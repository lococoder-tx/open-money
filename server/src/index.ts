import path from "node:path";
import express, { type ErrorRequestHandler } from "express";
import { LINK_KINDS, type LinkTarget } from "@rocket/shared";
import { z } from "zod";
import { env, ROOT_DIR } from "./env.ts";
import { createLinkToken, toPlaidError } from "./plaid.ts";
import * as q from "./queries.ts";
import {
  accessTokenFor,
  linkItem,
  NotFoundError,
  removeItem,
  syncAll,
  syncItem,
} from "./sync.ts";

const app = express();
app.use(express.json());

const api = express.Router();

api.post("/link/token", async (req, res) => {
  const body: LinkTarget = z
    .union([
      z.object({ kind: z.enum(LINK_KINDS) }),
      z.object({ itemId: z.string() }),
    ])
    .parse(req.body);
  const linkToken = await createLinkToken(
    "itemId" in body
      ? { accessToken: accessTokenFor(body.itemId) }
      : { kind: body.kind },
  );
  res.json({ linkToken });
});

api.post("/link/exchange", async (req, res) => {
  const body = z
    .object({
      publicToken: z.string(),
      institutionName: z.string().default("Unknown institution"),
    })
    .parse(req.body);
  res.json(await linkItem(body));
});

api.get("/institutions", (_req, res) => {
  res.json(q.listInstitutions());
});

api.post("/institutions/:id/sync", async (req, res) => {
  res.json(await syncItem(req.params.id));
});

api.delete("/institutions/:id", async (req, res) => {
  await removeItem(req.params.id);
  res.status(204).end();
});

api.post("/sync", async (_req, res) => {
  res.json(await syncAll());
});

api.get("/accounts", (_req, res) => {
  res.json(q.listAccounts());
});

api.get("/transactions", (req, res) => {
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const filter = z
    .object({
      search: z.string().optional(),
      category: z.string().optional(),
      accountId: z.string().optional(),
      start: date.optional(),
      end: date.optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .parse(req.query);
  res.json(q.listTransactions(filter));
});

api.patch("/transactions/:id", (req, res) => {
  const { category } = z
    .object({ category: z.string().min(1).nullable() })
    .parse(req.body);
  if (!q.setTransactionCategory(req.params.id, category))
    throw new NotFoundError("Unknown transaction");
  res.status(204).end();
});

api.get("/categories", (_req, res) => {
  res.json(q.listCategories());
});

api.get("/recurring", (_req, res) => {
  res.json(q.listRecurring());
});

api.patch("/recurring/:id", (req, res) => {
  const { hidden } = z.object({ hidden: z.boolean() }).parse(req.body);
  if (!q.setRecurringHidden(req.params.id, hidden))
    throw new NotFoundError("Unknown recurring stream");
  res.status(204).end();
});

api.get("/budgets", (_req, res) => {
  res.json(q.listBudgets());
});

api.put("/budgets/:category", (req, res) => {
  const { monthlyLimit } = z
    .object({ monthlyLimit: z.number().positive() })
    .parse(req.body);
  q.upsertBudget(req.params.category, monthlyLimit);
  res.status(204).end();
});

api.delete("/budgets/:category", (req, res) => {
  q.deleteBudget(req.params.category);
  res.status(204).end();
});

api.get("/holdings", (_req, res) => {
  res.json(q.listHoldings());
});

api.get("/summary", (_req, res) => {
  res.json(q.getSummary());
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof z.ZodError)
    return void res.status(400).json({ error: z.prettifyError(err) });
  if (err instanceof NotFoundError)
    return void res.status(404).json({ error: err.message });
  const plaidError = toPlaidError(err);
  if (plaidError)
    return void res
      .status(502)
      .json({ error: plaidError.message, code: plaidError.code });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};

app.use("/api", api);

if (process.env.NODE_ENV === "production") {
  const dist = path.join(ROOT_DIR, "web/dist");
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(dist, "index.html")),
  );
}

app.use(errorHandler);

app.listen(env.PORT, "127.0.0.1", () => {
  console.log(
    `API listening on http://127.0.0.1:${env.PORT} (Plaid ${env.PLAID_ENV})`,
  );
});
