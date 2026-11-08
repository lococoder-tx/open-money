import { Link } from "@tanstack/react-router";
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
import type { Account, Summary } from "@rocket/shared";
import { useQuery } from "@tanstack/react-query";
import { MerchantLogo } from "../components/MerchantLogo.tsx";
import { ConnectButton } from "../components/PlaidLink.tsx";
import {
  card,
  cardLink,
  cardTitle,
  errorText,
  badge,
  Meter,
  num,
  pageTitle,
  row,
  stack,
} from "../components/ui.tsx";
import { categoryLabel, money, shortDate } from "../format.ts";
import { queries } from "../queries.ts";

export function Dashboard() {
  const institutions = useQuery(queries.institutions);
  const accounts = useQuery(queries.accounts);
  const summary = useQuery(queries.summary);
  const error = summary.error ?? institutions.error ?? accounts.error;

  if (error)
    return <div className={`${card} ${errorText}`}>{error.message}</div>;
  if (!summary.data || !institutions.data || !accounts.data)
    return <div className="text-muted">Loading…</div>;
  if (institutions.data.length === 0) return <Welcome />;

  const data = summary.data;
  return (
    <div className={stack}>
      <h1 className={pageTitle}>{greeting()}</h1>
      <div className="grid grid-cols-[1fr] items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className={stack}>
          <SpendingCard daily={data.dailySpending} />
          <RecentTransactions transactions={data.recentTransactions} />
          <TopCategories categories={data.spendingByCategory} />
        </div>
        <div className={stack}>
          <AccountsCard accounts={accounts.data} />
          <NetWorthCard summary={data} />
          <UpcomingCard upcoming={data.upcoming} />
        </div>
      </div>
    </div>
  );
}

const cardHead = `${row} mb-2 justify-between`;
const cardHeadLink = `${cardLink} text-13`;
const heroValue = "mt-0.5 mb-1 text-32 font-bold tabular-nums";
const list = "text-14";
const listItem =
  "flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0";
