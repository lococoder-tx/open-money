import { useState } from "react";
import type { RecurringFrequency, RecurringStream } from "@rocket/shared";
import { api, useApi } from "../api.ts";
import { money, shortDate } from "../format.ts";

const FREQUENCIES: Record<
  RecurringFrequency,
  { label: string; perMonth: number }
> = {
  UNKNOWN: { label: "Unknown", perMonth: 0 },
  WEEKLY: { label: "Weekly", perMonth: 52 / 12 },
  BIWEEKLY: { label: "Biweekly", perMonth: 26 / 12 },
  SEMI_MONTHLY: { label: "Twice monthly", perMonth: 2 },
  MONTHLY: { label: "Monthly", perMonth: 1 },
  ANNUALLY: { label: "Annually", perMonth: 1 / 12 },
};

export function Recurring() {
  const { data, error, reload } = useApi<RecurringStream[]>("/recurring");
  const [showHidden, setShowHidden] = useState(false);

  if (error) return <div className="card error-text">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;

  const visible = data.filter((r) => r.isActive && (showHidden || !r.hidden));
  const outflows = visible.filter((r) => r.direction === "outflow");
  const inflows = visible.filter((r) => r.direction === "inflow");
  const monthlyCost = outflows
    .filter((r) => !r.hidden)
    .reduce(
      (sum, r) => sum + r.averageAmount * FREQUENCIES[r.frequency].perMonth,
      0,
    );

  const toggleHidden = async (r: RecurringStream) => {
    await api(`/recurring/${r.id}`, {
      method: "PATCH",
      body: { hidden: !r.hidden },
    });
    reload();
  };

  return (
    <div className="stack">
      <div className="row between">
        <h1>Recurring</h1>
        <label className="row small">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Show hidden
        </label>
      </div>
      <div className="card stat">
        <div className="muted">Subscriptions & bills, per month</div>
        <div className="stat-value">{money(monthlyCost)}</div>
        <div className="muted small">
          {outflows.filter((r) => !r.hidden).length} active charges
        </div>
      </div>
      <StreamTable
        title="Subscriptions & bills"
        streams={outflows}
        onToggle={toggleHidden}
      />
      <StreamTable
        title="Recurring income"
        streams={inflows}
        onToggle={toggleHidden}
      />
    </div>
  );
}

function StreamTable({
  title,
  streams,
  onToggle,
}: {
  title: string;
  streams: RecurringStream[];
  onToggle: (r: RecurringStream) => void;
}) {
  return (
    <section className="card flush">
      <h2 className="pad">{title}</h2>
      {streams.length === 0 ? (
        <p className="muted pad">
          Nothing detected yet. Plaid needs a few months of history to spot
          patterns.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Frequency</th>
              <th>Last</th>
              <th>Next</th>
              <th className="num">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {streams.map((r) => (
              <tr key={r.id} className={r.hidden ? "dimmed" : ""}>
                <td>{r.merchantName ?? r.name}</td>
                <td className="muted">{FREQUENCIES[r.frequency].label}</td>
                <td className="muted">{shortDate(r.lastDate)}</td>
                <td className="muted">
                  {r.nextDate ? shortDate(r.nextDate) : "—"}
                </td>
                <td className="num">{money(r.lastAmount)}</td>
                <td className="num">
                  <button className="btn small" onClick={() => onToggle(r)}>
                    {r.hidden ? "Unhide" : "Hide"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
