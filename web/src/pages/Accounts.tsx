import { useContext, useState } from "react";
import type { Account, AccountType, Institution } from "@rocket/shared";
import { api, DataVersion, useApi } from "../api.ts";
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

const typeLabels: Record<AccountType, string> = {
  depository: "Cash",
  credit: "Credit cards",
  loan: "Loans",
  investment: "Investments",
  other: "Other",
};

export function Accounts() {
  const institutions = useApi<Institution[]>("/institutions");
  const accounts = useApi<Account[]>("/accounts");

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
        <div className={errorText}>{institutions.error}</div>
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
  const { bump } = useContext(DataVersion);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      bump();
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (
      confirm(
        `Disconnect ${institution.name}? Its accounts and history will be deleted.`,
      )
    ) {
      void run(() =>
        api(`/institutions/${institution.itemId}`, { method: "DELETE" }),
      );
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
          <Button
            disabled={busy}
            onClick={() =>
              run(() =>
                api(`/institutions/${institution.itemId}/sync`, {
                  method: "POST",
                }),
              )
            }
          >
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
