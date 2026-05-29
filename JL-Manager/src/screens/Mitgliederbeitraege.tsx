import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBusinessYears,
  fetchMitgliedsbeitraege,
  fetchCategories,
  createTransaction,
  updateMitgliedsbeitrag,
} from "../api/finance";
import { canPayBeitraege } from "../auth/permissions";
import type { BusinessYear, Category, Mitgliedsbeitrag } from "../types/finance";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  BEZAHLT:    { label: "Bezahlt",     color: "#16a34a", bg: "#f0fdf4" },
  TEILWEISE:  { label: "Teilweise",   color: "#d97706", bg: "#fffbeb" },
  AUSSTEHEND: { label: "Ausstehend",  color: "#dc2626", bg: "#fef2f2" },
};

function todayStr(): string {
  return new Date().toISOString().substring(0, 10);
}

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
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: "var(--c-text-2)", bg: "var(--c-bg-3)" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 12,
      fontSize: 12, fontWeight: 600, background: s.bg, color: s.color,
      border: `1px solid ${s.color}33`,
    }}>
      {s.label}
    </span>
  );
}

function SummaryCard({
  label, value, sub, color,
}: {
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div style={{
      padding: "12px 20px", borderRadius: 10, background: "var(--c-bg)",
      border: "1px solid var(--c-border)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      minWidth: 120,
    }}>
      <div style={{ fontSize: 11, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function BezahlenBeitragModal({
  beitrag,
  mitgliedsbeitragKat,
  onClose,
  onDone,
}: {
  beitrag: Mitgliedsbeitrag;
  mitgliedsbeitragKat: Category;
  onClose: () => void;
  onDone: () => void;
}) {
  const openAmount =
    Math.max(0, beitrag.betragJL - beitrag.bezahltJL) +
    Math.max(0, beitrag.betragKG - beitrag.bezahltKG);
  const [datum, setDatum] = useState(todayStr());
  const [tag, setTag] = useState<"ONLINE" | "BAR">("BAR");
  const [amount, setAmount] = useState(openAmount.toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const memberName = beitrag.member
    ? `${beitrag.member.firstname} ${beitrag.member.lastname}`
    : `Mitglied #${beitrag.memberId}`;
  const yearLabel = beitrag.businessYear?.year ?? "";

  async function handleSubmit() {
    const amt = parseFloat(amount);
    if (!datum) { setError("Datum erforderlich."); return; }
    if (isNaN(amt) || amt <= 0) { setError("Gültigen Betrag eingeben."); return; }
    setSaving(true);
    setError("");
    try {
      await createTransaction({
        date: datum,
        description: `Mitgliedsbeitrag ${yearLabel}`,
        type: "EINZAHLUNG",
        amount: amt,
        categoryId: mitgliedsbeitragKat.id,
        businessYearId: beitrag.businessYearId,
        memberId: beitrag.memberId,
        tag,
      });
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
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 12,
        padding: 24, width: 380, maxWidth: "calc(100vw - 32px)", zIndex: 1000,
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>Beitrag bezahlen</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-3)", fontSize: 22 }}>×</button>
        </div>
        <div style={{ marginBottom: 18, padding: "10px 14px", borderRadius: 8, background: "var(--c-bg-2)", border: "1px solid var(--c-border)", fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: "var(--c-text)" }}>{memberName}</div>
          <div style={{ color: "var(--c-text-2)", marginTop: 2 }}>
            GJ {yearLabel} — Offen: <span style={{ color: "#dc2626", fontWeight: 600 }}>{openAmount.toFixed(2)} €</span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: "var(--c-text-3)" }}>
            <span>JL: {beitrag.betragJL.toFixed(2)} € ({beitrag.bezahltJL.toFixed(2)} € bzhl.)</span>
            {beitrag.betragKG > 0 && <span>KG: {beitrag.betragKG.toFixed(2)} € ({beitrag.bezahltKG.toFixed(2)} € bzhl.)</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Betrag (€)</div>
            <input
              type="number" min={0.01} step={0.01}
              value={amount} onChange={e => setAmount(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
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
            <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer" }}>
              Abbrechen
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !datum}
              style={{
                padding: "7px 16px", borderRadius: 6, border: "none",
                background: saving || !datum ? "#94a3b8" : "#16a34a",
                color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: saving || !datum ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Speichere…" : "Als bezahlt buchen"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Mitgliederbeitraege({ isMobile = false }: { isMobile?: boolean }) {
  const isAdmin = canPayBeitraege();
  const queryClient = useQueryClient();
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [bezahlenBeitrag, setBezahlenBeitrag] = useState<Mitgliedsbeitrag | null>(null);
  const [stornierenId, setStornierenId] = useState<number | null>(null);

  const { data: rawYears = [], isError: yearsError } = useQuery({
    queryKey: ["business-years"],
    queryFn: fetchBusinessYears,
  });
  const businessYears: BusinessYear[] = useMemo(
    () => [...rawYears].sort((a, b) => b.year - a.year),
    [rawYears],
  );

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    enabled: isAdmin,
    staleTime: 60_000,
  });
  const mitgliedsbeitragKat = categories.find(c => c.isMitgliedsbeitrag);

  const effectiveYearId = selectedYearId ?? businessYears[0]?.id ?? null;

  const { data: beitraege = [], isFetching, isError: beitraegeError } = useQuery({
    queryKey: ["mitgliedsbeitraege", { businessYearId: effectiveYearId }],
    queryFn: () => fetchMitgliedsbeitraege({ businessYearId: effectiveYearId! }),
    enabled: effectiveYearId !== null,
  });

  const error = yearsError ? "Fehler beim Laden der Geschäftsjahre"
    : beitraegeError ? "Fehler beim Laden der Beiträge"
    : "";

  const bezahlt   = beitraege.filter(b => b.status === "BEZAHLT").length;
  const teilweise = beitraege.filter(b => b.status === "TEILWEISE").length;
  const ausstehend = beitraege.filter(b => b.status === "AUSSTEHEND").length;
  const totalOffen = beitraege.reduce(
    (s, b) => s + Math.max(0, b.betragJL - b.bezahltJL) + Math.max(0, b.betragKG - b.bezahltKG), 0,
  );

  const visible: Mitgliedsbeitrag[] = statusFilter === "ALL"
    ? beitraege
    : beitraege.filter(b => b.status === statusFilter);

  async function handleStornieren(b: Mitgliedsbeitrag) {
    const name = b.member ? `${b.member.firstname} ${b.member.lastname}` : `Mitglied #${b.memberId}`;
    if (!confirm(`Beitragszahlung von ${name} zurücksetzen? Die bezahlten Beträge werden auf 0 gesetzt.`)) return;
    setStornierenId(b.id);
    try {
      await updateMitgliedsbeitrag(b.id, { bezahltJL: 0, bezahltKG: 0 });
      queryClient.invalidateQueries({ queryKey: ["mitgliedsbeitraege"] });
      queryClient.invalidateQueries({ queryKey: ["running-balance"] });
    } catch (err) {
      alert(apiErrMsg(err));
    } finally {
      setStornierenId(null);
    }
  }

  const colCount = isMobile
    ? (isAdmin ? 4 : 3)
    : (isAdmin ? 8 : 7);

  return (
    <div style={{ padding: "16px 16px", overflowY: "auto", height: "var(--content-h)", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "var(--c-text)" }}>Mitgliederbeiträge</h2>
        <select
          value={effectiveYearId ?? ""}
          onChange={e => setSelectedYearId(Number(e.target.value))}
          style={{
            fontSize: 14, padding: "4px 8px", borderRadius: 6,
            border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text)",
          }}
        >
          {businessYears.map(y => (
            <option key={y.id} value={y.id}>{y.year}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {!isMobile && <SummaryCard label="Bezahlt"    value={bezahlt}    color="#16a34a" />}
        {!isMobile && <SummaryCard label="Teilweise"  value={teilweise}  color="#d97706" />}
        <SummaryCard label="Ausstehend" value={ausstehend} color="#dc2626" />
        <SummaryCard label="Gesamt offen" value={`${totalOffen.toFixed(2)} €`} color="var(--c-text-2)" />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["ALL", "AUSSTEHEND", "TEILWEISE", "BEZAHLT"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "4px 14px", borderRadius: 20, border: "1px solid var(--c-border)",
              fontSize: 13, cursor: "pointer",
              background: statusFilter === s ? "var(--c-text)" : "var(--c-bg)",
              color: statusFilter === s ? "var(--c-bg)" : "var(--c-text-2)",
              fontWeight: statusFilter === s ? 600 : 400,
            }}
          >
            {s === "ALL" ? "Alle" : STATUS_MAP[s]?.label ?? s}
          </button>
        ))}
      </div>

      {isFetching && beitraege.length === 0 ? (
        <p style={{ color: "var(--c-text-3)" }}>Lade…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ background: "var(--c-bg)", borderRadius: 10, border: "1px solid var(--c-border)", overflow: "hidden", minWidth: isMobile ? undefined : 600 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr style={{ background: "var(--c-bg-2)", borderBottom: "1px solid var(--c-border)" }}>
                  <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Mitglied</th>
                  {!isMobile && <th align="right" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Beitrag JL</th>}
                  {!isMobile && <th align="right" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Beitrag KG</th>}
                  {!isMobile && <th align="right" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Bezahlt JL</th>}
                  {!isMobile && <th align="right" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Bezahlt KG</th>}
                  <th align="right" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Offen</th>
                  <th align="left" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Status</th>
                  {isAdmin && <th style={{ padding: "10px 14px", width: isMobile ? 90 : 120 }} />}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={colCount} style={{ padding: 24, textAlign: "center", color: "var(--c-text-3)", fontSize: 14 }}>
                      Keine Einträge
                    </td>
                  </tr>
                )}
                {visible.map((b, idx) => {
                  const offen = Math.max(0, b.betragJL - b.bezahltJL) + Math.max(0, b.betragKG - b.bezahltKG);
                  const isStornieren = stornierenId === b.id;
                  return (
                    <tr
                      key={b.id}
                      style={{ background: idx % 2 === 0 ? "var(--c-bg)" : "var(--c-bg-2)", borderBottom: "1px solid var(--c-border)" }}
                    >
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text)" }}>
                        {b.member
                          ? `${b.member.firstname} ${b.member.lastname}${!b.member.active ? " (inaktiv)" : ""}`
                          : `Mitglied #${b.memberId}`}
                      </td>
                      {!isMobile && <td align="right" style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text)" }}>{b.betragJL.toFixed(2)} €</td>}
                      {!isMobile && <td align="right" style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text)" }}>{b.betragKG.toFixed(2)} €</td>}
                      {!isMobile && <td align="right" style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text)" }}>{b.bezahltJL.toFixed(2)} €</td>}
                      {!isMobile && <td align="right" style={{ padding: "10px 14px", fontSize: 13, color: "var(--c-text)" }}>{b.bezahltKG.toFixed(2)} €</td>}
                      <td align="right" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: offen > 0 ? "#dc2626" : "#16a34a" }}>
                        {offen.toFixed(2)} €
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <StatusPill status={b.status} />
                      </td>
                      {isAdmin && (
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            {b.status !== "BEZAHLT" && (
                              <button
                                onClick={() => setBezahlenBeitrag(b)}
                                disabled={!mitgliedsbeitragKat}
                                title={mitgliedsbeitragKat ? "Zahlung buchen" : "Mitgliedsbeitrag-Kategorie nicht gefunden"}
                                style={{
                                  padding: isMobile ? "3px 6px" : "3px 8px",
                                  borderRadius: 5, border: "1px solid #86efac",
                                  background: "var(--c-bg)", color: "#16a34a",
                                  fontSize: isMobile ? 11 : 12, cursor: mitgliedsbeitragKat ? "pointer" : "not-allowed",
                                  opacity: mitgliedsbeitragKat ? 1 : 0.4,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Bezahlen
                              </button>
                            )}
                            {b.status !== "AUSSTEHEND" && (
                              <button
                                onClick={() => handleStornieren(b)}
                                disabled={isStornieren}
                                style={{
                                  padding: isMobile ? "3px 6px" : "3px 8px",
                                  borderRadius: 5, border: "1px solid #fca5a5",
                                  background: "var(--c-bg)", color: "#dc2626",
                                  fontSize: isMobile ? 11 : 12, cursor: isStornieren ? "not-allowed" : "pointer",
                                  opacity: isStornieren ? 0.5 : 1,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {isStornieren ? "…" : "Stornieren"}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bezahlenBeitrag && mitgliedsbeitragKat && (
        <BezahlenBeitragModal
          beitrag={bezahlenBeitrag}
          mitgliedsbeitragKat={mitgliedsbeitragKat}
          onClose={() => setBezahlenBeitrag(null)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ["mitgliedsbeitraege"] });
            queryClient.invalidateQueries({ queryKey: ["running-balance"] });
          }}
        />
      )}
    </div>
  );
}
