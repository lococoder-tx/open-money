// API contract shared by server and web. Amounts follow Plaid's sign convention
// for transactions (positive = money leaving the account) and are in major units.

export type ISODate = string;

/** Plaid categories for money moving between your own accounts or arriving as pay. Never counted as spending. */
export const NON_SPENDING_CATEGORIES = [
  "INCOME",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "LOAN_PAYMENTS",
];

/**
 * Which Plaid products a connection requires. Investment-only institutions
 * (Principal, many 401k providers) don't support `transactions`, so requiring it
 * would hide them from Link.
 */
export type LinkKind = "banking" | "investments";

export type ItemStatus = "ok" | "login_required" | "error";

export interface Institution {
  itemId: string;
  name: string;
  status: ItemStatus;
  error: string | null;
  products: string[];
  lastSyncedAt: string | null;
}

export type AccountType =
  "depository" | "credit" | "loan" | "investment" | "other";

export interface Account {
  id: string;
  itemId: string;
  institutionName: string;
  name: string;
  mask: string | null;
  type: AccountType;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  currency: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  accountName: string;
  amount: number;
  currency: string;
  date: ISODate;
  name: string;
  merchantName: string | null;
  logoUrl: string | null;
  /** User override if set, else Plaid's personal_finance_category.primary. */
  category: string;
  pending: boolean;
}

export interface TransactionPage {
  transactions: Transaction[];
  total: number;
}

export interface Holding {
  accountId: string;
  accountName: string;
  securityId: string;
  name: string;
  ticker: string | null;
  type: string | null;
  quantity: number;
  price: number;
  value: number;
  costBasis: number | null;
}

export type RecurringDirection = "inflow" | "outflow";

export interface RecurringStream {
  id: string;
  accountId: string;
  direction: RecurringDirection;
  name: string;
  merchantName: string | null;
  category: string;
  frequency: string;
  averageAmount: number;
  lastAmount: number;
  lastDate: ISODate;
  nextDate: ISODate | null;
  isActive: boolean;
  hidden: boolean;
}

export interface Budget {
  category: string;
  monthlyLimit: number;
  spent: number;
}

export interface CategoryAmount {
  category: string;
  amount: number;
}

export interface Summary {
  netWorth: number;
  assets: number;
  liabilities: number;
  monthSpending: number;
  lastMonthSpending: number;
  monthIncome: number;
  spendingByCategory: CategoryAmount[];
  netWorthHistory: { date: ISODate; value: number }[];
  upcoming: RecurringStream[];
}
