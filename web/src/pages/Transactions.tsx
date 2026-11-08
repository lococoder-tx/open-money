import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Transaction } from "@rocket/shared";
import { api } from "../api.ts";
import { MerchantLogo } from "../components/MerchantLogo.tsx";
import {
  badge,
  Button,
  cardFlush,
  errorText,
  field,
  pageTitle,
  row,
  stack,
  table,
  Td,
  Th,
} from "../components/ui.tsx";
import { categoryLabel, money, shortDate } from "../format.ts";
import { queries } from "../queries.ts";

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

  const { data, error } = useQuery(
    queries.transactions({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      search: debounced,
      category,
      accountId,
    }),
  );
  const categories = useQuery(queries.categories);
  const accounts = useQuery(queries.accounts);
  const pages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className={stack}>
      <h1 className={pageTitle}>Transactions</h1>
      <div className={row}>
        <input
          className={`${field} min-w-[220px] flex-1`}
          placeholder="Search merchant or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={field}
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
          className={field}
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

      {error && <div className={errorText}>{error.message}</div>}
      <div className={cardFlush}>
        <table className={table}>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Description</Th>
              <Th>Category</Th>
              <Th>Account</Th>
              <Th numeric>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {data?.transactions.map((t) => (
              <Row key={t.id} txn={t} categories={categories.data ?? []} />
            ))}
          </tbody>
        </table>
        {data?.total === 0 && (
          <p className="px-5 py-4 text-muted">No transactions match.</p>
        )}
      </div>

      {pages > 1 && (
        <div className={row}>
          <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-muted">
            Page {page + 1} of {pages}
          </span>
          <Button
            disabled={page + 1 >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ txn, categories }: { txn: Transaction; categories: string[] }) {
  const options = categories.includes(txn.category)
    ? categories
    : [...categories, txn.category];
  const queryClient = useQueryClient();
  const recategorize = useMutation({
    mutationFn: (category: string) =>
      api(`/transactions/${txn.id}`, { method: "PATCH", body: { category } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/transactions"] }),
  });

  return (
    <tr>
      <Td className="whitespace-nowrap text-muted">{shortDate(txn.date)}</Td>
      <Td>
        <div className="flex items-center gap-2.5">
          <MerchantLogo txn={txn} />
          <span>
            {txn.merchantName ?? txn.name}
            {txn.pending && <span className={badge}>Pending</span>}
          </span>
        </div>
      </Td>
      <Td>
        <select
          className="rounded-lg border border-transparent bg-transparent p-1 text-14 text-fg hover:border-border"
          value={txn.category}
          onChange={(e) => recategorize.mutate(e.target.value)}
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </Td>
      <Td className="text-muted">{txn.accountName}</Td>
      <Td numeric className={txn.amount < 0 ? "text-good" : ""}>
        {money(-txn.amount, txn.currency)}
      </Td>
    </tr>
  );
}
