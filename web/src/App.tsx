import { useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api, DataVersion } from "./api.ts";
import { Button } from "./components/ui.tsx";
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
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="flex shrink-0 flex-col gap-1 bg-sidebar px-3 py-5 text-white md:sticky md:top-0 md:h-screen md:w-55">
          <div className="px-3 pb-5 text-18 font-bold">🚀 Rocket Clone</div>
          <nav className="flex flex-1 flex-row flex-wrap gap-0.5 md:flex-col md:flex-nowrap">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-[9px] ${isActive ? "bg-accent text-white" : "text-sidebar-fg hover:bg-sidebar-hover hover:text-white"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <Button variant="sidebar" onClick={syncAll} disabled={syncing}>
            {syncing ? "Syncing…" : "↻ Sync all"}
          </Button>
        </aside>
        <main className="min-w-0 max-w-[1200px] flex-1 p-4 md:p-8">
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
