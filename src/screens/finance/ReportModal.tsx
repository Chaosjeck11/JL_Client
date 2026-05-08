import { useState } from "react";
import { fetchRunningBalance, fetchBusinessYear } from "../../api/finance";
import type { BusinessYear, Category, PaymentTag, RunningBalanceEntry } from "../../types/finance";

interface Props {
  businessYears: BusinessYear[];
  categories: Category[];
  onClose: () => void;
}

type ReportFormat = "csv" | "pdf";

function fmtDate(d: string): string {
  if (!d) return "–";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

const TAG_OPTIONS: Array<{ val: PaymentTag | null; label: string }> = [
  { val: "ONLINE", label: "Online" },
  { val: "BAR", label: "Bar" },
  { val: null, label: "Kein Tag" },
];

export default function ReportModal({ businessYears, categories, onClose }: Props) {
  const [selectedYearIds, setSelectedYearIds] = useState<number[]>(
    businessYears.length > 0 ? [businessYears[0].id] : []
  );
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [includeRueck, setIncludeRueck] = useState(true);
  const [selectedTags, setSelectedTags] = useState<Array<PaymentTag | null>>([]);
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleYear(id: number) {
    setSelectedYearIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleCat(id: number) {
    setSelectedCatIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleTag(tag: PaymentTag | null) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]);
  }

  async function handleGenerate() {
    if (selectedYearIds.length === 0) { setError("Bitte mindestens ein Jahr auswählen."); return; }
    setLoading(true);
    setError("");
    try {
      const sortedIds = [...selectedYearIds].sort((a, b) => {
        const ya = businessYears.find(y => y.id === a)?.year ?? 0;
        const yb = businessYears.find(y => y.id === b)?.year ?? 0;
        return ya - yb;
      });

      const allData: Array<{ year: BusinessYear; carryOver: number; entries: RunningBalanceEntry[] }> = [];
      for (const yid of sortedIds) {
        const yr = businessYears.find(y => y.id === yid)!;
        const [entries, detail] = await Promise.all([fetchRunningBalance(yid), fetchBusinessYear(yid)]);
        allData.push({ year: yr, carryOver: detail.carryOver ?? 0, entries });
      }

      const filteredData = allData.map(({ year, carryOver, entries }) => {
        const stornoIds = new Set(
          entries
            .filter(e => e.transaction.type === "RUECKBUCHUNG" && e.transaction.relatedTransactionId != null)
            .map(e => e.transaction.relatedTransactionId!)
        );
        let filtered = entries;
        if (!includeRueck) {
          filtered = filtered.filter(e =>
            e.transaction.type !== "RUECKBUCHUNG" && !stornoIds.has(e.transaction.id)
          );
        }
        if (selectedCatIds.length > 0) {
          filtered = filtered.filter(e => selectedCatIds.includes(e.transaction.categoryId));
        }
        if (selectedTags.length > 0) {
          filtered = filtered.filter(e => selectedTags.includes(e.transaction.tag ?? null));
        }
        return { year, carryOver, entries: filtered };
      });

      if (format === "csv") generateCSV(filteredData);
      else await generatePDF(filteredData);
      onClose();
    } catch {
      setError("Fehler beim Erstellen des Reports.");
    } finally {
      setLoading(false);
    }
  }

  function generateCSV(data: Array<{ year: BusinessYear; carryOver: number; entries: RunningBalanceEntry[] }>) {
    const BOM = "﻿";
    const rows: string[] = [BOM + "Datum;Beschreibung;Kategorie;Tag;Typ;Betrag;Kontostand"];

    for (const { year, carryOver, entries } of data) {
      rows.push(`;;; Geschäftsjahr ${year.year} – Übertrag: ${carryOver.toFixed(2)} €;;;`);
      for (const { transaction: t, runningBalance } of entries) {
        const typ = t.type === "EINZAHLUNG" ? "Einzahlung" : t.type === "AUSZAHLUNG" ? "Auszahlung" : "Rückbuchung";
        const betrag = t.type === "EINZAHLUNG" ? t.amount.toFixed(2) : (-t.amount).toFixed(2);
        rows.push([
          fmtDate(t.date),
          `"${t.description.replace(/"/g, '""')}"`,
          `"${t.category.name.replace(/"/g, '""')}"`,
          t.tag ?? "",
          typ,
          betrag,
          runningBalance.toFixed(2),
        ].join(";"));
      }
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kassenbuch_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generatePDF(data: Array<{ year: BusinessYear; carryOver: number; entries: RunningBalanceEntry[] }>) {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape" });
    const today = fmtDate(new Date().toISOString());

    data.forEach(({ year, carryOver, entries }, idx) => {
      if (idx > 0) doc.addPage();

      doc.setFontSize(16);
      doc.text(`Kassenbuch – Geschäftsjahr ${year.year}`, 14, 16);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Erstellt am ${today}  |  Übertrag: ${carryOver.toFixed(2)} €`, 14, 22);
      doc.setTextColor(0);

      const totalIn  = entries.filter(e => e.transaction.type === "EINZAHLUNG").reduce((s, e) => s + e.transaction.amount, 0);
      const totalOut = entries.filter(e => e.transaction.type !== "EINZAHLUNG").reduce((s, e) => s + e.transaction.amount, 0);
      const balance  = entries.length > 0 ? entries[entries.length - 1].runningBalance : carryOver;

      autoTable(doc, {
        startY: 27,
        head: [["Datum", "Beschreibung", "Kategorie", "Tag", "Typ", "Betrag", "Kontostand"]],
        body: entries.map(({ transaction: t, runningBalance }) => [
          fmtDate(t.date),
          t.description,
          t.category.name,
          t.tag ?? "–",
          t.type === "EINZAHLUNG" ? "Einzahlung" : t.type === "AUSZAHLUNG" ? "Auszahlung" : "Rückbuchung",
          `${t.type === "EINZAHLUNG" ? "+" : "-"}${t.amount.toFixed(2)} €`,
          `${runningBalance.toFixed(2)} €`,
        ]),
        foot: [[
          "", "", "", "", "Gesamt",
          `+${totalIn.toFixed(2)} € / -${totalOut.toFixed(2)} €`,
          `${balance.toFixed(2)} €`,
        ]],
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: "bold" },
        columnStyles: { 5: { halign: "right" }, 6: { halign: "right" } },
      });
    });

    doc.save(`kassenbuch_${new Date().toISOString().substring(0, 10)}.pdf`);
  }

  const section: React.CSSProperties = { marginBottom: 20 };
  const sectionLabel: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 };
  const checkRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: 13, color: "#1e293b" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 520, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>Report erstellen</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}>×</button>
        </div>

        {/* Jahre */}
        <div style={section}>
          <div style={sectionLabel}>Geschäftsjahr(e)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {businessYears.map(y => (
              <label key={y.id} style={{ ...checkRow, padding: "5px 12px", border: `1px solid ${selectedYearIds.includes(y.id) ? "#3b82f6" : "#d1d5db"}`, borderRadius: 6, background: selectedYearIds.includes(y.id) ? "#eff6ff" : "#fff", color: selectedYearIds.includes(y.id) ? "#1d4ed8" : "#1e293b", fontWeight: selectedYearIds.includes(y.id) ? 600 : 400 }}>
                <input type="checkbox" checked={selectedYearIds.includes(y.id)} onChange={() => toggleYear(y.id)} style={{ accentColor: "#3b82f6" }} />
                {y.year}
              </label>
            ))}
          </div>
        </div>

        {/* Kategorien */}
        <div style={section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={sectionLabel}>Kategorien</div>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Nichts ausgewählt = alle</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px" }}>
            {categories.map(c => (
              <label key={c.id} style={checkRow}>
                <input type="checkbox" checked={selectedCatIds.includes(c.id)} onChange={() => toggleCat(c.id)} style={{ accentColor: "#3b82f6" }} />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        {/* Rückbuchungen */}
        <div style={section}>
          <div style={sectionLabel}>Optionen</div>
          <label style={checkRow}>
            <input type="checkbox" checked={includeRueck} onChange={e => setIncludeRueck(e.target.checked)} style={{ accentColor: "#3b82f6" }} />
            Rückbuchungen einschließen
          </label>
        </div>

        {/* Tags */}
        <div style={section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={sectionLabel}>Zahlung (Tag)</div>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Nichts ausgewählt = alle</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {TAG_OPTIONS.map(({ val, label }) => (
              <label key={val ?? "none"} style={checkRow}>
                <input type="checkbox" checked={selectedTags.includes(val)} onChange={() => toggleTag(val)} style={{ accentColor: "#3b82f6" }} />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Format */}
        <div style={section}>
          <div style={sectionLabel}>Format</div>
          <div style={{ display: "flex", gap: 12 }}>
            {(["csv", "pdf"] as ReportFormat[]).map(f => (
              <label key={f} style={{ ...checkRow, padding: "6px 16px", border: `1px solid ${format === f ? "#3b82f6" : "#d1d5db"}`, borderRadius: 6, background: format === f ? "#eff6ff" : "#fff", color: format === f ? "#1d4ed8" : "#1e293b", fontWeight: format === f ? 600 : 400 }}>
                <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} style={{ accentColor: "#3b82f6" }} />
                {f.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: "pointer" }}>
            Abbrechen
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: loading ? "#94a3b8" : "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Erstelle…" : `${format.toUpperCase()} erstellen`}
          </button>
        </div>
      </div>
    </div>
  );
}
