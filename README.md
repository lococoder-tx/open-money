# Rocket Clone

A personal finance dashboard in the style of Rocket Money. It connects bank, credit card, brokerage, and retirement accounts through Plaid, then shows net worth, spending by category, subscriptions, budgets, and investment holdings.

TypeScript across the stack:

- `shared/` holds the API types that both sides import.
- `server/` is Express 5 with the Plaid Node SDK and SQLite (Node's built-in `node:sqlite`). Plaid access tokens are encrypted with AES-256-GCM before they are stored.
- `web/` is React 19 with Vite, React Router, Recharts, and `react-plaid-link`.

## Setup

1. Get API keys from the [Plaid dashboard](https://dashboard.plaid.com/developers/keys).
2. Copy `.env.example` to `.env`. Fill in `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `ENCRYPTION_KEY` (`openssl rand -hex 32`).
3. Add `http://localhost:5173/oauth` under **Allowed redirect URIs** in the Plaid dashboard.
4. Run:

   ```sh
   npm install
   npm run dev
   ```

5. Open http://localhost:5173. In sandbox mode, sign in to any institution with `user_good` / `pass_good`.

For production, run `npm run build && npm start` and open http://127.0.0.1:3001.

## Connecting accounts

There are two connect buttons, because Plaid only shows institutions that support every *required* product:

| Button | Required | Optional | Use for |
| --- | --- | --- | --- |
| Bank or card | `transactions` | `investments` | Checking, savings, credit cards, Fidelity cash management |
| Investments | `investments` | `transactions` | Fidelity brokerage, Principal 401(k), IRAs |

Fidelity and most large banks use OAuth. Link sends you to the institution and then back to `/oauth`, which finishes the connection. When a login expires, the account shows **Reconnect**, which opens Link in update mode.

Real Fidelity and Principal data needs Plaid **production** access. Request it in the dashboard, then set `PLAID_ENV=production` and use an `https` redirect URI.

## How sync works

**Sync** (one institution) or **Sync all** pulls these for each connection:

- Account balances, plus a daily balance snapshot that builds the net worth chart.
- Transactions through `/transactions/sync`, using a stored cursor.
- Recurring streams through `/transactions/recurring/get`. These feed Recurring and Upcoming bills.
- Holdings through `/investments/holdings/get`.

All Plaid data is fetched first and then written in one database transaction. A failed sync never moves the cursor past data that was not stored, so retrying is always safe.

Spending leaves out `INCOME`, `TRANSFER_IN`, `TRANSFER_OUT`, and `LOAN_PAYMENTS`, so credit card payments and transfers between your own accounts don't count twice.

## Limitations

- There is one user and no login. The server listens only on 127.0.0.1. Add authentication before you expose it anywhere.
- Sync is manual. There are no Plaid webhooks yet.
