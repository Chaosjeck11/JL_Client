import { useState, useEffect, useRef } from "react";
import { createTransaction, updateTransaction, fetchAttachments, uploadAttachment, downloadAttachment, deleteAttachment } from "../api/finance";
import type { Category, PaymentTag, Transaction, TransactionAttachment } from "../types/finance";
import { canManageFinance } from "../auth/permissions";

type Props = {
  transaction: Transaction;
  categories: Category[];
  onUpdated: (t: Transaction) => void;
  onDeleted: () => void;
};

function fmtDate(d: string): string {
  if (!d) return "–";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

function TypePill({ type }: { type: Transaction["type"] }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    EINZAHLUNG:  { label: "Einzahlung",  color: "#16a34a", bg: "#f0fdf4" },
    AUSZAHLUNG:  { label: "Auszahlung",  color: "#dc2626", bg: "#fef2f2" },
    RUECKBUCHUNG: { label: "Rückbuchung", color: "#d97706", bg: "#fffbeb" },
  };
  const s = map[type] ?? { label: type, color: "#64748b", bg: "#f1f5f9" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 12,
      fontSize: 12, fontWeight: 600, background: s.bg, color: s.color,
      border: `1px solid ${s.color}33`,
    }}>
      {s.label}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db",
  fontSize: 14, background: "#fff", width: "100%", boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 13, color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#1e293b" }}>{children}</span>
    </div>
  );
}

function TagPill({ tag }: { tag: PaymentTag | null | undefined }) {
  if (!tag) return <span style={{ fontSize: 13, color: "#94a3b8" }}>—</span>;
  const map: Record<PaymentTag, { label: string; color: string; bg: string }> = {
    ONLINE: { label: "Online", color: "#1d4ed8", bg: "#eff6ff" },
    BAR:    { label: "Bar",    color: "#374151", bg: "#f1f5f9" },
  };
  const s = map[tag];
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 12,
      fontSize: 12, fontWeight: 600, background: s.bg, color: s.color,
      border: `1px solid ${s.color}33`,
    }}>
      {s.label}
    </span>
  );
}

