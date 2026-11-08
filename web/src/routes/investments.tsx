import { createFileRoute } from "@tanstack/react-router";
import { Investments } from "../pages/Investments.tsx";

export const Route = createFileRoute("/investments")({
  component: Investments,
});
