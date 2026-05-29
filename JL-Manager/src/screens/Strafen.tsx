import { useState, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  fetchStrafen, createStrafe, updateStrafe, deleteStrafe,
  fetchEintraege, createEintrag, deleteEintrag,
  bezahlenEintrag, stornierenEintrag,
} from "../api/strafen";
import { fetchMembers } from "../api/members";
import { fetchBusinessYears } from "../api/finance";
import { canWriteStrafen, canSeeAllStrafen, canWriteStrafeEintraege, canMarkStrafeGezahlt } from "../auth/permissions";
import { getCurrentUser } from "../auth/currentUser";
import type { Strafe, StrafeEintrag } from "../types/strafen";
import type { Member } from "../types/member";
import type { BusinessYear } from "../types/finance";
import { triggerDownload } from "../utils/triggerDownload";

type SubTab = "katalog" | "meine" | "alle";

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--c-border)",
  fontSize: 13,
  background: "var(--c-bg)",
  color: "var(--c-text)",
  boxSizing: "border-box",
};

function todayStr(): string {
  return new Date().toISOString().substring(0, 10);
}

function fmtDate(d: string): string {
  if (!d) return "–";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

function detectBusinessYearId(dateStr: string, businessYears: BusinessYear[]): number | null {
  if (!dateStr || !businessYears.length) return null;
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const targetYear = month === 1 ? year - 1 : year;
  return businessYears.find(by => by.year === targetYear)?.id ?? null;
}

function apiErrMsg(err: unknown): string {
  const e = err as Error & { body?: string; status?: number };
  if (e.body) {
    try {
      const parsed = JSON.parse(e.body);
      return parsed.message ?? e.body;
    } catch {
      return e.body;
    }
  }
  return e.message ?? "Unbekannter Fehler";
}

function StatusBadge({ bezahlt }: { bezahlt: boolean }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 12,
      fontSize: 12, fontWeight: 600,
      background: bezahlt ? "#f0fdf4" : "#fef2f2",
      color: bezahlt ? "#16a34a" : "#dc2626",
      border: `1px solid ${bezahlt ? "#16a34a33" : "#dc262633"}`,
    }}>
      {bezahlt ? "Bezahlt" : "Offen"}
    </span>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ padding: "12px 20px", borderRadius: 10, background: "var(--c-bg)", border: "1px solid var(--c-border)", minWidth: 110 }}>
      <div style={{ fontSize: 11, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ── Assign Modal ──────────────────────────────────────────────────────────────
function AssignModal({
  preStrafe,
  members,
  businessYears,
  strafen,
  onClose,
  onCreated,
}: {
  preStrafe: Strafe | null;
  members: Member[];
  businessYears: BusinessYear[];
  strafen: Strafe[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [strafeId, setStrafeId] = useState<number>(preStrafe?.id ?? strafen[0]?.id ?? 0);
  const [memberId, setMemberId] = useState<number>(0);
  const [date, setDate] = useState(todayStr());
  const [grund, setGrund] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const detectedYearId = detectBusinessYearId(date, businessYears);
  const detectedYear = businessYears.find(by => by.id === detectedYearId);
  const activeMembers = members.filter(m => m.active);

  async function handleSubmit() {
    if (!memberId) { setError("Mitglied auswählen."); return; }
    const sid = preStrafe?.id ?? strafeId;
    if (!sid) { setError("Strafe auswählen."); return; }
    if (!detectedYearId) { setError("Kein passendes Geschäftsjahr für dieses Datum."); return; }
    setSaving(true);
    setError("");
    try {
      await createEintrag({ memberId, strafeId: sid, businessYearId: detectedYearId, grund: grund.trim() || undefined });
      onCreated();
      onClose();
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 12,
        padding: 24, width: 420, maxWidth: "calc(100vw - 32px)", zIndex: 1000,
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>Strafe zuweisen</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-3)", fontSize: 22 }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {preStrafe ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Strafe</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>
                {preStrafe.name} <span style={{ color: "#dc2626" }}>{preStrafe.betrag.toFixed(2)} €</span>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Strafe *</div>
              <select value={strafeId} onChange={e => setStrafeId(Number(e.target.value))} style={{ ...inputStyle, width: "100%" }}>
                <option value={0} disabled>Strafe wählen…</option>
                {strafen.map(s => <option key={s.id} value={s.id}>{s.name} ({s.betrag.toFixed(2)} €)</option>)}
              </select>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Mitglied *</div>
            <select value={memberId} onChange={e => setMemberId(Number(e.target.value))} style={{ ...inputStyle, width: "100%" }}>
              <option value={0} disabled>Mitglied wählen…</option>
              {activeMembers.map(m => <option key={m.id} value={m.id}>{m.firstname} {m.lastname}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Datum</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              {detectedYear
                ? <span style={{ fontSize: 12, color: "var(--c-text-3)", whiteSpace: "nowrap" }}>GJ {detectedYear.year}</span>
                : date ? <span style={{ fontSize: 12, color: "#dc2626", whiteSpace: "nowrap" }}>Kein GJ</span> : null}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Grund (optional)</div>
            <input type="text" value={grund} onChange={e => setGrund(e.target.value)} placeholder="Begründung oder Notiz" style={{ ...inputStyle, width: "100%" }} />
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 13, padding: "6px 10px", background: "#fef2f2", borderRadius: 6 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer" }}>Abbrechen</button>
            <button onClick={handleSubmit} disabled={saving} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: saving ? "#94a3b8" : "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Speichere…" : "Zuweisen"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Bezahlen Modal ────────────────────────────────────────────────────────────
function BezahlenModal({
  eintrag,
  onClose,
  onDone,
}: {
  eintrag: import("../types/strafen").StrafeEintrag;
  onClose: () => void;
  onDone: () => void;
}) {
  const [datum, setDatum] = useState(todayStr());
  const [tag, setTag] = useState<"ONLINE" | "BAR">("BAR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const strafe = eintrag.strafe;
  const member = eintrag.member;

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      await bezahlenEintrag(eintrag.id, { datum, tag });
      onDone();
      onClose();
    } catch (err) {
      setError(apiErrMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 12,
        padding: 24, width: 380, maxWidth: "calc(100vw - 32px)", zIndex: 1000,
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>Strafe bezahlen</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-3)", fontSize: 22 }}>×</button>
        </div>
        <div style={{ marginBottom: 18, padding: "10px 14px", borderRadius: 8, background: "var(--c-bg-2)", border: "1px solid var(--c-border)", fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: "var(--c-text)" }}>{strafe?.name ?? "–"} — {(strafe?.betrag ?? 0).toFixed(2)} €</div>
          {member && <div style={{ color: "var(--c-text-2)", marginTop: 2 }}>{member.firstname} {member.lastname}</div>}
          {eintrag.grund && <div style={{ color: "var(--c-text-3)", marginTop: 2, fontStyle: "italic" }}>„{eintrag.grund}"</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Datum</div>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Zahlungsart</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["BAR", "ONLINE"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTag(t)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    border: `2px solid ${tag === t ? "#1e293b" : "var(--c-border)"}`,
                    background: tag === t ? "#1e293b" : "var(--c-bg)",
                    color: tag === t ? "#fff" : "var(--c-text-2)",
                  }}
                >
                  {t === "BAR" ? "Bar" : "Online"}
                </button>
              ))}
            </div>
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 13, padding: "6px 10px", background: "#fef2f2", borderRadius: 6 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer" }}>Abbrechen</button>
            <button onClick={handleSubmit} disabled={saving || !datum} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: saving || !datum ? "#94a3b8" : "#16a34a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving || !datum ? "not-allowed" : "pointer" }}>
              {saving ? "Speichere…" : "Als bezahlt buchen"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Katalog Tab ───────────────────────────────────────────────────────────────
function KatalogTab({ isAdmin, onAssign }: { isAdmin: boolean; onAssign: (s: Strafe) => void }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", beschreibung: "", betrag: "" });
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", beschreibung: "", betrag: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data: strafen = [], isLoading } = useQuery({
    queryKey: ["strafen"],
    queryFn: fetchStrafen,
    staleTime: 30_000,
  });

  async function handleExportPdf() {
    setExporting(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      let y = 18;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Strafenkatalog", 14, y);
      y += 9;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`, 14, y);
      y += 10;

      autoTable(doc, {
        startY: y,
        head: [["Beschreibung", "Betrag"]],
        body: strafen.map(s => [
          s.beschreibung ? `${s.name}\n${s.beschreibung}` : s.name,
          `${s.betrag.toFixed(2)} €`,
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 0: { cellWidth: pageW - 28 - 30 }, 1: { halign: "right", cellWidth: 30 } },
        theme: "striped",
      });

      const tableEndY: number = (doc as any).lastAutoTable.finalY;
      const sigBlockH = 82;

      let sy: number;
      if (tableEndY + 10 + sigBlockH > pageH - 15) {
        doc.addPage();
        sy = 20;
      } else {
        sy = tableEndY + 12;
      }

      // Hinweistext
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(
        "Die Strafen sollen bis Ende des entsprechenden Geschäftsjahres gezahlt werden.",
        14, sy,
      );
      sy += 10;

      // Einleitungszeile
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text("Beide Seiten gelesen und akzeptiert:", 14, sy);
      sy += 12;

      // Unterschrift 1 — Mitglied
      doc.setDrawColor(100, 100, 100);
      doc.line(14, sy, 90, sy);       // Ort/Datum
      doc.line(110, sy, 196, sy);     // Unterschrift
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Ort, Datum", 14, sy + 4);
      doc.text("Unterschrift", 110, sy + 4);
      doc.setTextColor(0, 0, 0);
      sy += 18; // zwei Zeilen frei

      // Optionales Ankreuzfeld — Erziehungsberechtigte/r
      doc.setDrawColor(60, 60, 60);
      doc.rect(14, sy - 3.5, 4, 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Unterschrift des Erziehungsberechtigten (optional):", 20, sy);
      sy += 10;

      // Unterschrift 2 — Erziehungsberechtigte/r
      doc.setDrawColor(100, 100, 100);
      doc.line(14, sy, 90, sy);
      doc.line(110, sy, 196, sy);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Ort, Datum", 14, sy + 4);
      doc.text("Unterschrift Erziehungsberechtigte/r", 110, sy + 4);
      doc.setTextColor(0, 0, 0);

      const fn1 = `Strafenkatalog_${new Date().toISOString().substring(0, 10)}.pdf`;
      await triggerDownload(fn1, new Blob([doc.output("arraybuffer")], { type: "application/pdf" }));
    } finally {
      setExporting(false);
    }
  }

  function startEdit(s: Strafe) {
    setEditingId(s.id);
    setEditForm({ name: s.name, beschreibung: s.beschreibung ?? "", betrag: String(s.betrag) });
    setError("");
  }

  async function saveEdit(id: number) {
    if (!editForm.name.trim()) { setError("Name erforderlich."); return; }
    const betrag = parseFloat(editForm.betrag);
    if (isNaN(betrag) || betrag < 0) { setError("Betrag ungültig."); return; }
    setSaving(true); setError("");
    try {
      await updateStrafe(id, { name: editForm.name.trim(), beschreibung: editForm.beschreibung.trim() || null, betrag });
      queryClient.invalidateQueries({ queryKey: ["strafen"] });
      setEditingId(null);
    } catch (err) {
      setError(apiErrMsg(err));
    } finally { setSaving(false); }
  }

  async function handleDelete(s: Strafe) {
    if ((s._count?.eintraege ?? 0) > 0) { alert(`"${s.name}" hat ${s._count!.eintraege} Einträge und kann nicht gelöscht werden.`); return; }
    if (!confirm(`Strafe "${s.name}" löschen?`)) return;
    try {
      await deleteStrafe(s.id);
      queryClient.invalidateQueries({ queryKey: ["strafen"] });
    } catch (err) { alert(apiErrMsg(err)); }
  }

  async function handleCreate() {
    if (!newForm.name.trim()) { setError("Name erforderlich."); return; }
    const betrag = parseFloat(newForm.betrag);
    if (isNaN(betrag) || betrag < 0) { setError("Gültigen Betrag eingeben (z.B. 5 oder 2.50)."); return; }
    setSaving(true); setError("");
    try {
      await createStrafe({ name: newForm.name.trim(), beschreibung: newForm.beschreibung.trim() || undefined, betrag });
      queryClient.invalidateQueries({ queryKey: ["strafen"] });
      setNewForm({ name: "", beschreibung: "", betrag: "" });
      setCreating(false);
    } catch (err) {
      setError(apiErrMsg(err));
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>Strafenkatalog</h3>
        <button onClick={handleExportPdf} disabled={exporting || isLoading} style={{ marginLeft: "auto", padding: "5px 14px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: exporting || isLoading ? "not-allowed" : "pointer", opacity: exporting || isLoading ? 0.6 : 1 }}>
          {exporting ? "Exportiere…" : "PDF"}
        </button>
        {isAdmin && (
          <button onClick={() => { setCreating(true); setError(""); }} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Neue Strafe
          </button>
        )}
      </div>

      {isAdmin && creating && (
        <div style={{ padding: 14, borderRadius: 8, border: "1px solid var(--c-border)", background: "var(--c-bg-2)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...inputStyle, flex: 2 }} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *" autoFocus onKeyDown={e => { if (e.key === "Enter") handleCreate(); }} />
            <input type="number" min={0} step={0.01} style={{ ...inputStyle, width: 110 }} value={newForm.betrag} onChange={e => setNewForm(f => ({ ...f, betrag: e.target.value }))} placeholder="Betrag € *" />
          </div>
          <input style={{ ...inputStyle, width: "100%" }} value={newForm.beschreibung} onChange={e => setNewForm(f => ({ ...f, beschreibung: e.target.value }))} placeholder="Beschreibung (optional)" />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={handleCreate} disabled={saving} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: saving ? "#94a3b8" : "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "…" : "Erstellen"}</button>
            <button onClick={() => { setCreating(false); setNewForm({ name: "", beschreibung: "", betrag: "" }); setError(""); }} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer" }}>Abbrechen</button>
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 12, padding: "5px 8px", background: "#fef2f2", borderRadius: 5 }}>{error}</div>}
        </div>
      )}

      {isLoading ? (
        <div style={{ color: "var(--c-text-3)", padding: "24px 0" }}>Lade…</div>
      ) : strafen.length === 0 && !creating ? (
        <div style={{ color: "var(--c-text-3)", fontSize: 14, padding: "24px 0" }}>Keine Strafen im Katalog.</div>
      ) : (
        <div style={{ borderRadius: 10, border: "1px solid var(--c-border)", overflow: "hidden", background: "var(--c-bg)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--c-bg-2)", borderBottom: "1px solid var(--c-border)" }}>
                <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Name</th>
                <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Beschreibung</th>
                <th align="right" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Betrag</th>
                <th align="right" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Einträge</th>
                {isAdmin && <th style={{ padding: "10px 14px", width: 150 }} />}
              </tr>
            </thead>
            <tbody>
              {strafen.map((s, idx) => (
                editingId === s.id ? (
                  <tr key={s.id} style={{ background: "var(--c-bg-2)", borderBottom: "1px solid var(--c-border)" }}>
                    <td colSpan={isAdmin ? 5 : 4} style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input style={{ ...inputStyle, flex: 2 }} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *" autoFocus />
                          <input type="number" min={0} step={0.01} style={{ ...inputStyle, width: 110 }} value={editForm.betrag} onChange={e => setEditForm(f => ({ ...f, betrag: e.target.value }))} placeholder="€ *" />
                          <button onClick={() => saveEdit(s.id)} disabled={saving} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: saving ? "#94a3b8" : "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", flexShrink: 0 }}>{saving ? "…" : "Speichern"}</button>
                          <button onClick={() => { setEditingId(null); setError(""); }} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>Abbrechen</button>
                        </div>
                        <input style={{ ...inputStyle, width: "100%" }} value={editForm.beschreibung} onChange={e => setEditForm(f => ({ ...f, beschreibung: e.target.value }))} placeholder="Beschreibung (optional)" />
                        {error && <div style={{ color: "#dc2626", fontSize: 12 }}>{error}</div>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} style={{ background: idx % 2 === 0 ? "var(--c-bg)" : "var(--c-bg-2)", borderBottom: "1px solid var(--c-border)" }}>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>{s.name}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text-3)" }}>{s.beschreibung ?? "–"}</td>
                    <td align="right" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{s.betrag.toFixed(2)} €</td>
                    <td align="right" style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text-3)" }}>{s._count?.eintraege ?? 0}</td>
                    {isAdmin && (
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => onAssign(s)} title="Strafe zuweisen" style={{ padding: "4px 12px", borderRadius: 5, border: "none", background: "#1e293b", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+</button>
                          <button onClick={() => startEdit(s)} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 12, cursor: "pointer" }}>Bearb.</button>
                          <button onClick={() => handleDelete(s)} style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #fca5a5", background: "var(--c-bg)", color: "#dc2626", fontSize: 12, cursor: "pointer" }}>×</button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Meine Strafen (user + admin) ──────────────────────────────────────────────
function MeineEintraege({ memberId, memberName, businessYears, isMobile }: { memberId: number; memberName: string; businessYears: BusinessYear[]; isMobile: boolean }) {
  const sortedYears = useMemo(() => [...businessYears].sort((a, b) => b.year - a.year), [businessYears]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const effectiveYearId = selectedYearId ?? sortedYears[0]?.id ?? null;

  const { data: eintraege = [], isLoading } = useQuery({
    queryKey: ["strafen-eintraege", "meine", memberId, effectiveYearId],
    queryFn: () => fetchEintraege({ memberId, businessYearId: effectiveYearId ?? undefined }),
    enabled: effectiveYearId !== null,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

  const totalOffen = eintraege.filter(e => !e.bezahlt).reduce((s, e) => s + (e.strafe?.betrag ?? 0), 0);

  async function handleExportPdf() {
    setExporting(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const selectedYear = sortedYears.find(y => y.id === effectiveYearId);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let y = 18;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Strafenliste", 14, y);
      y += 9;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Mitglied: ${memberName}`, 14, y); y += 6;
      doc.text(`Geschäftsjahr: ${selectedYear?.year ?? "–"}`, 14, y); y += 6;
      doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`, 14, y); y += 10;

      autoTable(doc, {
        startY: y,
        head: [["#", "Strafe", "Betrag", "Datum", "Grund", "Status"]],
        body: eintraege.map((e, i) => [
          i + 1,
          e.strafe?.name ?? `#${e.strafeId}`,
          `${(e.strafe?.betrag ?? 0).toFixed(2)} €`,
          fmtDate(e.createdAt),
          e.grund ?? "–",
          e.bezahlt ? "Bezahlt" : "Offen",
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 0: { cellWidth: 10 }, 2: { halign: "right" }, 5: { cellWidth: 22 } },
        theme: "striped",
      });

      const tableEndY: number = (doc as any).lastAutoTable.finalY + 8;
      const totalGesamt = eintraege.reduce((s, e) => s + (e.strafe?.betrag ?? 0), 0);
      doc.setFontSize(10);
      doc.text(`Einträge: ${eintraege.length}  |  Gesamt: ${totalGesamt.toFixed(2)} €  |  Offen: ${totalOffen.toFixed(2)} €`, 14, tableEndY);

      const sigY = tableEndY + 24;
      doc.setDrawColor(120, 120, 120);
      doc.line(14, sigY, 90, sigY);
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text("Datum, Unterschrift Mitglied", 14, sigY + 4);

      const sig2Y = sigY + 22;
      doc.line(14, sig2Y, 90, sig2Y);
      doc.text("Datum, Unterschrift Erziehungsberechtigte/r (bei Minderjährigen)", 14, sig2Y + 4);
      doc.setTextColor(0, 0, 0);

      const fn2 = `Strafen_${memberName.replace(/\s+/g, "_")}_GJ${selectedYear?.year ?? ""}.pdf`;
      await triggerDownload(fn2, new Blob([doc.output("arraybuffer")], { type: "application/pdf" }));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>Deine Strafen</h3>
        <select value={effectiveYearId ?? ""} onChange={e => setSelectedYearId(Number(e.target.value))} style={{ fontSize: 14, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text)" }}>
          {sortedYears.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
        </select>
        <button onClick={handleExportPdf} disabled={exporting || isLoading} style={{ marginLeft: "auto", padding: "5px 14px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: exporting || isLoading ? "not-allowed" : "pointer", opacity: exporting || isLoading ? 0.6 : 1 }}>
          {exporting ? "Exportiere…" : "PDF"}
        </button>
      </div>

      {eintraege.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <SummaryCard label="Einträge" value={eintraege.length} color="var(--c-text)" />
          <SummaryCard label="Offen" value={`${totalOffen.toFixed(2)} €`} color={totalOffen > 0 ? "#dc2626" : "#16a34a"} />
          {!isMobile && <SummaryCard label="Gesamt" value={`${eintraege.reduce((s, e) => s + (e.strafe?.betrag ?? 0), 0).toFixed(2)} €`} color="var(--c-text-2)" />}
        </div>
      )}

      {isLoading ? (
        <div style={{ color: "var(--c-text-3)", fontSize: 13 }}>Lade…</div>
      ) : (
        <div style={{ borderRadius: 10, border: "1px solid var(--c-border)", overflow: "hidden", background: "var(--c-bg)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--c-bg-2)", borderBottom: "1px solid var(--c-border)" }}>
                <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Strafe</th>
                <th align="right" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Betrag</th>
                {!isMobile && <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Datum</th>}
                {!isMobile && <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Grund</th>}
                <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {eintraege.length === 0 ? (
                <tr><td colSpan={isMobile ? 3 : 5} style={{ padding: 24, textAlign: "center", color: "var(--c-text-3)", fontSize: 14 }}>Keine Strafen in diesem Geschäftsjahr.</td></tr>
              ) : eintraege.map((e, idx) => (
                <tr key={e.id} style={{ background: idx % 2 === 0 ? "var(--c-bg)" : "var(--c-bg-2)", borderBottom: "1px solid var(--c-border)" }}>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>{e.strafe?.name ?? `#${e.strafeId}`}</td>
                  <td align="right" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{(e.strafe?.betrag ?? 0).toFixed(2)} €</td>
                  {!isMobile && <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text-2)" }}>{fmtDate(e.createdAt)}</td>}
                  {!isMobile && <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text-3)" }}>{e.grund ?? "–"}</td>}
                  <td style={{ padding: "10px 14px" }}><StatusBadge bezahlt={e.bezahlt} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Alle Einträge (admin) ─────────────────────────────────────────────────────
function AlleEintraege({ members, businessYears, isMobile, isAdmin, canMarkGezahlt, onAdd }: { members: Member[]; businessYears: BusinessYear[]; isMobile: boolean; isAdmin?: boolean; canMarkGezahlt?: boolean; onAdd?: () => void }) {
  const queryClient = useQueryClient();
  const sortedYears = useMemo(() => [...businessYears].sort((a, b) => b.year - a.year), [businessYears]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [bezahlenEintragData, setBezahlenEintragData] = useState<import("../types/strafen").StrafeEintrag | null>(null);
  const [exporting, setExporting] = useState(false);

  const effectiveYearId = selectedYearId ?? sortedYears[0]?.id ?? null;
  const queryFilters = { businessYearId: effectiveYearId ?? undefined, memberId: selectedMemberId ?? undefined };

  const { data: eintraege = [], isLoading } = useQuery({
    queryKey: ["strafen-eintraege", "alle", queryFilters],
    queryFn: () => fetchEintraege(queryFilters),
    enabled: effectiveYearId !== null,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

  const totalOffen = eintraege.filter(e => !e.bezahlt).reduce((s, e) => s + (e.strafe?.betrag ?? 0), 0);

  async function handleExportPdf() {
    setExporting(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const selectedYear = sortedYears.find(y => y.id === effectiveYearId);
      const memberFilter = selectedMemberId ? members.find(m => m.id === selectedMemberId) : null;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      let y = 18;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Strafen – Übersicht", 14, y);
      y += 9;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      if (memberFilter) { doc.text(`Mitglied: ${memberFilter.firstname} ${memberFilter.lastname}`, 14, y); y += 6; }
      doc.text(`Geschäftsjahr: ${selectedYear?.year ?? "–"}`, 14, y); y += 6;
      doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`, 14, y); y += 10;

      autoTable(doc, {
        startY: y,
        head: [["#", "Mitglied", "Strafe", "Betrag", "Datum", "Grund", "Status"]],
        body: eintraege.map((e, i) => [
          i + 1,
          e.member ? `${e.member.firstname} ${e.member.lastname}` : `#${e.memberId}`,
          e.strafe?.name ?? `#${e.strafeId}`,
          `${(e.strafe?.betrag ?? 0).toFixed(2)} €`,
          fmtDate(e.createdAt),
          e.grund ?? "–",
          e.bezahlt ? "Bezahlt" : "Offen",
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 0: { cellWidth: 10 }, 3: { halign: "right" }, 6: { cellWidth: 22 } },
        theme: "striped",
      });

      const tableEndY: number = (doc as any).lastAutoTable.finalY + 8;
      const totalGesamt = eintraege.reduce((s, e) => s + (e.strafe?.betrag ?? 0), 0);
      doc.setFontSize(10);
      doc.text(`Einträge: ${eintraege.length}  |  Gesamt: ${totalGesamt.toFixed(2)} €  |  Offen: ${totalOffen.toFixed(2)} €`, 14, tableEndY);

      const filename = memberFilter
        ? `Strafen_${memberFilter.firstname}_${memberFilter.lastname}_GJ${selectedYear?.year ?? ""}.pdf`
        : `Strafen_Alle_GJ${selectedYear?.year ?? ""}.pdf`;
      await triggerDownload(filename, new Blob([doc.output("arraybuffer")], { type: "application/pdf" }));
    } finally {
      setExporting(false);
    }
  }

  async function handleToggleBezahlt(e: StrafeEintrag) {
    if (!e.bezahlt) {
      setBezahlenEintragData(e);
      return;
    }
    setTogglingId(e.id);
    try {
      await stornierenEintrag(e.id);
      queryClient.invalidateQueries({ queryKey: ["strafen-eintraege"] });
      queryClient.invalidateQueries({ queryKey: ["running-balance"] });
    } catch (err) { alert(apiErrMsg(err)); }
    finally { setTogglingId(null); }
  }

  async function handleDelete(e: StrafeEintrag) {
    const name = e.member ? `${e.member.firstname} ${e.member.lastname}` : `#${e.memberId}`;
    const hint = e.bezahlt ? " (Rückbuchung wird automatisch erstellt)" : "";
    if (!confirm(`Strafe für ${name} löschen?${hint}`)) return;
    try {
      await deleteEintrag(e.id);
      queryClient.invalidateQueries({ queryKey: ["strafen-eintraege"] });
      if (e.bezahlt) queryClient.invalidateQueries({ queryKey: ["running-balance"] });
    } catch (err) { alert(apiErrMsg(err)); }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>Alle Strafen</h3>
        <select value={effectiveYearId ?? ""} onChange={e => setSelectedYearId(Number(e.target.value))} style={{ fontSize: 14, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text)" }}>
          {sortedYears.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
        </select>
        <select value={selectedMemberId ?? ""} onChange={e => setSelectedMemberId(e.target.value ? Number(e.target.value) : null)} style={{ fontSize: 14, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text)" }}>
          <option value="">Alle Mitglieder</option>
          {members.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{m.firstname} {m.lastname}</option>)}
        </select>
        <button onClick={handleExportPdf} disabled={exporting || isLoading} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: exporting || isLoading ? "not-allowed" : "pointer", opacity: exporting || isLoading ? 0.6 : 1 }}>
          {exporting ? "Exportiere…" : "PDF"}
        </button>
        {isAdmin && onAdd && (
          <button onClick={onAdd} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Eintrag
          </button>
        )}
      </div>

      {eintraege.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <SummaryCard label="Einträge" value={eintraege.length} color="var(--c-text)" />
          <SummaryCard label="Offen" value={`${totalOffen.toFixed(2)} €`} color={totalOffen > 0 ? "#dc2626" : "#16a34a"} />
          {!isMobile && <SummaryCard label="Gesamt" value={`${eintraege.reduce((s, e) => s + (e.strafe?.betrag ?? 0), 0).toFixed(2)} €`} color="var(--c-text-2)" />}
        </div>
      )}

      {isLoading ? (
        <div style={{ color: "var(--c-text-3)", fontSize: 13 }}>Lade…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ borderRadius: 10, border: "1px solid var(--c-border)", overflow: "hidden", background: "var(--c-bg)", minWidth: isMobile ? undefined : 680 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--c-bg-2)", borderBottom: "1px solid var(--c-border)" }}>
                  <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Mitglied</th>
                  <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Strafe</th>
                  <th align="right" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Betrag</th>
                  {!isMobile && <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Datum</th>}
                  {!isMobile && <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Grund</th>}
                  <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Status</th>
                  <th style={{ padding: "10px 14px", width: 110 }} />
                </tr>
              </thead>
              <tbody>
                {eintraege.length === 0 ? (
                  <tr><td colSpan={isMobile ? 5 : 7} style={{ padding: 24, textAlign: "center", color: "var(--c-text-3)", fontSize: 14 }}>Keine Einträge.</td></tr>
                ) : eintraege.map((e, idx) => (
                  <tr key={e.id} style={{ background: idx % 2 === 0 ? "var(--c-bg)" : "var(--c-bg-2)", borderBottom: "1px solid var(--c-border)" }}>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text)" }}>{e.member ? `${e.member.firstname} ${e.member.lastname}` : `#${e.memberId}`}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>{e.strafe?.name ?? `#${e.strafeId}`}</td>
                    <td align="right" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{(e.strafe?.betrag ?? 0).toFixed(2)} €</td>
                    {!isMobile && <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text-2)" }}>{fmtDate(e.createdAt)}</td>}
                    {!isMobile && <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text-3)" }}>{e.grund ?? "–"}</td>}
                    <td style={{ padding: "10px 14px" }}><StatusBadge bezahlt={e.bezahlt} /></td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {canMarkGezahlt && (
                          <button
                            onClick={() => handleToggleBezahlt(e)}
                            disabled={togglingId === e.id}
                            style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${e.bezahlt ? "#fca5a5" : "#86efac"}`, background: "var(--c-bg)", color: e.bezahlt ? "#dc2626" : "#16a34a", fontSize: 12, cursor: togglingId === e.id ? "not-allowed" : "pointer", opacity: togglingId === e.id ? 0.5 : 1 }}
                          >
                            {e.bezahlt ? "Stornieren" : "Bezahlen"}
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleDelete(e)} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #fca5a5", background: "var(--c-bg)", color: "#dc2626", fontSize: 12, cursor: "pointer" }}>×</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {bezahlenEintragData && (
        <BezahlenModal
          eintrag={bezahlenEintragData}
          onClose={() => setBezahlenEintragData(null)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ["strafen-eintraege"] });
            queryClient.invalidateQueries({ queryKey: ["running-balance"] });
          }}
        />
      )}
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function Strafen({
  isMobile = false,
  initialSubTab,
  hideSubTabBar = false,
}: {
  isMobile?: boolean;
  initialSubTab?: SubTab;
  hideSubTabBar?: boolean;
}) {
  const canWriteStrafenCatalog = canWriteStrafen();
  const canWriteEintraege = canWriteStrafeEintraege();
  const canSeeAll = canSeeAllStrafen();
  const canMarkGezahlt = canMarkStrafeGezahlt();
  const currentUser = getCurrentUser();
  const queryClient = useQueryClient();

  const [subTab, setSubTab] = useState<SubTab>(initialSubTab ?? "katalog");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningStrafe, setAssigningStrafe] = useState<Strafe | null>(null);

  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: fetchMembers, staleTime: 30_000 });
  const { data: businessYears = [] } = useQuery({ queryKey: ["business-years"], queryFn: fetchBusinessYears, staleTime: 30_000 });
  const { data: strafen = [] } = useQuery({ queryKey: ["strafen"], queryFn: fetchStrafen, staleTime: 30_000 });

  function openAssign(strafe: Strafe) { setAssigningStrafe(strafe); setShowAssignModal(true); }
  function openAssignGeneral() { setAssigningStrafe(null); setShowAssignModal(true); }
  function closeAssign() { setShowAssignModal(false); setAssigningStrafe(null); }
  function handleCreated() {
    queryClient.invalidateQueries({ queryKey: ["strafen-eintraege"] });
    queryClient.invalidateQueries({ queryKey: ["strafen"] });
  }

  const tabs: { id: SubTab; label: string }[] = [
    { id: "katalog", label: "Strafenkatalog" },
    { id: "meine", label: "Deine Strafen" },
    ...(canSeeAll ? [{ id: "alle" as SubTab, label: "Alle Strafen" }] : []),
  ];

  return (
    <div style={{ padding: "16px 16px", overflowY: "auto", height: "var(--content-h)", boxSizing: "border-box" }}>
      {/* Subtab bar — hidden when parent nav handles tab switching */}
      {!hideSubTabBar && (
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--c-border)", marginBottom: 20 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              style={{
                padding: "8px 18px", border: "none",
                borderBottom: `2px solid ${subTab === tab.id ? "var(--c-text)" : "transparent"}`,
                background: "transparent", fontSize: 14,
                fontWeight: subTab === tab.id ? 700 : 400,
                color: subTab === tab.id ? "var(--c-text)" : "var(--c-text-2)",
                cursor: "pointer", marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {subTab === "katalog" && <KatalogTab isAdmin={canWriteStrafenCatalog} onAssign={openAssign} />}
      {subTab === "meine" && currentUser && (
        <MeineEintraege
          memberId={currentUser.sub}
          memberName={(() => { const m = members.find(x => x.id === currentUser.sub); return m ? `${m.firstname} ${m.lastname}` : currentUser.email; })()}
          businessYears={businessYears}
          isMobile={isMobile}
        />
      )}
      {subTab === "alle" && canSeeAll && (
        <AlleEintraege members={members} businessYears={businessYears} isMobile={isMobile} isAdmin={canWriteEintraege} canMarkGezahlt={canMarkGezahlt} onAdd={canWriteEintraege ? openAssignGeneral : undefined} />
      )}

      {showAssignModal && (
        <AssignModal preStrafe={assigningStrafe} members={members} businessYears={businessYears} strafen={strafen} onClose={closeAssign} onCreated={handleCreated} />
      )}
    </div>
  );
}
