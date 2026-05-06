import { apiFetch } from "./client";
import type {
  BusinessYear,
  Category,
  Mitgliedsbeitrag,
  RunningBalanceEntry,
  Transaction,
  TransactionType,
} from "../types/finance";

export function fetchCategories(): Promise<Category[]> {
  return apiFetch("/finance/categories");
}

export function createCategory(data: {
  name: string;
  description?: string;
}): Promise<Category> {
  return apiFetch("/finance/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteCategory(id: number): Promise<void> {
  return apiFetch(`/finance/categories/${id}`, { method: "DELETE" });
}

export function fetchBusinessYears(): Promise<BusinessYear[]> {
  return apiFetch("/finance/business-years");
}

export function fetchBusinessYear(id: number): Promise<BusinessYear> {
  return apiFetch(`/finance/business-years/${id}`);
}

export function createBusinessYear(data: { year: number }): Promise<BusinessYear> {
  return apiFetch("/finance/business-years", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteBusinessYear(id: number): Promise<void> {
  return apiFetch(`/finance/business-years/${id}`, { method: "DELETE" });
}

export function fetchTransactions(filters?: {
  businessYearId?: number;
  categoryId?: number;
  type?: TransactionType;
}): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (filters?.businessYearId !== undefined)
    params.set("businessYearId", String(filters.businessYearId));
  if (filters?.categoryId !== undefined)
    params.set("categoryId", String(filters.categoryId));
  if (filters?.type !== undefined) params.set("type", filters.type);
  const query = params.size > 0 ? `?${params}` : "";
  return apiFetch(`/finance/transactions${query}`);
}

export function fetchRunningBalance(
  businessYearId: number,
): Promise<RunningBalanceEntry[]> {
  return apiFetch(`/finance/transactions/balance/${businessYearId}`);
}

export function createTransaction(data: {
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  categoryId: number;
  businessYearId: number;
  relatedTransactionId?: number;
  memberId?: number | null;
  tag?: "ONLINE" | "BAR" | null;
}): Promise<Transaction> {
  return apiFetch("/finance/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTransaction(
  id: number,
  data: { date?: string; description?: string; categoryId?: number; memberId?: number | null; tag?: "ONLINE" | "BAR" | null },
): Promise<Transaction> {
  return apiFetch(`/finance/transactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteTransaction(id: number): Promise<void> {
  return apiFetch(`/finance/transactions/${id}`, { method: "DELETE" });
}

export function fetchMitgliedsbeitraege(filters?: {
  businessYearId?: number;
  memberId?: number;
  status?: string;
}): Promise<Mitgliedsbeitrag[]> {
  const params = new URLSearchParams();
  if (filters?.businessYearId !== undefined)
    params.set("businessYearId", String(filters.businessYearId));
  if (filters?.memberId !== undefined)
    params.set("memberId", String(filters.memberId));
  if (filters?.status) params.set("status", filters.status);
  const query = params.size > 0 ? `?${params}` : "";
  return apiFetch(`/finance/mitgliedsbeitraege${query}`);
}
