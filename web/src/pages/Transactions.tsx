import { useEffect, useState } from "react";
import type { Account, Transaction, TransactionPage } from "@rocket/shared";
import { api, useApi } from "../api.ts";
import { MerchantLogo } from "../components/MerchantLogo.tsx";
import { categoryLabel, money, shortDate } from "../format.ts";

const PAGE_SIZE = 50;

export function Transactions() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  });
  if (debounced) params.set("search", debounced);
  if (category) params.set("category", category);
  if (accountId) params.set("accountId", accountId);

  const { data, error, reload } = useApi<TransactionPage>(
    `/transactions?${params}`,
  );
  const categories = useApi<string[]>("/categories");
  const accounts = useApi<Account[]>("/accounts");
  const pages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="stack">
      <h1>Transactions</h1>
      <div className="row filters">
        <input
          placeholder="Search merchant or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
        <select
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All accounts</option>
          {accounts.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.institutionName} · {a.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-text">{error}</div>}
      <div className="card flush">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Account</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data?.transactions.map((t) => (
              <Row
                key={t.id}
                txn={t}
                categories={categories.data ?? []}
                onChange={reload}
              />
            ))}
          </tbody>
        </table>
        {data?.total === 0 && (
          <p className="muted pad">No transactions match.</p>
        )}
      </div>

      {pages > 1 && (
        <div className="row">
          <button
            className="btn"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className="muted">
            Page {page + 1} of {pages}
          </span>
          <button
            className="btn"
            disabled={page + 1 >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  txn,
  categories,
  onChange,
}: {
  txn: Transaction;
  categories: string[];
  onChange: () => void;
}) {
  const options = categories.includes(txn.category)
    ? categories
    : [...categories, txn.category];
  const recategorize = async (category: string) => {
    await api(`/transactions/${txn.id}`, {
      method: "PATCH",
      body: { category },
    });
    onChange();
  };

  return (
    <tr>
      <td className="muted nowrap">{shortDate(txn.date)}</td>
      <td>
        <div className="merchant">
          <MerchantLogo txn={txn} />
          <span>
            {txn.merchantName ?? txn.name}
            {txn.pending && <span className="badge">Pending</span>}
          </span>
        </div>
      </td>
      <td>
        <select
          className="inline"
          value={txn.category}
          onChange={(e) => recategorize(e.target.value)}
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </td>
      <td className="muted">{txn.accountName}</td>
      <td className={`num ${txn.amount < 0 ? "positive" : ""}`}>
        {money(-txn.amount, txn.currency)}
      </td>
    </tr>
  );
}
