import type { AccountBase, Holding, RemovedTransaction, Security, Transaction, TransactionStream } from 'plaid';
import type { Institution } from '@rocket/shared';
import { decrypt, encrypt } from './crypto.ts';
import { db, transaction } from './db.ts';
import { plaid, toPlaidError } from './plaid.ts';
import { getInstitution } from './queries.ts';

interface ItemRow {
  id: string;
  access_token_enc: string;
  cursor: string | null;
}

export async function linkItem(publicToken: string, institutionName: string): Promise<Institution> {
  const { data } = await plaid.itemPublicTokenExchange({ public_token: publicToken });
  db.prepare(
    `INSERT INTO items (id, access_token_enc, institution_name, products) VALUES (:id, :token, :name, '[]')
     ON CONFLICT(id) DO UPDATE SET access_token_enc = excluded.access_token_enc`,
  ).run({ id: data.item_id, token: encrypt(data.access_token), name: institutionName });
  return syncItem(data.item_id);
}

export function accessTokenFor(itemId: string): string {
  const row = db.prepare('SELECT access_token_enc FROM items WHERE id = ?').get(itemId) as
    | { access_token_enc: string }
    | undefined;
  if (!row) throw new NotFoundError(`Unknown item ${itemId}`);
  return decrypt(row.access_token_enc);
}

export async function removeItem(itemId: string): Promise<void> {
  try {
    await plaid.itemRemove({ access_token: accessTokenFor(itemId) });
  } catch (err) {
    const code = toPlaidError(err)?.code;
    if (code !== 'ITEM_NOT_FOUND' && code !== 'INVALID_ACCESS_TOKEN') throw err;
  }
  db.prepare('DELETE FROM items WHERE id = ?').run(itemId);
}

export async function syncAll(): Promise<Institution[]> {
  const ids = (db.prepare('SELECT id FROM items').all() as { id: string }[]).map((r) => r.id);
  return Promise.all(ids.map(syncItem));
}

/**
 * Fetches everything from Plaid first, then writes it in one DB transaction, so a
 * failed or interrupted sync never advances the transactions cursor past data it
 * didn't store. Rerunning is always safe.
 */
