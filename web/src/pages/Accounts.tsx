import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Account, AccountType, Institution } from "@rocket/shared";
import { api } from "../api.ts";
import { ConnectButton } from "../components/PlaidLink.tsx";
import {
  Button,
  card,
  cardTitle,
  errorText,
  pageTitle,
  row,
  stack,
  table,
  Td,
} from "../components/ui.tsx";
import { money } from "../format.ts";
import { queries } from "../queries.ts";

const typeLabels: Record<AccountType, string> = {
  depository: "Cash",
  credit: "Credit cards",
  loan: "Loans",
  investment: "Investments",
  other: "Other",
};

export function Accounts() {
  const institutions = useQuery(queries.institutions);
  const accounts = useQuery(queries.accounts);

  return (
    <div className={stack}>
      <div className={`${row} justify-between`}>
        <h1 className={pageTitle}>Accounts</h1>
        <div className={row}>
          <ConnectButton target={{ kind: "banking" }}>
            + Bank or card
          </ConnectButton>
          <ConnectButton target={{ kind: "investments" }} variant="default">
            + Investments
          </ConnectButton>
        </div>
      </div>
      {institutions.error && (
        <div className={errorText}>{institutions.error.message}</div>
      )}
      {institutions.data?.length === 0 && (
        <p className="my-[1em] text-muted">No connected institutions yet.</p>
      )}
      {institutions.data?.map((inst) => (
        <InstitutionCard
          key={inst.itemId}
          institution={inst}
          accounts={
            accounts.data?.filter((a) => a.itemId === inst.itemId) ?? []
          }
        />
      ))}
    </div>
  );
}

function InstitutionCard({
  institution,
  accounts,
}: {
  institution: Institution;
  accounts: Account[];
}) {
  const queryClient = useQueryClient();
  const invalidateAll = () => queryClient.invalidateQueries();
  const sync = useMutation({
    mutationFn: () =>
      api(`/institutions/${institution.itemId}/sync`, { method: "POST" }),
    onSuccess: invalidateAll,
  });
  const disconnect = useMutation({
    mutationFn: () =>
      api(`/institutions/${institution.itemId}`, { method: "DELETE" }),
    onSuccess: invalidateAll,
  });
  const busy = sync.isPending || disconnect.isPending;

  const remove = () => {
    if (
      confirm(
        `Disconnect ${institution.name}? Its accounts and history will be deleted.`,
      )
    ) {
      disconnect.mutate();
    }
  };

  return (
    <section className={card}>
      <div className={`${row} justify-between`}>
        <div>
          <h2 className={`${cardTitle} mb-3`}>{institution.name}</h2>
          <div className="text-13 text-muted">
            {institution.lastSyncedAt
              ? `Synced ${new Date(institution.lastSyncedAt).toLocaleString()}`
              : "Never synced"}
            {" · "}
            {institution.products.join(", ") || "pending"}
          </div>
        </div>
        <div className={row}>
          {institution.status === "login_required" && (
            <ConnectButton target={{ itemId: institution.itemId }}>
              Reconnect
            </ConnectButton>
          )}
          <Button disabled={busy} onClick={() => sync.mutate()}>
            {busy ? "…" : "Sync"}
          </Button>
          <Button variant="danger" disabled={busy} onClick={remove}>
            Remove
          </Button>
        </div>
      </div>
      {institution.status !== "ok" && (
        <p className={`my-[1em] ${errorText}`}>{institution.error}</p>
      )}
      <table className={table}>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id}>
              <Td>
                {a.name}{" "}
                {a.mask && <span className="text-muted">••{a.mask}</span>}
              </Td>
              <Td className="text-muted">{typeLabels[a.type]}</Td>
              <Td numeric>{money(a.currentBalance, a.currency)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
