// Fails when code reintroduces the stack this app migrated away from.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "../src");
const rules = [
  {
    test: /from ["']react-router(-dom)?["']/,
    fix: "use @tanstack/react-router",
  },
  {
    test: /\bfrom ["'][^"']+\.css["']/,
    fix: "styles.css is imported once in main.tsx; style with Tailwind classes",
    skip: "main.tsx",
  },
];
const cssRule = {
  test: /^\s*[.#][\w-]+[^{]*\{/m,
  fix: "no hand-written class rules in styles.css; use utilities or components/ui.tsx",
};

const files = readdirSync(root, { recursive: true }).filter(
  (f) => /\.(tsx?|css)$/.test(f) && !f.endsWith(".gen.ts"),
);
const problems = [];
for (const file of files) {
  const text = readFileSync(path.join(root, file), "utf8");
  const active = file.endsWith(".css")
    ? [cssRule]
    : rules.filter((r) => r.skip !== file);
  for (const rule of active)
    if (rule.test.test(text)) problems.push(`${file}: ${rule.fix}`);
}
for (const p of problems) console.error(p);
process.exit(problems.length ? 1 : 0);
