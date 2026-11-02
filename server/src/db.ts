import { DatabaseSync } from 'node:sqlite';
import { env } from './env.ts';

export const db = new DatabaseSync(env.DATABASE_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    access_token_enc TEXT NOT NULL,
    institution_name TEXT NOT NULL,
    products TEXT NOT NULL,
    cursor TEXT,
    status TEXT NOT NULL DEFAULT 'ok',
    error TEXT,
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    mask TEXT,
    type TEXT NOT NULL,
    subtype TEXT,
    current_balance REAL,
    available_balance REAL,
    currency TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    merchant_name TEXT,
    logo_url TEXT,
    plaid_category TEXT NOT NULL,
    user_category TEXT,
    pending INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS transactions_date ON transactions(date);

  CREATE TABLE IF NOT EXISTS holdings (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    security_id TEXT NOT NULL,
    name TEXT NOT NULL,
    ticker TEXT,
    type TEXT,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    value REAL NOT NULL,
    cost_basis REAL,
    PRIMARY KEY (account_id, security_id)
  );

  CREATE TABLE IF NOT EXISTS recurring (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    name TEXT NOT NULL,
    merchant_name TEXT,
    category TEXT NOT NULL,
    frequency TEXT NOT NULL,
    average_amount REAL NOT NULL,
    last_amount REAL NOT NULL,
    last_date TEXT NOT NULL,
    next_date TEXT,
    is_active INTEGER NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS balance_snapshots (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    balance REAL NOT NULL,
    PRIMARY KEY (account_id, date)
  );

  CREATE TABLE IF NOT EXISTS budgets (
    category TEXT PRIMARY KEY,
    monthly_limit REAL NOT NULL
  );
`);

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
