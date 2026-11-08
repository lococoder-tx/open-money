const stream = (over) => ({
  accountId: "acct",
  category: "ENTERTAINMENT",
  frequency: "MONTHLY",
  averageAmount: 15.49,
  lastAmount: 15.49,
  lastDate: "2026-10-12",
  nextDate: "2026-11-12",
  isActive: true,
  hidden: false,
  merchantName: null,
  direction: "outflow",
  ...over,
});

export const recurring = [
  stream({ id: "r1", name: "NETFLIX", merchantName: "Netflix" }),
  stream({ id: "r2", name: "GYM", frequency: "WEEKLY", averageAmount: 12, lastAmount: 12, hidden: true }),
  stream({ id: "r3", name: "Spotify", frequency: "ANNUALLY", nextDate: null }),
  stream({ id: "r4", name: "PAYROLL", merchantName: "Acme Corp", direction: "inflow", frequency: "BIWEEKLY", averageAmount: 2400, lastAmount: 2400 }),
];

export const budgets = [
  { category: "FOOD_AND_DRINK", monthlyLimit: 400, spent: 120 },
  { category: "GENERAL_MERCHANDISE", monthlyLimit: 100, spent: 90 },
  { category: "PERSONAL_CARE", monthlyLimit: 50, spent: 78.5 },
];

export async function stubJson(page, pathname, body) {
  await page.route(`**/api${pathname}`, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ contentType: "application/json", body: JSON.stringify(body) })
      : route.fallback(),
  );
}

/** Real /summary plus upcoming bills and a net worth history, which the seed DB lacks. */
export async function stubRichSummary(page) {
  await page.route("**/api/summary", async (route) => {
    const res = await route.fetch();
    const summary = await res.json();
    summary.upcoming = recurring.slice(0, 3).map((r, i) => ({ ...r, nextDate: `2026-11-${10 + i * 4}` }));
    summary.netWorthHistory = [-80000, -79000, -79500, -78000, -77164].map((value, i) => ({
      date: `2026-11-0${i + 4}`,
      value,
    }));
    await route.fulfill({ response: res, json: summary });
  });
}
