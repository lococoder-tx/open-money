import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import {
  ACCOUNT_TYPES,
  ITEM_STATUSES,
  RECURRING_DIRECTIONS,
  RECURRING_FREQUENCIES,
} from "@rocket/shared";

export const items = sqliteTable("items", {
  id: text().primaryKey(),
  accessTokenEnc: text().notNull(),
  institutionName: text().notNull(),
  products: text({ mode: "json" }).$type<string[]>().notNull().default([]),
  cursor: text(),
  status: text({ enum: ITEM_STATUSES }).notNull().default("ok"),
  error: text(),
  lastSyncedAt: text(),
  createdAt: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const accounts = sqliteTable("accounts", {
  id: text().primaryKey(),
  itemId: text()
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  name: text().notNull(),
  mask: text(),
  type: text({ enum: ACCOUNT_TYPES }).notNull(),
  subtype: text(),
  currentBalance: real(),
  availableBalance: real(),
  currency: text().notNull(),
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: text().primaryKey(),
    accountId: text()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    amount: real().notNull(),
    currency: text().notNull(),
    date: text().notNull(),
    name: text().notNull(),
    merchantName: text(),
    logoUrl: text(),
    plaidCategory: text().notNull(),
    userCategory: text(),
    pending: integer({ mode: "boolean" }).notNull(),
  },
  (t) => [index("transactions_date").on(t.date)],
);

export const holdings = sqliteTable(
  "holdings",
  {
    accountId: text()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    securityId: text().notNull(),
    name: text().notNull(),
    ticker: text(),
    type: text(),
    quantity: real().notNull(),
    price: real().notNull(),
    value: real().notNull(),
    costBasis: real(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.securityId] })],
);

export const recurring = sqliteTable("recurring", {
  id: text().primaryKey(),
  itemId: text()
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  accountId: text().notNull(),
  direction: text({ enum: RECURRING_DIRECTIONS }).notNull(),
  name: text().notNull(),
  merchantName: text(),
  category: text().notNull(),
  frequency: text({ enum: RECURRING_FREQUENCIES }).notNull(),
  averageAmount: real().notNull(),
  lastAmount: real().notNull(),
  lastDate: text().notNull(),
  nextDate: text(),
  isActive: integer({ mode: "boolean" }).notNull(),
  hidden: integer({ mode: "boolean" }).notNull().default(false),
});

export const balanceSnapshots = sqliteTable(
  "balance_snapshots",
  {
    accountId: text()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    date: text().notNull(),
    balance: real().notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.date] })],
);

export const budgets = sqliteTable("budgets", {
  category: text().primaryKey(),
  monthlyLimit: real().notNull(),
});
