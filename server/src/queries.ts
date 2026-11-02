import {
  NON_SPENDING_CATEGORIES,
  type Account,
  type Budget,
  type CategoryAmount,
  type Holding,
  type Institution,
  type ItemStatus,
  type RecurringStream,
  type Summary,
  type TransactionPage,
} from '@rocket/shared';
import { db } from './db.ts';

const NON_SPENDING_SQL = `(${NON_SPENDING_CATEGORIES.map((c) => `'${c}'`).join(', ')})`;
const CATEGORY_SQL = 'COALESCE(t.user_category, t.plaid_category)';

export function listInstitutions(): Institution[] {
  const rows = db.prepare('SELECT * FROM items ORDER BY created_at').all() as Record<string, unknown>[];
  return rows.map(toInstitution);
}

export function getInstitution(itemId: string): Institution {
  return toInstitution(db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as Record<string, unknown>);
}

function toInstitution(r: Record<string, unknown>): Institution {
  return {
    itemId: r.id as string,
    name: r.institution_name as string,
    status: r.status as ItemStatus,
    error: r.error as string | null,
    products: JSON.parse(r.products as string),
    lastSyncedAt: r.last_synced_at as string | null,
  };
}

export function listAccounts(): Account[] {
  return db
    .prepare(
      `SELECT a.id, a.item_id AS itemId, i.institution_name AS institutionName, a.name, a.mask, a.type,
         a.subtype, a.current_balance AS currentBalance, a.available_balance AS availableBalance, a.currency
       FROM accounts a JOIN items i ON i.id = a.item_id
       ORDER BY i.institution_name, a.type, a.name`,
    )
    .all() as unknown as Account[];
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
  const where: string[] = [];
  const params: Record<string, string | number> = {};
  if (f.search) {
    where.push(`(t.name LIKE :search OR t.merchant_name LIKE :search)`);
    params.search = `%${f.search}%`;
  }
  if (f.category) {
    where.push(`${CATEGORY_SQL} = :category`);
    params.category = f.category;
  }
  if (f.accountId) {
    where.push('t.account_id = :accountId');
    params.accountId = f.accountId;
  }
  if (f.start) {
    where.push('t.date >= :start');
    params.start = f.start;
  }
  if (f.end) {
    where.push('t.date <= :end');
    params.end = f.end;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM transactions t ${whereSql}`).get(params) as {
    total: number;
  };
  const rows = db
    .prepare(
      `SELECT t.id, t.account_id AS accountId, a.name AS accountName, t.amount, t.currency, t.date, t.name,
         t.merchant_name AS merchantName, t.logo_url AS logoUrl, ${CATEGORY_SQL} AS category, t.pending
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       ${whereSql}
       ORDER BY t.date DESC, t.id
       LIMIT :limit OFFSET :offset`,
    )
    .all({ ...params, limit: f.limit, offset: f.offset }) as Record<string, unknown>[];

  return {
    total,
    transactions: rows.map((r) => ({ ...r, pending: r.pending === 1 })) as unknown as TransactionPage['transactions'],
  };
}

export function setTransactionCategory(id: string, category: string | null): boolean {
  return db.prepare('UPDATE transactions SET user_category = ? WHERE id = ?').run(category, id).changes > 0;
}

export function listCategories(): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT ${CATEGORY_SQL} AS category FROM transactions t
       UNION SELECT category FROM budgets ORDER BY category`,
    )
    .all() as { category: string }[];
  return rows.map((r) => r.category);
}

export function listHoldings(): Holding[] {
  return db
    .prepare(
      `SELECT h.account_id AS accountId, a.name AS accountName, h.security_id AS securityId, h.name, h.ticker,
         h.type, h.quantity, h.price, h.value, h.cost_basis AS costBasis
       FROM holdings h JOIN accounts a ON a.id = h.account_id
       ORDER BY h.value DESC`,
    )
    .all() as unknown as Holding[];
}

const RECURRING_SELECT = `
  SELECT id, account_id AS accountId, direction, name, merchant_name AS merchantName, category, frequency,
    average_amount AS averageAmount, last_amount AS lastAmount, last_date AS lastDate, next_date AS nextDate,
    is_active AS isActive, hidden
  FROM recurring`;

function toRecurring(r: Record<string, unknown>): RecurringStream {
  return { ...r, isActive: r.isActive === 1, hidden: r.hidden === 1 } as unknown as RecurringStream;
}

