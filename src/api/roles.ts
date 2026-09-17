import { apiFetch } from "./client";
import type { Role } from "../types/member";

export function createRole(data: { name: string; accessLevel?: number; description?: string }): Promise<Role> {
  return apiFetch("/roles", { method: "POST", body: JSON.stringify(data) });
}

export function updateRole(id: number, data: Partial<{ name: string; accessLevel: number; description: string }>): Promise<Role> {
  return apiFetch(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteRole(id: number): Promise<void> {
  return apiFetch(`/roles/${id}`, { method: "DELETE" });
}