export default function TransactionDetail({
  transaction,
  categories,
  onUpdated,
  onDeleted,
}: Props) {
  const [edit, setEdit] = useState(false);
  const [date, setDate] = useState(transaction.date.substring(0, 10));
  const [description, setDescription] = useState(transaction.description);
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [tag, setTag] = useState<PaymentTag>(transaction.tag ?? "ONLINE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState<TransactionAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAttachments(transaction.id).then(setAttachments).catch(() => {});
  }, [transaction.id]);

  async function handleUpload(files: FileList) {
    setUploading(true);
    setAttachError("");
    try {
      for (const file of Array.from(files)) {
        await uploadAttachment(transaction.id, file);
      }
      const updated = await fetchAttachments(transaction.id);
      setAttachments(updated);
    } catch {
      setAttachError("Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAttachment(aid: number) {
    if (!confirm("Anhang löschen?")) return;
    try {
      await deleteAttachment(transaction.id, aid);
      setAttachments(prev => prev.filter(a => a.id !== aid));
    } catch {
      setAttachError("Löschen fehlgeschlagen");
    }
  }

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const sign = transaction.type === "EINZAHLUNG" ? "+" : "-";
  const amountColor = transaction.type === "EINZAHLUNG" ? "#16a34a" : transaction.type === "AUSZAHLUNG" ? "#dc2626" : "#d97706";
  const isAdmin = canManageFinance();

  async function save() {
    try {
      setSaving(true);
      const updated = await updateTransaction(transaction.id, { date, description, categoryId, tag });
      onUpdated(updated);
      setEdit(false);
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function handleStornieren() {
    if (!confirm("Buchung wirklich stornieren? Es wird automatisch eine Gegenbuchung erstellt.")) return;
    try {
      setSaving(true);
      await createTransaction({
        date: new Date().toISOString().slice(0, 10),
        description: `Stornierung: ${transaction.description}`,
        type: "RUECKBUCHUNG",
        amount: transaction.amount,
        categoryId: transaction.categoryId,
        businessYearId: transaction.businessYearId,
        relatedTransactionId: transaction.id,
      });
      onDeleted();
    } catch {
      setError("Stornierung fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  if (!edit) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "#1e293b" }}>Buchungsdetail</h3>
          <span style={{ fontSize: 18, fontWeight: 700, color: amountColor }}>
            {sign}{transaction.amount.toFixed(2)} €
          </span>
        </div>

        {error && (
          <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <InfoRow label="Datum">{fmtDate(transaction.date)}</InfoRow>
          <InfoRow label="Beschreibung">{transaction.description}</InfoRow>
          <InfoRow label="Kategorie">{transaction.category.name}</InfoRow>
          <InfoRow label="Typ"><TypePill type={transaction.type} /></InfoRow>
          <InfoRow label="Betrag">
            <span style={{ fontWeight: 600, color: amountColor }}>
              {sign}{transaction.amount.toFixed(2)} €
            </span>
          </InfoRow>
          <InfoRow label="Zahlungsart"><TagPill tag={transaction.tag} /></InfoRow>
          {transaction.relatedTransactionId && (
            <InfoRow label="Verknüpfte Buchung">#{transaction.relatedTransactionId}</InfoRow>
          )}
        </div>

        {isAdmin && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setEdit(true)}
              style={{
                padding: "7px 16px", borderRadius: 6, border: "1px solid #d1d5db",
                background: "#fff", fontSize: 13, cursor: "pointer",
              }}
            >
              Bearbeiten
            </button>
            {transaction.type !== "RUECKBUCHUNG" && (
              <button
                onClick={handleStornieren}
                disabled={saving}
                style={{
                  padding: "7px 16px", borderRadius: 6, border: "1px solid #fca5a5",
                  background: "#fef2f2", fontSize: 13, color: "#dc2626", cursor: "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                Stornieren
              </button>
            )}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Anhänge {attachments.length > 0 && `(${attachments.length})`}
          </div>

          {attachError && (
            <div style={{ padding: "6px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 12, marginBottom: 8 }}>
              {attachError}
            </div>
          )}

          {attachments.length === 0 && (
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>Keine Anhänge</div>
          )}

          {attachments.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ flex: 1, fontSize: 13, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.filename}
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtSize(a.size)}</span>
              <button
                onClick={() => downloadAttachment(transaction.id, a.id, a.filename)}
                title="Herunterladen"
                style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", fontSize: 12, cursor: "pointer" }}
              >
                ↓
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleDeleteAttachment(a.id)}
                  title="Löschen"
                  style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, cursor: "pointer" }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {isAdmin && (
            <div style={{ marginTop: 10 }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={e => e.target.files && handleUpload(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  padding: "6px 14px", borderRadius: 6, border: "1px dashed #94a3b8",
                  background: "#f8fafc", fontSize: 13, cursor: uploading ? "not-allowed" : "pointer",
                  color: "#475569", opacity: uploading ? 0.6 : 1,
                }}
              >
                {uploading ? "Wird hochgeladen…" : "+ Anhang hinzufügen"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ margin: "0 0 20px", fontSize: 16, color: "#1e293b" }}>Buchung bearbeiten</h3>

      {error && (
        <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Datum">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Beschreibung">
          <input value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Kategorie">
          <select value={categoryId} onChange={e => setCategoryId(Number(e.target.value))} style={inputStyle}>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Zahlungsart">
          <div style={{ display: "flex", gap: 8 }}>
            {(["ONLINE", "BAR"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTag(t)}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 6, border: "1px solid",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  borderColor: tag === t ? "#3b82f6" : "#d1d5db",
                  background: tag === t ? "#eff6ff" : "#fff",
                  color: tag === t ? "#1d4ed8" : "#374151",
                }}
              >
                {t === "ONLINE" ? "Online" : "Bar"}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            flex: 1, padding: "8px 0", borderRadius: 6, border: "none",
            background: "#1e293b", color: "#fff", fontSize: 14, fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        <button
          onClick={() => { setEdit(false); setError(""); }}
          disabled={saving}
          style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 14, cursor: "pointer" }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
