import { createFileRoute } from "@tanstack/react-router";
import { Recurring } from "../pages/Recurring.tsx";

export const Route = createFileRoute("/recurring")({ component: Recurring });
