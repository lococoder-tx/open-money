import { useState, type FormEvent } from "react";
import { NON_SPENDING_CATEGORIES, type Budget } from "@rocket/shared";
import { api, useApi } from "../api.ts";
import {
  Button,
  card,
  errorText,
  field,
  Meter,
  pageTitle,
  row,
  stack,
} from "../components/ui.tsx";
import { categoryLabel, money } from "../format.ts";

export function Budgets() {
  const { data, error, reload } = useApi<Budget[]>("/budgets");
  const categories = useApi<string[]>("/categories");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!category || !(Number(limit) > 0)) return;
    await api(`/budgets/${encodeURIComponent(category)}`, {
      method: "PUT",
      body: { monthlyLimit: Number(limit) },
    });
    setLimit("");
    reload();
  };

  const remove = async (c: string) => {
    await api(`/budgets/${encodeURIComponent(c)}`, { method: "DELETE" });
    reload();
  };

  const totalLimit = data?.reduce((s, b) => s + b.monthlyLimit, 0) ?? 0;
  const totalSpent = data?.reduce((s, b) => s + b.spent, 0) ?? 0;

  return (
    <div className={stack}>
      <h1 className={pageTitle}>Budgets</h1>
      {error && <div className={errorText}>{error}</div>}

      {data && data.length > 0 && (
        <BudgetBar label="Total" spent={totalSpent} limit={totalLimit} />
      )}

      <section className={`${card} ${stack}`}>
        {data?.length === 0 && (
          <p className="my-[1em] text-muted">
            No budgets yet. Add one per spending category below.
          </p>
        )}
        {data?.map((b) => (
          <BudgetBar
            key={b.category}
            label={categoryLabel(b.category)}
            spent={b.spent}
            limit={b.monthlyLimit}
            onRemove={() => remove(b.category)}
          />
        ))}
      </section>

      <form className={`${card} ${row}`} onSubmit={save}>
        <select
          className={field}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Choose a category</option>
          {categories.data
            ?.filter((c) => !NON_SPENDING_CATEGORIES.includes(c))
            .map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
        </select>
        <input
          className={field}
          type="number"
          min="1"
          step="1"
          placeholder="Monthly limit"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
        <Button variant="primary" type="submit">
          Save budget
        </Button>
      </form>
    </div>
  );
}

function BudgetBar({
  label,
  spent,
  limit,
  onRemove,
}: {
  label: string;
  spent: number;
  limit: number;
  onRemove?: () => void;
}) {
  const ratio = limit > 0 ? spent / limit : 0;
  const tone = ratio > 1 ? "over" : ratio > 0.85 ? "near" : "good";
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`${row} justify-between`}>
        <strong>{label}</strong>
        <span className={`${row} text-13`}>
          <span>
            {money(spent)} <span className="text-muted">of {money(limit)}</span>
          </span>
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label={`Remove ${label} budget`}
            >
              ✕
            </Button>
          )}
        </span>
      </div>
      <Meter percent={Math.min(100, ratio * 100)} tone={tone} />
      <div className="text-13 text-muted">
        {ratio > 1
          ? `${money(spent - limit)} over`
          : `${money(limit - spent)} left`}
      </div>
    </div>
  );
}
