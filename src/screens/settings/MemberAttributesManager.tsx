import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMemberAttributes, createMemberAttribute, updateMemberAttribute, deleteMemberAttribute } from "../../api/memberAttributes";
import type { AttributeType, MemberAttributeDefinition } from "../../types/memberAttributes";

function apiErrMsg(err: unknown): string {
  const e = err as Error & { body?: string };
  if (e.body) {
    try { const p = JSON.parse(e.body); return p.message ?? e.body; }
    catch { return e.body; }
  }
  return (err as Error).message ?? "Unbekannter Fehler";
}

const TYPES: AttributeType[] = ["BOOLEAN", "TEXT", "NUMBER", "SELECT"];

const inputStyle: React.CSSProperties = {
  padding: "5px 8px", borderRadius: 6, border: "1px solid var(--c-border)",
  fontSize: 13, background: "var(--c-bg)", color: "var(--c-text)", boxSizing: "border-box",
};

type Draft = { key: string; label: string; type: AttributeType; options: string; sortOrder: number };

function toDraft(d: MemberAttributeDefinition): Draft {
  return { key: d.key, label: d.label, type: d.type, options: (d.options ?? []).join(", "), sortOrder: d.sortOrder };
}

function optionsList(s: string): string[] {
  return s.split(",").map(o => o.trim()).filter(Boolean);
}

export default function MemberAttributesManager() {
  const queryClient = useQueryClient();
  const { data: attrs = [] } = useQuery({ queryKey: ["member-attributes"], queryFn: fetchMemberAttributes });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({ key: "", label: "", type: "BOOLEAN", options: "", sortOrder: 0 });
  const [creating, setCreating] = useState<Draft>({ key: "", label: "", type: "BOOLEAN", options: "", sortOrder: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["member-attributes"] });
  }

  function startEdit(d: MemberAttributeDefinition) {
    setEditingId(d.id);
    setEditDraft(toDraft(d));
    setError("");
  }

  async function saveEdit(id: number) {
    if (editDraft.type === "SELECT" && optionsList(editDraft.options).length === 0) {
      setError("SELECT-Merkmale brauchen mindestens eine Option"); return;
    }
    try {
      setBusy(true);
      setError("");
      await updateMemberAttribute(id, {
        key: editDraft.key, label: editDraft.label, type: editDraft.type,
        options: editDraft.type === "SELECT" ? optionsList(editDraft.options) : undefined,
        sortOrder: editDraft.sortOrder,
      });
      await invalidate();
      setEditingId(null);
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(d: MemberAttributeDefinition) {
    if (!confirm(`Merkmal „${d.label}" wirklich löschen?`)) return;
    try {
      setBusy(true);
      setError("");
      await deleteMemberAttribute(d.id);
      await invalidate();
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!creating.key.trim() || !creating.label.trim()) { setError("Key und Label sind erforderlich"); return; }
    if (creating.type === "SELECT" && optionsList(creating.options).length === 0) {
      setError("SELECT-Merkmale brauchen mindestens eine Option"); return;
    }
    try {
      setBusy(true);
      setError("");
      await createMemberAttribute({
        key: creating.key.trim(), label: creating.label.trim(), type: creating.type,
        options: creating.type === "SELECT" ? optionsList(creating.options) : undefined,
        sortOrder: creating.sortOrder,
      });
      await invalidate();
      setCreating({ key: "", label: "", type: "BOOLEAN", options: "", sortOrder: 0 });
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ margin: "0 0 4px" }}>Mitglieder-Merkmale</h3>
      <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "0 0 14px" }}>
        Frei definierbare Merkmale je Mitglied (ersetzen die alten festen Felder wie „Unter 18"). Werden auf der Mitgliedskarte gepflegt und in Beitragsklassen-Regeln referenziert. Löschen blockiert, solange das Merkmal in einer Regel verwendet wird.
      </p>

      {error && <p style={{ color: "red", fontSize: 13 }}>{error}</p>}

      <table width="100%" cellPadding={6} style={{ marginBottom: 16, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--c-border)" }}>
            <th align="left" style={{ fontSize: 12, color: "var(--c-text-3)" }}>Key</th>
            <th align="left" style={{ fontSize: 12, color: "var(--c-text-3)" }}>Label</th>
            <th align="left" style={{ fontSize: 12, color: "var(--c-text-3)" }}>Typ</th>
            <th align="left" style={{ fontSize: 12, color: "var(--c-text-3)" }}>Optionen</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {attrs.map(d => (
            <tr key={d.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
              {editingId === d.id ? (
                <>
                  <td><input style={{ ...inputStyle, width: 100 }} value={editDraft.key} onChange={e => setEditDraft({ ...editDraft, key: e.target.value })} /></td>
                  <td><input style={inputStyle} value={editDraft.label} onChange={e => setEditDraft({ ...editDraft, label: e.target.value })} /></td>
                  <td>
                    <select style={inputStyle} value={editDraft.type} onChange={e => setEditDraft({ ...editDraft, type: e.target.value as AttributeType })}>
                      {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>
                    {editDraft.type === "SELECT" && (
                      <input style={inputStyle} value={editDraft.options} onChange={e => setEditDraft({ ...editDraft, options: e.target.value })} placeholder="a, b, c" />
                    )}
                  </td>
                  <td align="right" style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => saveEdit(d.id)} disabled={busy}>Speichern</button>{" "}
                    <button onClick={() => setEditingId(null)} disabled={busy}>Abbrechen</button>
                  </td>
                </>
              ) : (
                <>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{d.key}</td>
                  <td>{d.label}</td>
                  <td>{d.type}</td>
                  <td style={{ color: "var(--c-text-2)", fontSize: 12 }}>{(d.options ?? []).join(", ") || "—"}</td>
                  <td align="right" style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => startEdit(d)} disabled={busy}>Bearbeiten</button>{" "}
                    <button onClick={() => handleDelete(d)} disabled={busy} style={{ color: "red" }}>Löschen</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ minWidth: 100 }}>
          Key
          <br />
          <input style={inputStyle} value={creating.key} onChange={e => setCreating({ ...creating, key: e.target.value })} placeholder="z.B. u18" />
        </label>
        <label style={{ flex: 1, minWidth: 120 }}>
          Label
          <br />
          <input style={{ ...inputStyle, width: "100%" }} value={creating.label} onChange={e => setCreating({ ...creating, label: e.target.value })} placeholder="z.B. Unter 18" />
        </label>
        <label>
          Typ
          <br />
          <select style={inputStyle} value={creating.type} onChange={e => setCreating({ ...creating, type: e.target.value as AttributeType })}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        {creating.type === "SELECT" && (
          <label style={{ flex: 1, minWidth: 140 }}>
            Optionen (kommagetrennt)
            <br />
            <input style={{ ...inputStyle, width: "100%" }} value={creating.options} onChange={e => setCreating({ ...creating, options: e.target.value })} placeholder="a, b, c" />
          </label>
        )}
        <button onClick={handleCreate} disabled={busy}>Anlegen</button>
      </div>
    </div>
  );
}
