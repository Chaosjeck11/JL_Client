const DEFAULT_API_URL = "http://100.91.210.125:3000";

export function getApiUrl(): string {
  return (localStorage.getItem("api_base_url") ?? DEFAULT_API_URL).replace(/\/$/, "");
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^\w.\-]/g, "_");
}

export async function prepareFileForUpload(file: File): Promise<[Blob, string]> {
  const buffer = await file.arrayBuffer();
  const blob = new Blob([buffer], { type: file.type });
  return [blob, sanitizeFilename(file.name)];
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
) {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`API error ${res.status}`) as Error & { status: number; body: string };
    err.status = res.status;
    err.body = text;
    throw err;
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return;
  }

  return res.json();
}
