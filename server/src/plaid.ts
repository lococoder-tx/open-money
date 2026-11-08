import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type LinkTokenCreateRequest,
} from "plaid";
import type { LinkKind } from "@rocket/shared";
import { z } from "zod";
import { env } from "./env.ts";

export const plaid = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
        "PLAID-SECRET": env.PLAID_SECRET,
      },
    },
  }),
);

const productsByKind: Record<
  LinkKind,
  Pick<LinkTokenCreateRequest, "products" | "optional_products">
> = {
  banking: {
    products: [Products.Transactions],
    optional_products: [Products.Investments],
  },
  investments: {
    products: [Products.Investments],
    optional_products: [Products.Transactions],
  },
};

/** `accessToken` puts Link in update mode to repair a broken login. */
export async function createLinkToken(
  target: { kind: LinkKind } | { accessToken: string },
): Promise<string> {
  const res = await plaid.linkTokenCreate({
    user: { client_user_id: "local-user" },
    client_name: "Rocket Clone",
    language: "en",
    country_codes: [CountryCode.Us],
    redirect_uri: env.PLAID_REDIRECT_URI,
    transactions: { days_requested: 730 },
    ...("accessToken" in target
      ? { access_token: target.accessToken }
      : productsByKind[target.kind]),
  });
  return res.data.link_token;
}

export interface PlaidError {
  code: string;
  message: string;
}

const optionalMessage = z.string().nullish().catch(undefined);
const plaidErrorResponse = z.object({
  response: z.object({
    data: z.object({
      error_code: z.string(),
      display_message: optionalMessage,
      error_message: optionalMessage,
    }),
  }),
});

export function toPlaidError(err: unknown): PlaidError | null {
  const parsed = plaidErrorResponse.safeParse(err);
  if (!parsed.success) return null;
  const { error_code, display_message, error_message } =
    parsed.data.response.data;
  return {
    code: error_code,
    message: display_message ?? error_message ?? error_code,
  };
}
