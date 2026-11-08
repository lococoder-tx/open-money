# Rocket Clone verification map

This directory is the maintained source for verifying what a Rocket Clone user can do in the browser. Read the index, then use the matching feature file as the recipe.

## Baseline preconditions

- An instance started by `.claude/skills/verify/scripts/launch.sh` with its printed variables exported.
- `doctor.sh` reports no FAIL lines.
- The run DB is seeded from the repo `rocket.db`, which has 1 institution (Tartan Bank), 14 accounts, about 18 transactions, and holdings. It has no budgets, no recurring streams, and one net-worth snapshot.
- Never drive the developer's own instance on ports 3001 or 5173.

## Driving conventions

- Use Playwright from `web/` (`import { chromium } from "playwright"`), pointed at `BASE_URL`.
- Prefer roles, accessible names, and placeholders over CSS classes. Tailwind class strings are not stable handles.
- Stub only non-GET `/api` calls, and only when the real call would hit Plaid or destroy seed data. `web/scripts/behavior.mjs` shows the pattern.
- Use `stubJson` from `web/scripts/fixtures.mjs` when a journey needs data the seed lacks, and say so in the proof.

## Proof and skip reporting

- Record the user action, the request it caused, and the rendered result.
- A let-through mutation needs a second read, from the DB or a reload.
- Put artifacts in `.verify-artifacts/$RUN_ID/<feature>/`.
- When a precondition is missing, report the journey as failed with the reason. Don't report it as verified through another path.

## Feature entry contract

Each feature file has an H1 and a paragraph, then four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with Playwright`, and `Gotchas`.

## Features

- [Dashboard](./dashboard.md) covers the spending chart, recent transactions, top categories, the accounts summary, net worth, and Coming up.
- [Transactions](./transactions.md) covers search, the filters kept in the URL, paging, and recategorizing.
- [Budgets](./budgets.md) covers adding, removing, and the meter tones.
- [Recurring](./recurring.md) covers the monthly cost, hide and unhide, and the Show hidden toggle.
- [Accounts and sync](./accounts.md) covers the institution cards, per-institution Sync and Remove, and Sync all.
