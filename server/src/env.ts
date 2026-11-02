import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

export const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));

try {
  process.loadEnvFile(path.join(ROOT_DIR, '.env'));
} catch {
  // No .env file: rely on the real environment.
}

const schema = z.object({
  PLAID_CLIENT_ID: z.string().min(1),
  PLAID_SECRET: z.string().min(1),
  PLAID_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  PLAID_REDIRECT_URI: z.url().optional().or(z.literal('').transform(() => undefined)),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'must be 32 bytes of hex (openssl rand -hex 32)'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_PATH: z.string().default('./rocket.db'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment. Copy .env.example to .env and fill it in.');
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  DATABASE_PATH: path.resolve(ROOT_DIR, parsed.data.DATABASE_PATH),
};
