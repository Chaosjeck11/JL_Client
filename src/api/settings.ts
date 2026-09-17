import { apiFetch } from "./client";
import type { Settings, UpdateSettingsBody } from "../types/settings";

export function fetchSettings(): Promise<Settings> {
  return apiFetch("/settings");
}

export function updateSettings(body: UpdateSettingsBody): Promise<Settings> {
  return apiFetch("/settings", { method: "PATCH", body: JSON.stringify(body) });
}
