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
export const LINK_KINDS = ["banking", "investments"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/** `itemId` reopens Link in update mode to repair that connection's login. */
export type LinkTarget = { kind: LinkKind } | { itemId: string };

export const ITEM_STATUSES = ["ok", "login_required", "error"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export interface Institution {
  itemId: string;
  name: string;
  status: ItemStatus;
  error: string | null;
  products: string[];
  lastSyncedAt: string | null;
}

export const ACCOUNT_TYPES = [
  "depository",
  "credit",
  "loan",
  "investment",
  "other",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface Account {
  id: string;
  itemId: string;
  institutionName: string;
  name: string;
  mask: string | null;
  type: AccountType;
  subtype: string | null;
  /** Plaid's convention: positive for every type, so a credit or loan balance is money owed. */
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

export const RECURRING_DIRECTIONS = ["inflow", "outflow"] as const;
export type RecurringDirection = (typeof RECURRING_DIRECTIONS)[number];

export const RECURRING_FREQUENCIES = [
  "UNKNOWN",
  "WEEKLY",
  "BIWEEKLY",
  "SEMI_MONTHLY",
  "MONTHLY",
  "ANNUALLY",
] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export interface RecurringStream {
  id: string;
  accountId: string;
  direction: RecurringDirection;
  name: string;
  merchantName: string | null;
  category: string;
  frequency: RecurringFrequency;
  /** Magnitudes. The sign lives in `direction`, unlike `Transaction.amount`. */
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
  /** Spending per calendar day, index 0 being the 1st. This month stops at today. */
  dailySpending: { thisMonth: number[]; lastMonth: number[] };
  spendingByCategory: CategoryAmount[];
  netWorthHistory: { date: ISODate; value: number }[];
  upcoming: RecurringStream[];
  recentTransactions: Transaction[];
}
