import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
import { api } from "./api.ts";
import { Button } from "./components/ui.tsx";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/transactions", label: "Transactions" },
  { to: "/recurring", label: "Recurring" },
  { to: "/budgets", label: "Budgets" },
  { to: "/investments", label: "Investments" },
  { to: "/accounts", label: "Accounts" },
] as const;

export function App() {
  const queryClient = useQueryClient();
  const syncAll = useMutation({
    mutationFn: () => api("/sync", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-1 bg-sidebar px-3 py-5 text-white md:sticky md:top-0 md:h-screen md:w-55">
        <div className="px-3 pb-5 text-18 font-bold">🚀 Rocket Clone</div>
        <nav className="flex flex-1 flex-row flex-wrap gap-0.5 md:flex-col md:flex-nowrap">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: true, includeSearch: false }}
              className="rounded-lg px-3 py-[9px]"
              activeProps={{ className: "bg-accent text-white" }}
              inactiveProps={{
                className:
                  "text-sidebar-fg hover:bg-sidebar-hover hover:text-white",
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <Button
          variant="sidebar"
          onClick={() => syncAll.mutate()}
          disabled={syncAll.isPending}
        >
          {syncAll.isPending ? "Syncing…" : "↻ Sync all"}
        </Button>
      </aside>
      <main className="min-w-0 max-w-[1200px] flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
