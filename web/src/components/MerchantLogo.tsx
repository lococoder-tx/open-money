import type { Transaction } from "@rocket/shared";

export function MerchantLogo({
  txn,
}: {
  txn: Pick<Transaction, "logoUrl" | "merchantName" | "name">;
}) {
  return txn.logoUrl ? (
    <img src={txn.logoUrl} alt="" />
  ) : (
    <span className="logo-fallback">{(txn.merchantName ?? txn.name)[0]}</span>
  );
}
