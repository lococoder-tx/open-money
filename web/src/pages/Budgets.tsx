import { useState, type FormEvent } from 'react';
import { NON_SPENDING_CATEGORIES, type Budget } from '@rocket/shared';
import { api, useApi } from '../api.ts';
import { categoryLabel, money } from '../format.ts';

export function Budgets() {
  const { data, error, reload } = useApi<Budget[]>('/budgets');
  const categories = useApi<string[]>('/categories');
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!category || !(Number(limit) > 0)) return;
    await api(`/budgets/${encodeURIComponent(category)}`, { method: 'PUT', body: { monthlyLimit: Number(limit) } });
    setLimit('');
    reload();
  };

  const remove = async (c: string) => {
    await api(`/budgets/${encodeURIComponent(c)}`, { method: 'DELETE' });
    reload();
  };

  const totalLimit = data?.reduce((s, b) => s + b.monthlyLimit, 0) ?? 0;
  const totalSpent = data?.reduce((s, b) => s + b.spent, 0) ?? 0;

  return (
    <div className="stack">
      <h1>Budgets</h1>
      {error && <div className="error-text">{error}</div>}

      {data && data.length > 0 && <BudgetBar label="Total" spent={totalSpent} limit={totalLimit} />}

      <section className="card stack">
        {data?.length === 0 && <p className="muted">No budgets yet. Add one per spending category below.</p>}
        {data?.map((b) => (
          <BudgetBar key={b.category} label={categoryLabel(b.category)} spent={b.spent} limit={b.monthlyLimit} onRemove={() => remove(b.category)} />
        ))}
      </section>

      <form className="card row" onSubmit={save}>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Choose a category</option>
          {categories.data
            ?.filter((c) => !NON_SPENDING_CATEGORIES.includes(c))
            .map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
        </select>
        <input type="number" min="1" step="1" placeholder="Monthly limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
        <button className="btn primary" type="submit">
          Save budget
        </button>
      </form>
    </div>
  );
}

function BudgetBar({ label, spent, limit, onRemove }: { label: string; spent: number; limit: number; onRemove?: () => void }) {
  const ratio = limit > 0 ? spent / limit : 0;
  const tone = ratio > 1 ? 'over' : ratio > 0.85 ? 'near' : '';
  return (
    <div className="budget">
      <div className="row between">
        <strong>{label}</strong>
        <span className="row small">
          <span>
            {money(spent)} <span className="muted">of {money(limit)}</span>
          </span>
          {onRemove && (
            <button className="btn small ghost" onClick={onRemove} aria-label={`Remove ${label} budget`}>
              ✕
            </button>
          )}
        </span>
      </div>
      <div className="meter">
        <div className={`meter-fill ${tone}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <div className="muted small">{ratio > 1 ? `${money(spent - limit)} over` : `${money(limit - spent)} left`}</div>
    </div>
  );
}
