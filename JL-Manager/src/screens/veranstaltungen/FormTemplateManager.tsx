import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFormTemplate, updateFormTemplate } from "../../api/veranstaltungen";
import type { FormColumn } from "../../types/veranstaltungen";

const inputStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)",
  fontSize: 13, background: "var(--c-bg)", color: "var(--c-text)", boxSizing: "border-box",
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

export default function FormTemplateManager() {
  const queryClient = useQueryClient();
  const { data: template, isLoading } = useQuery({
    queryKey: ["veranstaltung-form-template"],
    queryFn: fetchFormTemplate,
  });

  const [columns, setColumns] = useState<FormColumn[] | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FormColumn["type"]>("text");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const workingCols = columns ?? template?.columns ?? [];

  function addColumn() {
    if (!newLabel.trim()) return;
    setColumns([...workingCols, { id: uid(), label: newLabel.trim(), type: newType }]);
    setNewLabel("");
    setNewType("text");
  }

  function removeColumn(id: string) {
    setColumns(workingCols.filter(c => c.id !== id));
  }

  function updateColumn(id: string, field: keyof FormColumn, value: string) {
    setColumns(workingCols.map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateFormTemplate(workingCols);
      queryClient.invalidateQueries({ queryKey: ["veranstaltung-form-template"] });
      setColumns(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <div style={{ padding: 24, color: "var(--c-text-2)" }}>Lädt…</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--c-text)" }}>
          Formular-Vorlage
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--c-text-2)" }}>
          Spalten gelten nur für neue Veranstaltungen — bestehende Formulare bleiben unverändert.
        </p>
      </div>

      {workingCols.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--c-text-3)", marginBottom: 16 }}>Keine Spalten definiert.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--c-bg-2)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--c-text-2)", borderBottom: "1px solid var(--c-border)" }}>Bezeichnung</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--c-text-2)", borderBottom: "1px solid var(--c-border)" }}>Typ</th>
              <th style={{ padding: "8px 6px", borderBottom: "1px solid var(--c-border)", width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {workingCols.map(col => (
              <tr key={col.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
                <td style={{ padding: "6px 12px" }}>
                  <input
                    style={{ ...inputStyle, width: "100%" }}
                    value={col.label}
                    onChange={e => updateColumn(col.id, "label", e.target.value)}
                  />
                </td>
                <td style={{ padding: "6px 12px" }}>
                  <select
                    style={{ ...inputStyle }}
                    value={col.type}
                    onChange={e => updateColumn(col.id, "type", e.target.value)}
                  >
                    {COLUMN_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: "6px 6px", textAlign: "center" }}>
                  <button
                    onClick={() => removeColumn(col.id)}
                    title="Entfernen"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#dc2626", fontSize: 16, padding: "2px 6px",
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 140 }}
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="Neue Spalte…"
          onKeyDown={e => e.key === "Enter" && addColumn()}
        />
        <select
          style={{ ...inputStyle }}
          value={newType}
          onChange={e => setNewType(e.target.value as FormColumn["type"])}
        >
          {COLUMN_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={addColumn}
          disabled={!newLabel.trim()}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "none",
            background: newLabel.trim() ? "#1e293b" : "#94a3b8",
            color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: newLabel.trim() ? "pointer" : "not-allowed",
          }}
        >
          + Spalte
        </button>
      </div>

      {error && (
        <div style={{ color: "#dc2626", fontSize: 13, background: "#fef2f2", padding: "8px 12px", borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}
      {saved && (
        <div style={{ color: "#16a34a", fontSize: 13, background: "#f0fdf4", padding: "8px 12px", borderRadius: 6, marginBottom: 12 }}>
          Vorlage gespeichert.
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: "8px 20px", borderRadius: 6, border: "none",
          background: saving ? "#94a3b8" : "#1e293b", color: "#fff",
          fontWeight: 600, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Speichere…" : "Vorlage speichern"}
      </button>
    </div>
  );
}
