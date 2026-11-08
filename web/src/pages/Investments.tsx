import { useQuery } from "@tanstack/react-query";
import {
  card,
  cardFlush,
  errorText,
  pageTitle,
  stack,
  table,
  Td,
  Th,
} from "../components/ui.tsx";
import { money } from "../format.ts";
import { queries } from "../queries.ts";

export function Investments() {
  const { data, error } = useQuery(queries.holdings);
  if (error)
    return <div className={`${card} ${errorText}`}>{error.message}</div>;
  if (!data) return <div className="text-muted">Loading…</div>;

  const total = data.reduce((s, h) => s + h.value, 0);
  const gain = data.reduce(
    (s, h) => (h.costBasis == null ? s : s + h.value - h.costBasis),
    0,
  );

  return (
    <div className={stack}>
      <h1 className={pageTitle}>Investments</h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <div className={card}>
          <div className="text-muted">Total value</div>
          <div className="mt-1 text-24 font-bold">{money(total)}</div>
        </div>
        <div className={card}>
          <div className="text-muted">Unrealized gain</div>
          <div
            className={`mt-1 text-24 font-bold ${gain >= 0 ? "text-good" : "text-bad"}`}
          >
            {money(gain)}
          </div>
          <div className="text-13 text-muted">
            Across holdings that report cost basis
          </div>
        </div>
      </div>
      <section className={cardFlush}>
        {data.length === 0 ? (
          <p className="px-5 py-4 text-muted">
            No holdings. Connect a brokerage or retirement account from
            Accounts.
          </p>
        ) : (
          <table className={table}>
            <thead>
              <tr>
                <Th>Security</Th>
                <Th>Account</Th>
                <Th numeric>Shares</Th>
                <Th numeric>Price</Th>
                <Th numeric>Value</Th>
                <Th numeric>Gain</Th>
                <Th numeric>Weight</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((h) => {
                const g = h.costBasis == null ? null : h.value - h.costBasis;
                return (
                  <tr key={`${h.accountId}:${h.securityId}`}>
                    <Td>
                      {h.ticker && <strong>{h.ticker} </strong>}
                      <span className="text-muted">{h.name}</span>
                    </Td>
                    <Td className="text-muted">{h.accountName}</Td>
                    <Td numeric>
                      {h.quantity.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </Td>
                    <Td numeric>{money(h.price)}</Td>
                    <Td numeric>{money(h.value)}</Td>
                    <Td
                      numeric
                      className={
                        g == null ? "" : g >= 0 ? "text-good" : "text-bad"
                      }
                    >
                      {money(g)}
                    </Td>
                    <Td numeric>
                      {total > 0
                        ? `${((h.value / total) * 100).toFixed(1)}%`
                        : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
