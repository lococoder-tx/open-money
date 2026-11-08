import type { Transaction } from "@rocket/shared";

export function MerchantLogo({
  txn,
}: {
  txn: Pick<Transaction, "logoUrl" | "merchantName" | "name">;
}) {
  return txn.logoUrl ? (
    <img src={txn.logoUrl} alt="" className="size-7 shrink-0 rounded-full" />
  ) : (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-13 font-bold text-accent">
      {(txn.merchantName ?? txn.name)[0]}
    </span>
  );
}
