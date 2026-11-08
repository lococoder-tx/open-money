import {
  NON_SPENDING_CATEGORIES,
  type Account,
  type AccountType,
  type Budget,
  type CategoryAmount,
  type Holding,
  type Institution,
  type RecurringStream,
  type Summary,
  type TransactionPage,
} from "@rocket/shared";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  like,
  lt,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { db } from "./db.ts";
import {
  accounts,
  balanceSnapshots,
  budgets,
  holdings,
  items,
  recurring,
  transactions,
} from "./schema.ts";

const category = sql<string>`coalesce(${transactions.userCategory}, ${transactions.plaidCategory})`;

const institutionFields = {
  itemId: items.id,
  name: items.institutionName,
  status: items.status,
  error: items.error,
  products: items.products,
  lastSyncedAt: items.lastSyncedAt,
};

export function listInstitutions(): Institution[] {
  return db
    .select(institutionFields)
    .from(items)
    .orderBy(items.createdAt)
    .all();
}

export function getInstitution(itemId: string): Institution {
  return db
    .select(institutionFields)
    .from(items)
    .where(eq(items.id, itemId))
    .get()!;
}

export function listAccounts(): Account[] {
  return db
    .select({
      id: accounts.id,
      itemId: accounts.itemId,
      institutionName: items.institutionName,
      name: accounts.name,
      mask: accounts.mask,
      type: accounts.type,
      subtype: accounts.subtype,
      currentBalance: accounts.currentBalance,
      availableBalance: accounts.availableBalance,
      currency: accounts.currency,
    })
    .from(accounts)
    .innerJoin(items, eq(items.id, accounts.itemId))
    .orderBy(items.institutionName, accounts.type, accounts.name)
    .all();
}

export interface TransactionFilter {
  search?: string;
  category?: string;
  accountId?: string;
  start?: string;
  end?: string;
  limit: number;
  offset: number;
}

export function listTransactions(f: TransactionFilter): TransactionPage {
  const where = and(
    f.search
      ? or(
          like(transactions.name, `%${f.search}%`),
          like(transactions.merchantName, `%${f.search}%`),
        )
      : undefined,
    f.category ? eq(category, f.category) : undefined,
    f.accountId ? eq(transactions.accountId, f.accountId) : undefined,
    f.start ? gte(transactions.date, f.start) : undefined,
    f.end ? lte(transactions.date, f.end) : undefined,
  );

  const { total } = db
    .select({ total: count() })
    .from(transactions)
    .where(where)
    .get()!;
  const rows = db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      accountName: accounts.name,
      amount: transactions.amount,
      currency: transactions.currency,
      date: transactions.date,
      name: transactions.name,
      merchantName: transactions.merchantName,
      logoUrl: transactions.logoUrl,
      category,
      pending: transactions.pending,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(where)
    .orderBy(desc(transactions.date), transactions.id)
    .limit(f.limit)
    .offset(f.offset)
    .all();

  return { total, transactions: rows };
}

export function setTransactionCategory(
  id: string,
  userCategory: string | null,
): boolean {
  return (
    db
      .update(transactions)
      .set({ userCategory })
      .where(eq(transactions.id, id))
      .run().changes > 0
  );
}

export function listCategories(): string[] {
  const used = db.selectDistinct({ category }).from(transactions).all();
  const budgeted = db
    .select({ category: budgets.category })
    .from(budgets)
    .all();
  return [...new Set([...used, ...budgeted].map((r) => r.category))].sort();
}

export function listHoldings(): Holding[] {
  return db
    .select({
      accountId: holdings.accountId,
      accountName: accounts.name,
      securityId: holdings.securityId,
      name: holdings.name,
      ticker: holdings.ticker,
      type: holdings.type,
      quantity: holdings.quantity,
      price: holdings.price,
      value: holdings.value,
      costBasis: holdings.costBasis,
    })
    .from(holdings)
    .innerJoin(accounts, eq(accounts.id, holdings.accountId))
    .orderBy(desc(holdings.value))
    .all();
}

const recurringFields = {
  id: recurring.id,
  accountId: recurring.accountId,
  direction: recurring.direction,
  name: recurring.name,
  merchantName: recurring.merchantName,
  category: recurring.category,
  frequency: recurring.frequency,
  averageAmount: recurring.averageAmount,
  lastAmount: recurring.lastAmount,
  lastDate: recurring.lastDate,
  nextDate: recurring.nextDate,
  isActive: recurring.isActive,
  hidden: recurring.hidden,
};

