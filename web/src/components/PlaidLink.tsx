import { useContext, useEffect, useState, type ReactNode } from "react";
import {
  usePlaidLink,
  type PlaidLinkOnSuccessMetadata,
} from "react-plaid-link";
import type { Institution, LinkTarget } from "@rocket/shared";
import { api, DataVersion, errorMessage } from "../api.ts";

/**
 * OAuth institutions (Fidelity, most big banks) leave the app and come back to /oauth.
 * Link must be resumed there with the same token, so the in-flight session is stashed.
 */
interface PendingLink {
  linkToken: string;
  itemId: string | null;
}
const PENDING_KEY = "plaid-pending-link";

function isPendingLink(value: unknown): value is PendingLink {
  return (
    typeof value === "object" &&
    value !== null &&
    "linkToken" in value &&
    typeof value.linkToken === "string" &&
    "itemId" in value &&
    (value.itemId === null || typeof value.itemId === "string")
  );
}

/** Stored by an earlier page load, so it may be stale or hand-edited. */
export function readPendingLink(): PendingLink | null {
  const raw = localStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isPendingLink(value) ? value : null;
  } catch {
    return null;
  }
}

async function completeLink(
  pending: PendingLink,
  publicToken: string,
  metadata: PlaidLinkOnSuccessMetadata,
) {
  localStorage.removeItem(PENDING_KEY);
  if (pending.itemId) {
    await api(`/institutions/${pending.itemId}/sync`, { method: "POST" });
  } else {
    await api<Institution>("/link/exchange", {
      method: "POST",
      body: { publicToken, institutionName: metadata.institution?.name },
    });
  }
}

/** Opens Plaid Link as soon as it's ready; used by both the button and the OAuth return page. */
export function usePlaidFlow(
  pending: PendingLink | null,
  opts: { receivedRedirectUri?: string; onFinish: (error?: string) => void },
) {
  const { bump } = useContext(DataVersion);
  const { open, ready } = usePlaidLink({
    token: pending?.linkToken ?? null,
    receivedRedirectUri: opts.receivedRedirectUri,
    onSuccess: (publicToken, metadata) => {
      if (!pending || !publicToken) return;
      completeLink(pending, publicToken, metadata).then(
        () => {
          bump();
          opts.onFinish();
        },
        (err: unknown) => opts.onFinish(errorMessage(err)),
      );
    },
    onExit: (err) => {
      localStorage.removeItem(PENDING_KEY);
      opts.onFinish(err?.display_message ?? err?.error_message ?? undefined);
    },
  });

  useEffect(() => {
    if (pending && ready) open();
  }, [pending, ready, open]);
}

export function ConnectButton({
  target,
  children,
  className,
}: {
  target: LinkTarget;
  children: ReactNode;
  className?: string;
}) {
  const [pending, setPending] = useState<PendingLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  usePlaidFlow(pending, {
    onFinish: (err) => {
      setPending(null);
      setBusy(false);
      setError(err);
    },
  });

  const start = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const { linkToken } = await api<{ linkToken: string }>("/link/token", {
        method: "POST",
        body: target,
      });
      const next = {
        linkToken,
        itemId: "itemId" in target ? target.itemId : null,
      };
      localStorage.setItem(PENDING_KEY, JSON.stringify(next));
      setPending(next);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className={className ?? "btn primary"}
        onClick={start}
        disabled={busy}
      >
        {busy ? "Connecting…" : children}
      </button>
      {error && <span className="error-text">{error}</span>}
    </>
  );
}
