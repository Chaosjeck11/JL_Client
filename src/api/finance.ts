import { apiFetch } from "./client";
import type {
  BusinessYear,
  Category,
  Mitgliedsbeitrag,
  RunningBalanceEntry,
  Transaction,
  TransactionAttachment,
  TransactionType,
} from "../types/finance";

const API_URL = "http://DEPLOY_SERVER_IP:3000";

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

export function fetchAttachments(transactionId: number): Promise<TransactionAttachment[]> {
  return apiFetch(`/finance/transactions/${transactionId}/attachments`);
}

export async function uploadAttachment(transactionId: number, file: File): Promise<TransactionAttachment> {
  const token = localStorage.getItem("token");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/finance/transactions/${transactionId}/attachments`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function downloadAttachment(transactionId: number, attachmentId: number, filename: string): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/finance/transactions/${transactionId}/attachments/${attachmentId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchAttachmentArrayBuffer(transactionId: number, attachmentId: number): Promise<ArrayBuffer> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/finance/transactions/${transactionId}/attachments/${attachmentId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.arrayBuffer();
}

export async function fetchAttachmentDataUrl(transactionId: number, attachmentId: number): Promise<string> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/finance/transactions/${transactionId}/attachments/${attachmentId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function deleteAttachment(transactionId: number, attachmentId: number): Promise<void> {
  return apiFetch(`/finance/transactions/${transactionId}/attachments/${attachmentId}`, { method: "DELETE" });
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
