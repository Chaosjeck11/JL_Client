import { useState } from "react";
import { triggerDownload } from "../../utils/triggerDownload";
import {
  fetchRunningBalance,
  fetchBusinessYear,
  fetchAttachments,
  fetchAttachmentArrayBuffer,
  fetchAttachmentDataUrl,
} from "../../api/finance";
import type {
  BusinessYear,
  Category,
  PaymentTag,
  RunningBalanceEntry,
  TransactionAttachment,
} from "../../types/finance";

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

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max - 1) + "…" : s;
}

const TAG_OPTIONS: Array<{ val: PaymentTag | null; label: string }> = [
  { val: "ONLINE", label: "Online" },
  { val: "BAR", label: "Bar" },
  { val: null, label: "Kein Tag" },
];

async function convertToJpeg(dataUrl: string): Promise<ArrayBuffer> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((r) => {
    img.onload = () => r();
    img.onerror = () => r();
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 800;
  canvas.height = img.naturalHeight || 600;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return new Promise((resolve) =>
    canvas.toBlob((b) => b!.arrayBuffer().then(resolve), "image/jpeg", 0.92)
  );
}

export default function ReportModal({ businessYears, categories, onClose }: Props) {
  const [selectedYearIds, setSelectedYearIds] = useState<number[]>(
    businessYears.length > 0 ? [businessYears[0].id] : []
  );
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [includeRueck, setIncludeRueck] = useState(true);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Array<PaymentTag | null>>([]);
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleYear(id: number) {
    setSelectedYearIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleCat(id: number) {
    setSelectedCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleTag(tag: PaymentTag | null) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }

  async function handleGenerate() {
    if (selectedYearIds.length === 0) {
      setError("Bitte mindestens ein Jahr auswählen.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const sortedIds = [...selectedYearIds].sort((a, b) => {
        const ya = businessYears.find((y) => y.id === a)?.year ?? 0;
        const yb = businessYears.find((y) => y.id === b)?.year ?? 0;
        return ya - yb;
      });

      const allData: Array<{ year: BusinessYear; carryOver: number; entries: RunningBalanceEntry[] }> = [];
      for (const yid of sortedIds) {
        const yr = businessYears.find((y) => y.id === yid)!;
        const [entries, detail] = await Promise.all([fetchRunningBalance(yid), fetchBusinessYear(yid)]);
        allData.push({ year: yr, carryOver: detail.carryOver ?? 0, entries });
      }

      const filteredData = allData.map(({ year, carryOver, entries }) => {
        const stornoIds = new Set(
          entries
            .filter((e) => e.transaction.type === "RUECKBUCHUNG" && e.transaction.relatedTransactionId != null)
            .map((e) => e.transaction.relatedTransactionId!)
        );
        let filtered = entries;
        if (!includeRueck) {
          filtered = filtered.filter(
            (e) => e.transaction.type !== "RUECKBUCHUNG" && !stornoIds.has(e.transaction.id)
          );
        }
        if (selectedCatIds.length > 0) {
          filtered = filtered.filter((e) => selectedCatIds.includes(e.transaction.categoryId));
        }
        if (selectedTags.length > 0) {
          filtered = filtered.filter((e) => selectedTags.includes(e.transaction.tag ?? null));
        }
        return { year, carryOver, entries: filtered };
      });

      const attachmentMap = new Map<number, TransactionAttachment[]>();
      if (includeAttachments) {
        const txIds = [
          ...new Set(filteredData.flatMap((d) => d.entries.map((e) => e.transaction.id))),
        ];
        await Promise.all(
          txIds.map(async (tid) => {
            try {
              const atts = await fetchAttachments(tid);
              if (atts.length > 0) attachmentMap.set(tid, atts);
            } catch { /* skip */ }
          })
        );
      }

      if (format === "csv") await generateCSV(filteredData, attachmentMap);
      else await generatePDF(filteredData, attachmentMap);
      onClose();
    } catch {
      setError("Fehler beim Erstellen des Reports.");
    } finally {
      setLoading(false);
    }
  }

  async function generateCSV(
    data: Array<{ year: BusinessYear; carryOver: number; entries: RunningBalanceEntry[] }>,
    attachmentMap: Map<number, TransactionAttachment[]>
  ) {
    const hasAtts = attachmentMap.size > 0;
    const BOM = "﻿";
    const rows: string[] = [
      BOM + "Datum;Beschreibung;Kategorie;Tag;Typ;Betrag;Kontostand" + (hasAtts ? ";Anhänge" : ""),
    ];

    for (const { year, carryOver, entries } of data) {
      rows.push(
        `;;; Geschäftsjahr ${year.year} – Übertrag: ${carryOver.toFixed(2)} €;;;` +
          (hasAtts ? ";" : "")
      );
      for (const { transaction: t, runningBalance } of entries) {
        const typ =
          t.type === "EINZAHLUNG" ? "Einzahlung" : t.type === "AUSZAHLUNG" ? "Auszahlung" : "Rückbuchung";
        const betrag = t.type === "EINZAHLUNG" ? t.amount.toFixed(2) : (-t.amount).toFixed(2);
        const cols = [
          fmtDate(t.date),
          `"${t.description.replace(/"/g, '""')}"`,
          `"${t.category.name.replace(/"/g, '""')}"`,
          t.tag ?? "",
          typ,
          betrag,
          runningBalance.toFixed(2),
        ];
        if (hasAtts) {
          const atts = attachmentMap.get(t.id) ?? [];
          cols.push(`"${atts.map((a) => a.filename).join(" | ")}"`);
        }
        rows.push(cols.join(";"));
      }
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    await triggerDownload(`kassenbuch_${new Date().toISOString().substring(0, 10)}.csv`, blob);
  }

  async function generatePDF(
    data: Array<{ year: BusinessYear; carryOver: number; entries: RunningBalanceEntry[] }>,
    attachmentMap: Map<number, TransactionAttachment[]>
  ) {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape" });
    const today = fmtDate(new Date().toISOString());
    const filename = `kassenbuch_${new Date().toISOString().substring(0, 10)}.pdf`;

    for (let idx = 0; idx < data.length; idx++) {
      const { year, carryOver, entries } = data[idx];
      if (idx > 0) doc.addPage();

      doc.setFontSize(16);
      doc.text(`Kassenbuch – Geschäftsjahr ${year.year}`, 14, 16);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Erstellt am ${today}  |  Übertrag: ${carryOver.toFixed(2)} €`, 14, 22);
      doc.setTextColor(0);

      const totalIn = entries
        .filter((e) => e.transaction.type === "EINZAHLUNG")
        .reduce((s, e) => s + e.transaction.amount, 0);
      const totalOut = entries
        .filter((e) => e.transaction.type !== "EINZAHLUNG")
        .reduce((s, e) => s + e.transaction.amount, 0);
      const balance = entries.length > 0 ? entries[entries.length - 1].runningBalance : carryOver;

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
        foot: [
          [
            "",
            "",
            "",
            "",
            "Gesamt",
            `+${totalIn.toFixed(2)} € / -${totalOut.toFixed(2)} €`,
            `${balance.toFixed(2)} €`,
          ],
        ],
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: "bold" },
        columnStyles: { 5: { halign: "right" }, 6: { halign: "right" } },
      });

      // Attachment overview table (list only – actual files appended via pdf-lib below)
      const txWithAtts = entries.filter((e) => attachmentMap.has(e.transaction.id));
      if (txWithAtts.length > 0) {
        doc.addPage();
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.text(`Anhänge – Geschäftsjahr ${year.year}`, 14, 14);
        doc.setTextColor(0);

        const attRows: string[][] = [];
        for (const { transaction: t } of txWithAtts) {
          for (const att of attachmentMap.get(t.id)!) {
            attRows.push([fmtDate(t.date), t.description, att.filename, att.mimeType, fmtSize(att.size)]);
          }
        }

        autoTable(doc, {
          startY: 20,
          head: [["Datum", "Transaktion", "Dateiname", "Dateityp", "Größe"]],
          body: attRows,
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [30, 41, 59], textColor: 255 },
          columnStyles: {
            0: { cellWidth: 22 },
            2: { cellWidth: 80 },
            3: { cellWidth: 45 },
            4: { halign: "right", cellWidth: 20 },
          },
        });
      }
    }

    if (attachmentMap.size === 0) {
      doc.save(filename);
      return;
    }

    // Merge attachment files via pdf-lib
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const reportBytes = doc.output("arraybuffer") as ArrayBuffer;
    const mergedDoc = await PDFDocument.load(reportBytes);
    const fontBold = await mergedDoc.embedFont(StandardFonts.HelveticaBold);
    const fontNormal = await mergedDoc.embedFont(StandardFonts.Helvetica);
    const PW = 841.89, PH = 595.28; // A4 landscape in pt

    for (const { entries } of data) {
      for (const { transaction: t } of entries) {
        const atts = attachmentMap.get(t.id);
        if (!atts) continue;

        for (const att of atts) {
          // Separator page
          const sep = mergedDoc.addPage([PW, PH]);
          sep.drawText("Anhang", {
            x: 40, y: PH - 45, size: 18, font: fontBold,
            color: rgb(0.12, 0.16, 0.23),
          });
          sep.drawText(`Transaktion: ${fmtDate(t.date)} – ${truncate(t.description, 90)}`, {
            x: 40, y: PH - 75, size: 11, font: fontNormal,
            color: rgb(0.12, 0.16, 0.23),
          });
          sep.drawText(`Datei: ${att.filename}  (${fmtSize(att.size)})`, {
            x: 40, y: PH - 96, size: 10, font: fontNormal,
            color: rgb(0.47, 0.47, 0.47),
          });

          try {
            if (att.mimeType === "application/pdf") {
              const bytes = await fetchAttachmentArrayBuffer(t.id, att.id);
              const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
              const copied = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
              copied.forEach((p) => mergedDoc.addPage(p));
            } else if (att.mimeType === "image/jpeg" || att.mimeType === "image/jpg") {
              const bytes = await fetchAttachmentArrayBuffer(t.id, att.id);
              const emb = await mergedDoc.embedJpg(bytes);
              const page = mergedDoc.addPage([PW, PH]);
              const scale = Math.min(PW / emb.width, PH / emb.height);
              const dw = emb.width * scale, dh = emb.height * scale;
              page.drawImage(emb, { x: (PW - dw) / 2, y: (PH - dh) / 2, width: dw, height: dh });
            } else if (att.mimeType === "image/png") {
              const bytes = await fetchAttachmentArrayBuffer(t.id, att.id);
              const emb = await mergedDoc.embedPng(bytes);
              const page = mergedDoc.addPage([PW, PH]);
              const scale = Math.min(PW / emb.width, PH / emb.height);
              const dw = emb.width * scale, dh = emb.height * scale;
              page.drawImage(emb, { x: (PW - dw) / 2, y: (PH - dh) / 2, width: dw, height: dh });
            } else if (att.mimeType.startsWith("image/")) {
              // GIF, WebP, BMP etc. – convert via canvas to JPEG first
              const dataUrl = await fetchAttachmentDataUrl(t.id, att.id);
              const jpegBytes = await convertToJpeg(dataUrl);
              const emb = await mergedDoc.embedJpg(jpegBytes);
              const page = mergedDoc.addPage([PW, PH]);
              const scale = Math.min(PW / emb.width, PH / emb.height);
              const dw = emb.width * scale, dh = emb.height * scale;
              page.drawImage(emb, { x: (PW - dw) / 2, y: (PH - dh) / 2, width: dw, height: dh });
            } else {
              const info = mergedDoc.addPage([PW, PH]);
              info.drawText("Dieses Dateiformat kann nicht eingebettet werden.", {
                x: 40, y: PH / 2 + 10, size: 12, font: fontNormal,
                color: rgb(0.6, 0.6, 0.6),
              });
              info.drawText(`Format: ${att.mimeType}`, {
                x: 40, y: PH / 2 - 10, size: 10, font: fontNormal,
                color: rgb(0.6, 0.6, 0.6),
              });
            }
          } catch {
            const errPage = mergedDoc.addPage([PW, PH]);
            errPage.drawText("Fehler beim Laden des Anhangs.", {
              x: 40, y: PH / 2, size: 12, font: fontNormal,
              color: rgb(0.8, 0.2, 0.2),
            });
          }
        }
      }
    }

    const finalBytes = await mergedDoc.save();
    const blob = new Blob([finalBytes.buffer as ArrayBuffer], { type: "application/pdf" });
    await triggerDownload(filename, blob);
  }

  const section: React.CSSProperties = { marginBottom: 20 };
  const sectionLabel: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "var(--c-text-2)",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
  };
  const checkRow: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    padding: "4px 0", cursor: "pointer", fontSize: 13, color: "var(--c-text)",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--c-bg)", borderRadius: 12, padding: 28, width: 520, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "var(--c-text)" }}>Report erstellen</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--c-text-3)", lineHeight: 1 }}>×</button>
        </div>

        {/* Jahre */}
        <div style={section}>
          <div style={sectionLabel}>Geschäftsjahr(e)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {businessYears.map((y) => (
              <label
                key={y.id}
                style={{ ...checkRow, padding: "5px 12px", border: `1px solid ${selectedYearIds.includes(y.id) ? "#3b82f6" : "var(--c-border)"}`, borderRadius: 6, background: selectedYearIds.includes(y.id) ? "#eff6ff" : "var(--c-bg)", color: selectedYearIds.includes(y.id) ? "#1d4ed8" : "var(--c-text)", fontWeight: selectedYearIds.includes(y.id) ? 600 : 400 }}
              >
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
            <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>Nichts ausgewählt = alle</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px" }}>
            {categories.map((c) => (
              <label key={c.id} style={checkRow}>
                <input type="checkbox" checked={selectedCatIds.includes(c.id)} onChange={() => toggleCat(c.id)} style={{ accentColor: "#3b82f6" }} />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        {/* Optionen */}
        <div style={section}>
          <div style={sectionLabel}>Optionen</div>
          <label style={checkRow}>
            <input type="checkbox" checked={includeRueck} onChange={(e) => setIncludeRueck(e.target.checked)} style={{ accentColor: "#3b82f6" }} />
            Rückbuchungen einschließen
          </label>
          <label style={{ ...checkRow, marginTop: 4 }}>
            <input type="checkbox" checked={includeAttachments} onChange={(e) => setIncludeAttachments(e.target.checked)} style={{ accentColor: "#3b82f6" }} />
            <span>
              Anhänge einschließen
              <span style={{ fontSize: 11, color: "var(--c-text-3)", marginLeft: 6 }}>
                {format === "pdf"
                  ? "(PDF-Seiten + Bilder vollständig eingebettet)"
                  : "(Dateinamen als zusätzliche Spalte)"}
              </span>
            </span>
          </label>
        </div>

        {/* Tags */}
        <div style={section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={sectionLabel}>Zahlung (Tag)</div>
            <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>Nichts ausgewählt = alle</span>
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
            {(["csv", "pdf"] as ReportFormat[]).map((f) => (
              <label
                key={f}
                style={{ ...checkRow, padding: "6px 16px", border: `1px solid ${format === f ? "#3b82f6" : "var(--c-border)"}`, borderRadius: 6, background: format === f ? "#eff6ff" : "var(--c-bg)", color: format === f ? "#1d4ed8" : "var(--c-text)", fontWeight: format === f ? 600 : 400 }}
              >
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
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer" }}>
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
