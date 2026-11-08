// Usage: node web/scripts/behavior.mjs   (against the running app; mutating requests are stubbed)
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { recurring, stubJson } from "./fixtures.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const ACCENT = "rgb(232, 65, 79)";
const results = [];

async function check(name, fn) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const gets = [];
  page.on("request", (r) => {
    if (r.method() === "GET" && r.url().includes("/api/")) gets.push(new URL(r.url()));
  });
  await page.route("**/api/**", (route) =>
    route.request().method() === "GET"
      ? route.fallback()
      : route.fulfill({ status: 204 }),
  );
  const getsSince = (mark, pathname) =>
    gets.slice(mark).filter((u) => u.pathname === `/api${pathname}`);
  try {
    await fn({ page, gets, getsSince });
    results.push(["PASS", name]);
  } catch (err) {
    results.push(["FAIL", name, err.message.split("\n")[0]]);
  } finally {
    await context.close();
  }
}

async function waitForGet(getsSince, mark, pathname, page) {
  for (let i = 0; i < 40 && getsSince(mark, pathname).length === 0; i++)
    await page.waitForTimeout(50);
  assert.ok(getsSince(mark, pathname).length > 0, `expected a refetch of ${pathname}`);
}

const browser = await chromium.launch();

await check("sidebar links navigate and highlight the active route", async ({ page }) => {
  await page.goto(BASE_URL + "/");
  const routes = [
    ["Transactions", "/transactions"],
    ["Recurring", "/recurring"],
    ["Budgets", "/budgets"],
    ["Investments", "/investments"],
    ["Accounts", "/accounts"],
    ["Dashboard", "/"],
  ];
  for (const [label, pathname] of routes) {
    const link = page.locator("aside").getByRole("link", { name: label, exact: true });
    await link.click();
    await page.waitForURL((u) => u.pathname === pathname);
    await page.waitForFunction(
      ([el, accent]) => getComputedStyle(el).backgroundColor === accent,
      [await link.elementHandle(), ACCENT],
      { timeout: 3000 },
    ).catch(() => assert.fail(`${label} link should be highlighted`));
    const others = await page
      .locator("aside nav a")
      .evaluateAll((els, accent) =>
        els.filter((el) => getComputedStyle(el).backgroundColor === accent).length,
      ACCENT);
    assert.equal(others, 1, `exactly one active link on ${pathname}`);
  }
});

await check("deep link to /transactions renders rows", async ({ page }) => {
  await page.goto(BASE_URL + "/transactions");
  await page.locator("tbody tr").first().waitFor();
});

await check("Sync all refetches the mounted page's data", async ({ page, gets, getsSince }) => {
  await page.goto(BASE_URL + "/");
  await page.getByText("Recent transactions").waitFor();
  const mark = gets.length;
  await page.getByRole("button", { name: /Sync all/ }).click();
  await waitForGet(getsSince, mark, "/summary", page);
  await waitForGet(getsSince, mark, "/accounts", page);
});

await check("transaction search is debounced into one request", async ({ page, gets, getsSince }) => {
  await page.goto(BASE_URL + "/transactions");
  await page.locator("tbody tr").first().waitFor();
  const mark = gets.length;
  await page.getByPlaceholder("Search merchant or description").pressSequentially("uber", { delay: 30 });
  await page.waitForTimeout(600);
  const searches = getsSince(mark, "/transactions").map((u) => u.searchParams.get("search"));
  assert.deepEqual(searches, ["uber"]);
});

await check("category filter resets to page 1 and refetches", async ({ page, gets, getsSince }) => {
  await page.goto(BASE_URL + "/transactions");
  await page.locator("tbody tr").first().waitFor();
  const select = page.locator("select").first();
  const value = await select.locator("option").nth(1).getAttribute("value");
  const mark = gets.length;
  await select.selectOption(value);
  await waitForGet(getsSince, mark, "/transactions", page);
  const last = getsSince(mark, "/transactions").at(-1);
  assert.equal(last.searchParams.get("category"), value);
  assert.equal(last.searchParams.get("offset"), "0");
});

await check("recategorizing a transaction refetches the list", async ({ page, gets, getsSince }) => {
  await page.goto(BASE_URL + "/transactions");
  await page.locator("tbody tr").first().waitFor();
  const select = page.locator("tbody tr").first().locator("select");
  const current = await select.inputValue();
  const other = await select
    .locator("option")
    .evaluateAll((os, cur) => os.map((o) => o.value).find((v) => v !== cur), current);
  const mark = gets.length;
  await select.selectOption(other);
  await waitForGet(getsSince, mark, "/transactions", page);
});

await check("saving a budget refetches budgets", async ({ page, gets, getsSince }) => {
  await page.goto(BASE_URL + "/budgets");
  await page.getByText("Save budget").waitFor();
  const select = page.locator("form select");
  await select.locator("option").nth(1).waitFor({ state: "attached" });
  await select.selectOption({ index: 1 });
  await page.getByPlaceholder("Monthly limit").fill("123");
  const mark = gets.length;
  await page.getByRole("button", { name: "Save budget" }).click();
  await waitForGet(getsSince, mark, "/budgets", page);
  assert.equal(await page.getByPlaceholder("Monthly limit").inputValue(), "");
});

await check("hiding a recurring stream refetches recurring", async ({ page, gets, getsSince }) => {
  await stubJson(page, "/recurring", recurring);
  await page.goto(BASE_URL + "/recurring");
  await page.getByText("Netflix").waitFor();
  const mark = gets.length;
  await page.getByRole("button", { name: /^(Hide|Unhide)$/ }).first().click();
  await waitForGet(getsSince, mark, "/recurring", page);
});

await check("syncing an institution refetches institutions and accounts", async ({ page, gets, getsSince }) => {
  await page.goto(BASE_URL + "/accounts");
  await page.locator("section h2").first().waitFor();
  const mark = gets.length;
  await page.getByRole("button", { name: "Sync", exact: true }).first().click();
  await waitForGet(getsSince, mark, "/institutions", page);
  await waitForGet(getsSince, mark, "/accounts", page);
});

await check("an API error is shown on the page", async ({ page }) => {
  await page.route("**/api/holdings", (r) =>
    r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"holdings exploded"}' }),
  );
  await page.goto(BASE_URL + "/investments");
  await page.getByText("holdings exploded").waitFor({ timeout: 5000 });
});

await check("/oauth with nothing pending ends on /accounts", async ({ page }) => {
  await page.goto(BASE_URL + "/oauth");
  await page.waitForURL((u) => u.pathname === "/accounts");
  await page.locator("section h2").first().waitFor();
});

await browser.close();
for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
