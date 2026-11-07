import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Institution, Summary } from "@rocket/shared";
import { useApi } from "../api.ts";
import { ConnectButton } from "../components/PlaidLink.tsx";
import { categoryLabel, money, shortDate } from "../format.ts";

export function Dashboard() {
  const institutions = useApi<Institution[]>("/institutions");
  const { data, error } = useApi<Summary>("/summary");

  if (error) return <div className="card error-text">{error}</div>;
  if (!data || !institutions.data) return <div className="muted">Loading…</div>;
  if (institutions.data.length === 0) return <Welcome />;

  const delta = data.monthSpending - data.lastMonthSpending;
  const spending = data.spendingByCategory.map((c) => ({
    ...c,
    label: categoryLabel(c.category),
  }));

  return (
    <div className="stack">
      <h1>Dashboard</h1>
      <div className="stats">
        <Stat label="Net worth" value={money(data.netWorth)} />
        <Stat label="Assets" value={money(data.assets)} />
        <Stat label="Liabilities" value={money(data.liabilities)} />
        <Stat
          label="Spent this month"
          value={money(data.monthSpending)}
          hint={`${delta >= 0 ? "▲" : "▼"} ${money(Math.abs(delta))} vs last month`}
          hintTone={delta > 0 ? "bad" : "good"}
        />
        <Stat label="Income this month" value={money(data.monthIncome)} />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Net worth</h2>
          {data.netWorthHistory.length < 2 ? (
            <p className="muted">
              History builds up as you sync on different days.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.netWorthHistory}>
                <XAxis dataKey="date" tickFormatter={shortDate} fontSize={12} />
                <YAxis
                  tickFormatter={(v: number) => money(v).replace(/\.\d+$/, "")}
                  fontSize={12}
                  width={90}
                />
                <Tooltip
                  formatter={(v) => money(Number(v))}
                  labelFormatter={(l) => shortDate(String(l))}
                />
                <Area
                  dataKey="value"
                  stroke="var(--accent)"
                  fill="var(--accent-soft)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="card">
          <h2>Spending by category</h2>
          {spending.length === 0 ? (
            <p className="muted">No spending yet this month.</p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(160, spending.length * 32)}
            >
              <BarChart data={spending} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={150}
                  fontSize={12}
                />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Bar
                  dataKey="amount"
                  fill="var(--accent)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Upcoming bills</h2>
        {data.upcoming.length === 0 ? (
          <p className="muted">No upcoming recurring charges detected.</p>
        ) : (
          <table>
            <tbody>
              {data.upcoming.map((r) => (
                <tr key={r.id}>
                  <td>{r.merchantName ?? r.name}</td>
                  <td className="muted">
                    {r.nextDate && shortDate(r.nextDate)}
                  </td>
                  <td className="num">{money(r.lastAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  hintTone,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "good" | "bad";
}) {
  return (
    <div className="card stat">
      <div className="muted">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className={`stat-hint ${hintTone ?? ""}`}>{hint}</div>}
    </div>
  );
}

function Welcome() {
  return (
    <div className="card welcome">
      <h1>Connect your first account</h1>
      <p className="muted">
        Link a bank or credit card to track spending and subscriptions, or an
        investment or retirement account (Fidelity, Principal, Vanguard) to
        track holdings.
      </p>
      <div className="row">
        <ConnectButton target={{ kind: "banking" }}>
          Connect bank or card
        </ConnectButton>
        <ConnectButton target={{ kind: "investments" }} className="btn">
          Connect investments
        </ConnectButton>
      </div>
    </div>
  );
}
