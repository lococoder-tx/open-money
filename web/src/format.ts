const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function money(amount: number | null, currency = "USD"): string {
  if (amount == null) return "—";
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", { style: "currency", currency });
    currencyFormatters.set(currency, fmt);
  }
  return fmt.format(amount);
}

/** `FOOD_AND_DRINK` → `Food and drink` */
export function categoryLabel(category: string): string {
  const words = category.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
