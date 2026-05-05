import { useEffect, useState } from "react";
import {
  fetchBusinessYear,
  fetchBusinessYears,
  fetchCategories,
  fetchRunningBalance,
} from "../api/finance";
import { canManageFinance } from "../auth/permissions";
import type {
  BusinessYear,
  Category,
  RunningBalanceEntry,
  Transaction,
} from "../types/finance";
import BusinessYearForm from "./finance/BusinessYearForm";
import CategoryManager from "./finance/CategoryManager";
import TransactionCreate from "./TransactionCreate";
import TransactionDetail from "./TransactionDetail";

export default function Finance() {
  const [businessYears, setBusinessYears] = useState<BusinessYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [yearDetail, setYearDetail] = useState<BusinessYear | null>(null);
  const [entries, setEntries] = useState<RunningBalanceEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingYear, setCreatingYear] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchBusinessYears(), fetchCategories()])
      .then(([years, cats]) => {
        const sorted = [...years].sort((a, b) => b.year - a.year);
        setBusinessYears(sorted);
        setCategories(cats);
        if (sorted.length > 0) setSelectedYearId(sorted[0].id);
      })
      .catch(() => setError("Fehler beim Laden der Stammdaten"));
  }, []);

  useEffect(() => {
    if (selectedYearId === null) return;
    setSelected(null);
    setCreating(false);
    Promise.all([
      fetchRunningBalance(selectedYearId),
      fetchBusinessYear(selectedYearId),
    ])
      .then(([ents, detail]) => {
        setEntries(ents);
        setYearDetail(detail);
      })
      .catch(() => setError("Fehler beim Laden der Buchungen"));
  }, [selectedYearId]);

  function reloadYear() {
    if (selectedYearId === null) return;
    Promise.all([
      fetchRunningBalance(selectedYearId),
      fetchBusinessYear(selectedYearId),
    ]).then(([ents, detail]) => {
      setEntries(ents);
      setYearDetail(detail);
    });
  }

  function typeLabel(type: Transaction["type"]) {
    if (type === "EINZAHLUNG") return "Einzahlung";
    if (type === "AUSZAHLUNG") return "Auszahlung";
    return "Rückbuchung";
  }

  function typeColor(type: Transaction["type"]) {
    if (type === "EINZAHLUNG") return "green";
    if (type === "AUSZAHLUNG") return "red";
    return "gray";
  }

  function formatAmount(t: Transaction) {
    const sign = t.type === "EINZAHLUNG" ? "+" : "-";
    return `${sign}${t.amount.toFixed(2)} €`;
  }

  const totalIncome = entries
    .filter((e) => e.transaction.type === "EINZAHLUNG")
    .reduce((sum, e) => sum + e.transaction.amount, 0);

  const totalExpenses = entries
    .filter((e) => e.transaction.type !== "EINZAHLUNG")
    .reduce((sum, e) => sum + e.transaction.amount, 0);

  const finalBalance =
    entries.length > 0 ? entries[entries.length - 1].runningBalance : 0;

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* LEFT: KASSENBUCH */}
      <div style={{ flex: 2, padding: 16, overflow: "auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0 }}>Kassenbuch</h2>
            <select
              value={selectedYearId ?? ""}
              onChange={(e) => setSelectedYearId(Number(e.target.value))}
            >
              {businessYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.year}
                </option>
              ))}
            </select>
            {canManageFinance() && (
              <button
                onClick={() => {
                  setCreatingYear(true);
                  setCreating(false);
                  setSelected(null);
                }}
                style={{ fontSize: 12, padding: "2px 8px" }}
              >
                + Jahr
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canManageFinance() && (
              <button
                onClick={() => setShowCategoryManager((v) => !v)}
                style={{ fontWeight: "normal", opacity: 0.75 }}
              >
                Kategorien verwalten {showCategoryManager ? "▲" : "▼"}
              </button>
            )}
            <button
              onClick={() => {
                setCreating(true);
                setSelected(null);
              }}
            >
              + Neue Buchung
            </button>
          </div>
        </header>

        {showCategoryManager && (
          <CategoryManager
            onCategoriesChanged={setCategories}
          />
        )}

        {yearDetail && (
          <div style={{ display: "flex", gap: 12, margin: "12px 0" }}>
            <span
              style={{
                padding: "4px 10px",
                background: "#f0f0f0",
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              Übertrag: {yearDetail.carryOver.toFixed(2)} €
            </span>
            <span
              style={{
                padding: "4px 10px",
                background: "#f0f0f0",
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              Einnahmen: {(yearDetail.totalIncome ?? 0).toFixed(2)} €
            </span>
            <span
              style={{
                padding: "4px 10px",
                background: "#f0f0f0",
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              Kontostand: {(yearDetail.balance ?? 0).toFixed(2)} €
            </span>
          </div>
        )}

        {error && <p style={{ color: "red" }}>{error}</p>}

        <table width="100%" cellPadding={8}>
          <thead>
            <tr>
              <th align="left">Datum</th>
              <th align="left">Beschreibung</th>
              <th align="left">Kategorie</th>
              <th align="left">Typ</th>
              <th align="right">Betrag</th>
              <th align="right">Kontostand</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(({ transaction: t, runningBalance }) => (
              <tr
                key={t.id}
                onClick={() => {
                  setSelected(t);
                  setCreating(false);
                }}
                style={{
                  cursor: "pointer",
                  background: selected?.id === t.id ? "#eef" : "transparent",
                }}
              >
                <td>{t.date}</td>
                <td>{t.description}</td>
                <td>{t.category.name}</td>
                <td>
                  <span style={{ color: typeColor(t.type) }}>
                    {typeLabel(t.type)}
                  </span>
                </td>
                <td align="right" style={{ color: typeColor(t.type) }}>
                  {formatAmount(t)}
                </td>
                <td align="right">{runningBalance.toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr
              style={{
                fontWeight: "bold",
                borderTop: "2px solid #ccc",
              }}
            >
              <td colSpan={4}>Gesamt</td>
              <td align="right">
                <span style={{ color: "green" }}>
                  +{totalIncome.toFixed(2)} €
                </span>
                {" / "}
                <span style={{ color: "red" }}>
                  -{totalExpenses.toFixed(2)} €
                </span>
              </td>
              <td align="right">{finalBalance.toFixed(2)} €</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* RIGHT: DETAIL / CREATE */}
      <div
        style={{
          flex: 1,
          padding: 16,
          borderLeft: "1px solid #ccc",
        }}
      >
        {creatingYear ? (
          <BusinessYearForm
            onCreated={(by) => {
              const updated = [...businessYears, by].sort((a, b) => b.year - a.year);
              setBusinessYears(updated);
              setSelectedYearId(by.id);
              setCreatingYear(false);
            }}
            onCancel={() => setCreatingYear(false)}
          />
        ) : creating ? (
          <TransactionCreate
            businessYearId={selectedYearId!}
            categories={categories}
            onCreated={(t) => {
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
            onUpdated={(updated) => {
              setEntries((es) =>
                es.map((e) =>
                  e.transaction.id === updated.id
                    ? { ...e, transaction: updated }
                    : e
                )
              );
              setSelected(updated);
            }}
            onDeleted={() => {
              reloadYear();
              setSelected(null);
            }}
          />
        ) : (
          <p>Buchung auswählen oder neue Buchung erstellen…</p>
        )}
      </div>
    </div>
  );
}
