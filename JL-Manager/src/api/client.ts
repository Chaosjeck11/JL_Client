export const DEFAULT_API_URL = "http://DEPLOY_SERVER_IP:3000";

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

export async function apiFetch<T = void>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("token");
  const { headers: optionsHeaders, ...restOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${getApiUrl()}${path}`, {
    ...restOptions,
    headers: { ...(optionsHeaders as Record<string, string>), ...headers },
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