export function listRecurring(): RecurringStream[] {
  return db
    .select(recurringFields)
    .from(recurring)
    .orderBy(desc(recurring.isActive), desc(recurring.averageAmount))
    .all();
}

export function setRecurringHidden(id: string, hidden: boolean): boolean {
  return (
    db.update(recurring).set({ hidden }).where(eq(recurring.id, id)).run()
      .changes > 0
  );
}

interface DateRange {
  start: string;
  end: string;
}

function spendingByCategory({ start, end }: DateRange): CategoryAmount[] {
  const amount = sql<number>`sum(${transactions.amount})`;
  return db
    .select({ category, amount })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, start),
        lt(transactions.date, end),
        notInArray(category, NON_SPENDING_CATEGORIES),
      ),
    )
    .groupBy(category)
    .having(sql`${amount} > 0`)
    .orderBy(desc(amount))
    .all();
}

function dailySpending({ start, end }: DateRange): number[] {
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  const totals = Array<number>(days).fill(0);
  const rows = db
    .select({
      date: transactions.date,
      amount: sql<number>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, start),
        lt(transactions.date, end),
        notInArray(category, NON_SPENDING_CATEGORIES),
        gt(transactions.amount, 0),
      ),
    )
    .groupBy(transactions.date)
    .all();
  for (const r of rows) totals[Number(r.date.slice(8)) - 1] = r.amount;
  return totals;
}

export function listBudgets(): Budget[] {
  const spent = new Map(
    spendingByCategory(monthRange(0)).map((c) => [c.category, c.amount]),
  );
  return db
    .select()
    .from(budgets)
    .orderBy(budgets.category)
    .all()
    .map((b) => ({ ...b, spent: spent.get(b.category) ?? 0 }));
}

export function upsertBudget(category: string, monthlyLimit: number) {
  db.insert(budgets)
    .values({ category, monthlyLimit })
    .onConflictDoUpdate({ target: budgets.category, set: { monthlyLimit } })
    .run();
}

export function deleteBudget(category: string) {
  db.delete(budgets).where(eq(budgets.category, category)).run();
}

const LIABILITY_TYPES: ReadonlySet<AccountType> = new Set(["credit", "loan"]);

export function getSummary(): Summary {
  let assets = 0;
  let liabilities = 0;
  for (const a of listAccounts()) {
    if (LIABILITY_TYPES.has(a.type)) liabilities += a.currentBalance ?? 0;
    else assets += a.currentBalance ?? 0;
  }

  const thisMonth = monthRange(0);
  const upcoming = db
    .select(recurringFields)
    .from(recurring)
    .where(
      and(
        eq(recurring.direction, "outflow"),
        eq(recurring.isActive, true),
        eq(recurring.hidden, false),
        gte(recurring.nextDate, today()),
      ),
    )
    .orderBy(asc(recurring.nextDate))
    .limit(6)
    .all();

  return {
    netWorth: assets - liabilities,
    assets,
    liabilities,
    dailySpending: {
      thisMonth: dailySpending(thisMonth).slice(0, Number(today().slice(8))),
      lastMonth: dailySpending(monthRange(-1)),
    },
    spendingByCategory: spendingByCategory(thisMonth),
    netWorthHistory: netWorthHistory(),
    upcoming,
    recentTransactions: listTransactions({ limit: 8, offset: 0 })
      .transactions,
  };
}

/** Each date's net worth carries every account's most recent balance forward. */
function netWorthHistory(): Summary["netWorthHistory"] {
  const rows = db
    .select({
      date: balanceSnapshots.date,
      accountId: balanceSnapshots.accountId,
      balance: balanceSnapshots.balance,
      type: accounts.type,
    })
    .from(balanceSnapshots)
    .innerJoin(accounts, eq(accounts.id, balanceSnapshots.accountId))
    .orderBy(balanceSnapshots.date)
    .all();
  const latest = new Map<string, number>();
  const history: Summary["netWorthHistory"] = [];
  for (const r of rows) {
    latest.set(
      r.accountId,
      LIABILITY_TYPES.has(r.type) ? -r.balance : r.balance,
    );
    const value = [...latest.values()].reduce((a, b) => a + b, 0);
    const last = history.at(-1);
    if (last?.date === r.date) last.value = value;
    else history.push({ date: r.date, value });
  }
  return history;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function today(): string {
  return isoDate(new Date());
}

function monthRange(offset: number): DateRange {
  const now = new Date();
  const monthStart = (month: number) =>
    isoDate(new Date(Date.UTC(now.getFullYear(), month, 1)));
  return {
    start: monthStart(now.getMonth() + offset),
    end: monthStart(now.getMonth() + offset + 1),
  };
}
