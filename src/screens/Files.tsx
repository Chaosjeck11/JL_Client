import { useEffect, useRef, useState } from "react";
import {
  deleteFile,
  downloadFile,
  fetchFiles,
  fetchFolders,
  previewFile,
  updateFile,
  uploadFile as apiUploadFile,
} from "../api/files";
import { fetchMembers } from "../api/members";
import { canManageFinance } from "../auth/permissions";
import type { AppFile } from "../types/files";
import type { Member } from "../types/member";

function fmtDate(d: string): string {
  if (!d) return "–";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Files() {
  const [files, setFiles] = useState<AppFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<AppFile | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const [uploadFileVal, setUploadFileVal] = useState<File | null>(null);
  const [uploadPath, setUploadPath] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [editDesc, setEditDesc] = useState("");
  const [editPath, setEditPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isAdmin = canManageFinance();

  useEffect(() => {
    Promise.all([fetchFiles(), fetchFolders(), fetchMembers()])
      .then(([f, flds, mems]) => {
        setFiles(f);
        setFolders(flds);
        setMembers(mems);
      })
      .catch(() => setError("Fehler beim Laden der Dateien"));
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);
    }

    if (!selectedFile) {
      setPreviewLoading(false);
      setEditDesc("");
      setEditPath("");
      setSaveError("");
      return;
    }

    setEditDesc(selectedFile.description ?? "");
    setEditPath(selectedFile.path ?? "");
    setSaveError("");

    const mime = selectedFile.mimeType;
    const isPreviewable = mime.startsWith("image/") || mime === "application/pdf";
    setPreviewLoading(isPreviewable);
    if (!isPreviewable) return;

    let cancelled = false;
    previewFile(selectedFile.id)
      .then(url => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        previewUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPreviewLoading(false); });

    return () => { cancelled = true; };
  }, [selectedFile?.id]);

  function memberName(id: number): string {
    const m = members.find(m => m.id === id);
    return m ? `${m.firstname} ${m.lastname}` : `#${id}`;
  }

  const filteredFiles = files.filter(f => {
    if (selectedFolder !== null && f.path !== selectedFolder) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!f.filename.toLowerCase().includes(q) && !(f.description ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function handleUpload() {
    if (!uploadFileVal) return;
    setUploading(true);
    setUploadError("");
    try {
      const created = await apiUploadFile(uploadFileVal, uploadPath || undefined, uploadDescription || undefined);
      const newFolders = await fetchFolders();
      setFolders(newFolders);
      setFiles(prev => [...prev, created]);
      setCreating(false);
      setSelectedFile(created);
      setUploadFileVal(null);
      setUploadPath("");
      setUploadDescription("");
    } catch {
      setUploadError("Fehler beim Hochladen der Datei");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!selectedFile) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updateFile(selectedFile.id, {
        description: editDesc || undefined,
        path: editPath || undefined,
      });
      setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
      setSelectedFile(updated);
      fetchFolders().then(setFolders);
    } catch {
      setSaveError("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedFile) return;
    if (!confirm(`Datei "${selectedFile.filename}" wirklich löschen?`)) return;
    try {
      await deleteFile(selectedFile.id);
      setFiles(prev => prev.filter(f => f.id !== selectedFile.id));
      setSelectedFile(null);
      fetchFolders().then(setFolders);
    } catch {
      setSaveError("Fehler beim Löschen");
    }
  }

  const showPanel = creating || !!selectedFile;

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db",
    fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block",
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 44px)", background: "#f8fafc" }}>

      {/* ── LEFT: FILE BROWSER ── */}
      <div style={{ flex: showPanel ? 3 : 1, display: "flex", minWidth: 0 }}>

        {/* Folder sidebar */}
        <div style={{
          width: 180, flexShrink: 0, overflowY: "auto",
          borderRight: "1px solid #e2e8f0", background: "#f1f5f9",
          paddingTop: 16,
        }}>
          <div style={{ padding: "0 14px 8px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Ordner
          </div>
          {([{ label: "Alle Dateien", value: null as string | null }, ...folders.map(f => ({ label: f || "(Kein Ordner)", value: f }))]).map(entry => (
            <button
              key={entry.value ?? "__all__"}
              onClick={() => { setSelectedFolder(entry.value); setSelectedFile(null); setCreating(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "7px 16px", border: "none", cursor: "pointer",
                background: selectedFolder === entry.value ? "#dbeafe" : "transparent",
                borderLeft: `3px solid ${selectedFolder === entry.value ? "#3b82f6" : "transparent"}`,
                color: selectedFolder === entry.value ? "#1d4ed8" : "#374151",
                fontWeight: selectedFolder === entry.value ? 600 : 400,
                fontSize: 13,
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 20px", borderBottom: "1px solid #e2e8f0",
            position: "sticky", top: 0, background: "#fff", zIndex: 1, gap: 10, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                {selectedFolder ?? "Alle Dateien"}
              </h2>
              <span style={{ background: "#f1f5f9", color: "#64748b", borderRadius: 20, padding: "2px 9px", fontSize: 12, fontWeight: 600 }}>
                {filteredFiles.length}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Suchen…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 7, outline: "none", color: "#1e293b", width: 160 }}
              />
              {isAdmin && (
                <button
                  onClick={() => {
                    setCreating(true);
                    setSelectedFile(null);
                    setUploadFileVal(null);
                    setUploadPath(selectedFolder ?? "");
                    setUploadDescription("");
                    setUploadError("");
                  }}
                  style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  + Datei hochladen
                </button>
              )}
            </div>
          </header>

          {error && (
            <div style={{ margin: "10px 20px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ background: "#fff", flex: 1 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  {["Name", "Größe", "Datum", "Beschreibung"].map(h => (
                    <th key={h} align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFiles.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                      Keine Dateien
                    </td>
                  </tr>
                )}
                {filteredFiles.map((f, idx) => {
                  const isSel = selectedFile?.id === f.id;
                  const isHov = hoveredId === f.id;
                  let bg = idx % 2 === 0 ? "#fff" : "#f8fafc";
                  if (isHov) bg = "#f1f5f9";
                  if (isSel) bg = "#eff6ff";
                  return (
                    <tr
                      key={f.id}
                      onClick={() => { setSelectedFile(f); setCreating(false); }}
                      onMouseEnter={() => setHoveredId(f.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{ cursor: "pointer", background: bg, borderBottom: "1px solid #f1f5f9", borderLeft: isSel ? "3px solid #3b82f6" : "3px solid transparent", transition: "background 0.1s" }}
                    >
                      <td style={{ padding: "9px 14px", fontSize: 13, color: "#1e293b", fontWeight: 500, wordBreak: "break-word" }}>{f.filename}</td>
                      <td style={{ padding: "9px 14px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>{fmtSize(f.size)}</td>
                      <td style={{ padding: "9px 14px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(f.uploadedAt)}</td>
                      <td style={{ padding: "9px 14px", fontSize: 13, color: "#94a3b8" }}>{f.description ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── RIGHT: DETAIL / UPLOAD PANEL ── */}
      {showPanel && (
        <div style={{ flex: 2, padding: "20px 24px", overflowY: "auto", background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 16 }}>

          {creating ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#1e293b" }}>Datei hochladen</h3>
                <button onClick={() => setCreating(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8", lineHeight: 1 }}>×</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Datei *</label>
                  <input type="file" onChange={e => setUploadFileVal(e.target.files?.[0] ?? null)} style={{ fontSize: 13, cursor: "pointer" }} />
                </div>
                <div>
                  <label style={labelStyle}>Ordner / Pfad</label>
                  <input type="text" placeholder="z.B. Dokumente/2025" value={uploadPath} onChange={e => setUploadPath(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Beschreibung</label>
                  <input type="text" placeholder="Optionale Beschreibung" value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} style={inputStyle} />
                </div>
              </div>

              {uploadError && (
                <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 13 }}>
                  {uploadError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFileVal || uploading}
                  style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: uploadFileVal && !uploading ? "#1e293b" : "#94a3b8", color: "#fff", fontSize: 13, fontWeight: 600, cursor: uploadFileVal && !uploading ? "pointer" : "not-allowed" }}
                >
                  {uploading ? "Wird hochgeladen…" : "Hochladen"}
                </button>
                <button onClick={() => setCreating(false)} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: "pointer" }}>
                  Abbrechen
                </button>
              </div>
            </>
          ) : selectedFile ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#1e293b", wordBreak: "break-all" }}>{selectedFile.filename}</h3>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{selectedFile.mimeType}</div>
                </div>
                <button onClick={() => setSelectedFile(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8", lineHeight: 1, flexShrink: 0, marginLeft: 8 }}>×</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 13, alignItems: "center" }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>Größe</span>
                <span style={{ color: "#1e293b" }}>{fmtSize(selectedFile.size)}</span>
                <span style={{ color: "#64748b", fontWeight: 600 }}>Hochgeladen</span>
                <span style={{ color: "#1e293b" }}>{fmtDate(selectedFile.uploadedAt)}</span>
                <span style={{ color: "#64748b", fontWeight: 600 }}>Von</span>
                <span style={{ color: "#1e293b" }}>{memberName(selectedFile.uploadedBy)}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Beschreibung</label>
                  {isAdmin ? (
                    <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={inputStyle} placeholder="Keine Beschreibung" />
                  ) : (
                    <div style={{ fontSize: 13, color: "#1e293b" }}>{selectedFile.description ?? "–"}</div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Ordner / Pfad</label>
                  {isAdmin ? (
                    <input type="text" value={editPath} onChange={e => setEditPath(e.target.value)} style={inputStyle} placeholder="(Kein Ordner)" />
                  ) : (
                    <div style={{ fontSize: 13, color: "#1e293b" }}>{selectedFile.path || "–"}</div>
                  )}
                </div>
              </div>

              {saveError && (
                <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 13 }}>
                  {saveError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => downloadFile(selectedFile.id, selectedFile.filename)}
                  style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: "pointer", color: "#374151" }}
                >
                  Herunterladen
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
                    >
                      {saving ? "Speichern…" : "Speichern"}
                    </button>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={handleDelete}
                      style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 13, cursor: "pointer" }}
                    >
                      Löschen
                    </button>
                  </>
                )}
              </div>

              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                {previewLoading && (
                  <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: 24 }}>
                    Vorschau wird geladen…
                  </div>
                )}
                {!previewLoading && previewUrl && selectedFile.mimeType.startsWith("image/") && (
                  <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                    <img src={previewUrl} alt={selectedFile.filename} style={{ width: "100%", display: "block" }} />
                  </div>
                )}
                {!previewLoading && previewUrl && selectedFile.mimeType === "application/pdf" && (
                  <iframe
                    src={previewUrl}
                    title={selectedFile.filename}
                    style={{ width: "100%", height: 600, border: "1px solid #e2e8f0", borderRadius: 8 }}
                  />
                )}
                {!previewLoading && !previewUrl && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 24px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ width: 48, height: 48, background: "#e2e8f0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.5 }}>
                      {selectedFile.filename.split(".").pop()?.toUpperCase() ?? "FILE"}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>Keine Vorschau verfügbar</div>
                    <button
                      onClick={() => downloadFile(selectedFile.id, selectedFile.filename)}
                      style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: "pointer", color: "#374151" }}
                    >
                      Herunterladen
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
