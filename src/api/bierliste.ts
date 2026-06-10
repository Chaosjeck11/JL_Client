import { apiFetch, getApiUrl } from "./client";
import { getToken } from "../auth/auth";
import type {
  BierDrink,
  BierFridge,
  BierConsumption,
  BierMemberBalance,
  BierCashbox,
  BierCashboxTransaction,
  BierUserStat,
} from "../types/bierliste";

// ── Drinks ────────────────────────────────────────────────────────────────────

export function fetchBierDrinks(includeInactive = false): Promise<BierDrink[]> {
  return apiFetch(`/bierliste/drinks${includeInactive ? "?includeInactive=true" : ""}`);
}

export function createBierDrink(data: { name: string; pricePerUnit: number; description?: string; category?: string }): Promise<BierDrink> {
  return apiFetch("/bierliste/drinks", { method: "POST", body: JSON.stringify(data) });
}

export function updateBierDrink(id: number, data: { name?: string; pricePerUnit?: number; description?: string; category?: string; active?: boolean; sortOrder?: number }): Promise<BierDrink> {
  return apiFetch(`/bierliste/drinks/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteBierDrink(id: number): Promise<void> {
  return apiFetch(`/bierliste/drinks/${id}`, { method: "DELETE" });
}

export async function uploadBierDrinkImage(drinkId: number, file: File): Promise<BierDrink> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${getApiUrl()}/bierliste/drinks/${drinkId}/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Fridge ────────────────────────────────────────────────────────────────────

export function fetchBierFridge(): Promise<BierFridge[]> {
  return apiFetch("/bierliste/fridge");
}

export function updateBierFridge(drinkId: number, data: { mode: "set" | "add" | "subtract"; value: number; minStock?: number; maxStock?: number; location?: string }): Promise<BierFridge> {
  return apiFetch(`/bierliste/fridge/${drinkId}`, { method: "PATCH", body: JSON.stringify(data) });
}

// ── Consumption ───────────────────────────────────────────────────────────────

export function fetchMyConsumption(): Promise<BierConsumption[]> {
  return apiFetch("/bierliste/consumption/me");
}

export function postConsumption(drinkId: number, amount: number, note?: string): Promise<BierConsumption> {
  return apiFetch("/bierliste/consumption", {
    method: "POST",
    body: JSON.stringify({ drinkId, amount, ...(note ? { note } : {}) }),
  });
}

// ── Members / Balances ────────────────────────────────────────────────────────

export function fetchMyBalance(): Promise<BierMemberBalance> {
  return apiFetch("/bierliste/members/balance/me");
}

export function fetchAllBalances(): Promise<BierMemberBalance[]> {
  return apiFetch("/bierliste/members/balance");
}

export function payMember(memberId: number, amount: number): Promise<BierMemberBalance> {
  return apiFetch(`/bierliste/members/${memberId}/pay`, { method: "PATCH", body: JSON.stringify({ amount }) });
}

export function adjustMemberAmounts(memberId: number, data: { openAmount?: number; paidAmount?: number }): Promise<BierMemberBalance> {
  return apiFetch(`/bierliste/members/${memberId}/amounts`, { method: "PATCH", body: JSON.stringify(data) });
}

// ── Cashbox ───────────────────────────────────────────────────────────────────

export function fetchCashbox(): Promise<BierCashbox> {
  return apiFetch("/bierliste/cashbox");
}

export function postCashboxTransaction(data: { amount: number; direction: "IN" | "OUT" | "CORRECTION"; reason?: string; paymentType?: string; userIdPaid?: number }): Promise<BierCashboxTransaction> {
  return apiFetch("/bierliste/cashbox", { method: "POST", body: JSON.stringify(data) });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function fetchBierStats(): Promise<BierUserStat[]> {
  return apiFetch("/bierliste/stats/users");
}
