import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSchichten,
  createSchicht,
  updateSchicht,
  deleteSchicht,
  signUpSchicht,
  signOffSchicht,
} from "../../api/veranstaltungen";
import { fetchMembers } from "../../api/members";
import { getCurrentUser } from "../../auth/currentUser";
import { canWriteEvents } from "../../auth/permissions";
import type { VeranstaltungSchicht } from "../../types/veranstaltungen";

function apiErrMsg(err: unknown): string {
  const e = err as Error & { body?: string };
  if (e.body) {
    try { const p = JSON.parse(e.body); return p.message ?? e.body; }
    catch { return e.body; }
  }
  return (err as Error).message ?? "Unbekannter Fehler";
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)",
  fontSize: 13, background: "var(--c-bg)", color: "var(--c-text)", boxSizing: "border-box",
};

type Draft = { name: string; startTime: string; endTime: string; kapazitaet: string; beschreibung: string };

const EMPTY_DRAFT: Draft = { name: "", startTime: "", endTime: "", kapazitaet: "", beschreibung: "" };

function toDraft(s: VeranstaltungSchicht): Draft {
  return {
    name: s.name,
    startTime: toDatetimeLocal(s.startTime),
    endTime: toDatetimeLocal(s.endTime),
    kapazitaet: s.kapazitaet != null ? String(s.kapazitaet) : "",
    beschreibung: s.beschreibung ?? "",
  };
}

function draftToBody(d: Draft) {
  return {
    name: d.name.trim(),
    startTime: d.startTime ? new Date(d.startTime).toISOString() : undefined,
    endTime: d.endTime ? new Date(d.endTime).toISOString() : undefined,
    kapazitaet: d.kapazitaet.trim() ? Number(d.kapazitaet) : undefined,
    beschreibung: d.beschreibung.trim() || undefined,
  };
}

function ShiftForm({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <label style={{ flex: 2, minWidth: 140 }}>
        Name
        <br />
        <input style={{ ...inputStyle, width: "100%" }} value={draft.name} onChange={e => onChange({ ...draft, name: e.target.value })} placeholder="z.B. Theke Abend" />
      </label>
      <label>
        Start
        <br />
        <input type="datetime-local" style={inputStyle} value={draft.startTime} onChange={e => onChange({ ...draft, startTime: e.target.value })} />
      </label>
      <label>
        Ende
        <br />
        <input type="datetime-local" style={inputStyle} value={draft.endTime} onChange={e => onChange({ ...draft, endTime: e.target.value })} />
      </label>
      <label>
        Kapazität
        <br />
        <input type="number" min={1} style={{ ...inputStyle, width: 80 }} value={draft.kapazitaet} onChange={e => onChange({ ...draft, kapazitaet: e.target.value })} placeholder="∞" />
      </label>
      <label style={{ flex: 2, minWidth: 140 }}>
        Beschreibung
        <br />
        <input style={{ ...inputStyle, width: "100%" }} value={draft.beschreibung} onChange={e => onChange({ ...draft, beschreibung: e.target.value })} placeholder="Optional" />
      </label>
    </div>
  );
}

