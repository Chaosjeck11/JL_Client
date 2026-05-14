import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function Files({ isMobile = false }: { isMobile?: boolean }) {
  const queryClient = useQueryClient();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<AppFile | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const { data: files = [], isError: filesError } = useQuery<AppFile[]>({
    queryKey: ["files"],
    queryFn: () => fetchFiles(),
  });
  const { data: folders = [] } = useQuery({
    queryKey: ["files-folders"],
    queryFn: fetchFolders,
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: fetchMembers,
  });

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
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["files-folders"] });
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
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["files-folders"] });
      setSelectedFile(updated);
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
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["files-folders"] });
      setSelectedFile(null);
    } catch {
      setSaveError("Fehler beim Löschen");
    }
  }

  const showPanel = creating || !!selectedFile;

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)",
    fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none",
    background: "var(--c-bg)", color: "var(--c-text)",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", marginBottom: 4, display: "block",
  };

  return (
    <div style={{ display: "flex", height: "var(--content-h)", background: "var(--c-bg-2)" }}>

      {/* ── LEFT: FILE BROWSER ── */}
      <div style={{
        flex: showPanel ? 3 : 1,
        display: isMobile && showPanel ? "none" : "flex",
        flexDirection: isMobile ? "column" : "row",
        minWidth: 0,
      }}>

        {/* Folder sidebar — desktop only; mobile uses pill bar below */}
        {!isMobile && <div style={{
          width: 180, flexShrink: 0, overflowY: "auto",
          borderRight: "1px solid var(--c-border)", background: "var(--c-bg-3)",
          paddingTop: 16,
        }}>
          <div style={{ padding: "0 14px 8px", fontSize: 11, fontWeight: 700, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
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
                color: selectedFolder === entry.value ? "#1d4ed8" : "var(--c-text-2)",
                fontWeight: selectedFolder === entry.value ? 600 : 400,
                fontSize: 13,
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>}

        {/* Mobile: folder pill bar */}
        {isMobile && (
          <div style={{
            display: "flex", gap: 8, overflowX: "auto", padding: "10px 16px",
            borderBottom: "1px solid var(--c-border)", background: "var(--c-bg-2)",
            flexShrink: 0,
          }}>
            {[{ label: "Alle", value: null as string | null }, ...folders.map(f => ({ label: f || "(Kein Ordner)", value: f }))].map(entry => (
              <button
                key={entry.value ?? "__all__"}
                onClick={() => { setSelectedFolder(entry.value); setSelectedFile(null); setCreating(false); }}
                style={{
                  flexShrink: 0, padding: "5px 14px", borderRadius: 20,
                  border: selectedFolder === entry.value ? "none" : "1px solid var(--c-border)",
                  background: selectedFolder === entry.value ? "#1e293b" : "var(--c-bg)",
                  color: selectedFolder === entry.value ? "#fff" : "var(--c-text-2)",
                  fontWeight: selectedFolder === entry.value ? 600 : 400,
                  fontSize: 13, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}

        {/* File list */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 20px", borderBottom: "1px solid var(--c-border)",
            position: "sticky", top: 0, background: "var(--c-bg)", zIndex: 1, gap: 10, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--c-text)" }}>
                {selectedFolder ?? "Alle Dateien"}
              </h2>
              <span style={{ background: "var(--c-bg-3)", color: "var(--c-text-2)", borderRadius: 20, padding: "2px 9px", fontSize: 12, fontWeight: 600 }}>
                {filteredFiles.length}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Suchen…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding: "6px 10px", fontSize: 13, border: "1px solid var(--c-border)", borderRadius: 7, outline: "none", color: "var(--c-text)", background: "var(--c-bg)", width: 160 }}
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

          {filesError && (
            <div style={{ margin: "10px 20px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 13 }}>
              Fehler beim Laden der Dateien
            </div>
          )}

          <div style={{ background: "var(--c-bg)", flex: 1 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr style={{ background: "var(--c-bg-2)", borderBottom: "1px solid var(--c-border)" }}>
                  <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Name</th>
                  {!isMobile && <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Größe</th>}
                  <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Datum</th>
                  {!isMobile && <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Beschreibung</th>}
                </tr>
              </thead>
              <tbody>
                {filteredFiles.length === 0 && (
                  <tr>
                    <td colSpan={isMobile ? 2 : 4} style={{ padding: 24, textAlign: "center", color: "var(--c-text-3)", fontSize: 14 }}>
                      Keine Dateien
                    </td>
                  </tr>
                )}
                {filteredFiles.map((f, idx) => {
                  const isSel = selectedFile?.id === f.id;
                  const isHov = hoveredId === f.id;
                  let bg = idx % 2 === 0 ? "var(--c-bg)" : "var(--c-bg-2)";
                  if (isHov) bg = "var(--c-bg-3)";
                  if (isSel) bg = "#eff6ff";
                  return (
                    <tr
                      key={f.id}
                      onClick={() => { setSelectedFile(f); setCreating(false); }}
                      onMouseEnter={() => setHoveredId(f.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{ cursor: "pointer", background: bg, borderBottom: "1px solid var(--c-border)", borderLeft: isSel ? "3px solid #3b82f6" : "3px solid transparent", transition: "background 0.1s" }}
                    >
                      <td style={{ padding: "9px 14px", fontSize: 13, color: "var(--c-text)", fontWeight: 500, wordBreak: "break-word" }}>{f.filename}</td>
                      {!isMobile && <td style={{ padding: "9px 14px", fontSize: 13, color: "var(--c-text-2)", whiteSpace: "nowrap" }}>{fmtSize(f.size)}</td>}
                      <td style={{ padding: "9px 14px", fontSize: 13, color: "var(--c-text-2)", whiteSpace: "nowrap" }}>{fmtDate(f.uploadedAt)}</td>
                      {!isMobile && <td style={{ padding: "9px 14px", fontSize: 13, color: "var(--c-text-3)" }}>{f.description ?? "–"}</td>}
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
        <div style={{
          flex: isMobile ? 1 : 2,
          padding: isMobile ? "0" : "20px 24px",
          overflowY: "auto", background: "var(--c-bg)",
          borderLeft: isMobile ? "none" : "1px solid var(--c-border)",
          display: "flex", flexDirection: "column", gap: isMobile ? 0 : 16,
        }}>
          {isMobile && (
            <button
              onClick={() => { setSelectedFile(null); setCreating(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                width: "100%", padding: "12px 16px",
                border: "none", borderBottom: "1px solid var(--c-border)",
                background: "var(--c-bg)", cursor: "pointer",
                color: "#2563eb", fontSize: 14, fontWeight: 600,
                flexShrink: 0,
              }}
            >
              ← Zurück
            </button>
          )}
          <div style={{ padding: isMobile ? "16px" : "0", flex: 1, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          {creating ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "var(--c-text)" }}>Datei hochladen</h3>
                <button onClick={() => setCreating(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--c-text-3)", lineHeight: 1 }}>×</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Datei *</label>
                  <input type="file" onChange={e => setUploadFileVal(e.target.files?.[0] ?? null)} style={{ fontSize: 13, cursor: "pointer", color: "var(--c-text)" }} />
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
                  style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: uploadFileVal && !uploading ? "#1e293b" : "var(--c-text-3)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: uploadFileVal && !uploading ? "pointer" : "not-allowed" }}
                >
                  {uploading ? "Wird hochgeladen…" : "Hochladen"}
                </button>
                <button onClick={() => setCreating(false)} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer" }}>
                  Abbrechen
                </button>
              </div>
            </>
          ) : selectedFile ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "var(--c-text)", wordBreak: "break-all" }}>{selectedFile.filename}</h3>
                  <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{selectedFile.mimeType}</div>
                </div>
                <button onClick={() => setSelectedFile(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--c-text-3)", lineHeight: 1, flexShrink: 0, marginLeft: 8 }}>×</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 13, alignItems: "center" }}>
                <span style={{ color: "var(--c-text-2)", fontWeight: 600 }}>Größe</span>
                <span style={{ color: "var(--c-text)" }}>{fmtSize(selectedFile.size)}</span>
                <span style={{ color: "var(--c-text-2)", fontWeight: 600 }}>Hochgeladen</span>
                <span style={{ color: "var(--c-text)" }}>{fmtDate(selectedFile.uploadedAt)}</span>
                <span style={{ color: "var(--c-text-2)", fontWeight: 600 }}>Von</span>
                <span style={{ color: "var(--c-text)" }}>{memberName(selectedFile.uploadedBy)}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Beschreibung</label>
                  {isAdmin ? (
                    <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={inputStyle} placeholder="Keine Beschreibung" />
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--c-text)" }}>{selectedFile.description ?? "–"}</div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Ordner / Pfad</label>
                  {isAdmin ? (
                    <input type="text" value={editPath} onChange={e => setEditPath(e.target.value)} style={inputStyle} placeholder="(Kein Ordner)" />
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--c-text)" }}>{selectedFile.path || "–"}</div>
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
                  style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid var(--c-border)", background: "var(--c-bg)", fontSize: 13, cursor: "pointer", color: "var(--c-text-2)" }}
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

              <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 16 }}>
                {previewLoading && (
                  <div style={{ fontSize: 13, color: "var(--c-text-3)", textAlign: "center", padding: 24 }}>
                    Vorschau wird geladen…
                  </div>
                )}
                {!previewLoading && previewUrl && selectedFile.mimeType.startsWith("image/") && (
                  <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--c-border)" }}>
                    <img src={previewUrl} alt={selectedFile.filename} style={{ width: "100%", display: "block" }} />
                  </div>
                )}
                {!previewLoading && previewUrl && selectedFile.mimeType === "application/pdf" && (
                  <iframe
                    src={previewUrl}
                    title={selectedFile.filename}
                    style={{ width: "100%", height: 600, border: "1px solid var(--c-border)", borderRadius: 8 }}
                  />
                )}
                {!previewLoading && !previewUrl && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 24px", background: "var(--c-bg-2)", border: "1px solid var(--c-border)", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ width: 48, height: 48, background: "var(--c-border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--c-text-2)", letterSpacing: 0.5 }}>
                      {selectedFile.filename.split(".").pop()?.toUpperCase() ?? "FILE"}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--c-text-2)" }}>Keine Vorschau verfügbar</div>
                    <button
                      onClick={() => downloadFile(selectedFile.id, selectedFile.filename)}
                      style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid var(--c-border)", background: "var(--c-bg)", fontSize: 13, cursor: "pointer", color: "var(--c-text-2)" }}
                    >
                      Herunterladen
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
