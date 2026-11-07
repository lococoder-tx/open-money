import type {
  AccountBase,
  Holding,
  RemovedTransaction,
  Security,
  Transaction,
  TransactionStream,
} from "plaid";
import type { AccountType, Institution } from "@rocket/shared";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { decrypt, encrypt } from "./crypto.ts";
import { chunks, db, excluded } from "./db.ts";
import { plaid, toPlaidError } from "./plaid.ts";
import { getInstitution, today } from "./queries.ts";
import {
  accounts,
  balanceSnapshots,
  holdings,
  items,
  recurring,
  transactions,
} from "./schema.ts";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function linkItem(
  publicToken: string,
  institutionName: string,
): Promise<Institution> {
  const { data } = await plaid.itemPublicTokenExchange({
    public_token: publicToken,
  });
  const accessTokenEnc = encrypt(data.access_token);
  db.insert(items)
    .values({ id: data.item_id, accessTokenEnc, institutionName })
    .onConflictDoUpdate({ target: items.id, set: { accessTokenEnc } })
    .run();
  return syncItem(data.item_id);
}

function getItem(itemId: string) {
  const item = db.select().from(items).where(eq(items.id, itemId)).get();
  if (!item) throw new NotFoundError(`Unknown item ${itemId}`);
  return item;
}

export function accessTokenFor(itemId: string): string {
  return decrypt(getItem(itemId).accessTokenEnc);
}

export async function removeItem(itemId: string): Promise<void> {
  try {
    await plaid.itemRemove({ access_token: accessTokenFor(itemId) });
  } catch (err) {
    const code = toPlaidError(err)?.code;
    if (code !== "ITEM_NOT_FOUND" && code !== "INVALID_ACCESS_TOKEN") throw err;
  }
  db.delete(items).where(eq(items.id, itemId)).run();
}

export async function syncAll(): Promise<Institution[]> {
  const ids = db.select({ id: items.id }).from(items).all();
  return Promise.all(ids.map((r) => syncItem(r.id)));
}

/**
 * Fetches everything from Plaid first, then writes it in one DB transaction, so a
 * failed or interrupted sync never advances the transactions cursor past data it
 * didn't store. Rerunning is always safe.
 */
export async function syncItem(itemId: string): Promise<Institution> {
  const item = getItem(itemId);
  const accessToken = decrypt(item.accessTokenEnc);

  try {
    const { data: itemData } = await plaid.itemGet({
      access_token: accessToken,
    });
    const products: string[] =
      itemData.item.products ?? itemData.item.billed_products;
    const has = (p: string) => products.includes(p);

    const [plaidAccounts, txns, streams, investments] = await Promise.all([
      plaid
        .accountsGet({ access_token: accessToken })
        .then((r) => r.data.accounts),
      has("transactions") ? fetchTransactions(accessToken, item.cursor) : null,
      has("transactions") ? fetchRecurring(accessToken) : null,
      has("investments") ? fetchHoldings(accessToken) : null,
    ]);

    db.transaction((tx) => {
      writeAccounts(tx, itemId, plaidAccounts);
      if (txns) writeTransactions(tx, itemId, txns);
      if (streams) writeRecurring(tx, itemId, streams);
      if (investments) writeHoldings(tx, plaidAccounts, investments);
      tx.update(items)
        .set({
          products,
          status: "ok",
          error: null,
          lastSyncedAt: new Date().toISOString(),
        })
        .where(eq(items.id, itemId))
        .run();
    });
  } catch (err) {
    const plaidError = toPlaidError(err);
    if (!plaidError) throw err;
    db.update(items)
      .set({
        status:
          plaidError.code === "ITEM_LOGIN_REQUIRED"
            ? "login_required"
            : "error",
        error: plaidError.message,
      })
      .where(eq(items.id, itemId))
      .run();
  }
  return getInstitution(itemId);
}

export class NotFoundError extends Error {}

interface TransactionChanges {
  added: Transaction[];
  modified: Transaction[];
  removed: RemovedTransaction[];
  cursor: string;
}

async function fetchTransactions(
  accessToken: string,
  startCursor: string | null,
): Promise<TransactionChanges> {
  restart: for (;;) {
    const changes: TransactionChanges = {
      added: [],
      modified: [],
      removed: [],
      cursor: startCursor ?? "",
    };
    for (;;) {
      try {
        const { data } = await plaid.transactionsSync({
          access_token: accessToken,
          cursor: changes.cursor || undefined,
          count: 500,
        });
        changes.added.push(...data.added);
        changes.modified.push(...data.modified);
        changes.removed.push(...data.removed);
        changes.cursor = data.next_cursor;
        if (!data.has_more) return changes;
      } catch (err) {
        if (
          toPlaidError(err)?.code ===
          "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"
        )
          continue restart;
        throw err;
      }
    }
  }
}

/** Recurring detection needs transaction history Plaid may still be pulling right after Link. */
async function fetchRecurring(
  accessToken: string,
): Promise<TransactionStream[] | null> {
  try {
    const { data } = await plaid.transactionsRecurringGet({
      access_token: accessToken,
    });
    return [...data.inflow_streams, ...data.outflow_streams];
  } catch (err) {
    if (toPlaidError(err)?.code === "PRODUCT_NOT_READY") return null;
    throw err;
  }
}

