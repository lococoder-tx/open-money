import {
  keepPreviousData,
  QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import type {
  Account,
  Budget,
  Holding,
  Institution,
  RecurringStream,
  Summary,
  TransactionPage,
} from "@rocket/shared";
import { api } from "./api.ts";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export interface TransactionFilters {
  limit: number;
  offset: number;
  search?: string;
  category?: string;
  accountId?: string;
}

const get = <T>(path: string) =>
  queryOptions({ queryKey: [path], queryFn: () => api<T>(path) });

export const queries = {
  institutions: get<Institution[]>("/institutions"),
  accounts: get<Account[]>("/accounts"),
  summary: get<Summary>("/summary"),
  categories: get<string[]>("/categories"),
  budgets: get<Budget[]>("/budgets"),
  recurring: get<RecurringStream[]>("/recurring"),
  holdings: get<Holding[]>("/holdings"),
  transactions: (filters: TransactionFilters) =>
    queryOptions({
      queryKey: ["/transactions", filters],
      queryFn: () => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(filters))
          if (value !== undefined && value !== "")
            params.set(key, String(value));
        return api<TransactionPage>(`/transactions?${params}`);
      },
      placeholderData: keepPreviousData,
    }),
};
