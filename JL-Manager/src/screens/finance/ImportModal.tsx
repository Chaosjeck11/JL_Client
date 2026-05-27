import { useRef, useState } from "react";
import { createTransaction } from "../../api/finance";
import type { BusinessYear, Category } from "../../types/finance";

interface Props {
  businessYears: BusinessYear[];
  categories: Category[];
  onImported: () => void;
  onClose: () => void;
}

interface ParsedRow {
  raw: string[];
  date: string;          // ISO YYYY-MM-DD
  description: string;
  categoryId: number | null;
  categoryName: string;
  tag: "ONLINE" | "BAR" | null;
  type: "EINZAHLUNG" | "AUSZAHLUNG" | null;
  amount: number | null;
  businessYearId: number | null;
  businessYearLabel: string;
  errors: string[];
}

function parseDateDE(str: string): string | null {
  const m = str.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function getBusinessYearForDate(isoDate: string, businessYears: BusinessYear[]): BusinessYear | undefined {
  const d = new Date(isoDate);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const byYear = month === 1 ? year - 1 : year;
  return businessYears.find(by => by.year === byYear);
}

const TEMPLATE_CSV =
  "Datum;Beschreibung;Kategorie;Tag;Typ;Betrag\n" +
  "01.02.2025;Beispiel Einzahlung;Mitgliedsbeitrag;ONLINE;Einzahlung;100.00\n" +
  "15.03.2025;Beispiel Ausgabe;Miete;BAR;Auszahlung;50.00\n";

function downloadTemplate() {
  const blob = new Blob(["﻿" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kassenbuch_import_vorlage.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportModal({ businessYears, categories, onImported, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; failed: number } | null>(null);
  const [parseError, setParseError] = useState("");

  const validRows = rows.filter(r => r.errors.length === 0);
  const invalidRows = rows.filter(r => r.errors.length > 0);

  async function handleFile(file: File) {
    setParseError("");
    setRows([]);
    setImportResult(null);
    setFileName(file.name);

    try {
      const { read, utils } = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      let wb;
      if (isCsv) {
        const text = new TextDecoder("utf-8").decode(buffer).replace(/^﻿/, "");
        wb = read(text, { type: "string", FS: ";" });
      } else {
        wb = read(buffer, { type: "array" });
      }
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: string[][] = utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as string[][];

      if (raw.length < 2) { setParseError("Die Datei enthält keine Daten."); return; }

      // Normalize header
      const header = raw[0].map(h => String(h).trim().toLowerCase());
      function col(name: string): number { return header.indexOf(name); }
      const ci = { datum: col("datum"), desc: col("beschreibung"), kat: col("kategorie"), tag: col("tag"), typ: col("typ"), betrag: col("betrag") };

      if (ci.datum === -1 || ci.desc === -1 || ci.kat === -1 || ci.typ === -1 || ci.betrag === -1) {
        setParseError("Pflichtfelder fehlen in der Kopfzeile: Datum, Beschreibung, Kategorie, Typ, Betrag");
        return;
      }

      const parsed: ParsedRow[] = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i];
        if (!r || r.every(c => !String(c).trim())) continue; // skip empty rows
        const rowStr = r.map(c => String(c ?? "").trim());

        const datumRaw = rowStr[ci.datum] ?? "";
        const descRaw  = rowStr[ci.desc]  ?? "";
        const katRaw   = rowStr[ci.kat]   ?? "";
        const tagRaw   = (ci.tag !== -1 ? rowStr[ci.tag] : "")?.toUpperCase();
        const typRaw   = rowStr[ci.typ]   ?? "";
        const betragRaw = rowStr[ci.betrag] ?? "";

        const errors: string[] = [];

        const isoDate = parseDateDE(datumRaw);
        if (!isoDate) errors.push(`Ungültiges Datum "${datumRaw}" (erwartet DD.MM.YYYY)`);

        if (!descRaw) errors.push("Beschreibung fehlt");

        const cat = categories.find(c => c.name.toLowerCase() === katRaw.toLowerCase());
        if (!cat) errors.push(`Kategorie "${katRaw}" nicht gefunden`);

        let tag: "ONLINE" | "BAR" | null = null;
        if (tagRaw === "ONLINE") tag = "ONLINE";
        else if (tagRaw === "BAR") tag = "BAR";
        else if (tagRaw && tagRaw !== "") errors.push(`Unbekanntes Tag "${tagRaw}" (ONLINE oder BAR)`);

        let type: "EINZAHLUNG" | "AUSZAHLUNG" | null = null;
        const typLow = typRaw.toLowerCase();
        if (typLow === "einzahlung") type = "EINZAHLUNG";
        else if (typLow === "auszahlung") type = "AUSZAHLUNG";
        else if (typLow === "rückbuchung" || typLow === "ruckbuchung") {
          errors.push("Rückbuchungen können nicht importiert werden – bitte manuell anlegen");
        } else {
          errors.push(`Unbekannter Typ "${typRaw}" (Einzahlung oder Auszahlung)`);
        }

        const amountRaw = betragRaw.replace(",", ".").replace(/[^0-9.+-]/g, "");
        const amount = Math.abs(parseFloat(amountRaw));
        if (isNaN(amount) || amount <= 0) errors.push(`Ungültiger Betrag "${betragRaw}"`);

        let by: BusinessYear | undefined;
        let byLabel = "";
        if (isoDate) {
          by = getBusinessYearForDate(isoDate, businessYears);
          if (!by) errors.push(`Kein Geschäftsjahr für ${datumRaw} gefunden`);
          else byLabel = String(by.year);
        }

        parsed.push({
          raw: rowStr,
          date: isoDate ?? "",
          description: descRaw,
          categoryId: cat?.id ?? null,
          categoryName: katRaw,
          tag,
          type,
          amount: isNaN(amount) ? null : amount,
          businessYearId: by?.id ?? null,
          businessYearLabel: byLabel,
          errors,
        });
      }

      if (parsed.length === 0) { setParseError("Keine gültigen Zeilen gefunden."); return; }
      setRows(parsed);
    } catch {
      setParseError("Datei konnte nicht gelesen werden.");
    }
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    let ok = 0;
    let failed = 0;
    for (const row of validRows) {
      try {
        await createTransaction({
          date: row.date,
          description: row.description,
          type: row.type!,
          amount: row.amount!,
          categoryId: row.categoryId!,
          businessYearId: row.businessYearId!,
          tag: row.tag,
        });
        ok++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    setImportResult({ ok, failed });
    if (ok > 0) onImported();
  }

  const sectionLabel: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--c-bg)", borderRadius: 12, padding: 28, width: 780, maxWidth: "95vw", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "var(--c-text)" }}>Buchungen importieren</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--c-text-3)", lineHeight: 1 }}>×</button>
        </div>

        {/* Vorlage */}
        <div style={{ padding: "12px 16px", background: "var(--c-bg-2)", borderRadius: 8, border: "1px solid var(--c-border)", fontSize: 13, color: "var(--c-text-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            Format: <code style={{ background: "var(--c-bg-3)", padding: "1px 5px", borderRadius: 3, fontSize: 12 }}>Datum;Beschreibung;Kategorie;Tag;Typ;Betrag</code>
            <br />
            <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>Unterstützt: .xlsx und .csv · Tag: ONLINE oder BAR · Typ: Einzahlung oder Auszahlung</span>
          </div>
          <button
            onClick={downloadTemplate}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #3b82f6", background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Vorlage (.csv)
          </button>
        </div>

        {/* File input */}
        <div>
          <div style={sectionLabel}>Datei auswählen</div>
          <div
            style={{ border: "2px dashed var(--c-border)", borderRadius: 8, padding: "24px 20px", textAlign: "center", cursor: "pointer", background: "var(--c-bg-2)" }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            {fileName
              ? <span style={{ fontSize: 14, color: "var(--c-text)", fontWeight: 600 }}>{fileName}</span>
              : <span style={{ fontSize: 14, color: "var(--c-text-3)" }}>Datei hierher ziehen oder klicken (.xlsx / .csv)</span>
            }
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        </div>

        {parseError && (
          <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 13 }}>
            {parseError}
          </div>
        )}

        {/* Import result */}
        {importResult && (
          <div style={{ padding: "12px 16px", background: importResult.failed === 0 ? "#f0fdf4" : "#fffbeb", border: `1px solid ${importResult.failed === 0 ? "#86efac" : "#fcd34d"}`, borderRadius: 8, fontSize: 14 }}>
            <strong>{importResult.ok}</strong> Buchung(en) erfolgreich importiert
            {importResult.failed > 0 && <>, <strong style={{ color: "#dc2626" }}>{importResult.failed}</strong> fehlgeschlagen</>}
          </div>
        )}

        {/* Preview */}
        {rows.length > 0 && !importResult && (
          <>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                <div style={sectionLabel}>Vorschau</div>
                <span style={{ fontSize: 12, color: "#16a34a" }}>{validRows.length} gültig</span>
                {invalidRows.length > 0 && <span style={{ fontSize: 12, color: "#dc2626" }}>{invalidRows.length} fehlerhaft</span>}
              </div>
              <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--c-border)" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--c-bg-2)", borderBottom: "1px solid var(--c-border)" }}>
                      {["Datum", "Beschreibung", "Kategorie", "Tag", "Typ", "Betrag", "GJ", "Status"].map(h => (
                        <th key={h} align="left" style={{ padding: "7px 10px", fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.4, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const ok = row.errors.length === 0;
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid var(--c-border)", background: ok ? "transparent" : "#fff8f8" }}>
                          <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{row.date ? row.date.split("-").reverse().join(".") : row.raw[0]}</td>
                          <td style={{ padding: "6px 10px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description || row.raw[1]}</td>
                          <td style={{ padding: "6px 10px" }}>{row.categoryName}</td>
                          <td style={{ padding: "6px 10px" }}>{row.tag ?? "–"}</td>
                          <td style={{ padding: "6px 10px" }}>{row.type === "EINZAHLUNG" ? "Einzahlung" : row.type === "AUSZAHLUNG" ? "Auszahlung" : (row.raw[4] ?? "–")}</td>
                          <td style={{ padding: "6px 10px", textAlign: "right", whiteSpace: "nowrap" }}>{row.amount != null ? `${row.amount.toFixed(2)} €` : row.raw[5]}</td>
                          <td style={{ padding: "6px 10px" }}>{row.businessYearLabel || "–"}</td>
                          <td style={{ padding: "6px 10px" }}>
                            {ok
                              ? <span style={{ color: "#16a34a", fontWeight: 600 }}>✓</span>
                              : <span style={{ color: "#dc2626" }} title={row.errors.join("\n")}>✗ {row.errors[0]}{row.errors.length > 1 ? ` (+${row.errors.length - 1})` : ""}</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 13, cursor: "pointer" }}>
                Abbrechen
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: importing || validRows.length === 0 ? "#94a3b8" : "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: importing || validRows.length === 0 ? "not-allowed" : "pointer" }}
              >
                {importing ? "Importiere…" : `${validRows.length} Buchung(en) importieren`}
              </button>
            </div>
          </>
        )}

        {importResult && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Schließen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