async function fetchHoldings(
  accessToken: string,
): Promise<{ holdings: Holding[]; securities: Security[] }> {
  const { data } = await plaid.investmentsHoldingsGet({
    access_token: accessToken,
  });
  return { holdings: data.holdings, securities: data.securities };
}

const knownAccountTypes = new Set<string>([
  "depository",
  "credit",
  "loan",
  "investment",
]);

function writeAccounts(tx: Tx, itemId: string, plaidAccounts: AccountBase[]) {
  if (plaidAccounts.length === 0) return;
  tx.insert(accounts)
    .values(
      plaidAccounts.map((a) => ({
        id: a.account_id,
        itemId,
        name: a.official_name ?? a.name,
        mask: a.mask,
        type: (knownAccountTypes.has(a.type) ? a.type : "other") as AccountType,
        subtype: a.subtype ?? null,
        currentBalance: a.balances.current,
        availableBalance: a.balances.available,
        currency: a.balances.iso_currency_code ?? "USD",
      })),
    )
    .onConflictDoUpdate({
      target: accounts.id,
      set: excluded(accounts, [
        "name",
        "mask",
        "type",
        "subtype",
        "currentBalance",
        "availableBalance",
        "currency",
      ]),
    })
    .run();

  const snapshots = plaidAccounts.flatMap((a) =>
    a.balances.current == null
      ? []
      : [
          {
            accountId: a.account_id,
            date: today(),
            balance: a.balances.current,
          },
        ],
  );
  if (snapshots.length === 0) return;
  tx.insert(balanceSnapshots)
    .values(snapshots)
    .onConflictDoUpdate({
      target: [balanceSnapshots.accountId, balanceSnapshots.date],
      set: excluded(balanceSnapshots, ["balance"]),
    })
    .run();
}

function writeTransactions(
  tx: Tx,
  itemId: string,
  { added, modified, removed, cursor }: TransactionChanges,
) {
  const rows = [...added, ...modified].map((t) => ({
    id: t.transaction_id,
    accountId: t.account_id,
    amount: t.amount,
    currency: t.iso_currency_code ?? "USD",
    date: t.date,
    name: t.name,
    merchantName: t.merchant_name ?? null,
    logoUrl: t.logo_url ?? null,
    plaidCategory: t.personal_finance_category?.primary ?? "OTHER",
    pending: t.pending,
  }));
  for (const chunk of chunks(rows)) {
    tx.insert(transactions)
      .values(chunk)
      .onConflictDoUpdate({
        target: transactions.id,
        set: excluded(transactions, [
          "accountId",
          "amount",
          "currency",
          "date",
          "name",
          "merchantName",
          "logoUrl",
          "plaidCategory",
          "pending",
        ]),
      })
      .run();
  }
  const removedIds = removed.flatMap((r) =>
    r.transaction_id ? [r.transaction_id] : [],
  );
  for (const chunk of chunks(removedIds)) {
    tx.delete(transactions).where(inArray(transactions.id, chunk)).run();
  }
  tx.update(items).set({ cursor }).where(eq(items.id, itemId)).run();
}

function writeRecurring(tx: Tx, itemId: string, streams: TransactionStream[]) {
  // Plaid reports inflow amounts as negative; store magnitudes and carry the sign in `direction`.
  const rows = streams.map((s) => ({
    id: s.stream_id,
    itemId,
    accountId: s.account_id,
    direction: (s.average_amount.amount! < 0 ? "inflow" : "outflow") as
      "inflow" | "outflow",
    name: s.description,
    merchantName: s.merchant_name ?? null,
    category: s.personal_finance_category?.primary ?? "OTHER",
    frequency: s.frequency,
    averageAmount: Math.abs(s.average_amount.amount ?? 0),
    lastAmount: Math.abs(s.last_amount.amount ?? 0),
    lastDate: s.last_date,
    nextDate: s.predicted_next_date ?? null,
    isActive: s.is_active,
  }));
  for (const chunk of chunks(rows)) {
    tx.insert(recurring)
      .values(chunk)
      .onConflictDoUpdate({
        target: recurring.id,
        set: excluded(recurring, [
          "accountId",
          "name",
          "merchantName",
          "category",
          "frequency",
          "averageAmount",
          "lastAmount",
          "lastDate",
          "nextDate",
          "isActive",
        ]),
      })
      .run();
  }
  tx.delete(recurring)
    .where(
      and(
        eq(recurring.itemId, itemId),
        notInArray(
          recurring.id,
          rows.map((r) => r.id),
        ),
      ),
    )
    .run();
}

function writeHoldings(
  tx: Tx,
  plaidAccounts: AccountBase[],
  {
    holdings: plaidHoldings,
    securities,
  }: { holdings: Holding[]; securities: Security[] },
) {
  const securityById = new Map(securities.map((s) => [s.security_id, s]));
  tx.delete(holdings)
    .where(
      inArray(
        holdings.accountId,
        plaidAccounts.map((a) => a.account_id),
      ),
    )
    .run();
  const rows = plaidHoldings.map((h) => {
    const security = securityById.get(h.security_id);
    return {
      accountId: h.account_id,
      securityId: h.security_id,
      name: security?.name ?? "Unknown security",
      ticker: security?.ticker_symbol ?? null,
      type: security?.type ?? null,
      quantity: h.quantity,
      price: h.institution_price,
      value: h.institution_value,
      costBasis: h.cost_basis ?? null,
    };
  });
  for (const chunk of chunks(rows)) tx.insert(holdings).values(chunk).run();
}
