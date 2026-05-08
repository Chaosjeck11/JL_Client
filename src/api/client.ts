const API_URL = "http://DEPLOY_SERVER_IP:3000";

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

  return res.json();
}
