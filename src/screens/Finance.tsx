import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBusinessYear,
  fetchBusinessYears,
  fetchCategories,
  fetchRunningBalance,
} from "../api/finance";
import { fetchMembers } from "../api/members";
import { fetchVeranstaltungen } from "../api/veranstaltungen";
import { canManageFinance } from "../auth/permissions";
import type { PaymentTag, RunningBalanceEntry, Transaction } from "../types/finance";
import BusinessYearForm from "./finance/BusinessYearForm";
import CategoryManager from "./finance/CategoryManager";
import ImportModal from "./finance/ImportModal";
import ReportModal from "./finance/ReportModal";
import TransactionCreate from "./TransactionCreate";
import TransactionDetail from "./TransactionDetail";

function fmtDate(d: string): string {
  if (!d) return "–";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

function TypePill({ type }: { type: Transaction["type"] }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    EINZAHLUNG:   { label: "Einzahlung",  color: "#16a34a", bg: "#f0fdf4" },
    AUSZAHLUNG:   { label: "Auszahlung",  color: "#dc2626", bg: "#fef2f2" },
    RUECKBUCHUNG: { label: "Rückbuchung", color: "#d97706", bg: "#fffbeb" },
  };
  const s = map[type] ?? { label: type, color: "#64748b", bg: "#f1f5f9" };
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 10,
      fontSize: 11, fontWeight: 600, background: s.bg, color: s.color,
      whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

function TagPill({ tag }: { tag: PaymentTag | null | undefined }) {
  if (!tag) return null;
  const map: Record<PaymentTag, { label: string; color: string; bg: string }> = {
    ONLINE: { label: "Online", color: "#1d4ed8", bg: "#eff6ff" },
    BAR:    { label: "Bar",    color: "#374151", bg: "#f1f5f9" },
  };
  const s = map[tag];
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 10,
      fontSize: 11, fontWeight: 600, background: s.bg, color: s.color,
      whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: "10px 16px", borderRadius: 8, background: "#fff",
      border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      minWidth: 140,
    }}>
      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? "#1e293b" }}>{value}</div>
    </div>
  );
}

type ActiveFilter = "date" | "desc" | "cat" | "tag" | null;

