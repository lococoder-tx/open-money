import { createFileRoute } from "@tanstack/react-router";
import {
  parseTransactionSearch,
  Transactions,
} from "../pages/Transactions.tsx";

export const Route = createFileRoute("/transactions")({
  component: Transactions,
  validateSearch: parseTransactionSearch,
});
