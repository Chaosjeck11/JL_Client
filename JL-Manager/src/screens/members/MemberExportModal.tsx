import { useState } from "react";
import type { Member } from "../../types/member";
import { triggerDownload } from "../../utils/triggerDownload";

interface Props {
  members: Member[];
  onClose: () => void;
}

type FieldKey =
  | "firstname" | "lastname" | "email" | "address" | "phone"
  | "birthday" | "joinedAt" | "role" | "active"
  | "beitragskategorie" | "u18" | "bereitsMitglied" | "schuelerStudentAzubi" | "berufstaetig";

type ReportFormat = "csv" | "pdf";
type StatusFilter = "all" | "active" | "inactive";

const FIELD_LABELS: Record<FieldKey, string> = {
  firstname: "Vorname",
  lastname: "Nachname",
  email: "E-Mail",
  address: "Adresse",
  phone: "Telefon",
  birthday: "Geburtstag",
  joinedAt: "Beitrittsdatum",
  role: "Rolle",
  active: "Aktivitätsstatus",
  beitragskategorie: "Beitragskategorie",
  u18: "Unter 18",
  bereitsMitglied: "Bereits Mitglied (KG)",
  schuelerStudentAzubi: "Schüler/Student/Azubi",
  berufstaetig: "Berufstätig",
};

const FIELD_GROUPS: Array<{ label: string; fields: FieldKey[] }> = [
  {
    label: "Stammdaten",
    fields: ["firstname", "lastname", "email", "address", "phone", "birthday", "joinedAt"],
  },
  {
    label: "Mitgliedschaft",
    fields: ["role", "active"],
  },
  {
    label: "Beitragsinfos",
    fields: ["beitragskategorie", "u18", "bereitsMitglied", "schuelerStudentAzubi", "berufstaetig"],
  },
];

const ALL_FIELDS: FieldKey[] = FIELD_GROUPS.flatMap(g => g.fields);

const STATUS_OPTIONS: Array<{ val: StatusFilter; label: string }> = [
  { val: "all", label: "Alle" },
  { val: "active", label: "Aktiv" },
  { val: "inactive", label: "Inaktiv" },
];

