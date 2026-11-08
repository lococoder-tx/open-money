import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { readPendingLink, usePlaidFlow } from "../components/PlaidLink.tsx";
import { card, cardLink, errorText } from "../components/ui.tsx";

export function OAuthReturn() {
  const navigate = useNavigate();
  const [pending] = useState(readPendingLink);
  const [error, setError] = useState<string>();

  usePlaidFlow(pending, {
    receivedRedirectUri: window.location.href,
    onFinish: (err) => (err ? setError(err) : navigate("/accounts")),
  });

  if (!pending) {
    return (
      <div className={card}>
        No connection in progress.{" "}
        <Link to="/accounts" className={cardLink}>
          Back to accounts
        </Link>
      </div>
    );
  }
  return (
    <div className={card}>
      {error ? (
        <span className={errorText}>{error}</span>
      ) : (
        "Finishing connection…"
      )}
    </div>
  );
}
