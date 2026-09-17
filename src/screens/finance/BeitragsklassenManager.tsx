import { useState, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBeitragsklassen,
  createBeitragsklasse,
  updateBeitragsklasse,
  deleteBeitragsklasse,
  addBeitragsklasseRegel,
  deleteBeitragsklasseRegel,
} from "../../api/finance";
import { fetchMemberAttributes } from "../../api/memberAttributes";
import { canWriteFinance } from "../../auth/permissions";
import type { Beitragsklasse } from "../../types/finance";

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

type Draft = { name: string; betragJL: number; betragKG: number; isDefault: boolean; prioritaet: number };

function toDraft(k: Beitragsklasse): Draft {
  return { name: k.name, betragJL: k.betragJL, betragKG: k.betragKG, isDefault: k.isDefault, prioritaet: k.prioritaet };
}

function RegelRow({ klasse, canWrite }: { klasse: Beitragsklasse; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const { data: attrs = [] } = useQuery({ queryKey: ["member-attributes"], queryFn: fetchMemberAttributes });
  const [merkmalId, setMerkmalId] = useState<number | "">("");
  const [wert, setWert] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["beitragsklassen"] });
  }

  async function addRule() {
    if (!merkmalId || !wert.trim()) { setError("Merkmal und Wert erforderlich"); return; }
    try {
      setBusy(true);
      setError("");
      await addBeitragsklasseRegel(klasse.id, { merkmalId: Number(merkmalId), wert: wert.trim() });
      await invalidate();
      setWert("");
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(regelId: number) {
    try {
      setBusy(true);
      setError("");
      await deleteBeitragsklasseRegel(klasse.id, regelId);
      await invalidate();
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "8px 12px 12px", background: "var(--c-bg-2)" }}>
      {error && <p style={{ color: "red", fontSize: 12, margin: "0 0 6px" }}>{error}</p>}
      {(klasse.regeln ?? []).length === 0 && (
        <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "0 0 6px" }}>
          Keine Regeln — Klasse greift nur, wenn sie {klasse.isDefault ? "Default ist." : "explizit zugewiesen wird."}
        </p>
      )}
      {(klasse.regeln ?? []).map(r => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 4 }}>
          <span>{r.merkmal?.label ?? r.merkmalId} = "{r.wert}"</span>
          {canWrite && (
            <button onClick={() => removeRule(r.id)} disabled={busy} style={{ color: "red", fontSize: 11 }}>Entfernen</button>
          )}
        </div>
      ))}
      {canWrite && (
        <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
          <select style={{ ...inputStyle, fontSize: 12 }} value={merkmalId} onChange={e => setMerkmalId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Merkmal…</option>
            {attrs.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <input style={{ ...inputStyle, fontSize: 12, width: 100 }} placeholder="Wert" value={wert} onChange={e => setWert(e.target.value)} />
          <button onClick={addRule} disabled={busy} style={{ fontSize: 12 }}>+ Regel</button>
        </div>
      )}
    </div>
  );
}

