import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFormRow,
  deleteFormRow,
  deleteVeranstaltung,
  deleteVeranstaltungAttachment,
  downloadVeranstaltungAttachment,
  fetchAllAttachments,
  fetchVeranstaltungAttachmentBlob,
  fetchVeranstaltungFinancials,
  fetchVeranstaltungForm,
  updateFormColumns,
  updateFormRow,
  updateVeranstaltung,
  uploadVeranstaltungAttachment,
} from "../../api/veranstaltungen";
import { downloadAttachment, fetchAttachmentBlob } from "../../api/finance";
import type {
  AllAttachments,
  FormColumn,
  Veranstaltung,
  VeranstaltungAttachment,
  VeranstaltungFormRow,
} from "../../types/veranstaltungen";
import { canManageFinance } from "../../auth/permissions";
import AttachmentViewer from "../../components/AttachmentViewer";

function fmtDate(d: string): string {
  if (!d) return "–";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

function fmtAmount(n: number, type?: string): React.ReactNode {
  const color = type === "AUSZAHLUNG" ? "#dc2626" : type === "EINZAHLUNG" ? "#16a34a" : "#1e293b";
  const prefix = type === "AUSZAHLUNG" ? "–" : type === "EINZAHLUNG" ? "+" : "";
  return (
    <span style={{ color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
      {prefix}{n.toFixed(2)} €
    </span>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db",
  fontSize: 14, background: "#fff", width: "100%", boxSizing: "border-box",
};

const colInputStyle: React.CSSProperties = {
  padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db",
  fontSize: 13, background: "#fff", boxSizing: "border-box",
};

const COLUMN_TYPES = [
  { value: "text",     label: "Text" },
  { value: "number",   label: "Zahl" },
  { value: "date",     label: "Datum" },
  { value: "checkbox", label: "Ja/Nein" },
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: "10px 16px", borderRadius: 8, background: "#fff",
      border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      flex: 1,
    }}>
      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? "#1e293b" }}>{value}</div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase",
      letterSpacing: 0.8, paddingTop: 20, paddingBottom: 8,
      borderTop: "1px solid #f1f5f9", marginTop: 8,
    }}>
      {children}
    </div>
  );
}

