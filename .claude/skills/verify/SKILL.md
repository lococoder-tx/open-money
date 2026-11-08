---
name: verify
description: Launch and drive the Rocket Clone personal-finance web app (React + TanStack Router/Query + Tailwind, Express + SQLite API) in an isolated instance, then prove UI behavior with Playwright and pixel-diff screenshots. Use to confirm a frontend or API change works in the real app, to check for visual regressions, or before claiming a UI change is done.
---

# Verify Rocket Clone

The user-facing surface is the web app in `web/`, served by Vite and proxying `/api` to the Express server in `server/`. Every recipe drives that browser surface. Plaid Link (connecting a bank) opens Plaid's hosted iframe and cannot be driven headless, so it is out of scope.

All paths below are relative to the repo root. Helpers live in `.claude/skills/verify/scripts/`.

## Launch

```sh
eval "$(.claude/skills/verify/scripts/launch.sh)"
```

This starts the API on `API_PORT` (default 3102) and Vite on `WEB_PORT` (default 5182). The run gets its own SQLite file at `$RUN_DIR/rocket.db`, a `.backup` copy of the repo's `rocket.db` when one exists, so a run never writes the developer's data. The server applies pending migrations on start. Launch prints the variables to export and exits 0 once `/api/institutions` answers through the Vite proxy and `/` serves the app shell. It refuses to start if either port is taken. The developer's own `npm run dev` usually holds 3001 and 5173, so never point a run at those.

No `.env` is required. Launch fills placeholder Plaid credentials and an encryption key when they are unset. Reads and local writes work with placeholders; Sync and Connect call Plaid and fail.

Without a repo `rocket.db`, the app starts empty and the dashboard shows "Connect your first account". Journeys that need data then fail with that reason. Do not weaken them.

## Doctor

```sh
.claude/skills/verify/scripts/doctor.sh
```

Read-only. It checks that both processes from this run are alive, that each port belongs to this run's process tree, that the API answers through the proxy, and that the served entry is the TanStack Router build. It prints the git revision (with `+dirty`) and the transaction count in the run's DB. Run it first whenever anything looks off. A FAIL line means relaunch, not drive.

## Drive

Two committed Playwright scripts drive the real UI. Both read `BASE_URL`.

```sh
node web/scripts/behavior.mjs
node web/scripts/visual.mjs capture .verify-artifacts/$RUN_ID/after
node web/scripts/visual.mjs diff <baselineDir> .verify-artifacts/$RUN_ID/after
```

- `behavior.mjs` runs 12 user journeys and prints PASS or FAIL per journey. It stubs every non-GET `/api` request with a 204 so it never mutates data or calls Plaid, and it asserts the follow-up GET refetches the UI makes.
- `visual.mjs capture` screenshots 12 states (7 routes, 2 hover states, 3 fixture-backed states for data the seed DB lacks) in light and dark at 1280 and 600 px wide, 48 PNGs in all. The browser clock is fixed to 2026-11-07 10:00 so the greeting is stable.
- `visual.mjs diff` exits 1 on any pixel more than 2 color units off and writes red-marked diff images to `<candidateDir>/_diff/`. A baseline must come from the code before your change. Capture it from a checkout of the base commit, launched on other ports. Check that it really is the old code, by a DOM difference only the old version has, before trusting a clean diff.
- `web/scripts/fixtures.mjs` holds the stub data and `stubJson(page, path, body)` for ad hoc journeys.

For an ad hoc journey, write a short Playwright script against `BASE_URL`. Use these stable handles:

- Sidebar links are `page.locator("aside").getByRole("link", { name: "Transactions", exact: true })`. The active link has background `rgb(232, 65, 79)`.
- `Sync all` is `getByRole("button", { name: /Sync all/ })`.
- Page headings are `getByRole("heading", { level: 1 })`.
- Transactions search is `getByPlaceholder("Search merchant or description")`. The first two `select`s on the page are the category and account filters. Each table row has its own category `select`.
- The budget form is `form select`, `getByPlaceholder("Monthly limit")`, and `getByRole("button", { name: "Save budget" })`.

The feature map in `features/` gives the recipe per feature.

## Evidence

Put every artifact under `.verify-artifacts/$RUN_ID/`, which git ignores. Save the screenshots, `_diff/` images, and script output there. Tee `behavior.mjs` output with `| tee .verify-artifacts/$RUN_ID/behavior.txt`.

- Drive the real user path, meaning clicks, typing, and URL navigation. Never call internal setters or seed state through the console.
- Capture the action and the resulting state. Record the request the UI sent (`page.on("request")`) as well as what it rendered.
- For a mutation you let through (no 204 stub), confirm the side effect with a second read, such as `sqlite3 "$RUN_DIR/rocket.db" "select * from budgets"` or a fresh page load.
- Stubs are allowed only at the `/api` boundary and only for Plaid-backed or destructive calls. Say which requests a proof stubbed.

## Cleanup

```sh
.claude/skills/verify/scripts/cleanup.sh
```

It kills the process trees whose PIDs launch recorded, never by name, and deletes `$RUN_DIR` with its disposable DB. It leaves `.verify-artifacts/` alone. Run it after every failed attempt too.
