import { createFileRoute } from "@tanstack/react-router";
import { Budgets } from "../pages/Budgets.tsx";

export const Route = createFileRoute("/budgets")({ component: Budgets });
