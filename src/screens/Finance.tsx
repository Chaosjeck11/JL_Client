import { useEffect, useState } from "react";
import {
  fetchBusinessYear,
  fetchBusinessYears,
  fetchCategories,
  fetchRunningBalance,
} from "../api/finance";
import { fetchMembers } from "../api/members";
import { canManageFinance } from "../auth/permissions";
import type { BusinessYear, Category, RunningBalanceEntry, Transaction } from "../types/finance";
import type { Member } from "../types/member";
import BusinessYearForm from "./finance/BusinessYearForm";
import CategoryManager from "./finance/CategoryManager";
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

export default function Finance() {
  const [businessYears, setBusinessYears] = useState<BusinessYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [yearDetail, setYearDetail] = useState<BusinessYear | null>(null);
  const [entries, setEntries] = useState<RunningBalanceEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingYear, setCreatingYear] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [error, setError] = useState("");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const isAdmin = canManageFinance();

  useEffect(() => {
    Promise.all([fetchBusinessYears(), fetchCategories(), fetchMembers()])
      .then(([years, cats, mems]) => {
        const sorted = [...years].sort((a, b) => b.year - a.year);
        setBusinessYears(sorted);
        setCategories(cats);
        setMembers(mems);
        if (sorted.length > 0) setSelectedYearId(sorted[0].id);
      })
      .catch(() => setError("Fehler beim Laden der Stammdaten"));
  }, []);

  useEffect(() => {
    if (selectedYearId === null) return;
    setSelected(null);
    setCreating(false);
    Promise.all([fetchRunningBalance(selectedYearId), fetchBusinessYear(selectedYearId)])
      .then(([ents, detail]) => { setEntries(ents); setYearDetail(detail); })
      .catch(() => setError("Fehler beim Laden der Buchungen"));
  }, [selectedYearId]);

  function reloadYear() {
    if (selectedYearId === null) return;
    Promise.all([fetchRunningBalance(selectedYearId), fetchBusinessYear(selectedYearId)])
      .then(([ents, detail]) => { setEntries(ents); setYearDetail(detail); });
  }

  const stornoIds = new Set(
    entries
      .filter(e => e.transaction.type === "RUECKBUCHUNG" && e.transaction.relatedTransactionId != null)
      .map(e => e.transaction.relatedTransactionId!)
  );
  const visibleEntries = entries.filter(
    e => e.transaction.type !== "RUECKBUCHUNG" && !stornoIds.has(e.transaction.id)
  );

  const totalIncome   = visibleEntries.filter(e => e.transaction.type === "EINZAHLUNG").reduce((s, e) => s + e.transaction.amount, 0);
  const totalExpenses = visibleEntries.filter(e => e.transaction.type !== "EINZAHLUNG").reduce((s, e) => s + e.transaction.amount, 0);
  const finalBalance  = entries.length > 0 ? entries[entries.length - 1].runningBalance : (yearDetail?.carryOver ?? 0);

  const showPanel = creating || creatingYear || !!selected;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 44px)", background: "#f8fafc" }}>

      {/* ── LEFT: KASSENBUCH ── */}
      <div style={{ flex: showPanel ? 3 : 1, padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, color: "#1e293b" }}>Kassenbuch</h2>
            <select
              value={selectedYearId ?? ""}
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
            {isAdmin && (
              <button
                onClick={() => { setCreating(true); setSelected(null); setCreatingYear(false); }}
                style={{
                  padding: "5px 14px", borderRadius: 6, border: "none",
                  background: "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                + Neue Buchung
              </button>
            )}
          </div>
        </div>

        {/* Category manager */}
        {showCategoryManager && (
          <CategoryManager onCategoriesChanged={setCategories} />
        )}

        {error && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Stats cards */}
        {yearDetail && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Übertrag"   value={`${yearDetail.carryOver.toFixed(2)} €`} />
            <StatCard label="Einnahmen"  value={`+${totalIncome.toFixed(2)} €`}  color="#16a34a" />
            <StatCard label="Ausgaben"   value={`-${totalExpenses.toFixed(2)} €`} color="#dc2626" />
            <StatCard label="Kontostand" value={`${finalBalance.toFixed(2)} €`}   color={finalBalance >= 0 ? "#1e293b" : "#dc2626"} />
          </div>
        )}

        {/* Transaction table */}
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["Datum", "Beschreibung", "Kategorie", "Typ", "Betrag", "Kontostand"].map((h, i) => (
                  <th
                    key={h}
                    align={i >= 4 ? "right" : "left"}
                    style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleEntries.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                    Keine Buchungen für dieses Jahr
                  </td>
                </tr>
              )}
              {visibleEntries.map(({ transaction: t, runningBalance }, idx) => {
                const isSelected = selected?.id === t.id;
                const isHovered  = hoveredId === t.id;
                const amtColor   = t.type === "EINZAHLUNG" ? "#16a34a" : t.type === "AUSZAHLUNG" ? "#dc2626" : "#d97706";
                return (
                  <tr
                    key={t.id}
                    onClick={() => { setSelected(t); setCreating(false); setCreatingYear(false); }}
                    onMouseEnter={() => setHoveredId(t.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "#eff6ff" : isHovered ? "#f1f5f9" : idx % 2 === 0 ? "#fff" : "#f8fafc",
                      borderBottom: "1px solid #f1f5f9",
                      borderLeft: isSelected ? "3px solid #3b82f6" : "3px solid transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    <td style={{ padding: "9px 14px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(t.date)}</td>
                    <td style={{ padding: "9px 14px", fontSize: 13, color: "#1e293b" }}>{t.description}</td>
                    <td style={{ padding: "9px 14px", fontSize: 13, color: "#64748b" }}>{t.category.name}</td>
                    <td style={{ padding: "9px 14px" }}><TypePill type={t.type} /></td>
                    <td align="right" style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, color: amtColor, whiteSpace: "nowrap" }}>
                      {t.type === "EINZAHLUNG" ? "+" : "-"}{t.amount.toFixed(2)} €
                    </td>
                    <td align="right" style={{ padding: "9px 14px", fontSize: 13, color: "#1e293b", whiteSpace: "nowrap" }}>
                      {runningBalance.toFixed(2)} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {visibleEntries.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                  <td colSpan={4} style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#374151" }}>Gesamt</td>
                  <td align="right" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                    <span style={{ color: "#16a34a" }}>+{totalIncome.toFixed(2)} €</span>
                    {" / "}
                    <span style={{ color: "#dc2626" }}>-{totalExpenses.toFixed(2)} €</span>
                  </td>
                  <td align="right" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: finalBalance >= 0 ? "#1e293b" : "#dc2626" }}>
                    {finalBalance.toFixed(2)} €
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── RIGHT: DETAIL / CREATE PANEL ── */}
      {showPanel && (
        <div style={{
          flex: 2, padding: "20px 24px", borderLeft: "1px solid #e2e8f0",
          overflowY: "auto", background: "#fff",
        }}>
          {creatingYear ? (
            <BusinessYearForm
              onCreated={by => {
                const updated = [...businessYears, by].sort((a, b) => b.year - a.year);
                setBusinessYears(updated);
                setSelectedYearId(by.id);
                setCreatingYear(false);
              }}
              onCancel={() => setCreatingYear(false)}
            />
          ) : creating ? (
            <TransactionCreate
              businessYears={businessYears}
              defaultBusinessYearId={selectedYearId}
              categories={categories}
              members={members}
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
              onUpdated={updated => {
                setEntries(es => es.map(e => e.transaction.id === updated.id ? { ...e, transaction: updated } : e));
                setSelected(updated);
              }}
              onDeleted={() => {
                reloadYear();
                setSelected(null);
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
