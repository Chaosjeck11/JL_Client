import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createVeranstaltungKategorie,
  deleteVeranstaltungKategorie,
  fetchVeranstaltungKategorien,
  updateVeranstaltungKategorie,
} from "../../api/veranstaltungen";
import type { VeranstaltungKategorie } from "../../types/veranstaltungen";

const inputStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)",
  fontSize: 13, background: "var(--c-bg)", color: "var(--c-text)", boxSizing: "border-box",
};

const PRESET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6b7280",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{
            width: 22, height: 22, borderRadius: "50%", background: c, border: "none",
            cursor: "pointer", outline: value === c ? "2px solid var(--c-text)" : "2px solid transparent",
            outlineOffset: 2,
          }}
        />
      ))}
      <input
        type="color"
        value={value || "#3b82f6"}
        onChange={e => onChange(e.target.value)}
        style={{ width: 26, height: 26, padding: 0, border: "1px solid var(--c-border)", borderRadius: 4, cursor: "pointer" }}
        title="Eigene Farbe"
      />
    </div>
  );
}

function KategoriePill({ kategorie }: { kategorie: VeranstaltungKategorie }) {
  const bg = kategorie.color ?? "#6b7280";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 12,
      fontSize: 12, fontWeight: 600, color: "#fff",
      background: bg,
    }}>
      {kategorie.name}
    </span>
  );
}

export { KategoriePill };

function EditRow({ k, onDone }: { k: VeranstaltungKategorie; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(k.name);
  const [description, setDescription] = useState(k.description ?? "");
  const [color, setColor] = useState(k.color ?? "#6b7280");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) { setError("Name erforderlich."); return; }
    setSaving(true);
    try {
      await updateVeranstaltungKategorie(k.id, {
        name: name.trim(),
        description: description.trim() || null,
        color: color || null,
      });
      queryClient.invalidateQueries({ queryKey: ["veranstaltung-kategorien"] });
      queryClient.invalidateQueries({ queryKey: ["veranstaltungen"] });
      onDone();
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      padding: "12px 14px", borderBottom: "1px solid var(--c-border)",
      background: "var(--c-bg-2)", display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name"
          autoFocus
        />
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "none",
            background: saving ? "#94a3b8" : "#1e293b", color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", flexShrink: 0,
          }}
        >
          {saving ? "…" : "Speichern"}
        </button>
        <button
          onClick={onDone}
          style={{
            padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)",
            background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer", flexShrink: 0,
          }}
        >
          Abbrechen
        </button>
      </div>
      <input
        style={{ ...inputStyle, width: "100%" }}
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Beschreibung (optional)"
      />
      <ColorPicker value={color} onChange={setColor} />
      {error && <div style={{ color: "#dc2626", fontSize: 12 }}>{error}</div>}
    </div>
  );
}

export default function VeranstaltungKategorienManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  const { data: kategorien = [], isLoading } = useQuery<VeranstaltungKategorie[]>({
    queryKey: ["veranstaltung-kategorien"],
    queryFn: fetchVeranstaltungKategorien,
  });

  async function handleCreate() {
    if (!newName.trim()) { setCreateError("Name erforderlich."); return; }
    setSaving(true);
    setCreateError("");
    try {
      await createVeranstaltungKategorie({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        color: newColor || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["veranstaltung-kategorien"] });
      setNewName("");
      setNewDesc("");
      setNewColor("#3b82f6");
      setCreating(false);
    } catch {
      setCreateError("Fehler beim Erstellen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(k: VeranstaltungKategorie) {
    const count = k._count?.veranstaltungen ?? 0;
    const msg = count > 0
      ? `Kategorie "${k.name}" wird von ${count} Veranstaltung${count !== 1 ? "en" : ""} verwendet und kann nicht gelöscht werden.`
      : `Kategorie "${k.name}" löschen?`;
    if (count > 0) { alert(msg); return; }
    if (!confirm(msg)) return;
    try {
      await deleteVeranstaltungKategorie(k.id);
      queryClient.invalidateQueries({ queryKey: ["veranstaltung-kategorien"] });
      queryClient.invalidateQueries({ queryKey: ["veranstaltungen"] });
    } catch {
      alert("Löschen fehlgeschlagen.");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--c-text)" }}>
          Event-Kategorien
        </h2>
        <button
          onClick={() => { setCreating(true); setCreateError(""); }}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "none",
            background: "#1e293b", color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          + Neu
        </button>
      </div>

      {creating && (
        <div style={{
          padding: "14px", borderRadius: 8, border: "1px solid var(--c-border)",
          background: "var(--c-bg-2)", marginBottom: 16,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Name *"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            />
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                padding: "6px 14px", borderRadius: 6, border: "none",
                background: saving ? "#94a3b8" : "#1e293b", color: "#fff",
                fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", flexShrink: 0,
              }}
            >
              {saving ? "…" : "Erstellen"}
            </button>
            <button
              onClick={() => { setCreating(false); setCreateError(""); setNewName(""); setNewDesc(""); }}
              style={{
                padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)",
                background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer", flexShrink: 0,
              }}
            >
              Abbrechen
            </button>
          </div>
          <input
            style={{ ...inputStyle, width: "100%" }}
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Beschreibung (optional)"
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          {createError && <div style={{ color: "#dc2626", fontSize: 12 }}>{createError}</div>}
        </div>
      )}

      {isLoading && <div style={{ color: "var(--c-text-3)", fontSize: 13 }}>Lädt…</div>}
      {!isLoading && kategorien.length === 0 && !creating && (
        <div style={{ color: "var(--c-text-3)", fontSize: 13 }}>Noch keine Kategorien.</div>
      )}

      <div style={{ borderRadius: 8, border: "1px solid var(--c-border)", overflow: "hidden" }}>
        {kategorien.map(k => (
          editingId === k.id ? (
            <EditRow key={k.id} k={k} onDone={() => setEditingId(null)} />
          ) : (
            <div
              key={k.id}
              style={{
                padding: "10px 14px", borderBottom: "1px solid var(--c-border)",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <div
                style={{
                  width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                  background: k.color ?? "#6b7280",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--c-text)" }}>{k.name}</div>
                {k.description && (
                  <div style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 1 }}>{k.description}</div>
                )}
              </div>
              {k._count && (
                <span style={{ fontSize: 11, color: "var(--c-text-3)", flexShrink: 0 }}>
                  {k._count.veranstaltungen} Event{k._count.veranstaltungen !== 1 ? "s" : ""}
                </span>
              )}
              <button
                onClick={() => setEditingId(k.id)}
                style={{
                  padding: "4px 10px", borderRadius: 5, border: "1px solid var(--c-border)",
                  background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 12, cursor: "pointer", flexShrink: 0,
                }}
              >
                Bearbeiten
              </button>
              <button
                onClick={() => handleDelete(k)}
                style={{
                  padding: "4px 8px", borderRadius: 5, border: "1px solid #fca5a5",
                  background: "var(--c-bg)", color: "#dc2626", fontSize: 12, cursor: "pointer", flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
