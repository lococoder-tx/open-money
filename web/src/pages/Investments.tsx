import type { Holding } from '@rocket/shared';
import { useApi } from '../api.ts';
import { money } from '../format.ts';

export function Investments() {
  const { data, error } = useApi<Holding[]>('/holdings');
  if (error) return <div className="card error-text">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;

  const total = data.reduce((s, h) => s + h.value, 0);
  const withBasis = data.filter((h) => h.costBasis != null);
  const gain = withBasis.reduce((s, h) => s + h.value - h.costBasis!, 0);

  return (
    <div className="stack">
      <h1>Investments</h1>
      <div className="stats">
        <div className="card stat">
          <div className="muted">Total value</div>
          <div className="stat-value">{money(total)}</div>
        </div>
        <div className="card stat">
          <div className="muted">Unrealized gain</div>
          <div className={`stat-value ${gain >= 0 ? 'positive' : 'negative'}`}>{money(gain)}</div>
          <div className="muted small">Across holdings that report cost basis</div>
        </div>
      </div>
      <section className="card flush">
        {data.length === 0 ? (
          <p className="muted pad">No holdings. Connect a brokerage or retirement account from Accounts.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Security</th>
                <th>Account</th>
                <th className="num">Shares</th>
                <th className="num">Price</th>
                <th className="num">Value</th>
                <th className="num">Gain</th>
                <th className="num">Weight</th>
              </tr>
            </thead>
            <tbody>
              {data.map((h) => {
                const g = h.costBasis == null ? null : h.value - h.costBasis;
                return (
                  <tr key={`${h.accountId}:${h.securityId}`}>
                    <td>
                      {h.ticker && <strong>{h.ticker} </strong>}
                      <span className="muted">{h.name}</span>
                    </td>
                    <td className="muted">{h.accountName}</td>
                    <td className="num">{h.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td className="num">{money(h.price)}</td>
                    <td className="num">{money(h.value)}</td>
                    <td className={`num ${g == null ? '' : g >= 0 ? 'positive' : 'negative'}`}>{money(g)}</td>
                    <td className="num">{total > 0 ? `${((h.value / total) * 100).toFixed(1)}%` : '—'}</td>
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
