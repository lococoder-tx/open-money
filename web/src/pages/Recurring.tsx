import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { RecurringFrequency, RecurringStream } from "@rocket/shared";
import { api } from "../api.ts";
import {
  Button,
  card,
  cardFlush,
  cardTitle,
  errorText,
  field,
  pageTitle,
  row,
  stack,
  table,
  Td,
  Th,
} from "../components/ui.tsx";
import { money, shortDate } from "../format.ts";
import { queries } from "../queries.ts";

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
  const { data, error } = useQuery(queries.recurring);
  const queryClient = useQueryClient();
  const toggleHidden = useMutation({
    mutationFn: (r: RecurringStream) =>
      api(`/recurring/${r.id}`, {
        method: "PATCH",
        body: { hidden: !r.hidden },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queries.recurring.queryKey }),
  });
  const [showHidden, setShowHidden] = useState(false);

  if (error)
    return <div className={`${card} ${errorText}`}>{error.message}</div>;
  if (!data) return <div className="text-muted">Loading…</div>;

  const visible = data.filter((r) => r.isActive && (showHidden || !r.hidden));
  const outflows = visible.filter((r) => r.direction === "outflow");
  const inflows = visible.filter((r) => r.direction === "inflow");
  const monthlyCost = outflows
    .filter((r) => !r.hidden)
    .reduce(
      (sum, r) => sum + r.averageAmount * FREQUENCIES[r.frequency].perMonth,
      0,
    );

  return (
    <div className={stack}>
      <div className={`${row} justify-between`}>
        <h1 className={pageTitle}>Recurring</h1>
        <label className={`${row} text-13`}>
          <input
            className={`${field} m-[3px_3px_3px_4px]`}
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Show hidden
        </label>
      </div>
      <div className={card}>
        <div className="text-muted">Subscriptions & bills, per month</div>
        <div className="mt-1 text-24 font-bold">{money(monthlyCost)}</div>
        <div className="text-13 text-muted">
          {outflows.filter((r) => !r.hidden).length} active charges
        </div>
      </div>
      <StreamTable
        title="Subscriptions & bills"
        streams={outflows}
        onToggle={toggleHidden.mutate}
      />
      <StreamTable
        title="Recurring income"
        streams={inflows}
        onToggle={toggleHidden.mutate}
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
    <section className={cardFlush}>
      <h2 className={`${cardTitle} px-5 py-4`}>{title}</h2>
      {streams.length === 0 ? (
        <p className="px-5 py-4 text-muted">
          Nothing detected yet. Plaid needs a few months of history to spot
          patterns.
        </p>
      ) : (
        <table className={table}>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Frequency</Th>
              <Th>Last</Th>
              <Th>Next</Th>
              <Th numeric>Amount</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {streams.map((r) => (
              <tr key={r.id} className={r.hidden ? "opacity-50" : ""}>
                <Td>{r.merchantName ?? r.name}</Td>
                <Td className="text-muted">{FREQUENCIES[r.frequency].label}</Td>
                <Td className="text-muted">{shortDate(r.lastDate)}</Td>
                <Td className="text-muted">
                  {r.nextDate ? shortDate(r.nextDate) : "—"}
                </Td>
                <Td numeric>{money(r.lastAmount)}</Td>
                <Td numeric>
                  <Button size="sm" onClick={() => onToggle(r)}>
                    {r.hidden ? "Unhide" : "Hide"}
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
