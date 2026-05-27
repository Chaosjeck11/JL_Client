import { apiFetch, getApiUrl, prepareFileForUpload } from "./client";
import type {
  AllAttachments,
  FormColumn,
  Veranstaltung,
  VeranstaltungAttachment,
  VeranstaltungFinancials,
  VeranstaltungForm,
  VeranstaltungFormRow,
  VeranstaltungFormTemplate,
  VeranstaltungKategorie,
} from "../types/veranstaltungen";

export function fetchVeranstaltungen(): Promise<Veranstaltung[]> {
  return apiFetch("/veranstaltungen");
}

export function fetchVeranstaltung(id: number): Promise<Veranstaltung> {
  return apiFetch(`/veranstaltungen/${id}`);
}

export function createVeranstaltung(data: {
  name: string;
  date: string;
  description?: string;
}): Promise<Veranstaltung> {
  return apiFetch("/veranstaltungen", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateVeranstaltung(
  id: number,
  data: Partial<{ name: string; date: string; description: string | null }>,
): Promise<Veranstaltung> {
  return apiFetch(`/veranstaltungen/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteVeranstaltung(id: number): Promise<void> {
  return apiFetch(`/veranstaltungen/${id}`, { method: "DELETE" });
}

export function fetchVeranstaltungFinancials(id: number): Promise<VeranstaltungFinancials> {
  return apiFetch(`/veranstaltungen/${id}/financials`);
}

export function fetchAllAttachments(id: number): Promise<AllAttachments> {
  return apiFetch(`/veranstaltungen/${id}/all-attachments`);
}

export async function uploadVeranstaltungAttachment(
  id: number,
  file: File,
): Promise<VeranstaltungAttachment> {
  const token = localStorage.getItem("token");
  const [blob, filename] = await prepareFileForUpload(file);
  const fd = new FormData();
  fd.append("file", blob, filename);
  const res = await fetch(`${getApiUrl()}/veranstaltungen/${id}/attachments`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) throw new Error(`Upload fehlgeschlagen: ${res.status}`);
  return res.json();
}

export async function downloadVeranstaltungAttachment(
  id: number,
  aid: number,
  filename: string,
): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(
    `${getApiUrl()}/veranstaltungen/${id}/attachments/${aid}/download`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchVeranstaltungAttachmentBlob(
  id: number,
  aid: number,
): Promise<{ url: string; mimeType: string }> {
  const token = localStorage.getItem("token");
  const res = await fetch(
    `${getApiUrl()}/veranstaltungen/${id}/attachments/${aid}/download`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new Error(`Vorschau fehlgeschlagen: ${res.status}`);
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), mimeType };
}

export function deleteVeranstaltungAttachment(id: number, aid: number): Promise<void> {
  return apiFetch(`/veranstaltungen/${id}/attachments/${aid}`, { method: "DELETE" });
}

export function fetchVeranstaltungForm(id: number): Promise<VeranstaltungForm> {
  return apiFetch(`/veranstaltungen/${id}/form`);
}

export function addFormRow(
  id: number,
  cells: Record<string, unknown> = {},
): Promise<VeranstaltungFormRow> {
  return apiFetch(`/veranstaltungen/${id}/form/rows`, {
    method: "POST",
    body: JSON.stringify({ cells }),
  });
}

export function updateFormRow(
  id: number,
  rowId: number,
  data: { cells?: Record<string, unknown>; rowIndex?: number },
): Promise<VeranstaltungFormRow> {
  return apiFetch(`/veranstaltungen/${id}/form/rows/${rowId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteFormRow(id: number, rowId: number): Promise<void> {
  return apiFetch(`/veranstaltungen/${id}/form/rows/${rowId}`, { method: "DELETE" });
}

export function updateFormColumns(
  id: number,
  columns: FormColumn[],
): Promise<VeranstaltungForm> {
  return apiFetch(`/veranstaltungen/${id}/form`, {
    method: "PATCH",
    body: JSON.stringify({ columns }),
  });
}

export function fetchFormTemplate(): Promise<VeranstaltungFormTemplate> {
  return apiFetch("/veranstaltung-form-template");
}

export function updateFormTemplate(columns: FormColumn[]): Promise<VeranstaltungFormTemplate> {
  return apiFetch("/veranstaltung-form-template", {
    method: "PATCH",
    body: JSON.stringify({ columns }),
  });
}

export function fetchVeranstaltungKategorien(): Promise<VeranstaltungKategorie[]> {
  return apiFetch("/veranstaltung-kategorien");
}

export function createVeranstaltungKategorie(data: {
  name: string;
  description?: string | null;
  color?: string | null;
}): Promise<VeranstaltungKategorie> {
  return apiFetch("/veranstaltung-kategorien", { method: "POST", body: JSON.stringify(data) });
}

export function updateVeranstaltungKategorie(
  id: number,
  data: { name?: string; description?: string | null; color?: string | null },
): Promise<VeranstaltungKategorie> {
  return apiFetch(`/veranstaltung-kategorien/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteVeranstaltungKategorie(id: number): Promise<void> {
  return apiFetch(`/veranstaltung-kategorien/${id}`, { method: "DELETE" });
}