export async function syncItem(itemId: string): Promise<Institution> {
  const item = db.prepare('SELECT id, access_token_enc, cursor FROM items WHERE id = ?').get(itemId) as
    | ItemRow
    | undefined;
  if (!item) throw new NotFoundError(`Unknown item ${itemId}`);
  const accessToken = decrypt(item.access_token_enc);

  try {
    const { data: itemData } = await plaid.itemGet({ access_token: accessToken });
    const products = itemData.item.products ?? itemData.item.billed_products;
    const has = (p: string) => products.includes(p as never);

    const [accounts, txns, streams, holdings] = await Promise.all([
      plaid.accountsGet({ access_token: accessToken }).then((r) => r.data.accounts),
      has('transactions') ? fetchTransactions(accessToken, item.cursor) : null,
      has('transactions') ? fetchRecurring(accessToken) : null,
      has('investments') ? fetchHoldings(accessToken) : null,
    ]);

    transaction(() => {
      writeAccounts(itemId, accounts);
      if (txns) writeTransactions(itemId, txns);
      if (streams) writeRecurring(itemId, streams);
      if (holdings) writeHoldings(accounts, holdings);
      db.prepare(
        `UPDATE items SET products = :products, status = 'ok', error = NULL, last_synced_at = datetime('now')
         WHERE id = :id`,
      ).run({ id: itemId, products: JSON.stringify(products) });
    });
  } catch (err) {
    const plaidError = toPlaidError(err);
    if (!plaidError) throw err;
    db.prepare('UPDATE items SET status = :status, error = :error WHERE id = :id').run({
      id: itemId,
      status: plaidError.code === 'ITEM_LOGIN_REQUIRED' ? 'login_required' : 'error',
      error: plaidError.message,
    });
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

async function fetchTransactions(accessToken: string, startCursor: string | null): Promise<TransactionChanges> {
  restart: for (;;) {
    const changes: TransactionChanges = { added: [], modified: [], removed: [], cursor: startCursor ?? '' };
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
        if (toPlaidError(err)?.code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') continue restart;
        throw err;
      }
    }
  }
}

/** Recurring detection needs transaction history Plaid may still be pulling right after Link. */
async function fetchRecurring(accessToken: string): Promise<TransactionStream[] | null> {
  try {
    const { data } = await plaid.transactionsRecurringGet({ access_token: accessToken });
    return [...data.inflow_streams, ...data.outflow_streams];
  } catch (err) {
    if (toPlaidError(err)?.code === 'PRODUCT_NOT_READY') return null;
    throw err;
  }
}

async function fetchHoldings(accessToken: string): Promise<{ holdings: Holding[]; securities: Security[] }> {
  const { data } = await plaid.investmentsHoldingsGet({ access_token: accessToken });
  return { holdings: data.holdings, securities: data.securities };
}

const knownAccountTypes = new Set(['depository', 'credit', 'loan', 'investment']);

function writeAccounts(itemId: string, accounts: AccountBase[]) {
  const upsert = db.prepare(
    `INSERT INTO accounts (id, item_id, name, mask, type, subtype, current_balance, available_balance, currency)
     VALUES (:id, :itemId, :name, :mask, :type, :subtype, :current, :available, :currency)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, mask = excluded.mask, type = excluded.type,
       subtype = excluded.subtype, current_balance = excluded.current_balance,
       available_balance = excluded.available_balance, currency = excluded.currency`,
  );
  const snapshot = db.prepare(
    `INSERT INTO balance_snapshots (account_id, date, balance) VALUES (?, date('now'), ?)
     ON CONFLICT(account_id, date) DO UPDATE SET balance = excluded.balance`,
  );
  for (const a of accounts) {
    upsert.run({
      id: a.account_id,
      itemId,
      name: a.official_name ?? a.name,
      mask: a.mask,
      type: knownAccountTypes.has(a.type) ? a.type : 'other',
      subtype: a.subtype ?? null,
      current: a.balances.current,
      available: a.balances.available,
      currency: a.balances.iso_currency_code ?? 'USD',
    });
    if (a.balances.current != null) snapshot.run(a.account_id, a.balances.current);
  }
}

function writeTransactions(itemId: string, { added, modified, removed, cursor }: TransactionChanges) {
  const upsert = db.prepare(
    `INSERT INTO transactions (id, account_id, amount, currency, date, name, merchant_name, logo_url, plaid_category, pending)
     VALUES (:id, :accountId, :amount, :currency, :date, :name, :merchant, :logo, :category, :pending)
     ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, amount = excluded.amount,
       currency = excluded.currency, date = excluded.date, name = excluded.name,
       merchant_name = excluded.merchant_name, logo_url = excluded.logo_url,
       plaid_category = excluded.plaid_category, pending = excluded.pending`,
  );
  for (const t of [...added, ...modified]) {
    upsert.run({
      id: t.transaction_id,
      accountId: t.account_id,
      amount: t.amount,
      currency: t.iso_currency_code ?? 'USD',
      date: t.date,
      name: t.name,
      merchant: t.merchant_name ?? null,
      logo: t.logo_url ?? null,
      category: t.personal_finance_category?.primary ?? 'OTHER',
      pending: t.pending ? 1 : 0,
    });
  }
  const remove = db.prepare('DELETE FROM transactions WHERE id = ?');
  for (const r of removed) if (r.transaction_id) remove.run(r.transaction_id);
  db.prepare('UPDATE items SET cursor = ? WHERE id = ?').run(cursor, itemId);
}

function writeRecurring(itemId: string, streams: TransactionStream[]) {
  const upsert = db.prepare(
    `INSERT INTO recurring (id, item_id, account_id, direction, name, merchant_name, category, frequency,
       average_amount, last_amount, last_date, next_date, is_active)
     VALUES (:id, :itemId, :accountId, :direction, :name, :merchant, :category, :frequency,
       :average, :last, :lastDate, :nextDate, :active)
     ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, name = excluded.name,
       merchant_name = excluded.merchant_name, category = excluded.category, frequency = excluded.frequency,
       average_amount = excluded.average_amount, last_amount = excluded.last_amount,
       last_date = excluded.last_date, next_date = excluded.next_date, is_active = excluded.is_active`,
  );
  // Plaid reports inflow amounts as negative; store magnitudes and carry the sign in `direction`.
  for (const s of streams) {
    upsert.run({
      id: s.stream_id,
      itemId,
      accountId: s.account_id,
      direction: s.average_amount.amount! < 0 ? 'inflow' : 'outflow',
      name: s.description,
      merchant: s.merchant_name ?? null,
      category: s.personal_finance_category?.primary ?? 'OTHER',
      frequency: s.frequency,
      average: Math.abs(s.average_amount.amount ?? 0),
      last: Math.abs(s.last_amount.amount ?? 0),
      lastDate: s.last_date,
      nextDate: s.predicted_next_date ?? null,
      active: s.is_active ? 1 : 0,
    });
  }
  const ids = streams.map((s) => s.stream_id);
  db.prepare(
    `DELETE FROM recurring WHERE item_id = ? AND id NOT IN (SELECT value FROM json_each(?))`,
  ).run(itemId, JSON.stringify(ids));
}

function writeHoldings(accounts: AccountBase[], { holdings, securities }: { holdings: Holding[]; securities: Security[] }) {
  const securityById = new Map(securities.map((s) => [s.security_id, s]));
  const accountIds = JSON.stringify(accounts.map((a) => a.account_id));
  db.prepare('DELETE FROM holdings WHERE account_id IN (SELECT value FROM json_each(?))').run(accountIds);
  const insert = db.prepare(
    `INSERT INTO holdings (account_id, security_id, name, ticker, type, quantity, price, value, cost_basis)
     VALUES (:accountId, :securityId, :name, :ticker, :type, :quantity, :price, :value, :costBasis)`,
  );
  for (const h of holdings) {
    const security = securityById.get(h.security_id);
    insert.run({
      accountId: h.account_id,
      securityId: h.security_id,
      name: security?.name ?? 'Unknown security',
      ticker: security?.ticker_symbol ?? null,
      type: security?.type ?? null,
      quantity: h.quantity,
      price: h.institution_price,
      value: h.institution_value,
      costBasis: h.cost_basis ?? null,
    });
  }
}
