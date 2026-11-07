import { useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api, DataVersion } from "./api.ts";
import { Accounts } from "./pages/Accounts.tsx";
import { Budgets } from "./pages/Budgets.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Investments } from "./pages/Investments.tsx";
import { OAuthReturn } from "./pages/OAuthReturn.tsx";
import { Recurring } from "./pages/Recurring.tsx";
import { Transactions } from "./pages/Transactions.tsx";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/transactions", label: "Transactions" },
  { to: "/recurring", label: "Recurring" },
  { to: "/budgets", label: "Budgets" },
  { to: "/investments", label: "Investments" },
  { to: "/accounts", label: "Accounts" },
];

export function App() {
  const [version, setVersion] = useState(0);
  const dataVersion = useMemo(
    () => ({ version, bump: () => setVersion((v) => v + 1) }),
    [version],
  );
  const [syncing, setSyncing] = useState(false);

  const syncAll = async () => {
    setSyncing(true);
    try {
      await api("/sync", { method: "POST" });
      dataVersion.bump();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <DataVersion.Provider value={dataVersion}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">🚀 Rocket Clone</div>
          <nav>
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            className="btn ghost sync"
            onClick={syncAll}
            disabled={syncing}
          >
            {syncing ? "Syncing…" : "↻ Sync all"}
          </button>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/oauth" element={<OAuthReturn />} />
          </Routes>
        </main>
      </div>
    </DataVersion.Provider>
  );
}
