import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "../api/settings";
import type { Settings } from "../types/settings";
import RolesManager from "./settings/RolesManager";
import MemberAttributesManager from "./settings/MemberAttributesManager";

function apiErrMsg(err: unknown): string {
  const e = err as Error & { body?: string };
  if (e.body) {
    try { const p = JSON.parse(e.body); return p.message ?? e.body; }
    catch { return e.body; }
  }
  return (err as Error).message ?? "Unbekannter Fehler";
}

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--c-border)",
  fontSize: 13,
  background: "var(--c-bg)",
  color: "var(--c-text)",
  boxSizing: "border-box",
  width: "100%",
};

const FIELDS: { key: keyof Omit<Settings, "id" | "updatedAt">; label: string; hint: string }[] = [
  { key: "bierlisteAdminLevel", label: "Bierliste-Admin-Level", hint: "Ab diesem Level: Bierliste-Admin-Rechte" },
  { key: "strafenwartLevel", label: "Strafenwart-Level", hint: "Ab diesem Level: alle Strafen lesen/schreiben" },
  { key: "strafenVorstandLevel", label: "Strafen-Vorstand-Level", hint: "Ab diesem Level: Strafen anlegen/bearbeiten/löschen" },
  { key: "strafenKassenwartLevel", label: "Strafen-Kassenwart-Level", hint: "Ab diesem Level: Strafen bezahlen/stornieren" },
  { key: "adminLevel", label: "Admin-Level", hint: "Ab diesem Level: Rolle ändern, fremdes Avatar bearbeiten" },
];

function LevelForm() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [edits, setEdits] = useState<Partial<Settings>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const form: Settings | null = data ? { ...data, ...edits } : null;

  async function handleSave() {
    if (!form) return;
    try {
      setSaving(true);
      setError("");
      setSaved(false);
      const updated = await updateSettings({
        bierlisteAdminLevel: form.bierlisteAdminLevel,
        strafenwartLevel: form.strafenwartLevel,
        strafenVorstandLevel: form.strafenVorstandLevel,
        strafenKassenwartLevel: form.strafenKassenwartLevel,
        adminLevel: form.adminLevel,
      });
      queryClient.setQueryData(["settings"], updated);
      setEdits({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !form) {
    return <div>Lade…</div>;
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 20px" }}>
        Level-Änderungen gelten sofort. Mitgliedsbeitrag-Beträge werden hier nicht mehr gepflegt — siehe Finanzen → Beitragsklassen.
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {FIELDS.map(f => (
        <div key={f.key} style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            {f.label}
            <input
              type="number"
              value={form[f.key]}
              onChange={e => setEdits({ ...edits, [f.key]: Number(e.target.value) })}
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
          <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "4px 0 0" }}>{f.hint}</p>
        </div>
      ))}

      <button onClick={handleSave} disabled={saving} style={{ marginTop: 8 }}>
        {saving ? "Speichert…" : saved ? "Gespeichert ✓" : "Speichern"}
      </button>
    </div>
  );
}

type Tab = "level" | "roles" | "attributes";

const TABS: { id: Tab; label: string }[] = [
  { id: "level", label: "Level" },
  { id: "roles", label: "Rollen" },
  { id: "attributes", label: "Mitglieder-Merkmale" },
];

export default function ServerSettings() {
  const [tab, setTab] = useState<Tab>("level");

  return (
    <div style={{ padding: "16px 16px", overflowY: "auto", height: "var(--content-h)", boxSizing: "border-box" }}>
      <h2 style={{ margin: "0 0 4px" }}>Server-Einstellungen</h2>
      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 16px" }}>
        Nur für Systemadmins sichtbar.
      </p>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--c-border)", marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 14px", border: "none", background: "transparent", fontSize: 13,
              fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? "var(--c-text)" : "var(--c-text-2)",
              borderBottom: `2px solid ${tab === t.id ? "var(--c-text)" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "level" && <LevelForm />}
      {tab === "roles" && <RolesManager />}
      {tab === "attributes" && <MemberAttributesManager />}
    </div>
  );
}
