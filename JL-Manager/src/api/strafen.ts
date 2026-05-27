import { apiFetch } from "./client";
import type { Strafe, StrafeEintrag } from "../types/strafen";

export function fetchStrafen(): Promise<Strafe[]> {
  return apiFetch("/strafen");
}

export function createStrafe(data: { name: string; beschreibung?: string; betrag: number }): Promise<Strafe> {
  return apiFetch("/strafen", { method: "POST", body: JSON.stringify(data) });
}

export function updateStrafe(id: number, data: { name?: string; beschreibung?: string | null; betrag?: number }): Promise<Strafe> {
  return apiFetch(`/strafen/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteStrafe(id: number): Promise<void> {
  return apiFetch(`/strafen/${id}`, { method: "DELETE" });
}

export function fetchEintraege(filters?: {
  memberId?: number;
  strafeId?: number;
  businessYearId?: number;
  bezahlt?: boolean;
}): Promise<StrafeEintrag[]> {
  const params = new URLSearchParams();
  if (filters?.memberId != null) params.set("memberId", String(filters.memberId));
  if (filters?.strafeId != null) params.set("strafeId", String(filters.strafeId));
  if (filters?.businessYearId != null) params.set("businessYearId", String(filters.businessYearId));
  if (filters?.bezahlt != null) params.set("bezahlt", String(filters.bezahlt));
  const qs = params.toString();
  return apiFetch(`/strafen/eintraege${qs ? `?${qs}` : ""}`);
}

export function createEintrag(data: {
  memberId: number;
  strafeId: number;
  businessYearId: number;
  grund?: string;
}): Promise<StrafeEintrag> {
  return apiFetch("/strafen/eintraege", { method: "POST", body: JSON.stringify(data) });
}

export function updateEintrag(id: number, data: { bezahlt?: boolean; grund?: string | null }): Promise<StrafeEintrag> {
  return apiFetch(`/strafen/eintraege/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteEintrag(id: number): Promise<void> {
  return apiFetch(`/strafen/eintraege/${id}`, { method: "DELETE" });
}
