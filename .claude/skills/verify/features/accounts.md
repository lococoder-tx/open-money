# Accounts and sync

The accounts page at `/accounts` lists each connected institution with its accounts and balances. It offers per-institution Sync, Remove, and Reconnect (when login is required), plus buttons to connect new banks or brokerages. `Sync all` in the sidebar syncs everything from any page.

## Sub-features

- `acct-list` shows institution cards with the last sync time, products, and an account table.
- `acct-sync` sends a POST to `/institutions/:id/sync`, and the institutions and accounts refetch.
- `acct-remove` asks for confirmation, sends a DELETE, and the card disappears.
- `acct-sync-all` sends a POST to `/sync` from the sidebar, and every visible query refetches.
- `acct-connect` opens Plaid Link. It is out of scope headless.

## How to get to it (user POV)

- Choose `Accounts` in the sidebar.
- Choose `Manage` on the dashboard's Accounts card.

## Driving it with Playwright

Preconditions:

- The seeded DB has Tartan Bank.
- Plaid placeholders mean real syncs fail. Stub `POST` with a 204 to test the UI wiring.

- **Load.** Go to `/accounts` and wait for `locator("section h2")`. One card reads Tartan Bank with 14 account rows.
- **Sync.** Click `getByRole("button", { name: "Sync", exact: true })`. A POST goes out, followed by `GET /api/institutions` and `GET /api/accounts`.
- **Sync all.** Click `getByRole("button", { name: /Sync all/ })` on any page. The page's GETs repeat, such as `/api/summary` on the dashboard.
- **Remove.** Register `page.on("dialog", d => d.accept())` and stub the DELETE, then click `Remove`. The DELETE goes out and the list refetches.
- **Proof.** Save the request log and screenshots.

## Gotchas

- Never let the DELETE through on the run DB unless the journey reseeds after. It wipes the institution's accounts and history.
- Opening `/oauth` with no link in flight redirects straight to `/accounts`, because Plaid init fails and fires onExit. That is existing behavior.
- A real sync with real sandbox keys changes the data and breaks screenshot baselines.
