import { useState, useEffect, useRef } from "react";
import { login } from "../auth/auth";
import type { ApiError } from "../api/client";

const DEFAULT_API_URL = "http://100.91.210.125:3000";

type Props = {
  onSuccess: () => void;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
  color: "#1e293b",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#6b7280",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export default function Login({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiUrl, setApiUrl] = useState(
    () => localStorage.getItem("api_base_url") ?? DEFAULT_API_URL,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reachability, setReachability] = useState<"checking" | "ok" | "error">("checking");
  const isFirstRender = useRef(true);

  async function checkReachability(url: string) {
    const trimmed = url.trim().replace(/\/$/, "") || DEFAULT_API_URL;
    setReachability("checking");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      await fetch(trimmed, { method: "HEAD", mode: "no-cors", signal: controller.signal });
      setReachability("ok");
    } catch {
      setReachability("error");
    } finally {
      clearTimeout(timer);
    }
  }

  useEffect(() => {
    checkReachability(apiUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => checkReachability(apiUrl), 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowDetail(false);
    setLoading(true);

    const trimmed = apiUrl.trim().replace(/\/$/, "") || DEFAULT_API_URL;
    localStorage.setItem("api_base_url", trimmed);

    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      const apiErr = err as ApiError;
      const status = apiErr.status ? ` (${apiErr.status})` : "";
      let detail = apiErr.body ?? "";
      try {
        const parsed = JSON.parse(detail);
        detail = JSON.stringify(parsed, null, 2);
      } catch { /* not JSON, keep raw */ }
      setError({
        message: `Login fehlgeschlagen${status}. E-Mail oder Passwort ungültig.`,
        detail: detail || apiErr.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#ffffff",
        borderRadius: 16,
        padding: "40px 36px 32px",
        width: "100%",
        maxWidth: 380,
        boxShadow: "0 25px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
      }}>
        {/* Logo / Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "#1e293b",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
            boxShadow: "0 4px 12px rgba(30,41,59,0.3)",
          }}>
            <span style={{ color: "#fff", fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>JL</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.3px" }}>
            Vereinsverwaltung
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Melde dich mit deinem Konto an
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Email */}
          <div>
            <label style={labelStyle}>E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@beispiel.de"
              required
              autoComplete="email"
              style={inputStyle}
            />
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>Passwort</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 16,
                  color: "#94a3b8",
                  lineHeight: 1,
                }}
                tabIndex={-1}
                aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 12px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              color: "#dc2626",
              fontSize: 13,
              lineHeight: 1.4,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span>{error.message}</span>
                {error.detail && (
                  <button
                    type="button"
                    onClick={() => setShowDetail(v => !v)}
                    style={{
                      flexShrink: 0,
                      background: "none",
                      border: "1px solid #fca5a5",
                      borderRadius: 4,
                      color: "#dc2626",
                      fontSize: 11,
                      cursor: "pointer",
                      padding: "2px 6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {showDetail ? "Details ▲" : "Details ▼"}
                  </button>
                )}
              </div>
              {showDetail && error.detail && (
                <pre style={{
                  marginTop: 8,
                  marginBottom: 0,
                  padding: "8px 10px",
                  background: "#fff5f5",
                  borderRadius: 4,
                  fontSize: 11,
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  color: "#7f1d1d",
                }}>
                  {error.detail}
                </pre>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "11px",
              background: loading ? "#94a3b8" : "#1e293b",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.01em",
            }}
          >
            {loading ? "Anmelden…" : "Anmelden"}
          </button>

          {/* Server URL */}
          <div style={{
            borderTop: "1px solid #f1f5f9",
            paddingTop: 18,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0, color: "#94a3b8" }}>Server-Adresse</label>
              <span style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 3 }}>
                {reachability === "checking" && <><span>🟡</span> Prüfe…</>}
                {reachability === "ok"       && <><span>🟢</span> Erreichbar</>}
                {reachability === "error"    && <><span>🔴</span> Nicht erreichbar</>}
              </span>
            </div>
            <input
              type="text"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              placeholder={DEFAULT_API_URL}
              style={{
                ...inputStyle,
                fontSize: 12,
                color: "#64748b",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            />
            {reachability === "error" && (
              <div style={{ marginTop: 5, fontSize: 11, color: "#dc2626" }}>
                Tailscale aktiv?
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