function fmtDate(d: string | null | undefined): string {
  if (!d) return "–";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

function beitragskategorie(m: Member): string {
  if (m.u18 || m.bereitsMitglied || m.schuelerStudentAzubi) return "Reduziert (35 €)";
  return "Voll (100 €)";
}

function getFieldValue(m: Member, field: FieldKey): string {
  switch (field) {
    case "firstname": return m.firstname;
    case "lastname": return m.lastname;
    case "email": return m.email;
    case "address": return m.address ?? "–";
    case "phone": return m.phone ?? "–";
    case "birthday": return fmtDate(m.birthday);
    case "joinedAt": return fmtDate(m.joinedAt);
    case "role": return m.role?.name ?? "–";
    case "active": return m.active ? "Aktiv" : "Inaktiv";
    case "beitragskategorie": return beitragskategorie(m);
    case "u18": return m.u18 ? "Ja" : "Nein";
    case "bereitsMitglied": return m.bereitsMitglied ? "Ja" : "Nein";
    case "schuelerStudentAzubi": return m.schuelerStudentAzubi ? "Ja" : "Nein";
    case "berufstaetig": return m.berufstaetig ? "Ja" : "Nein";
  }
}

export default function MemberExportModal({ members, onClose }: Props) {
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>(ALL_FIELDS);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleField(f: FieldKey) {
    setSelectedFields(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  }

  function toggleGroup(fields: FieldKey[]) {
    const allSelected = fields.every(f => selectedFields.includes(f));
    if (allSelected) {
      setSelectedFields(prev => prev.filter(f => !fields.includes(f)));
    } else {
      setSelectedFields(prev => [...new Set([...prev, ...fields])]);
    }
  }

  const filteredMembers = members.filter(m => {
    if (statusFilter === "active") return m.active;
    if (statusFilter === "inactive") return !m.active;
    return true;
  });

  const orderedFields = ALL_FIELDS.filter(f => selectedFields.includes(f));

  async function handleGenerate() {
    if (selectedFields.length === 0) { setError("Bitte mindestens ein Feld auswählen."); return; }
    setLoading(true);
    setError("");
    try {
      if (format === "csv") await generateCSV();
      else await generatePDF();
      onClose();
    } catch {
      setError("Fehler beim Erstellen des Exports.");
    } finally {
      setLoading(false);
    }
  }

  async function generateCSV() {
    const BOM = "﻿";
    const header = orderedFields.map(f => FIELD_LABELS[f]).join(";");
    const rows = filteredMembers.map(m =>
      orderedFields
        .map(f => {
          const val = getFieldValue(m, f);
          return val.includes(";") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        })
        .join(";")
    );
    const csv = BOM + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    await triggerDownload(`mitglieder_${new Date().toISOString().substring(0, 10)}.csv`, blob);
  }

  async function generatePDF() {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const orientation = orderedFields.length > 7 ? "landscape" : "portrait";
    const doc = new jsPDF({ orientation });
    const today = fmtDate(new Date().toISOString());

    const statusLabel = statusFilter === "active" ? "Aktive Mitglieder" : statusFilter === "inactive" ? "Inaktive Mitglieder" : "Alle Mitglieder";

    doc.setFontSize(16);
    doc.text(`Mitgliederliste – ${statusLabel}`, 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Erstellt am ${today}  |  ${filteredMembers.length} Mitglieder`, 14, 22);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 28,
      head: [orderedFields.map(f => FIELD_LABELS[f])],
      body: filteredMembers.map(m => orderedFields.map(f => getFieldValue(m, f))),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const filename = `mitglieder_${new Date().toISOString().substring(0, 10)}.pdf`;
    await triggerDownload(filename, new Blob([doc.output("arraybuffer")], { type: "application/pdf" }));
  }

  const section: React.CSSProperties = { marginBottom: 20 };
  const sectionLabel: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "var(--c-text-2)",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
  };
  const checkRow: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    padding: "4px 0", cursor: "pointer", fontSize: 13, color: "var(--c-text)",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--c-bg)", borderRadius: 12, padding: 28, width: 560,
        maxWidth: "90vw", maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "var(--c-text)" }}>Mitgliederliste exportieren</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--c-text-3)", lineHeight: 1 }}>×</button>
        </div>

        {/* Felder */}
        <div style={section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={sectionLabel}>Felder</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setSelectedFields([...ALL_FIELDS])}
                style={{ fontSize: 11, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Alle
              </button>
              <button
                onClick={() => setSelectedFields([])}
                style={{ fontSize: 11, color: "var(--c-text-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Keine
              </button>
            </div>
          </div>

          {FIELD_GROUPS.map(group => {
            const allSelected = group.fields.every(f => selectedFields.includes(f));
            const someSelected = group.fields.some(f => selectedFields.includes(f));
            return (
              <div key={group.label} style={{ marginBottom: 12, padding: "10px 12px", background: "var(--c-bg-2)", borderRadius: 8 }}>
                <label style={{ ...checkRow, marginBottom: 6, fontWeight: 600, color: "var(--c-text-2)" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = !allSelected && someSelected; }}
                    onChange={() => toggleGroup(group.fields)}
                    style={{ accentColor: "#3b82f6" }}
                  />
                  {group.label}
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px", paddingLeft: 20 }}>
                  {group.fields.map(f => (
                    <label key={f} style={checkRow}>
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(f)}
                        onChange={() => toggleField(f)}
                        style={{ accentColor: "#3b82f6" }}
                      />
                      {FIELD_LABELS[f]}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Statusfilter */}
        <div style={section}>
          <div style={sectionLabel}>Status</div>
          <div style={{ display: "flex", gap: 8 }}>
            {STATUS_OPTIONS.map(({ val, label }) => (
              <label
                key={val}
                style={{
                  ...checkRow, padding: "5px 14px",
                  border: `1px solid ${statusFilter === val ? "#3b82f6" : "var(--c-border)"}`,
                  borderRadius: 6,
                  background: statusFilter === val ? "#eff6ff" : "var(--c-bg)",
                  color: statusFilter === val ? "#1d4ed8" : "var(--c-text)",
                  fontWeight: statusFilter === val ? 600 : 400,
                }}
              >
                <input
                  type="radio"
                  name="status"
                  value={val}
                  checked={statusFilter === val}
                  onChange={() => setStatusFilter(val)}
                  style={{ accentColor: "#3b82f6" }}
                />
                {label}
              </label>
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--c-text-2)" }}>
            {filteredMembers.length} Mitglied{filteredMembers.length !== 1 ? "er" : ""} werden exportiert
          </div>
        </div>

        {/* Format */}
        <div style={section}>
          <div style={sectionLabel}>Format</div>
          <div style={{ display: "flex", gap: 12 }}>
            {(["csv", "pdf"] as ReportFormat[]).map(f => (
              <label
                key={f}
                style={{
                  ...checkRow, padding: "6px 16px",
                  border: `1px solid ${format === f ? "#3b82f6" : "var(--c-border)"}`,
                  borderRadius: 6,
                  background: format === f ? "#eff6ff" : "var(--c-bg)",
                  color: format === f ? "#1d4ed8" : "var(--c-text)",
                  fontWeight: format === f ? 600 : 400,
                }}
              >
                <input
                  type="radio"
                  name="format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  style={{ accentColor: "#3b82f6" }}
                />
                {f.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            padding: "8px 12px", background: "#fef2f2",
            border: "1px solid #fca5a5", borderRadius: 6,
            color: "#dc2626", fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer" }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: "8px 20px", borderRadius: 6, border: "none",
              background: loading ? "var(--c-text-3)" : "#1e293b",
              color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Erstelle…" : `${format.toUpperCase()} exportieren`}
          </button>
        </div>
      </div>
    </div>
  );
}
