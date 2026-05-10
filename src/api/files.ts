import { apiFetch, getApiUrl, prepareFileForUpload } from "./client";
import type { AppFile } from "../types/files";


export function fetchFiles(path?: string): Promise<AppFile[]> {
  const params = path ? `?path=${encodeURIComponent(path)}` : "";
  return apiFetch(`/files${params}`);
}

export function fetchFolders(): Promise<string[]> {
  return apiFetch("/files/folders");
}

export async function uploadFile(
  file: File,
  path?: string,
  description?: string,
): Promise<AppFile> {
  const token = localStorage.getItem("token");
  const [blob, filename] = await prepareFileForUpload(file);
  const form = new FormData();
  form.append("file", blob, filename);
  if (path !== undefined) form.append("path", path);
  if (description !== undefined) form.append("description", description);
  const res = await fetch(`${getApiUrl()}/files/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function downloadFile(id: number, filename: string): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${getApiUrl()}/files/${id}/download`, {
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

export async function previewFile(id: number): Promise<string> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${getApiUrl()}/files/${id}/preview`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function updateFile(
  id: number,
  data: { description?: string; path?: string },
): Promise<AppFile> {
  return apiFetch(`/files/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteFile(id: number): Promise<void> {
  return apiFetch(`/files/${id}`, { method: "DELETE" });
}
