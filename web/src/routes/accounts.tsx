import { createFileRoute } from "@tanstack/react-router";
import { Accounts } from "../pages/Accounts.tsx";

export const Route = createFileRoute("/accounts")({ component: Accounts });
