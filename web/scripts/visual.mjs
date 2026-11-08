// Usage:
//   node web/scripts/visual.mjs capture <outDir>   screenshot every state of the running app
//   node web/scripts/visual.mjs diff <baseDir> <candidateDir>   exit 1 on any differing pixel
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { budgets, recurring, stubJson, stubRichSummary } from "./fixtures.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
// Headless Chromium occasionally rasterizes anti-aliased edges 1 unit off between runs.
const NOISE_TOLERANCE = 2;
const FIXED_NOW =new Date("2026-11-07T10:00:00");

const states = [
  { name: "dashboard", path: "/", ready: "text=Recent transactions" },
  {
    name: "dashboard-expanded",
    path: "/",
    ready: "text=Recent transactions",
    act: async (page) => {
      for (const s of await page.locator("summary").all()) await s.click();
    },
  },
  { name: "transactions", path: "/transactions", ready: "tbody tr" },
  { name: "recurring", path: "/recurring", ready: "text=Recurring income" },
  { name: "budgets", path: "/budgets", ready: "text=Save budget" },
  { name: "investments", path: "/investments", ready: "text=Total value" },
  { name: "accounts", path: "/accounts", ready: "section h2" },
  {
    name: "hover-nav",
    path: "/transactions",
    ready: "tbody tr",
    act: (page) => page.locator("aside nav a").nth(3).hover(),
  },
  {
    name: "hover-select",
    path: "/transactions",
    ready: "tbody tr",
    act: (page) => page.locator("tbody select").first().hover(),
  },
  { name: "dashboard-rich", path: "/", ready: "text=Recent transactions", setup: stubRichSummary },
  {
    name: "recurring-streams",
    path: "/recurring",
    ready: "text=Netflix",
    setup: (page) => stubJson(page, "/recurring", recurring),
  },
  {
    name: "budgets-tones",
    path: "/budgets",
    ready: "text=Food and drink",
    setup: (page) => stubJson(page, "/budgets", budgets),
  },
];
const viewports = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 600, height: 900 },
};
const schemes = ["light", "dark"];

async function capture(outDir) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  for (const [vpName, viewport] of Object.entries(viewports)) {
    for (const colorScheme of schemes) {
      const context = await browser.newContext({ viewport, colorScheme });
      const page = await context.newPage();
      await page.clock.setFixedTime(FIXED_NOW);
      for (const s of states) {
        await page.unrouteAll();
        await s.setup?.(page);
        await page.goto(BASE_URL + s.path, { waitUntil: "networkidle" });
        await page.locator(s.ready).first().waitFor();
        await s.act?.(page);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        const file = path.join(outDir, `${s.name}.${vpName}.${colorScheme}.png`);
        await page.screenshot({ path: file, fullPage: true });
      }
      await context.close();
    }
  }
  await browser.close();
  console.log(`captured ${states.length * 4} screenshots to ${outDir}`);
}

function diff(baseDir, candDir) {
  const diffDir = path.join(candDir, "_diff");
  mkdirSync(diffDir, { recursive: true });
  const names = readdirSync(baseDir).filter((f) => f.endsWith(".png"));
  if (names.length === 0) throw new Error(`no baseline screenshots in ${baseDir}`);
  let failed = 0;
  for (const name of names) {
    const a = PNG.sync.read(readFileSync(path.join(baseDir, name)));
    let b;
    try {
      b = PNG.sync.read(readFileSync(path.join(candDir, name)));
    } catch {
      console.log(`MISSING  ${name}`);
      failed++;
      continue;
    }
    if (a.width !== b.width || a.height !== b.height) {
      console.log(`SIZE     ${name}  ${a.width}x${a.height} -> ${b.width}x${b.height}`);
      failed++;
      continue;
    }
    const out = new PNG({ width: a.width, height: a.height });
    pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: 0 });
    let real = 0;
    let noise = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const delta = Math.max(
        Math.abs(a.data[i] - b.data[i]),
        Math.abs(a.data[i + 1] - b.data[i + 1]),
        Math.abs(a.data[i + 2] - b.data[i + 2]),
      );
      if (delta > NOISE_TOLERANCE) real++;
      else if (delta > 0) noise++;
    }
    if (real > 0) {
      writeFileSync(path.join(diffDir, name), PNG.sync.write(out));
      failed++;
    }
    console.log(`${real === 0 ? "SAME   " : "DIFF   "}  ${name}  ${real}px (${noise}px noise)`);
  }
  console.log(`${names.length - failed}/${names.length} match`);
  process.exit(failed === 0 ? 0 : 1);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "capture" && args[0]) await capture(args[0]);
else if (cmd === "diff" && args[0] && args[1]) diff(args[0], args[1]);
else {
  console.error("usage: visual.mjs capture <dir> | diff <baseDir> <candidateDir>");
  process.exit(2);
}