const caption = "text-13 text-muted";
const emptyText = "my-[1em] text-muted";

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
    (_, i) => ({
      day: i + 1,
      thisMonth: thisMonth[i],
      lastMonth: lastMonth[i],
    }),
  );

  return (
    <section className={card}>
      <div className={caption}>Current spend this month</div>
      <div className={heroValue}>{money(spent)}</div>
      <div className={`text-13 ${delta > 0 ? "text-bad" : "text-good"}`}>
        {money(Math.abs(delta))} {delta > 0 ? "above" : "below"} last month at
        this point
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chart} margin={{ top: 16, right: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
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
            stroke="var(--color-muted)"
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Area
            dataKey="thisMonth"
            stroke="var(--color-accent)"
            strokeWidth={2.5}
            fill="var(--color-accent-soft)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className={`flex items-center gap-1.5 ${caption}`}>
        <span className="h-0 w-4 border-t-3 border-accent" /> This month
        <span className="ml-2.5 h-0 w-4 border-t-2 border-dashed border-muted" />{" "}
        Last month
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
    <section className={card}>
      <div className={cardHead}>
        <h2 className={cardTitle}>Recent transactions</h2>
        <Link to="/transactions" className={cardHeadLink}>
          See all
        </Link>
      </div>
      {transactions.length === 0 ? (
        <p className={emptyText}>No transactions yet.</p>
      ) : (
        <ul className={list}>
          {transactions.map((t) => (
            <li key={t.id} className={listItem}>
              <div className="flex items-center gap-2.5">
                <MerchantLogo txn={t} />
                <div>
                  <div>
                    {t.merchantName ?? t.name}
                    {t.pending && <span className={badge}>Pending</span>}
                  </div>
                  <div className={caption}>
                    {categoryLabel(t.category)} · {shortDate(t.date)}
                  </div>
                </div>
              </div>
              <div className={`${num} ${t.amount < 0 ? "text-good" : ""}`}>
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
    <section className={card}>
      <div className={cardHead}>
        <h2 className={cardTitle}>Top categories</h2>
        <Link to="/budgets" className={cardHeadLink}>
          Budgets
        </Link>
      </div>
      {top.length === 0 ? (
        <p className={emptyText}>No spending yet this month.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {top.map((c) => (
            <div key={c.category} className="flex flex-col gap-1.5">
              <div className={`${row} justify-between text-13`}>
                <span>{categoryLabel(c.category)}</span>
                <span className={num}>{money(c.amount)}</span>
              </div>
              <Meter percent={(c.amount / max) * 100} tone="accent" />
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

const groupRow = "flex justify-between border-b border-border py-3";

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
    <section className={card}>
      <div className={cardHead}>
        <h2 className={cardTitle}>Accounts</h2>
        <Link to="/accounts" className={cardHeadLink}>
          Manage
        </Link>
      </div>
      <div className="text-15 [&>div:last-child_summary]:border-b-0">
        {(Object.keys(ACCOUNT_GROUPS) as AccountGroup[]).map((g) => {
          const members = groups.get(g);
          if (!members) return null;
          return (
            <div key={g}>
              <details className="group">
                <summary
                  className={`${groupRow} cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden`}
                >
                  <span className="before:inline-block before:w-3.5 before:text-muted before:transition-transform before:duration-150 before:ease-[ease] before:content-['›'] group-open:before:rotate-90">
                    {ACCOUNT_GROUPS[g]}
                  </span>
                  <span className={num}>{money(totalOf(g))}</span>
                </summary>
                {members.map((a) => (
                  <div
                    key={a.id}
                    className="flex justify-between gap-2 border-b border-border py-2 pl-3.5 text-13"
                  >
                    <span>
                      {a.name}
                      {a.mask && (
                        <span className="text-muted"> ••{a.mask}</span>
                      )}
                    </span>
                    <span className={num}>
                      {money(a.currentBalance, a.currency)}
                    </span>
                  </div>
                ))}
              </details>
              {g === "cards" && (
                <div className={`${groupRow} pl-3.5 text-muted`}>
                  <span>Net cash</span>
                  <span className={`${num} ${netCash < 0 ? "text-bad" : ""}`}>
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
    <section className={card}>
      <h2 className={`${cardTitle} mb-3`}>Net worth</h2>
      <div className={heroValue}>{money(summary.netWorth)}</div>
      {history.length >= 2 && (
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={history} margin={{ top: 8 }}>
            <Tooltip
              formatter={(v) => money(Number(v))}
              labelFormatter={(l) => shortDate(String(l))}
            />
            <Area
              dataKey="value"
              stroke="var(--color-accent)"
              fill="var(--color-accent-soft)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
      <div className={`${row} mt-2 justify-between text-13`}>
        <span className="text-muted">Assets</span>
        <span className={num}>{money(summary.assets)}</span>
      </div>
      <div className={`${row} justify-between text-13`}>
        <span className="text-muted">Debts</span>
        <span className={num}>{money(summary.liabilities)}</span>
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
    <section className={card}>
      <div className={cardHead}>
        <h2 className={cardTitle}>Coming up</h2>
        <Link to="/recurring" className={cardHeadLink}>
          Recurring
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <p className={emptyText}>No upcoming recurring charges detected.</p>
      ) : (
        <>
          <p className={`my-[1em] ${caption}`}>
            {thisWeek.length === 0
              ? "Nothing due in the next 7 days."
              : `${thisWeek.length} charge${thisWeek.length === 1 ? "" : "s"} due in the next 7 days, totaling ${money(weekTotal)}.`}
          </p>
          <ul className={list}>
            {upcoming.map((r) => (
              <li key={r.id} className={listItem}>
                <div>
                  <div>{r.merchantName ?? r.name}</div>
                  <div className={caption}>
                    {r.nextDate && shortDate(r.nextDate)}
                  </div>
                </div>
                <div className={num}>{money(r.lastAmount)}</div>
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
    <div className={`${card} mx-auto my-[60px] max-w-[560px] text-center`}>
      <h1 className={pageTitle}>Connect your first account</h1>
      <p className={emptyText}>
        Link a bank or credit card to track spending and subscriptions, or an
        investment or retirement account (Fidelity, Principal, Vanguard) to
        track holdings.
      </p>
      <div className={`${row} mt-5 justify-center`}>
        <ConnectButton target={{ kind: "banking" }}>
          Connect bank or card
        </ConnectButton>
        <ConnectButton target={{ kind: "investments" }} variant="default">
          Connect investments
        </ConnectButton>
      </div>
    </div>
  );
}
