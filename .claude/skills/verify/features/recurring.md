# Recurring

The recurring page at `/recurring` shows subscriptions and bills, plus recurring income, that Plaid detected. It shows the estimated monthly cost and lets the user hide streams.

## Sub-features

- `rec-cost` shows the monthly cost across visible outflows, normalized by frequency.
- `rec-hide` sends a PATCH with `hidden` when the user clicks Hide or Unhide, then refetches.
- `rec-show-hidden` toggles hidden streams into view, dimmed at 50% opacity.
- `rec-empty` shows "Nothing detected yet" in each table.

## How to get to it (user POV)

- Choose `Recurring` in the sidebar.
- Choose the `Recurring` link on the dashboard's Coming up card.

## Driving it with Playwright

Preconditions:

- The seed has no recurring streams. Use `stubJson(page, "/recurring", recurring)` from `fixtures.mjs` before `page.goto`.

- **Load.** Go to `/recurring` and wait for `getByText("Netflix")`. The monthly cost card shows a dollar total, and the Recurring income table lists Acme Corp.
- **Hide.** Click the first `getByRole("button", { name: /^(Hide|Unhide)$/ })`. A `PATCH /api/recurring/r1` goes out, followed by `GET /api/recurring`.
- **Show hidden.** Check `getByLabel("Show hidden")`. The GYM row appears dimmed.
- **Proof.** Save the request log and screenshots with Show hidden off and on.

## Gotchas

- With stubbed GETs, a let-through PATCH 404s because the stream does not exist in the DB. Stub the PATCH too, as behavior.mjs does.
- Real streams need several months of Plaid history, and sandbox items rarely have them.
