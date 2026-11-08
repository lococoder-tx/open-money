# Transactions

The transactions page at `/transactions` lists transactions in a table with debounced search, category and account filters, paging at 50 per page, and an inline category picker per row. Filters live in the URL, so a filtered view survives reload and can be shared.

## Sub-features

- `txn-search` debounces search by 250 ms into one request and sets `?search=`.
- `txn-filter` sets the category and account filters, writes `?category=` and `?accountId=`, and resets to the first page.
- `txn-url` restores the filters and the input values from the URL on load.
- `txn-page` shows Previous and Next when there are more than 50 results, and sets `?page=` as a zero-based index.
- `txn-recat` changes a row's category, which sends a PATCH and refetches the list.

## How to get to it (user POV)

- Choose `Transactions` in the sidebar.
- Choose `See all` on the dashboard's Recent transactions card.
- Open a shared URL such as `/transactions?category=FOOD_AND_DRINK`.

## Driving it with Playwright

Preconditions:

- The seeded DB has transactions in at least 2 categories.

- **Search.** `getByPlaceholder("Search merchant or description").pressSequentially("uber")`, then wait 600 ms. Exactly one `GET /api/transactions` with `search=uber` goes out, and the URL has `?search=uber`.
- **Filter.** `page.locator("select").first().selectOption({ index: 1 })`. The URL gets `?category=<value>`, and the next request has `offset=0`.
- **Reload.** `page.reload()`. The first select still shows the value, and the first request after reload carries the category.
- **Recategorize.** On the first `tbody tr select`, pick a different option. A `PATCH /api/transactions/<id>` goes out, followed by a fresh `GET /api/transactions`. Stub the PATCH to keep the seed intact, or let it through and confirm with `sqlite3 "$RUN_DIR/rocket.db" "select user_category from transactions where id='<id>'"`.
- **Proof.** Save the request log and a screenshot showing the filter state and the URL.

## Gotchas

- Paging needs more than 50 matching rows. The seed has about 18, so `txn-page` cannot be shown on seed data. Report it as failed for that reason, or use a stubbed `/api/transactions` with `total` over 50.
- `?page=` is zero-based, and an absent value means the first page.
- Amounts render inverted, so income shows positive in green.
