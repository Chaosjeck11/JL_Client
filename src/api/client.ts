const API_URL = "http://100.91.210.125:3000";

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

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return;
  }

  return res.json();
}
