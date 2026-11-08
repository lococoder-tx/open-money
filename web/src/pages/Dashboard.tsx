import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Account, Institution, Summary } from "@rocket/shared";
import { useApi } from "../api.ts";
import { MerchantLogo } from "../components/MerchantLogo.tsx";
import { ConnectButton } from "../components/PlaidLink.tsx";
import { categoryLabel, money, shortDate } from "../format.ts";

export function Dashboard() {
  const institutions = useApi<Institution[]>("/institutions");
  const accounts = useApi<Account[]>("/accounts");
  const summary = useApi<Summary>("/summary");
  const error = summary.error ?? institutions.error ?? accounts.error;

  if (error) return <div className="card error-text">{error}</div>;
  if (!summary.data || !institutions.data || !accounts.data)
    return <div className="muted">Loading…</div>;
  if (institutions.data.length === 0) return <Welcome />;

  const data = summary.data;
  return (
    <div className="stack">
      <h1>{greeting()}</h1>
      <div className="dashboard">
        <div className="stack">
          <SpendingCard daily={data.dailySpending} />
          <RecentTransactions transactions={data.recentTransactions} />
          <TopCategories categories={data.spendingByCategory} />
        </div>
        <div className="stack">
          <AccountsCard accounts={accounts.data} />
          <NetWorthCard summary={data} />
          <UpcomingCard upcoming={data.upcoming} />
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const cumulative = (daily: number[]) => {
  let sum = 0;
  return daily.map((amount) => (sum += amount));
};

function SpendingCard({ daily }: { daily: Summary["dailySpending"] }) {
  const thisMonth = cumulative(daily.thisMonth);
  const lastMonth = cumulative(daily.lastMonth);
  const spent = thisMonth.at(-1) ?? 0;
  const lastMonthSoFar =
    lastMonth[Math.min(thisMonth.length, lastMonth.length) - 1] ?? 0;
  const delta = spent - lastMonthSoFar;
  const chart = Array.from(
    { length: Math.max(thisMonth.length, lastMonth.length) },
    (_, i) => ({ day: i + 1, thisMonth: thisMonth[i], lastMonth: lastMonth[i] }),
  );

  return (
    <section className="card">
      <div className="muted small">Current spend this month</div>
      <div className="hero-value">{money(spent)}</div>
      <div className={`small ${delta > 0 ? "negative" : "positive"}`}>
        {money(Math.abs(delta))} {delta > 0 ? "above" : "below"} last month
        at this point
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chart} margin={{ top: 16, right: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            interval="preserveStartEnd"
          />
          <YAxis
            orientation="right"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={56}
            tickFormatter={(v: number) => money(v).replace(/\.\d+$/, "")}
          />
          <Tooltip
            formatter={(v, name) => [
              money(Number(v)),
              name === "thisMonth" ? "This month" : "Last month",
            ]}
            labelFormatter={(day) => `Day ${day}`}
          />
          <Line
            dataKey="lastMonth"
            stroke="var(--muted)"
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Area
            dataKey="thisMonth"
            stroke="var(--accent)"
            strokeWidth={2.5}
            fill="var(--accent-soft)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="legend small muted">
        <span className="swatch accent" /> This month
        <span className="swatch dashed" /> Last month
      </div>
    </section>
  );
}

function RecentTransactions({
  transactions,
}: {
  transactions: Summary["recentTransactions"];
}) {
  return (
    <section className="card">
      <div className="row between card-head">
        <h2>Recent transactions</h2>
        <Link to="/transactions" className="small">
          See all
        </Link>
      </div>
      {transactions.length === 0 ? (
        <p className="muted">No transactions yet.</p>
      ) : (
        <ul className="list">
          {transactions.map((t) => (
            <li key={t.id}>
              <div className="merchant">
                <MerchantLogo txn={t} />
                <div>
                  <div>
                    {t.merchantName ?? t.name}
                    {t.pending && <span className="badge">Pending</span>}
                  </div>
                  <div className="muted small">
                    {categoryLabel(t.category)} · {shortDate(t.date)}
                  </div>
                </div>
              </div>
              <div className={`num ${t.amount < 0 ? "positive" : ""}`}>
                {t.amount < 0 ? "+" : ""}
                {money(Math.abs(t.amount), t.currency)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TopCategories({
  categories,
}: {
  categories: Summary["spendingByCategory"];
}) {
  const top = categories.slice(0, 5);
  const max = top[0]?.amount ?? 0;
  return (
    <section className="card">
      <div className="row between card-head">
        <h2>Top categories</h2>
        <Link to="/budgets" className="small">
          Budgets
        </Link>
      </div>
      {top.length === 0 ? (
        <p className="muted">No spending yet this month.</p>
      ) : (
        <div className="stack tight">
          {top.map((c) => (
            <div key={c.category} className="budget">
              <div className="row between small">
                <span>{categoryLabel(c.category)}</span>
                <span className="num">{money(c.amount)}</span>
              </div>
              <div className="meter">
                <div
                  className="meter-fill accent"
                  style={{ width: `${(c.amount / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const ACCOUNT_GROUPS = {
  checking: "Checking",
  cards: "Card balance",
  savings: "Savings",
  investments: "Investments",
  loans: "Loans",
  other: "Other",
} as const;
type AccountGroup = keyof typeof ACCOUNT_GROUPS;

function groupOf(a: Account): AccountGroup {
  switch (a.type) {
    case "depository":
      return a.subtype === "checking" ? "checking" : "savings";
    case "credit":
      return "cards";
    case "investment":
      return "investments";
    case "loan":
      return "loans";
    case "other":
      return "other";
  }
}

function AccountsCard({ accounts }: { accounts: Account[] }) {
  const groups = new Map<AccountGroup, Account[]>();
  for (const a of accounts) {
    const g = groupOf(a);
    groups.set(g, [...(groups.get(g) ?? []), a]);
  }
  const totalOf = (g: AccountGroup) =>
    (groups.get(g) ?? []).reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);
  const netCash = totalOf("checking") - totalOf("cards");

  return (
    <section className="card">
      <div className="row between card-head">
        <h2>Accounts</h2>
        <Link to="/accounts" className="small">
          Manage
        </Link>
      </div>
      <div className="account-groups">
        {(Object.keys(ACCOUNT_GROUPS) as AccountGroup[]).map((g) => {
          const members = groups.get(g);
          if (!members) return null;
          return (
            <div key={g}>
              <details>
                <summary>
                  <span>{ACCOUNT_GROUPS[g]}</span>
                  <span className="num">{money(totalOf(g))}</span>
                </summary>
                {members.map((a) => (
                  <div key={a.id} className="account-row small">
                    <span>
                      {a.name}
                      {a.mask && <span className="muted"> ••{a.mask}</span>}
                    </span>
                    <span className="num">
                      {money(a.currentBalance, a.currency)}
                    </span>
                  </div>
                ))}
              </details>
              {g === "cards" && (
                <div className="net-cash">
                  <span>Net cash</span>
                  <span className={`num ${netCash < 0 ? "negative" : ""}`}>
                    {money(netCash)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NetWorthCard({ summary }: { summary: Summary }) {
  const history = summary.netWorthHistory;
  return (
    <section className="card">
      <h2>Net worth</h2>
      <div className="hero-value">{money(summary.netWorth)}</div>
      {history.length >= 2 && (
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={history} margin={{ top: 8 }}>
            <Tooltip
              formatter={(v) => money(Number(v))}
              labelFormatter={(l) => shortDate(String(l))}
            />
            <Area
              dataKey="value"
              stroke="var(--accent)"
              fill="var(--accent-soft)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
      <div className="row between small net-split">
        <span className="muted">Assets</span>
        <span className="num">{money(summary.assets)}</span>
      </div>
      <div className="row between small">
        <span className="muted">Debts</span>
        <span className="num">{money(summary.liabilities)}</span>
      </div>
    </section>
  );
}

function UpcomingCard({ upcoming }: { upcoming: Summary["upcoming"] }) {
  const weekOut = new Date(Date.now() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const thisWeek = upcoming.filter((r) => r.nextDate && r.nextDate <= weekOut);
  const weekTotal = thisWeek.reduce((sum, r) => sum + r.lastAmount, 0);

  return (
    <section className="card">
      <div className="row between card-head">
        <h2>Coming up</h2>
        <Link to="/recurring" className="small">
          Recurring
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <p className="muted">No upcoming recurring charges detected.</p>
      ) : (
        <>
          <p className="muted small">
            {thisWeek.length === 0
              ? "Nothing due in the next 7 days."
              : `${thisWeek.length} charge${thisWeek.length === 1 ? "" : "s"} due in the next 7 days, totaling ${money(weekTotal)}.`}
          </p>
          <ul className="list">
            {upcoming.map((r) => (
              <li key={r.id}>
                <div>
                  <div>{r.merchantName ?? r.name}</div>
                  <div className="muted small">
                    {r.nextDate && shortDate(r.nextDate)}
                  </div>
                </div>
                <div className="num">{money(r.lastAmount)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
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
