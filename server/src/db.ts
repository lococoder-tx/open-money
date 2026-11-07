import Database from "better-sqlite3";
import { getTableColumns, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { toSnakeCase } from "drizzle-orm/casing";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { fileURLToPath } from "node:url";
import { env } from "./env.ts";
import * as schema from "./schema.ts";

const sqlite = new Database(env.DATABASE_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle({ client: sqlite, schema, casing: "snake_case" });

migrate(db, {
  migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
});

/** `ON CONFLICT DO UPDATE SET col = excluded.col` for each named column. */
export function excluded<T extends SQLiteTable>(
  table: T,
  keys: (keyof T["$inferInsert"] & string)[],
): Record<string, SQL> {
  const columns = getTableColumns(table);
  return Object.fromEntries(
    keys.map((k) => {
      const col = columns[k]!;
      const name = col.keyAsName ? toSnakeCase(col.name) : col.name;
      return [k, sql.raw(`excluded.${name}`)];
    }),
  );
}

/** SQLite caps bound parameters per statement, so bulk inserts go in slices. */
export function chunks<T>(rows: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
