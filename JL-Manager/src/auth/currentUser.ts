type JwtPayload = {
  sub: number;
  email: string;
  accessLevel: number;
  role: string;
};

function base64UrlDecode(input: string) {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = input.length % 4;
  if (pad) {
    input += "=".repeat(4 - pad);
  }
  return atob(input);
}

export function getCurrentUser(): JwtPayload | null {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    return JSON.parse(base64UrlDecode(payload));
  } catch (e) {
    console.error("JWT decode failed", e);
    return null;
  }
}
