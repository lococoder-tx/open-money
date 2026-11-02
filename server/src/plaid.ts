import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type LinkTokenCreateRequest,
} from 'plaid';
import type { LinkKind } from '@rocket/shared';
import { env } from './env.ts';

export const plaid = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
        'PLAID-SECRET': env.PLAID_SECRET,
      },
    },
  }),
);

const productsByKind: Record<LinkKind, Pick<LinkTokenCreateRequest, 'products' | 'optional_products'>> = {
  banking: { products: [Products.Transactions], optional_products: [Products.Investments] },
  investments: { products: [Products.Investments], optional_products: [Products.Transactions] },
};

/** `accessToken` puts Link in update mode to repair a broken login. */
export async function createLinkToken(
  target: { kind: LinkKind } | { accessToken: string },
): Promise<string> {
  const res = await plaid.linkTokenCreate({
    user: { client_user_id: 'local-user' },
    client_name: 'Rocket Clone',
    language: 'en',
    country_codes: [CountryCode.Us],
    redirect_uri: env.PLAID_REDIRECT_URI,
    transactions: { days_requested: 730 },
    ...('accessToken' in target ? { access_token: target.accessToken } : productsByKind[target.kind]),
  });
  return res.data.link_token;
}

export interface PlaidError {
  code: string;
  message: string;
}

export function toPlaidError(err: unknown): PlaidError | null {
  const data = (err as { response?: { data?: { error_code?: unknown; display_message?: unknown; error_message?: unknown } } })
    ?.response?.data;
  if (typeof data?.error_code !== 'string') return null;
  const message = [data.display_message, data.error_message].find((m) => typeof m === 'string');
  return { code: data.error_code, message: (message as string | undefined) ?? data.error_code };
}
