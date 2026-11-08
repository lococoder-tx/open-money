# Budgets

The budgets page at `/budgets` lets a user set a monthly limit per spending category and see progress meters, green under 85%, amber from 85% to 100%, and red over the limit, with a Total bar on top.

## Sub-features

- `bud-add` picks a category and a limit and saves with Save budget. The input clears and the list refetches.
- `bud-remove` removes a budget with its ✕ button.
- `bud-tones` colors meters and labels them with "left" or "over".
- `bud-empty` shows "No budgets yet" when there are none.

## How to get to it (user POV)

- Choose `Budgets` in the sidebar.
- Choose the `Budgets` link on the dashboard's Top categories card.

## Driving it with Playwright

Preconditions:

- The category list is non-empty, because the seed has transactions.
- The seed has no budgets. For `bud-tones` without writing data, use `stubJson(page, "/budgets", budgets)` from `fixtures.mjs`.

- **Add.** `page.locator("form select").selectOption({ index: 1 })`, fill `getByPlaceholder("Monthly limit")` with `123`, then click `getByRole("button", { name: "Save budget" })`. A `PUT /api/budgets/<CATEGORY>` with `{"monthlyLimit":123}` goes out, the input empties, and `GET /api/budgets` refetches.
- **Confirm.** If you let the PUT through, reload the page. The budget row shows `of $123.00`. Also run `sqlite3 "$RUN_DIR/rocket.db" "select * from budgets"`.
- **Remove.** Click `getByRole("button", { name: "Remove <Category label> budget" })`. A DELETE goes out and the row disappears after the refetch.
- **Proof.** Take before and after screenshots and save the DB query output.

## Gotchas

- Income and transfer categories are deliberately absent from the picker.
- Save does nothing when the limit is empty or 0, so no request goes out.