export default function SchichtenSection({ veranstaltungId }: { veranstaltungId: number }) {
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const isAdmin = canWriteEvents();

  const { data: schichten = [], isLoading } = useQuery({
    queryKey: ["veranstaltung-schichten", veranstaltungId],
    queryFn: () => fetchSchichten(veranstaltungId),
  });
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: fetchMembers, enabled: isAdmin });

  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [addMemberFor, setAddMemberFor] = useState<number | null>(null);
  const [addMemberId, setAddMemberId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["veranstaltung-schichten", veranstaltungId] });
  }

  async function handleCreate() {
    if (!createDraft.name.trim()) { setError("Name ist erforderlich"); return; }
    try {
      setBusyId(-1);
      setError("");
      await createSchicht(veranstaltungId, draftToBody(createDraft));
      await invalidate();
      setCreateDraft(EMPTY_DRAFT);
      setCreating(false);
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveEdit(id: number) {
    try {
      setBusyId(id);
      setError("");
      await updateSchicht(veranstaltungId, id, draftToBody(editDraft));
      await invalidate();
      setEditingId(null);
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(s: VeranstaltungSchicht) {
    if (!confirm(`Schicht „${s.name}" wirklich löschen?`)) return;
    try {
      setBusyId(s.id);
      setError("");
      await deleteSchicht(veranstaltungId, s.id);
      await invalidate();
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSignUp(s: VeranstaltungSchicht, memberId?: number) {
    try {
      setBusyId(s.id);
      setError("");
      await signUpSchicht(veranstaltungId, s.id, memberId);
      await invalidate();
      setAddMemberFor(null);
      setAddMemberId("");
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSignOff(s: VeranstaltungSchicht, memberId: number) {
    try {
      setBusyId(s.id);
      setError("");
      await signOffSchicht(veranstaltungId, s.id, memberId);
      await invalidate();
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: 0 }}>Lädt…</p>;

  return (
    <div>
      {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}

      {schichten.length === 0 && !creating && (
        <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 8px" }}>Keine Schichten geplant.</p>
      )}

      {schichten.map(s => {
        const full = s.kapazitaet != null && s.mitglieder.length >= s.kapazitaet;
        const selfSignedUp = currentUser ? s.mitglieder.some(m => m.id === currentUser.sub) : false;
        const busy = busyId === s.id;
        const availableMembers = members.filter(m => !s.mitglieder.some(sm => sm.id === m.id));
        return (
          <div key={s.id} style={{ border: "1px solid var(--c-border)", borderRadius: 8, padding: 12, marginBottom: 10, background: "var(--c-bg-2)" }}>
            {editingId === s.id ? (
              <>
                <ShiftForm draft={editDraft} onChange={setEditDraft} />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={() => handleSaveEdit(s.id)} disabled={busy}>Speichern</button>
                  <button onClick={() => setEditingId(null)} disabled={busy}>Abbrechen</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--c-text)" }}>{s.name}</div>
                    {(s.startTime || s.endTime) && (
                      <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                        {fmtDateTime(s.startTime)}{s.endTime ? ` – ${fmtDateTime(s.endTime)}` : ""}
                      </div>
                    )}
                    {s.beschreibung && <div style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 2 }}>{s.beschreibung}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {isAdmin && (
                      <>
                        <button onClick={() => { setEditingId(s.id); setEditDraft(toDraft(s)); }} disabled={busy} style={{ fontSize: 12 }}>Bearbeiten</button>
                        <button onClick={() => handleDelete(s)} disabled={busy} style={{ fontSize: 12, color: "red" }}>Löschen</button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 8 }}>
                  Angemeldet: {s.mitglieder.length}{s.kapazitaet != null ? ` / ${s.kapazitaet}` : ""}{full && " (voll)"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {s.mitglieder.map(m => (
                    <span key={m.id} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: 20, fontSize: 12,
                      background: "var(--c-bg-3)", color: "var(--c-text-2)",
                    }}>
                      {m.firstname} {m.lastname}
                      {(isAdmin || m.id === currentUser?.sub) && (
                        <button
                          onClick={() => handleSignOff(s, m.id)}
                          disabled={busy}
                          title="Austragen"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-3)", fontSize: 12, padding: 0, lineHeight: 1 }}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  {!selfSignedUp && (
                    <button onClick={() => handleSignUp(s)} disabled={busy || full} style={{ fontSize: 12 }}>
                      {full ? "Schicht voll" : "Selbst eintragen"}
                    </button>
                  )}
                  {isAdmin && addMemberFor !== s.id && (
                    <button onClick={() => { setAddMemberFor(s.id); setAddMemberId(""); }} disabled={busy || full} style={{ fontSize: 12 }}>
                      + Mitglied eintragen
                    </button>
                  )}
                  {isAdmin && addMemberFor === s.id && (
                    <>
                      <select style={{ ...inputStyle, fontSize: 12 }} value={addMemberId} onChange={e => setAddMemberId(e.target.value ? Number(e.target.value) : "")}>
                        <option value="">Mitglied…</option>
                        {availableMembers.map(m => <option key={m.id} value={m.id}>{m.firstname} {m.lastname}</option>)}
                      </select>
                      <button onClick={() => addMemberId && handleSignUp(s, addMemberId as number)} disabled={busy || !addMemberId} style={{ fontSize: 12 }}>
                        Eintragen
                      </button>
                      <button onClick={() => setAddMemberFor(null)} disabled={busy} style={{ fontSize: 12 }}>Abbrechen</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      {isAdmin && (
        creating ? (
          <div style={{ border: "1px dashed var(--c-text-3)", borderRadius: 8, padding: 12 }}>
            <ShiftForm draft={createDraft} onChange={setCreateDraft} />
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={handleCreate} disabled={busyId === -1}>Anlegen</button>
              <button onClick={() => { setCreating(false); setCreateDraft(EMPTY_DRAFT); }} disabled={busyId === -1}>Abbrechen</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            style={{
              padding: "6px 14px", borderRadius: 6, border: "1px dashed var(--c-text-3)",
              background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer",
            }}
          >
            + Schicht hinzufügen
          </button>
        )
      )}
    </div>
  );
}
