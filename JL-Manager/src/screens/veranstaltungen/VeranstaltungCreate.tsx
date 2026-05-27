import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createVeranstaltung } from "../../api/veranstaltungen";
import type { Veranstaltung } from "../../types/veranstaltungen";

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 6, border: "1px solid var(--c-border)",
  fontSize: 14, background: "var(--c-bg)", color: "var(--c-text)", width: "100%", boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

type Props = {
  onCreated: (v: Veranstaltung) => void;
  onCancel: () => void;
};

export default function VeranstaltungCreate({ onCreated, onCancel }: Props) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name ist erforderlich."); return; }
    if (!date) { setError("Datum ist erforderlich."); return; }
    setSaving(true);
    setError("");
    try {
      const created = await createVeranstaltung({
        name: name.trim(),
        date: new Date(date).toISOString(),
        description: description.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["veranstaltungen"] });
      onCreated(created);
    } catch {
      setError("Fehler beim Erstellen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--c-text)" }}>
          Neue Veranstaltung
        </h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Name *">
          <input
            style={inputStyle}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z.B. Jahresausflug 2025"
            autoFocus
          />
        </Field>

        <Field label="Datum *">
          <input
            type="date"
            style={inputStyle}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </Field>

        <Field label="Beschreibung">
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optionale Beschreibung…"
          />
        </Field>

        {error && (
          <div style={{ color: "#dc2626", fontSize: 13, background: "#fef2f2", padding: "8px 12px", borderRadius: 6 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "8px 20px", borderRadius: 6, border: "none",
              background: saving ? "#94a3b8" : "#1e293b", color: "#fff",
              fontWeight: 600, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Erstelle…" : "Erstellen"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "8px 16px", borderRadius: 6, border: "1px solid var(--c-border)",
              background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 14, cursor: "pointer",
            }}
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
