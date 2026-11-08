# Dashboard

The dashboard at `/` greets the user and summarizes this month's spending against last month, recent transactions, top categories, balances grouped by account type, net worth, and upcoming recurring charges.

## Sub-features

- `dash-spend` shows the month's spend, the delta against last month, and a cumulative chart.
- `dash-recent` lists the 8 latest transactions with merchant logos and a See all link.
- `dash-categories` shows the top 5 categories as meters.
- `dash-accounts` shows collapsible groups of accounts, plus Net cash after Card balance.
- `dash-networth` shows the net worth value and a sparkline once there are 2 or more snapshots.
- `dash-upcoming` lists upcoming recurring charges and the 7-day total.
- `dash-empty` shows "Connect your first account" when no institution is linked.

## How to get to it (user POV)

- Open `/`.
- Choose `Dashboard` in the sidebar.

## Driving it with Playwright

Preconditions:

- The seeded DB is in place.
- For `dash-networth` and `dash-upcoming`, use `stubRichSummary(page)` from `fixtures.mjs`, because the seed has 1 snapshot and no recurring streams.

- **Load.** `page.goto(BASE_URL + "/")`, then wait for `getByText("Recent transactions")`. A level-1 heading reads Good morning, afternoon, or evening.
- **Expand groups.** Click each `summary` in the Accounts card. Each expands to list accounts with masks such as `••0000`.
- **See all.** Click `getByRole("link", { name: "See all" })`. The URL becomes `/transactions`.
- **Proof.** Screenshot the full page, or run `visual.mjs` and check the `dashboard*` shots.

## Gotchas

- The greeting depends on the clock. Fix it with `page.clock.setFixedTime` before comparing screenshots.
- The chart is Recharts SVG. Wait about 400 ms after load before screenshotting so ResponsiveContainer can measure.
- Server "today" comes from the real system clock, so the daily spending series changes at UTC midnight.
