import { useState, useEffect, useRef } from "react";
import { login } from "../auth/auth";
import { version as APP_VERSION } from "../../package.json";

const DEFAULT_API_URL = "https://jl_manage.ct-2514.de";

const PLATFORMS = ["linux", "windows", "android"] as const;
type Platform = (typeof PLATFORMS)[number];

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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [connectivity, setConnectivity] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const connectivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLog, setDebugLog] = useState("");
  const [debugLoading, setDebugLoading] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [debugPlatform, setDebugPlatform] = useState<Platform>("linux");

  useEffect(() => {
    if (connectivityTimer.current) clearTimeout(connectivityTimer.current);
    setConnectivity("checking");
    connectivityTimer.current = setTimeout(async () => {
      const url = apiUrl.trim().replace(/\/$/, "") || DEFAULT_API_URL;
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 3000);
      try {
        await fetch(url, { mode: "no-cors", signal: ctrl.signal });
        setConnectivity("ok");
      } catch {
        setConnectivity("error");
      } finally {
        clearTimeout(timeout);
      }
    }, 800);
    return () => { if (connectivityTimer.current) clearTimeout(connectivityTimer.current); };
  }, [apiUrl]);

  async function runDebugCheck() {
    setDebugLoading(true);
    setUpdateAvailable(false);
    setLatestVersion("");
    const lines: string[] = [];

    let platform: string = debugPlatform;
    if ("__TAURI_INTERNALS__" in window) {
      try {
        const { platform: getPlatform } = await import("@tauri-apps/plugin-os");
        platform = await getPlatform();
        lines.push(`Platform (Tauri): ${platform}`);
      } catch (e) {
        lines.push(`Platform-Erkennung fehlgeschlagen: ${e}`);
        lines.push(`Fallback auf: ${platform}`);
      }
    } else {
      lines.push(`Kein Tauri — gewählte Platform: ${platform}`);
    }

    const base = apiUrl.trim().replace(/\/$/, "") || DEFAULT_API_URL;
    const url = `${base}/update/check?version=${encodeURIComponent(APP_VERSION)}&platform=${platform}`;
    lines.push(`\nAktuelle Version: ${APP_VERSION}`);
    lines.push(`GET ${url}`);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      lines.push(`Status: ${res.status} ${res.statusText}`);
      const text = await res.text();
      lines.push(`\n--- Serverantwort ---`);
      try {
        const json = JSON.parse(text);
        lines.push(JSON.stringify(json, null, 2));
        if (json?.updateAvailable) {
          setUpdateAvailable(true);
          setLatestVersion(json.latestVersion ?? "");
        }
      } catch {
        lines.push(text);
      }
    } catch (e) {
      lines.push(`\nNetzwerkfehler: ${e}`);
    }

    setDebugLog(lines.join("\n"));
    setDebugLoading(false);
  }

  async function runManualUpdate() {
    if (!latestVersion) return;
    const lines: string[] = [debugLog, "", "--- Update-Download ---"];
    const base = apiUrl.trim().replace(/\/$/, "") || DEFAULT_API_URL;
    const platform = debugPlatform;
    const downloadUrl = `${base}/update/download?platform=${platform}`;
    lines.push(`GET ${downloadUrl}`);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(downloadUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      lines.push(`Status: ${res.status} ${res.statusText}`);
      if (!res.ok) {
        lines.push("Download fehlgeschlagen.");
        setDebugLog(lines.join("\n"));
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const ext = platform === "windows" ? "exe" : platform === "android" ? "apk" : "AppImage";
      const disposition = res.headers.get("content-disposition") ?? "";
      const fnMatch = disposition.match(/filename="?([^";\n]+)"?/i);
      const filename = fnMatch?.[1] ?? `jl-manager-${latestVersion}.${ext}`;
      lines.push(`Dateiname: ${filename}`);
      lines.push(`Größe: ${(uint8.byteLength / 1024 / 1024).toFixed(2)} MB`);

      if ("__TAURI_INTERNALS__" in window) {
        const { writeFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
        await writeFile(filename, uint8, { baseDir: BaseDirectory.Download });
        const { downloadDir } = await import("@tauri-apps/api/path");
        const { openPath } = await import("@tauri-apps/plugin-opener");
        const dir = await downloadDir();
        await openPath(`${dir}/${filename}`);
        lines.push("Gespeichert in Downloads. Ordner geöffnet.");
      } else {
        const blob = new Blob([uint8]);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
        lines.push("Download über Browser gestartet.");
      }
    } catch (e) {
      lines.push(`Fehler: ${e}`);
    }

    setDebugLog(lines.join("\n"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmed = apiUrl.trim().replace(/\/$/, "") || DEFAULT_API_URL;
    localStorage.setItem("api_base_url", trimmed);

    try {
      await login(email, password);
      onSuccess();
    } catch {
      setError("Login fehlgeschlagen. E-Mail oder Passwort ungültig.");
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
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={inputStyle}
            />
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
              {error}
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
              <label style={{ ...labelStyle, marginBottom: 0 }}>Server-Adresse</label>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: connectivity === "ok" ? "#22c55e" : connectivity === "error" ? "#ef4444" : "#f59e0b",
                display: "inline-block",
                boxShadow: connectivity === "ok" ? "0 0 4px #22c55e80" : connectivity === "error" ? "0 0 4px #ef444480" : "none",
                transition: "background 0.3s",
              }} title={connectivity === "ok" ? "Erreichbar" : connectivity === "error" ? "Nicht erreichbar" : "Prüfe…"} />
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
          </div>
        </form>

        {/* Debug section */}
        <div style={{ marginTop: 24, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
          <button
            type="button"
            onClick={() => setDebugOpen(o => !o)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 9, lineHeight: 1 }}>{debugOpen ? "▼" : "▶"}</span>
            Debug / Update
          </button>

          {debugOpen && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Version row */}
              <div style={{ fontSize: 12, color: "#64748b" }}>
                <span style={{ fontWeight: 600 }}>Aktuelle Version:</span> {APP_VERSION}
                {latestVersion && (
                  <>
                    {" · "}
                    <span style={{ fontWeight: 600 }}>Server:</span> {latestVersion}
                    {" · "}
                    <span style={{ color: updateAvailable ? "#ef4444" : "#22c55e", fontWeight: 600 }}>
                      {updateAvailable ? "Update verfügbar" : "Aktuell"}
                    </span>
                  </>
                )}
              </div>

              {/* Platform selector + buttons */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={debugPlatform}
                  onChange={e => setDebugPlatform(e.target.value as Platform)}
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    background: "#f8fafc",
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  {PLATFORMS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={runDebugCheck}
                  disabled={debugLoading}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    background: "#1e293b",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: debugLoading ? "not-allowed" : "pointer",
                    opacity: debugLoading ? 0.6 : 1,
                  }}
                >
                  {debugLoading ? "Prüfe…" : "Update prüfen"}
                </button>

                {updateAvailable && (
                  <button
                    type="button"
                    onClick={runManualUpdate}
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      background: "#dc2626",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Update herunterladen
                  </button>
                )}
              </div>

              {/* Raw log */}
              {debugLog && (
                <textarea
                  readOnly
                  value={debugLog}
                  rows={10}
                  style={{
                    width: "100%",
                    fontSize: 10,
                    fontFamily: "monospace",
                    padding: "8px 10px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    background: "#0f172a",
                    color: "#94a3b8",
                    resize: "vertical",
                    boxSizing: "border-box",
                    lineHeight: 1.5,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