export function listRecurring(): RecurringStream[] {
  const rows = db.prepare(`${RECURRING_SELECT} ORDER BY is_active DESC, average_amount DESC`).all();
  return (rows as Record<string, unknown>[]).map(toRecurring);
}

export function setRecurringHidden(id: string, hidden: boolean): boolean {
  return db.prepare('UPDATE recurring SET hidden = ? WHERE id = ?').run(hidden ? 1 : 0, id).changes > 0;
}

function spendingByCategory(start: string, end: string): CategoryAmount[] {
  return db
    .prepare(
      `SELECT ${CATEGORY_SQL} AS category, SUM(t.amount) AS amount
       FROM transactions t
       WHERE t.date >= ? AND t.date < ? AND ${CATEGORY_SQL} NOT IN ${NON_SPENDING_SQL}
       GROUP BY 1 HAVING SUM(t.amount) > 0 ORDER BY 2 DESC`,
    )
    .all(start, end) as unknown as CategoryAmount[];
}

export function listBudgets(): Budget[] {
  const { start, end } = monthRange(0);
  const spent = new Map(spendingByCategory(start, end).map((c) => [c.category, c.amount]));
  const rows = db.prepare('SELECT category, monthly_limit AS monthlyLimit FROM budgets ORDER BY category').all() as {
    category: string;
    monthlyLimit: number;
  }[];
  return rows.map((b) => ({ ...b, spent: spent.get(b.category) ?? 0 }));
}

export function upsertBudget(category: string, monthlyLimit: number) {
  db.prepare(
    `INSERT INTO budgets (category, monthly_limit) VALUES (?, ?)
     ON CONFLICT(category) DO UPDATE SET monthly_limit = excluded.monthly_limit`,
  ).run(category, monthlyLimit);
}

export function deleteBudget(category: string) {
  db.prepare('DELETE FROM budgets WHERE category = ?').run(category);
}

const LIABILITY_TYPES = new Set(['credit', 'loan']);

export function getSummary(): Summary {
  let assets = 0;
  let liabilities = 0;
  for (const a of listAccounts()) {
    if (LIABILITY_TYPES.has(a.type)) liabilities += a.currentBalance ?? 0;
    else assets += a.currentBalance ?? 0;
  }

  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);
  const byCategory = spendingByCategory(thisMonth.start, thisMonth.end);
  const total = (cs: CategoryAmount[]) => cs.reduce((sum, c) => sum + c.amount, 0);
  const { income } = db
    .prepare(
      `SELECT COALESCE(-SUM(t.amount), 0) AS income FROM transactions t
       WHERE t.date >= ? AND t.date < ? AND ${CATEGORY_SQL} = 'INCOME'`,
    )
    .get(thisMonth.start, thisMonth.end) as { income: number };

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (
    db
      .prepare(
        `${RECURRING_SELECT} WHERE direction = 'outflow' AND is_active = 1 AND hidden = 0 AND next_date >= ?
         ORDER BY next_date LIMIT 6`,
      )
      .all(today) as Record<string, unknown>[]
  ).map(toRecurring);

  return {
    netWorth: assets - liabilities,
    assets,
    liabilities,
    monthSpending: total(byCategory),
    lastMonthSpending: total(spendingByCategory(lastMonth.start, lastMonth.end)),
    monthIncome: income,
    spendingByCategory: byCategory,
    netWorthHistory: netWorthHistory(),
    upcoming,
  };
}

/** Each date's net worth carries every account's most recent balance forward. */
function netWorthHistory(): Summary['netWorthHistory'] {
  const rows = db
    .prepare(
      `SELECT s.date, s.account_id AS accountId, s.balance, a.type FROM balance_snapshots s
       JOIN accounts a ON a.id = s.account_id ORDER BY s.date`,
    )
    .all() as { date: string; accountId: string; balance: number; type: string }[];
  const latest = new Map<string, number>();
  const history: Summary['netWorthHistory'] = [];
  for (const r of rows) {
    latest.set(r.accountId, LIABILITY_TYPES.has(r.type) ? -r.balance : r.balance);
    const value = [...latest.values()].reduce((a, b) => a + b, 0);
    if (history.at(-1)?.date === r.date) history.at(-1)!.value = value;
    else history.push({ date: r.date, value });
  }
  return history;
}

function monthRange(offset: number): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    start: fmt(new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1))),
    end: fmt(new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset + 1, 1))),
  };
}