function CellInput({
  column,
  value,
  onChange,
}: {
  column: FormColumn;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const strVal = value == null ? "" : String(value);

  if (column.type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16 }}
      />
    );
  }
  if (column.type === "date") {
    const iso = strVal.length >= 10 ? strVal.substring(0, 10) : strVal;
    return (
      <input
        type="date"
        style={{ ...inputStyle, fontSize: 12, padding: "4px 6px" }}
        value={iso}
        onChange={e => onChange(e.target.value)}
      />
    );
  }
  if (column.type === "number") {
    return (
      <input
        type="number"
        style={{ ...inputStyle, fontSize: 12, padding: "4px 6px" }}
        value={strVal}
        onChange={e => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      type="text"
      style={{ ...inputStyle, fontSize: 12, padding: "4px 6px" }}
      value={strVal}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function displayCellValue(col: FormColumn, value: unknown): string {
  if (value == null || value === "") return "–";
  if (col.type === "checkbox") return value ? "✓" : "–";
  if (col.type === "date" && typeof value === "string" && value.length >= 10) {
    return fmtDate(value);
  }
  return String(value);
}

type Props = {
  veranstaltung: Veranstaltung;
  onDeleted: () => void;
  onUpdated: (v: Veranstaltung) => void;
};

export default function VeranstaltungDetail({ veranstaltung, onDeleted, onUpdated }: Props) {
  const queryClient = useQueryClient();
  const isAdmin = canManageFinance();

  // Edit mode for event metadata
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(veranstaltung.name);
  const [editDate, setEditDate] = useState(veranstaltung.date.substring(0, 10));
  const [editDesc, setEditDesc] = useState(veranstaltung.description ?? "");
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState("");

  // Reset edit fields when veranstaltung changes
  useEffect(() => {
    setEditing(false);
    setEditName(veranstaltung.name);
    setEditDate(veranstaltung.date.substring(0, 10));
    setEditDesc(veranstaltung.description ?? "");
    setMetaError("");
    setEditingCols(false);
    setColDraft(null);
    setColError("");
  }, [veranstaltung.id]);

  // Financials
  const { data: financials } = useQuery({
    queryKey: ["veranstaltung-financials", veranstaltung.id],
    queryFn: () => fetchVeranstaltungFinancials(veranstaltung.id),
  });

  // Form
  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: ["veranstaltung-form", veranstaltung.id],
    queryFn: () => fetchVeranstaltungForm(veranstaltung.id),
  });

  // All attachments (direct + from transactions)
  const { data: allAttachments } = useQuery<AllAttachments>({
    queryKey: ["veranstaltung-all-attachments", veranstaltung.id],
    queryFn: () => fetchAllAttachments(veranstaltung.id),
  });
  const directAttachments: VeranstaltungAttachment[] = allAttachments?.direct ?? veranstaltung.attachments ?? [];
  const txAttachments = allAttachments?.fromTransactions ?? [];

  // Attachment viewer
  type ViewerSource =
    | { kind: "direct"; att: VeranstaltungAttachment }
    | { kind: "transaction"; att: AllAttachments["fromTransactions"][number] };
  const [viewerSource, setViewerSource] = useState<ViewerSource | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerMime, setViewerMime] = useState<string>("application/octet-stream");
  const viewerUrlRef = useRef<string | null>(null);
  const cancelTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      if (viewerUrlRef.current) URL.revokeObjectURL(viewerUrlRef.current);
    };
  }, []);

  function closeViewer() {
    setViewerSource(null);
    if (viewerUrlRef.current) { URL.revokeObjectURL(viewerUrlRef.current); viewerUrlRef.current = null; }
    setViewerUrl(null);
  }

  async function openDirectViewer(att: VeranstaltungAttachment) {
    const token = ++cancelTokenRef.current;
    if (viewerSource?.kind === "direct" && viewerSource.att.id === att.id) { closeViewer(); return; }
    if (viewerUrlRef.current) { URL.revokeObjectURL(viewerUrlRef.current); viewerUrlRef.current = null; }
    setViewerSource({ kind: "direct", att });
    setViewerUrl(null);
    try {
      const { url, mimeType } = await fetchVeranstaltungAttachmentBlob(veranstaltung.id, att.id);
      if (cancelTokenRef.current !== token) { URL.revokeObjectURL(url); return; }
      viewerUrlRef.current = url;
      setViewerUrl(url);
      setViewerMime(mimeType);
    } catch { /* silent */ }
  }

  async function openTxViewer(att: AllAttachments["fromTransactions"][number]) {
    const token = ++cancelTokenRef.current;
    if (viewerSource?.kind === "transaction" && viewerSource.att.id === att.id) { closeViewer(); return; }
    if (viewerUrlRef.current) { URL.revokeObjectURL(viewerUrlRef.current); viewerUrlRef.current = null; }
    setViewerSource({ kind: "transaction", att });
    setViewerUrl(null);
    try {
      const { url, mimeType } = await fetchAttachmentBlob(att.transactionId, att.id);
      if (cancelTokenRef.current !== token) { URL.revokeObjectURL(url); return; }
      viewerUrlRef.current = url;
      setViewerUrl(url);
      setViewerMime(mimeType);
    } catch { /* silent */ }
  }

  // Attachment upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setUploadError("");
    try {
      for (const f of files) {
        await uploadVeranstaltungAttachment(veranstaltung.id, f);
      }
      queryClient.invalidateQueries({ queryKey: ["veranstaltungen", veranstaltung.id] });
      queryClient.invalidateQueries({ queryKey: ["veranstaltungen"] });
      queryClient.invalidateQueries({ queryKey: ["veranstaltung-all-attachments", veranstaltung.id] });
    } catch {
      setUploadError("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteAttachment(att: VeranstaltungAttachment) {
    if (!confirm(`Anhang "${att.filename}" löschen?`)) return;
    try {
      await deleteVeranstaltungAttachment(veranstaltung.id, att.id);
      if (viewerSource?.kind === "direct" && viewerSource.att.id === att.id) closeViewer();
      queryClient.invalidateQueries({ queryKey: ["veranstaltungen", veranstaltung.id] });
      queryClient.invalidateQueries({ queryKey: ["veranstaltungen"] });
      queryClient.invalidateQueries({ queryKey: ["veranstaltung-all-attachments", veranstaltung.id] });
    } catch {
      alert("Löschen fehlgeschlagen.");
    }
  }

  // Form column editing
  const [editingCols, setEditingCols] = useState(false);
  const [colDraft, setColDraft] = useState<FormColumn[] | null>(null);
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState<FormColumn["type"]>("text");
  const [savingCols, setSavingCols] = useState(false);
  const [colError, setColError] = useState("");

  // Form row editing
  const [rowDrafts, setRowDrafts] = useState<Record<number, Record<string, unknown>>>({});
  const [savingRows, setSavingRows] = useState<Set<number>>(new Set());
  const [addingRow, setAddingRow] = useState(false);

  function openColEditor() {
    setColDraft([...(form?.columns ?? [])]);
    setNewColLabel("");
    setNewColType("text");
    setColError("");
    setEditingCols(true);
  }

  function addColDraftColumn() {
    if (!newColLabel.trim()) return;
    setColDraft(prev => [...(prev ?? []), { id: uid(), label: newColLabel.trim(), type: newColType }]);
    setNewColLabel("");
    setNewColType("text");
  }

  function removeColDraftColumn(id: string) {
    setColDraft(prev => (prev ?? []).filter(c => c.id !== id));
  }

  function updateColDraftColumn(id: string, field: keyof FormColumn, value: string) {
    setColDraft(prev => (prev ?? []).map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  async function saveFormCols() {
    const toSave = colDraft ?? [];
    setSavingCols(true);
    setColError("");
    try {
      await updateFormColumns(veranstaltung.id, toSave);
      queryClient.invalidateQueries({ queryKey: ["veranstaltung-form", veranstaltung.id] });
      setEditingCols(false);
      setColDraft(null);
    } catch {
      setColError("Fehler beim Speichern.");
    } finally {
      setSavingCols(false);
    }
  }

  function setRowDraft(rowId: number, colId: string, value: unknown) {
    setRowDrafts(d => ({
      ...d,
      [rowId]: { ...(d[rowId] ?? {}), [colId]: value },
    }));
  }

  function getRowCellValue(row: VeranstaltungFormRow, colId: string): unknown {
    const draft = rowDrafts[row.id];
    if (draft && colId in draft) return draft[colId];
    return row.cells[colId];
  }

  async function saveRow(row: VeranstaltungFormRow) {
    const draft = rowDrafts[row.id];
    if (!draft) return;
    setSavingRows(s => new Set(s).add(row.id));
    try {
      const merged = { ...row.cells, ...draft };
      await updateFormRow(veranstaltung.id, row.id, { cells: merged });
      setRowDrafts(d => { const nd = { ...d }; delete nd[row.id]; return nd; });
      queryClient.invalidateQueries({ queryKey: ["veranstaltung-form", veranstaltung.id] });
    } catch {
      alert("Fehler beim Speichern.");
    } finally {
      setSavingRows(s => { const ns = new Set(s); ns.delete(row.id); return ns; });
    }
  }

  async function handleAddRow() {
    setAddingRow(true);
    try {
      await addFormRow(veranstaltung.id, {});
      queryClient.invalidateQueries({ queryKey: ["veranstaltung-form", veranstaltung.id] });
    } catch {
      alert("Fehler beim Hinzufügen.");
    } finally {
      setAddingRow(false);
    }
  }

  async function handleDeleteRow(rowId: number) {
    if (!confirm("Zeile löschen?")) return;
    try {
      await deleteFormRow(veranstaltung.id, rowId);
      queryClient.invalidateQueries({ queryKey: ["veranstaltung-form", veranstaltung.id] });
    } catch {
      alert("Fehler beim Löschen.");
    }
  }

  // Meta save/delete
  async function saveMeta() {
    if (!editName.trim()) { setMetaError("Name ist erforderlich."); return; }
    setSavingMeta(true);
    setMetaError("");
    try {
      const updated = await updateVeranstaltung(veranstaltung.id, {
        name: editName.trim(),
        date: new Date(editDate).toISOString(),
        description: editDesc.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["veranstaltungen"] });
      queryClient.invalidateQueries({ queryKey: ["veranstaltungen", veranstaltung.id] });
      setEditing(false);
      onUpdated(updated);
    } catch {
      setMetaError("Fehler beim Speichern.");
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Veranstaltung "${veranstaltung.name}" und alle Daten löschen? Dies kann nicht rückgängig gemacht werden.`)) return;
    try {
      await deleteVeranstaltung(veranstaltung.id);
      queryClient.invalidateQueries({ queryKey: ["veranstaltungen"] });
      onDeleted();
    } catch {
      alert("Löschen fehlgeschlagen.");
    }
  }

  const transactions = veranstaltung.transactions ?? [];
  const columns = form?.columns ?? [];
  const rows = (form?.rows ?? []).slice().sort((a, b) => a.rowIndex - b.rowIndex);

  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        {editing ? (
          <input
            style={{ ...inputStyle, fontSize: 20, fontWeight: 700, padding: "4px 8px", flex: 1, marginRight: 12 }}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            autoFocus
          />
        ) : (
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1e293b", flex: 1 }}>
            {veranstaltung.name}
          </h2>
        )}
        {isAdmin && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {editing ? (
              <>
                <button
                  onClick={saveMeta}
                  disabled={savingMeta}
                  style={{
                    padding: "6px 14px", borderRadius: 6, border: "none",
                    background: savingMeta ? "#94a3b8" : "#1e293b",
                    color: "#fff", fontSize: 13, fontWeight: 600,
                    cursor: savingMeta ? "not-allowed" : "pointer",
                  }}
                >
                  {savingMeta ? "…" : "Speichern"}
                </button>
                <button
                  onClick={() => { setEditing(false); setMetaError(""); }}
                  style={{
                    padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db",
                    background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer",
                  }}
                >
                  Abbrechen
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db",
                    background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer",
                  }}
                >
                  Bearbeiten
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: "6px 12px", borderRadius: 6, border: "1px solid #fca5a5",
                    background: "#fff", color: "#dc2626", fontSize: 13, cursor: "pointer",
                  }}
                >
                  Löschen
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Date + description */}
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>Datum</label>
            <input type="date" style={{ ...inputStyle, width: "auto" }} value={editDate} onChange={e => setEditDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>Beschreibung</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
          </div>
          {metaError && <div style={{ color: "#dc2626", fontSize: 13 }}>{metaError}</div>}
        </div>
      ) : (
        <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
          <span style={{ fontWeight: 500, color: "#374151" }}>{fmtDate(veranstaltung.date)}</span>
          {veranstaltung.description && (
            <span style={{ marginLeft: 12 }}>{veranstaltung.description}</span>
          )}
        </div>
      )}

      {/* Financials */}
      <SectionHeader>Finanzen</SectionHeader>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatCard
          label="Einnahmen"
          value={financials ? `${financials.einnahmen.toFixed(2)} €` : "…"}
          color="#16a34a"
        />
        <StatCard
          label="Ausgaben"
          value={financials ? `${financials.ausgaben.toFixed(2)} €` : "…"}
          color="#dc2626"
        />
        <StatCard
          label="Saldo"
          value={financials ? `${financials.saldo >= 0 ? "+" : ""}${financials.saldo.toFixed(2)} €` : "…"}
          color={financials ? (financials.saldo >= 0 ? "#16a34a" : "#dc2626") : "#1e293b"}
        />
      </div>

      {/* Linked Transactions */}
      <SectionHeader>Buchungen ({transactions.length})</SectionHeader>
      {transactions.length === 0 ? (
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Keine verknüpften Buchungen.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Datum</th>
              <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Beschreibung</th>
              <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Kategorie</th>
              <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Betrag</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "6px 10px", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(tx.date)}</td>
                <td style={{ padding: "6px 10px", color: "#1e293b" }}>{tx.description}</td>
                <td style={{ padding: "6px 10px", color: "#64748b" }}>{tx.category?.name ?? "–"}</td>
                <td style={{ padding: "6px 10px", textAlign: "right" }}>
                  {fmtAmount(tx.amount, tx.type)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Formular */}
      <SectionHeader>Formular</SectionHeader>
      {formLoading ? (
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Lädt…</p>
      ) : (
        <>
          {/* Column editor (admin) */}
          {isAdmin && (
            <div style={{ marginBottom: 12 }}>
              {!editingCols ? (
                <button
                  onClick={openColEditor}
                  style={{
                    padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db",
                    background: "#fff", color: "#374151", fontSize: 12, cursor: "pointer",
                  }}
                >
                  Spalten bearbeiten
                </button>
              ) : (
                <div style={{
                  padding: 12, borderRadius: 8, border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 10 }}>
                    Spalten bearbeiten
                  </div>
                  {(colDraft ?? []).length === 0 ? (
                    <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 10px" }}>Keine Spalten.</p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10, fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#fff" }}>
                          <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Bezeichnung</th>
                          <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Typ</th>
                          <th style={{ padding: "5px 4px", borderBottom: "1px solid #e2e8f0", width: 32 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {(colDraft ?? []).map(col => (
                          <tr key={col.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "4px 8px" }}>
                              <input
                                style={{ ...colInputStyle, width: "100%" }}
                                value={col.label}
                                onChange={e => updateColDraftColumn(col.id, "label", e.target.value)}
                              />
                            </td>
                            <td style={{ padding: "4px 8px" }}>
                              <select
                                style={colInputStyle}
                                value={col.type}
                                onChange={e => updateColDraftColumn(col.id, "type", e.target.value)}
                              >
                                {COLUMN_TYPES.map(t => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: "4px 4px", textAlign: "center" }}>
                              <button
                                onClick={() => removeColDraftColumn(col.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 15, padding: "1px 4px" }}
                              >×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                    <input
                      style={{ ...colInputStyle, flex: 1, minWidth: 120 }}
                      value={newColLabel}
                      onChange={e => setNewColLabel(e.target.value)}
                      placeholder="Neue Spalte…"
                      onKeyDown={e => e.key === "Enter" && addColDraftColumn()}
                    />
                    <select
                      style={colInputStyle}
                      value={newColType}
                      onChange={e => setNewColType(e.target.value as FormColumn["type"])}
                    >
                      {COLUMN_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={addColDraftColumn}
                      disabled={!newColLabel.trim()}
                      style={{
                        padding: "5px 12px", borderRadius: 6, border: "none",
                        background: newColLabel.trim() ? "#1e293b" : "#94a3b8",
                        color: "#fff", fontSize: 12, fontWeight: 600,
                        cursor: newColLabel.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      + Spalte
                    </button>
                  </div>
                  {colError && (
                    <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{colError}</div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={saveFormCols}
                      disabled={savingCols}
                      style={{
                        padding: "6px 14px", borderRadius: 6, border: "none",
                        background: savingCols ? "#94a3b8" : "#1e293b",
                        color: "#fff", fontSize: 13, fontWeight: 600,
                        cursor: savingCols ? "not-allowed" : "pointer",
                      }}
                    >
                      {savingCols ? "…" : "Speichern"}
                    </button>
                    <button
                      onClick={() => { setEditingCols(false); setColDraft(null); setColError(""); }}
                      style={{
                        padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db",
                        background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer",
                      }}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row table */}
          {columns.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Keine Spalten definiert.</p>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {columns.map(col => (
                        <th key={col.id} style={{
                          padding: "6px 10px", textAlign: "left", fontWeight: 600,
                          color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap",
                        }}>
                          {col.label}
                        </th>
                      ))}
                      {isAdmin && <th style={{ padding: "6px 6px", borderBottom: "1px solid #e2e8f0", width: 80 }} />}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={columns.length + (isAdmin ? 1 : 0)} style={{ padding: "12px 10px", color: "#94a3b8", textAlign: "center" }}>
                          Keine Einträge.
                        </td>
                      </tr>
                    )}
                    {rows.map(row => {
                      const hasDraft = !!rowDrafts[row.id] && Object.keys(rowDrafts[row.id]).length > 0;
                      const saving = savingRows.has(row.id);
                      return (
                        <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          {columns.map(col => (
                            <td key={col.id} style={{ padding: "4px 8px" }}>
                              {isAdmin ? (
                                <CellInput
                                  column={col}
                                  value={getRowCellValue(row, col.id)}
                                  onChange={v => setRowDraft(row.id, col.id, v)}
                                />
                              ) : (
                                <span style={{ fontSize: 13, color: "#1e293b" }}>
                                  {displayCellValue(col, row.cells[col.id])}
                                </span>
                              )}
                            </td>
                          ))}
                          {isAdmin && (
                            <td style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>
                              {hasDraft && (
                                <button
                                  onClick={() => saveRow(row)}
                                  disabled={saving}
                                  style={{
                                    padding: "3px 8px", borderRadius: 4, border: "none",
                                    background: saving ? "#94a3b8" : "#1e293b",
                                    color: "#fff", fontSize: 11, fontWeight: 600,
                                    cursor: saving ? "not-allowed" : "pointer", marginRight: 4,
                                  }}
                                >
                                  {saving ? "…" : "↑"}
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteRow(row.id)}
                                title="Zeile löschen"
                                style={{
                                  background: "none", border: "none", cursor: "pointer",
                                  color: "#dc2626", fontSize: 16, padding: "2px 4px",
                                }}
                              >
                                ×
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {isAdmin && (
                <button
                  onClick={handleAddRow}
                  disabled={addingRow}
                  style={{
                    marginTop: 8, padding: "6px 14px", borderRadius: 6,
                    border: "1px dashed #94a3b8", background: "#fff",
                    color: "#64748b", fontSize: 13, cursor: addingRow ? "not-allowed" : "pointer",
                  }}
                >
                  {addingRow ? "…" : "+ Zeile hinzufügen"}
                </button>
              )}
            </>
          )}
        </>
      )}

      {/* Direct Attachments */}
      <SectionHeader>Anhänge ({directAttachments.length})</SectionHeader>
      {directAttachments.length === 0 && !isAdmin && (
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Keine Anhänge.</p>
      )}
      {directAttachments.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 8 }}>
          <tbody>
            {directAttachments.map(att => {
              const isActive = viewerSource?.kind === "direct" && viewerSource.att.id === att.id;
              return (
                <tr
                  key={att.id}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    background: isActive ? "#eff6ff" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => openDirectViewer(att)}
                >
                  <td style={{ padding: "7px 10px", color: "#1e293b" }}>{att.filename}</td>
                  <td style={{ padding: "7px 10px", color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtBytes(att.size)}</td>
                  <td style={{ padding: "7px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      onClick={e => { e.stopPropagation(); downloadVeranstaltungAttachment(veranstaltung.id, att.id, att.filename); }}
                      title="Herunterladen"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", fontSize: 15, padding: "2px 6px" }}
                    >
                      ↓
                    </button>
                    {isAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteAttachment(att); }}
                        title="Löschen"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 15, padding: "2px 4px" }}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {isAdmin && (
        <div style={{ marginTop: 4 }}>
          <label
            style={{
              display: "inline-block", padding: "6px 14px", borderRadius: 6,
              border: "1px dashed #94a3b8", background: "#fff", color: "#64748b",
              fontSize: 13, cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Lädt hoch…" : "+ Datei hochladen"}
            <input
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          {uploadError && (
            <span style={{ marginLeft: 10, color: "#dc2626", fontSize: 12 }}>{uploadError}</span>
          )}
        </div>
      )}

      {/* Transaction Attachments */}
      {txAttachments.length > 0 && (
        <>
          <SectionHeader>Buchungs-Anhänge ({txAttachments.length})</SectionHeader>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 8 }}>
            <tbody>
              {txAttachments.map(att => {
                const isActive = viewerSource?.kind === "transaction" && viewerSource.att.id === att.id;
                return (
                  <tr
                    key={att.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: isActive ? "#eff6ff" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => openTxViewer(att)}
                  >
                    <td style={{ padding: "7px 10px", color: "#1e293b" }}>
                      <div>{att.filename}</div>
                      {att.transaction && (
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {fmtDate(att.transaction.date)} · {att.transaction.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "7px 10px", color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtBytes(att.size)}</td>
                    <td style={{ padding: "7px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        onClick={e => { e.stopPropagation(); downloadAttachment(att.transactionId, att.id, att.filename); }}
                        title="Herunterladen"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", fontSize: 15, padding: "2px 6px" }}
                      >
                        ↓
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* Attachment viewer side panel */}
      {viewerSource && (
        <AttachmentViewer
          filename={viewerSource.att.filename}
          url={viewerUrl ?? ""}
          mimeType={viewerMime}
          onDownload={() => {
            if (viewerSource.kind === "direct") {
              downloadVeranstaltungAttachment(veranstaltung.id, viewerSource.att.id, viewerSource.att.filename);
            } else {
              downloadAttachment(viewerSource.att.transactionId, viewerSource.att.id, viewerSource.att.filename);
            }
          }}
          onClose={closeViewer}
        />
      )}
    </div>
  );
}
