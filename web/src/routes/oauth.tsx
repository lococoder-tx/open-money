import { createFileRoute } from "@tanstack/react-router";
import { OAuthReturn } from "../pages/OAuthReturn.tsx";

export const Route = createFileRoute("/oauth")({ component: OAuthReturn });
