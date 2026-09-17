import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRoles } from "../../api/members";
import { createRole, updateRole, deleteRole } from "../../api/roles";
import type { Role } from "../../types/member";

function apiErrMsg(err: unknown): string {
  const e = err as Error & { body?: string };
  if (e.body) {
    try { const p = JSON.parse(e.body); return p.message ?? e.body; }
    catch { return e.body; }
  }
  return (err as Error).message ?? "Unbekannter Fehler";
}

const inputStyle: React.CSSProperties = {
  padding: "5px 8px", borderRadius: 6, border: "1px solid var(--c-border)",
  fontSize: 13, background: "var(--c-bg)", color: "var(--c-text)", boxSizing: "border-box",
};

export default function RolesManager() {
  const queryClient = useQueryClient();
  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: fetchRoles });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; accessLevel: number; description: string }>({ name: "", accessLevel: 0, description: "" });
  const [creating, setCreating] = useState({ name: "", accessLevel: 0, description: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["roles"] });
  }

  function startEdit(r: Role) {
    setEditingId(r.id);
    setEditDraft({ name: r.name, accessLevel: r.accessLevel, description: r.description ?? "" });
    setError("");
  }

  async function saveEdit(id: number) {
    try {
      setBusy(true);
      setError("");
      await updateRole(id, editDraft);
      await invalidate();
      setEditingId(null);
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(r: Role) {
    if (!confirm(`Rolle „${r.name}" wirklich löschen?`)) return;
    try {
      setBusy(true);
      setError("");
      await deleteRole(r.id);
      await invalidate();
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!creating.name.trim()) { setError("Name ist erforderlich"); return; }
    try {
      setBusy(true);
      setError("");
      await createRole(creating);
      await invalidate();
      setCreating({ name: "", accessLevel: 0, description: "" });
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ margin: "0 0 4px" }}>Rollen</h3>
      <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "0 0 14px" }}>
        `accessLevel` bestimmt die Berechtigungsstufe (0–5). Löschen blockiert, solange Mitglieder der Rolle zugewiesen sind.
      </p>

      {error && <p style={{ color: "red", fontSize: 13 }}>{error}</p>}

      <table width="100%" cellPadding={6} style={{ marginBottom: 16, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--c-border)" }}>
            <th align="left" style={{ fontSize: 12, color: "var(--c-text-3)" }}>Name</th>
            <th align="left" style={{ fontSize: 12, color: "var(--c-text-3)" }}>Level</th>
            <th align="left" style={{ fontSize: 12, color: "var(--c-text-3)" }}>Beschreibung</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {roles.map(r => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
              {editingId === r.id ? (
                <>
                  <td><input style={inputStyle} value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} /></td>
                  <td><input type="number" min={0} max={5} style={{ ...inputStyle, width: 60 }} value={editDraft.accessLevel} onChange={e => setEditDraft({ ...editDraft, accessLevel: Number(e.target.value) })} /></td>
                  <td><input style={inputStyle} value={editDraft.description} onChange={e => setEditDraft({ ...editDraft, description: e.target.value })} /></td>
                  <td align="right" style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => saveEdit(r.id)} disabled={busy}>Speichern</button>{" "}
                    <button onClick={() => setEditingId(null)} disabled={busy}>Abbrechen</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{r.name}</td>
                  <td>{r.accessLevel}</td>
                  <td style={{ color: "var(--c-text-2)" }}>{r.description ?? "—"}</td>
                  <td align="right" style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => startEdit(r)} disabled={busy}>Bearbeiten</button>{" "}
                    <button onClick={() => handleDelete(r)} disabled={busy} style={{ color: "red" }}>Löschen</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ flex: 2, minWidth: 120 }}>
          Name
          <br />
          <input style={{ ...inputStyle, width: "100%" }} value={creating.name} onChange={e => setCreating({ ...creating, name: e.target.value })} placeholder="Rollenname" />
        </label>
        <label>
          Level
          <br />
          <input type="number" min={0} max={5} style={{ ...inputStyle, width: 60 }} value={creating.accessLevel} onChange={e => setCreating({ ...creating, accessLevel: Number(e.target.value) })} />
        </label>
        <label style={{ flex: 3, minWidth: 140 }}>
          Beschreibung
          <br />
          <input style={{ ...inputStyle, width: "100%" }} value={creating.description} onChange={e => setCreating({ ...creating, description: e.target.value })} placeholder="Optional" />
        </label>
        <button onClick={handleCreate} disabled={busy}>Anlegen</button>
      </div>
    </div>
  );
}
