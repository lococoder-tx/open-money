import { useContext, useState } from "react";
import type { Account, AccountType, Institution } from "@rocket/shared";
import { api, DataVersion, useApi } from "../api.ts";
import { ConnectButton } from "../components/PlaidLink.tsx";
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
    <div className="stack">
      <div className="row between">
        <h1>Accounts</h1>
        <div className="row">
          <ConnectButton target={{ kind: "banking" }}>
            + Bank or card
          </ConnectButton>
          <ConnectButton target={{ kind: "investments" }} className="btn">
            + Investments
          </ConnectButton>
        </div>
      </div>
      {institutions.error && (
        <div className="error-text">{institutions.error}</div>
      )}
      {institutions.data?.length === 0 && (
        <p className="muted">No connected institutions yet.</p>
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
    <section className="card">
      <div className="row between">
        <div>
          <h2>{institution.name}</h2>
          <div className="muted small">
            {institution.lastSyncedAt
              ? `Synced ${new Date(institution.lastSyncedAt).toLocaleString()}`
              : "Never synced"}
            {" · "}
            {institution.products.join(", ") || "pending"}
          </div>
        </div>
        <div className="row">
          {institution.status === "login_required" && (
            <ConnectButton target={{ itemId: institution.itemId }}>
              Reconnect
            </ConnectButton>
          )}
          <button
            className="btn"
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
          </button>
          <button className="btn danger" disabled={busy} onClick={remove}>
            Remove
          </button>
        </div>
      </div>
      {institution.status !== "ok" && (
        <p className="error-text">{institution.error}</p>
      )}
      <table>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id}>
              <td>
                {a.name} {a.mask && <span className="muted">••{a.mask}</span>}
              </td>
              <td className="muted">{typeLabels[a.type]}</td>
              <td className="num">{money(a.currentBalance, a.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