export default function Finance({ isMobile = false }: { isMobile?: boolean }) {
  const queryClient = useQueryClient();
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingYear, setCreatingYear] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [showStornos, setShowStornos] = useState(false);

  // Filter state
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterKeywords, setFilterKeywords] = useState("");
  const [filterCatIds, setFilterCatIds] = useState<number[]>([]);
  const [filterTags, setFilterTags] = useState<Array<PaymentTag | null>>([]);

  const filterRef = useRef<HTMLTableSectionElement>(null);

  const isAdmin = canManageFinance();

  const { data: rawYears = [] } = useQuery({
    queryKey: ["business-years"],
    queryFn: fetchBusinessYears,
  });
  const businessYears = useMemo(
    () => [...rawYears].sort((a, b) => b.year - a.year),
    [rawYears],
  );

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: fetchMembers,
  });

  const { data: veranstaltungen = [] } = useQuery({
    queryKey: ["veranstaltungen"],
    queryFn: fetchVeranstaltungen,
  });

  const effectiveYearId = selectedYearId ?? businessYears[0]?.id ?? null;

  const { data: entries = [] } = useQuery<RunningBalanceEntry[]>({
    queryKey: ["running-balance", effectiveYearId],
    queryFn: () => fetchRunningBalance(effectiveYearId!),
    enabled: effectiveYearId !== null,
  });

  const { data: yearDetail = null } = useQuery({
    queryKey: ["business-years", effectiveYearId],
    queryFn: () => fetchBusinessYear(effectiveYearId!),
    enabled: effectiveYearId !== null,
  });

  useEffect(() => {
    setSelected(null);
    setCreating(false);
  }, [effectiveYearId]);

  function reloadYear() {
    if (effectiveYearId === null) return;
    queryClient.invalidateQueries({ queryKey: ["running-balance", effectiveYearId] });
    queryClient.invalidateQueries({ queryKey: ["business-years", effectiveYearId] });
  }

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!activeFilter) return;
    function onDown(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setActiveFilter(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [activeFilter]);

  function toggleCat(id: number) {
    setFilterCatIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const stornoIds = new Set(
    entries
      .filter(e => e.transaction.type === "RUECKBUCHUNG" && e.transaction.relatedTransactionId != null)
      .map(e => e.transaction.relatedTransactionId!)
  );
  const baseEntries = showStornos
    ? entries
    : entries.filter(e => e.transaction.type !== "RUECKBUCHUNG" && !stornoIds.has(e.transaction.id));

  const visibleEntries = baseEntries.filter(e => {
    const t = e.transaction;
    const txDate = t.date.substring(0, 10);
    if (filterDateFrom && txDate < filterDateFrom) return false;
    if (filterDateTo && txDate > filterDateTo) return false;
    if (filterKeywords) {
      const kws = filterKeywords.toLowerCase().split(/\s+/).filter(Boolean);
      if (!kws.every(k => t.description.toLowerCase().includes(k))) return false;
    }
    if (filterCatIds.length > 0 && !filterCatIds.includes(t.categoryId)) return false;
    if (filterTags.length > 0 && !filterTags.includes(t.tag ?? null)) return false;
    return true;
  });

  const statsEntries = entries.filter(
    e => e.transaction.type !== "RUECKBUCHUNG" && !stornoIds.has(e.transaction.id)
  );
  const totalIncome   = statsEntries.filter(e => e.transaction.type === "EINZAHLUNG").reduce((s, e) => s + e.transaction.amount, 0);
  const totalExpenses = statsEntries.filter(e => e.transaction.type !== "EINZAHLUNG").reduce((s, e) => s + e.transaction.amount, 0);
  const finalBalance  = entries.length > 0 ? entries[entries.length - 1].runningBalance : (yearDetail?.carryOver ?? 0);

  const hasDateFilter = !!(filterDateFrom || filterDateTo);
  const hasDescFilter = !!filterKeywords;
  const hasCatFilter  = filterCatIds.length > 0;
  const hasTagFilter  = filterTags.length > 0;
  const hasAnyFilter  = hasDateFilter || hasDescFilter || hasCatFilter || hasTagFilter;

  const showPanel = creating || creatingYear || !!selected;

  const thBase: React.CSSProperties = {
    padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, position: "relative",
    userSelect: "none",
  };
  const thClickable: React.CSSProperties = {
    ...thBase, cursor: "pointer",
  };

  const dropdownBox: React.CSSProperties = {
    position: "absolute", top: "100%", left: 0, zIndex: 200,
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "12px 14px",
    minWidth: 240, display: "flex", flexDirection: "column", gap: 8,
  };

  const filterDot = (
    <span style={{
      display: "inline-block", width: 6, height: 6, borderRadius: "50%",
      background: "#3b82f6", marginLeft: 4, verticalAlign: "middle",
    }} />
  );

  const inputStyle: React.CSSProperties = {
    padding: "6px 8px", borderRadius: 5, border: "1px solid #d1d5db",
    fontSize: 13, width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", height: "var(--content-h)", background: "#f8fafc" }}>

      {/* ── LEFT: KASSENBUCH ── */}
      <div style={{
        flex: showPanel ? 3 : 1,
        padding: isMobile ? "14px 16px" : "20px 24px",
        overflowY: "auto", overflowX: "hidden",
        display: isMobile && showPanel ? "none" : "flex",
        flexDirection: "column", gap: 16,
      }}>

        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, color: "#1e293b" }}>Kassenbuch</h2>
            <select
              value={effectiveYearId ?? ""}
              onChange={e => setSelectedYearId(Number(e.target.value))}
              style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, background: "#fff" }}
            >
              {businessYears.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
            {isAdmin && (
              <button
                onClick={() => { setCreatingYear(true); setCreating(false); setSelected(null); }}
                style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: "pointer" }}
              >
                + Jahr
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isAdmin && (
              <button
                onClick={() => setShowCategoryManager(v => !v)}
                style={{
                  padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db",
                  background: showCategoryManager ? "#1e293b" : "#fff",
                  color: showCategoryManager ? "#fff" : "#374151",
                  fontSize: 13, cursor: "pointer",
                }}
              >
                Kategorien {showCategoryManager ? "▲" : "▼"}
              </button>
            )}
            <button
              onClick={() => setShowStornos(v => !v)}
              style={{
                padding: "5px 12px", borderRadius: 6,
                border: showStornos ? "1px solid #d97706" : "1px solid #d1d5db",
                background: showStornos ? "#fffbeb" : "#fff",
                color: showStornos ? "#d97706" : "#374151",
                fontSize: 13, fontWeight: showStornos ? 600 : 400, cursor: "pointer",
              }}
            >
              Rückbuchungen {showStornos ? "▲" : "▼"}
            </button>
            <button
              onClick={() => setShowReport(true)}
              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer" }}
            >
              Report
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowImport(true)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer" }}
                >
                  Import
                </button>
                <button
                  onClick={() => { setCreating(true); setSelected(null); setCreatingYear(false); }}
                  style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  + Neue Buchung
                </button>
              </>
            )}
          </div>
        </div>

        {/* Category manager */}
        {showCategoryManager && (
          <CategoryManager onCategoriesChanged={() => {}} />
        )}

        {/* Stats cards */}
        {yearDetail && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Übertrag"   value={`${yearDetail.carryOver.toFixed(2)} €`} />
            <StatCard label="Einnahmen"  value={`+${totalIncome.toFixed(2)} €`}  color="#16a34a" />
            <StatCard label="Ausgaben"   value={`-${totalExpenses.toFixed(2)} €`} color="#dc2626" />
            {(() => { const g = totalIncome - totalExpenses; return <StatCard label="Gewinn" value={`${g >= 0 ? "+" : ""}${g.toFixed(2)} €`} color={g >= 0 ? "#16a34a" : "#dc2626"} />; })()}
            {!isMobile && <StatCard label="Kontostand" value={`${finalBalance.toFixed(2)} €`}   color={finalBalance >= 0 ? "#1e293b" : "#dc2626"} />}
          </div>
        )}

        {/* Active filter chips */}
        {hasAnyFilter && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Filter:</span>
            {hasDateFilter && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1d4ed8" }}>
                {filterDateFrom && filterDateTo
                  ? `${fmtDate(filterDateFrom)} – ${fmtDate(filterDateTo)}`
                  : filterDateFrom ? `ab ${fmtDate(filterDateFrom)}`
                  : `bis ${fmtDate(filterDateTo)}`}
                <button onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "#1d4ed8", fontSize: 13 }}>×</button>
              </span>
            )}
            {hasDescFilter && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1d4ed8" }}>
                „{filterKeywords}"
                <button onClick={() => setFilterKeywords("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "#1d4ed8", fontSize: 13 }}>×</button>
              </span>
            )}
            {hasCatFilter && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1d4ed8" }}>
                {filterCatIds.length === 1
                  ? categories.find(c => c.id === filterCatIds[0])?.name ?? "1 Kategorie"
                  : `${filterCatIds.length} Kategorien`}
                <button onClick={() => setFilterCatIds([])} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "#1d4ed8", fontSize: 13 }}>×</button>
              </span>
            )}
            {hasTagFilter && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1d4ed8" }}>
                {filterTags.map(t => t === null ? "Kein Tag" : t === "ONLINE" ? "Online" : "Bar").join(", ")}
                <button onClick={() => setFilterTags([])} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "#1d4ed8", fontSize: 13 }}>×</button>
              </span>
            )}
            <button
              onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterKeywords(""); setFilterCatIds([]); setFilterTags([]); }}
              style={{ padding: "2px 8px", borderRadius: 12, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, cursor: "pointer" }}
            >
              Alle zurücksetzen
            </button>
          </div>
        )}

        {/* Transaction table */}
        <div style={{ overflowX: "auto" }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "visible" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead ref={filterRef}>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>

                {/* ── Datum ── */}
                <th
                  align="left"
                  style={thClickable}
                  onClick={() => setActiveFilter(activeFilter === "date" ? null : "date")}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    Datum {hasDateFilter && filterDot}
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>▼</span>
                  </span>
                  {activeFilter === "date" && (
                    <div style={dropdownBox} onClick={e => e.stopPropagation()}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "none", letterSpacing: 0 }}>Von</label>
                      <input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        style={inputStyle}
                      />
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "none", letterSpacing: 0 }}>Bis</label>
                      <input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        style={inputStyle}
                      />
                      {hasDateFilter && (
                        <button
                          onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                          style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, cursor: "pointer" }}
                        >
                          Zurücksetzen
                        </button>
                      )}
                    </div>
                  )}
                </th>

                {/* ── Beschreibung ── */}
                <th
                  align="left"
                  style={thClickable}
                  onClick={() => setActiveFilter(activeFilter === "desc" ? null : "desc")}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    Beschreibung {hasDescFilter && filterDot}
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>▼</span>
                  </span>
                  {activeFilter === "desc" && (
                    <div style={dropdownBox} onClick={e => e.stopPropagation()}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "none", letterSpacing: 0 }}>
                        Stichwörter (Leerzeichen = UND)
                      </label>
                      <input
                        type="text"
                        placeholder="z.B. Miete Strom"
                        value={filterKeywords}
                        onChange={e => setFilterKeywords(e.target.value)}
                        style={inputStyle}
                        autoFocus
                      />
                      {hasDescFilter && (
                        <button
                          onClick={() => setFilterKeywords("")}
                          style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, cursor: "pointer" }}
                        >
                          Zurücksetzen
                        </button>
                      )}
                    </div>
                  )}
                </th>

                {/* ── Kategorie ── */}
                {!isMobile && <th
                  align="left"
                  style={thClickable}
                  onClick={() => setActiveFilter(activeFilter === "cat" ? null : "cat")}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    Kategorie
                    {hasCatFilter && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 16, height: 16, borderRadius: "50%", background: "#3b82f6",
                        color: "#fff", fontSize: 9, fontWeight: 700, marginLeft: 2,
                      }}>
                        {filterCatIds.length}
                      </span>
                    )}
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>▼</span>
                  </span>
                  {activeFilter === "cat" && (
                    <div style={{ ...dropdownBox, maxHeight: 240, overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                      {categories.length === 0 && (
                        <span style={{ fontSize: 13, color: "#94a3b8" }}>Keine Kategorien</span>
                      )}
                      {categories.map(c => (
                        <label
                          key={c.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "4px 2px", cursor: "pointer",
                            fontSize: 13, fontWeight: 400, color: "#1e293b",
                            textTransform: "none", letterSpacing: 0,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={filterCatIds.includes(c.id)}
                            onChange={() => toggleCat(c.id)}
                            style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#3b82f6" }}
                          />
                          {c.name}
                        </label>
                      ))}
                      {hasCatFilter && (
                        <button
                          onClick={() => setFilterCatIds([])}
                          style={{ marginTop: 4, padding: "5px 8px", borderRadius: 5, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, cursor: "pointer" }}
                        >
                          Auswahl aufheben
                        </button>
                      )}
                    </div>
                  )}
                </th>}

                {/* ── Tag ── */}
                {!isMobile && <th
                  align="left"
                  style={thClickable}
                  onClick={() => setActiveFilter(activeFilter === "tag" ? null : "tag")}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    Zahlung
                    {hasTagFilter && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 16, height: 16, borderRadius: "50%", background: "#3b82f6",
                        color: "#fff", fontSize: 9, fontWeight: 700, marginLeft: 2,
                      }}>
                        {filterTags.length}
                      </span>
                    )}
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>▼</span>
                  </span>
                  {activeFilter === "tag" && (
                    <div style={{ ...dropdownBox, minWidth: 160 }} onClick={e => e.stopPropagation()}>
                      {([["ONLINE", "Online"], ["BAR", "Bar"], [null, "Kein Tag"]] as const).map(([val, label]) => (
                        <label
                          key={val ?? "none"}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "4px 2px", cursor: "pointer",
                            fontSize: 13, fontWeight: 400, color: "#1e293b",
                            textTransform: "none", letterSpacing: 0,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={filterTags.includes(val)}
                            onChange={() =>
                              setFilterTags(prev =>
                                prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]
                              )
                            }
                            style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#3b82f6" }}
                          />
                          {label}
                        </label>
                      ))}
                      {hasTagFilter && (
                        <button
                          onClick={() => setFilterTags([])}
                          style={{ marginTop: 4, padding: "5px 8px", borderRadius: 5, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, cursor: "pointer" }}
                        >
                          Auswahl aufheben
                        </button>
                      )}
                    </div>
                  )}
                </th>}

                {/* Typ, Betrag, Kontostand — not filterable */}
                {!isMobile && <th align="left" style={thBase}>Typ</th>}
                <th align="right" style={thBase}>Betrag</th>
                {!isMobile && <th align="right" style={thBase}>Kontostand</th>}
              </tr>
            </thead>
            <tbody>
              {visibleEntries.length === 0 && (
                <tr>
                  <td colSpan={isMobile ? 3 : 7} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                    {baseEntries.length === 0 ? "Keine Buchungen für dieses Jahr" : "Keine Ergebnisse für die aktuellen Filter"}
                  </td>
                </tr>
              )}
              {visibleEntries.map(({ transaction: t, runningBalance }, idx) => {
                const isSelected  = selected?.id === t.id;
                const isHovered   = hoveredId === t.id;
                const isRueck     = t.type === "RUECKBUCHUNG";
                const isStorniert = stornoIds.has(t.id);
                const amtColor    = t.type === "EINZAHLUNG" ? "#16a34a" : t.type === "AUSZAHLUNG" ? "#dc2626" : "#d97706";

                let rowBg = idx % 2 === 0 ? "#fff" : "#f8fafc";
                if (isRueck || isStorniert) rowBg = idx % 2 === 0 ? "#fffbeb" : "#fef9ec";
                if (isHovered) rowBg = "#f1f5f9";
                if (isSelected) rowBg = "#eff6ff";

                return (
                  <tr
                    key={t.id}
                    onClick={() => { setSelected(t); setCreating(false); setCreatingYear(false); }}
                    onMouseEnter={() => setHoveredId(t.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      cursor: "pointer",
                      background: rowBg,
                      borderBottom: "1px solid #f1f5f9",
                      borderLeft: isSelected ? "3px solid #3b82f6" : (isRueck || isStorniert) ? "3px solid #d97706" : "3px solid transparent",
                      opacity: isStorniert ? 0.6 : 1,
                      transition: "background 0.1s",
                    }}
                  >
                    <td style={{ padding: "9px 14px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(t.date)}</td>
                    <td style={{ padding: "9px 14px", fontSize: 13, color: "#1e293b" }}>{t.description}</td>
                    {!isMobile && <td style={{ padding: "9px 14px", fontSize: 13, color: "#64748b" }}>{t.category.name}</td>}
                    {!isMobile && <td style={{ padding: "9px 14px" }}><TagPill tag={t.tag} /></td>}
                    {!isMobile && <td style={{ padding: "9px 14px" }}><TypePill type={t.type} /></td>}
                    <td align="right" style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, color: amtColor, whiteSpace: "nowrap" }}>
                      {t.type === "EINZAHLUNG" ? "+" : "-"}{t.amount.toFixed(2)} €
                    </td>
                    {!isMobile && <td align="right" style={{ padding: "9px 14px", fontSize: 13, color: "#1e293b", whiteSpace: "nowrap" }}>
                      {runningBalance.toFixed(2)} €
                    </td>}
                  </tr>
                );
              })}
            </tbody>
            {visibleEntries.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                  {isMobile ? (
                    <>
                      <td colSpan={2} style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#374151" }}>Gesamt</td>
                      <td align="right" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: finalBalance >= 0 ? "#1e293b" : "#dc2626", whiteSpace: "nowrap" }}>
                        {finalBalance.toFixed(2)} €
                      </td>
                    </>
                  ) : (
                    <>
                      <td colSpan={5} style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#374151" }}>Gesamt</td>
                      <td align="right" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                        <span style={{ color: "#16a34a" }}>+{totalIncome.toFixed(2)} €</span>
                        {" / "}
                        <span style={{ color: "#dc2626" }}>-{totalExpenses.toFixed(2)} €</span>
                      </td>
                      <td align="right" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: finalBalance >= 0 ? "#1e293b" : "#dc2626" }}>
                        {finalBalance.toFixed(2)} €
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </div>
      </div>

      {showReport && (
        <ReportModal
          businessYears={businessYears}
          categories={categories}
          onClose={() => setShowReport(false)}
        />
      )}

      {showImport && (
        <ImportModal
          businessYears={businessYears}
          categories={categories}
          onImported={reloadYear}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* ── RIGHT: DETAIL / CREATE PANEL ── */}
      {showPanel && (
        <div style={{
          flex: isMobile ? 1 : 2,
          padding: isMobile ? "0" : "20px 24px",
          borderLeft: isMobile ? "none" : "1px solid #e2e8f0",
          overflowY: "auto", background: "#fff",
        }}>
          {isMobile && (
            <button
              onClick={() => { setSelected(null); setCreating(false); setCreatingYear(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                width: "100%", padding: "12px 16px",
                border: "none", borderBottom: "1px solid #e2e8f0",
                background: "#fff", cursor: "pointer",
                color: "#2563eb", fontSize: 14, fontWeight: 600,
              }}
            >
              ← Zurück
            </button>
          )}
          <div style={{ padding: isMobile ? "16px" : "0" }}>
          {creatingYear ? (
            <BusinessYearForm
              onCreated={by => {
                queryClient.invalidateQueries({ queryKey: ["business-years"] });
                setSelectedYearId(by.id);
                setCreatingYear(false);
              }}
              onCancel={() => setCreatingYear(false)}
            />
          ) : creating ? (
            <TransactionCreate
              businessYears={businessYears}
              defaultBusinessYearId={effectiveYearId}
              categories={categories}
              members={members}
              veranstaltungen={veranstaltungen}
              onCreated={t => {
                reloadYear();
                setSelected(t);
                setCreating(false);
              }}
              onCancel={() => setCreating(false)}
            />
          ) : selected ? (
            <TransactionDetail
              transaction={selected}
              categories={categories}
              veranstaltungen={veranstaltungen}
              onUpdated={updated => {
                reloadYear();
                setSelected(updated);
              }}
              onDeleted={() => {
                reloadYear();
                setSelected(null);
              }}
            />
          ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