export default function BeitragsklassenManager() {
  const queryClient = useQueryClient();
  const { data: klassen = [] } = useQuery({ queryKey: ["beitragsklassen"], queryFn: fetchBeitragsklassen });
  const canWrite = canWriteFinance();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({ name: "", betragJL: 0, betragKG: 0, isDefault: false, prioritaet: 0 });
  const [creating, setCreating] = useState<Draft>({ name: "", betragJL: 0, betragKG: 0, isDefault: false, prioritaet: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["beitragsklassen"] });
  }

  function startEdit(k: Beitragsklasse) {
    setEditingId(k.id);
    setEditDraft(toDraft(k));
    setError("");
  }

  async function saveEdit(id: number) {
    try {
      setBusy(true);
      setError("");
      await updateBeitragsklasse(id, editDraft);
      await invalidate();
      setEditingId(null);
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(k: Beitragsklasse) {
    if (!confirm(`Beitragsklasse „${k.name}" wirklich löschen?`)) return;
    try {
      setBusy(true);
      setError("");
      await deleteBeitragsklasse(k.id);
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
      await createBeitragsklasse(creating);
      await invalidate();
      setCreating({ name: "", betragJL: 0, betragKG: 0, isDefault: false, prioritaet: 0 });
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      border: "1px solid var(--c-border)", borderRadius: 6, padding: 16, margin: "12px 0", background: "var(--c-bg-2)",
    }}>
      <h4 style={{ margin: "0 0 4px" }}>Beitragsklassen</h4>
      <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "0 0 12px" }}>
        Ersetzt die feste „ermäßigt/voll"-Logik. Genau eine Klasse ist Default (Fallback); Regeln (Merkmal = Wert) entscheiden, welche Klasse ein Mitglied bekommt — die erste zutreffende, nach Priorität sortiert, gewinnt.
      </p>

      {error && <p style={{ color: "red", margin: "0 0 8px" }}>{error}</p>}

      <table width="100%" cellPadding={6} style={{ marginBottom: 16 }}>
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="right">Beitrag JL</th>
            <th align="right">Beitrag KG</th>
            <th align="center">Default</th>
            <th align="right">Priorität</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {klassen.length === 0 && (
            <tr><td colSpan={6} style={{ color: "var(--c-text-3)", fontStyle: "italic" }}>Keine Beitragsklassen vorhanden</td></tr>
          )}
          {klassen.map(k => (
            <Fragment key={k.id}>
              <tr>
                {editingId === k.id ? (
                  <>
                    <td><input style={inputStyle} value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} /></td>
                    <td align="right"><input type="number" style={{ ...inputStyle, width: 70 }} value={editDraft.betragJL} onChange={e => setEditDraft({ ...editDraft, betragJL: Number(e.target.value) })} /></td>
                    <td align="right"><input type="number" style={{ ...inputStyle, width: 70 }} value={editDraft.betragKG} onChange={e => setEditDraft({ ...editDraft, betragKG: Number(e.target.value) })} /></td>
                    <td align="center"><input type="checkbox" checked={editDraft.isDefault} onChange={e => setEditDraft({ ...editDraft, isDefault: e.target.checked })} /></td>
                    <td align="right"><input type="number" style={{ ...inputStyle, width: 50 }} value={editDraft.prioritaet} onChange={e => setEditDraft({ ...editDraft, prioritaet: Number(e.target.value) })} /></td>
                    <td align="right" style={{ whiteSpace: "nowrap" }}>
                      <button onClick={() => saveEdit(k.id)} disabled={busy}>Speichern</button>{" "}
                      <button onClick={() => setEditingId(null)} disabled={busy}>Abbrechen</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{k.name}</td>
                    <td align="right">{k.betragJL.toFixed(2)} €</td>
                    <td align="right">{k.betragKG.toFixed(2)} €</td>
                    <td align="center">{k.isDefault ? "✓" : ""}</td>
                    <td align="right">{k.prioritaet}</td>
                    <td align="right" style={{ whiteSpace: "nowrap" }}>
                      <button onClick={() => setExpandedId(expandedId === k.id ? null : k.id)}>
                        Regeln {expandedId === k.id ? "▲" : "▼"} ({(k.regeln ?? []).length})
                      </button>{" "}
                      {canWrite && <button onClick={() => startEdit(k)} disabled={busy}>Bearbeiten</button>}{" "}
                      {canWrite && <button onClick={() => handleDelete(k)} disabled={busy} style={{ color: "red" }}>Löschen</button>}
                    </td>
                  </>
                )}
              </tr>
              {expandedId === k.id && (
                <tr>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <RegelRow klasse={k} canWrite={canWrite} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {canWrite && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: 120 }}>
            Name
            <br />
            <input style={{ ...inputStyle, width: "100%" }} value={creating.name} onChange={e => setCreating({ ...creating, name: e.target.value })} placeholder="z.B. Fördermitglied" />
          </label>
          <label>
            Beitrag JL
            <br />
            <input type="number" style={{ ...inputStyle, width: 80 }} value={creating.betragJL} onChange={e => setCreating({ ...creating, betragJL: Number(e.target.value) })} />
          </label>
          <label>
            Beitrag KG
            <br />
            <input type="number" style={{ ...inputStyle, width: 80 }} value={creating.betragKG} onChange={e => setCreating({ ...creating, betragKG: Number(e.target.value) })} />
          </label>
          <label>
            Priorität
            <br />
            <input type="number" style={{ ...inputStyle, width: 60 }} value={creating.prioritaet} onChange={e => setCreating({ ...creating, prioritaet: Number(e.target.value) })} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={creating.isDefault} onChange={e => setCreating({ ...creating, isDefault: e.target.checked })} />
            Default
          </label>
          <button onClick={handleCreate} disabled={busy}>Anlegen</button>
        </div>
      )}
    </div>
  );
}
