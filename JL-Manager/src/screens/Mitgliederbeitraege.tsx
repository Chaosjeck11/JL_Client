import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBusinessYears, fetchMitgliedsbeitraege } from "../api/finance";
import type { BusinessYear, Mitgliedsbeitrag } from "../types/finance";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  BEZAHLT:    { label: "Bezahlt",     color: "#16a34a", bg: "#f0fdf4" },
  TEILWEISE:  { label: "Teilweise",   color: "#d97706", bg: "#fffbeb" },
  AUSSTEHEND: { label: "Ausstehend",  color: "#dc2626", bg: "#fef2f2" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: "#64748b", bg: "#f1f5f9" };
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
      padding: "12px 20px", borderRadius: 10, background: "#fff",
      border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      minWidth: 120,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Mitgliederbeitraege() {
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data: rawYears = [], isError: yearsError } = useQuery({
    queryKey: ["business-years"],
    queryFn: fetchBusinessYears,
  });
  const businessYears: BusinessYear[] = useMemo(
    () => [...rawYears].sort((a, b) => b.year - a.year),
    [rawYears],
  );

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

  return (
    <div style={{ padding: "16px 16px", overflowY: "auto", height: "var(--content-h)", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1e293b" }}>Mitgliederbeiträge</h2>
        <select
          value={effectiveYearId ?? ""}
          onChange={e => setSelectedYearId(Number(e.target.value))}
          style={{
            fontSize: 14, padding: "4px 8px", borderRadius: 6,
            border: "1px solid #d1d5db", background: "#fff",
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
        <SummaryCard label="Bezahlt"    value={bezahlt}    color="#16a34a" />
        <SummaryCard label="Teilweise"  value={teilweise}  color="#d97706" />
        <SummaryCard label="Ausstehend" value={ausstehend} color="#dc2626" />
        <SummaryCard label="Gesamt offen" value={`${totalOffen.toFixed(2)} €`} color="#64748b" />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["ALL", "AUSSTEHEND", "TEILWEISE", "BEZAHLT"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "4px 14px", borderRadius: 20, border: "1px solid #d1d5db",
              fontSize: 13, cursor: "pointer",
              background: statusFilter === s ? "#1e293b" : "#fff",
              color: statusFilter === s ? "#fff" : "#374151",
              fontWeight: statusFilter === s ? 600 : 400,
            }}
          >
            {s === "ALL" ? "Alle" : STATUS_MAP[s]?.label ?? s}
          </button>
        ))}
      </div>

      {isFetching && beitraege.length === 0 ? (
        <p style={{ color: "#94a3b8" }}>Lade…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden", minWidth: 600 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["Mitglied", "Beitrag JL", "Beitrag KG", "Bezahlt JL", "Bezahlt KG", "Offen", "Status"].map((h, i) => (
                  <th
                    key={h}
                    align={i === 0 ? "left" : i === 6 ? "left" : "right"}
                    style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                    Keine Einträge
                  </td>
                </tr>
              )}
              {visible.map((b, idx) => {
                const offen = Math.max(0, b.betragJL - b.bezahltJL) + Math.max(0, b.betragKG - b.bezahltKG);
                return (
                  <tr
                    key={b.id}
                    style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#1e293b" }}>
                      {b.member
                        ? `${b.member.firstname} ${b.member.lastname}${!b.member.active ? " (inaktiv)" : ""}`
                        : `Mitglied #${b.memberId}`}
                    </td>
                    <td align="right" style={{ padding: "10px 14px", fontSize: 13 }}>{b.betragJL.toFixed(2)} €</td>
                    <td align="right" style={{ padding: "10px 14px", fontSize: 13 }}>{b.betragKG.toFixed(2)} €</td>
                    <td align="right" style={{ padding: "10px 14px", fontSize: 13 }}>{b.bezahltJL.toFixed(2)} €</td>
                    <td align="right" style={{ padding: "10px 14px", fontSize: 13 }}>{b.bezahltKG.toFixed(2)} €</td>
                    <td
                      align="right"
                      style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: offen > 0 ? "#dc2626" : "#16a34a" }}
                    >
                      {offen.toFixed(2)} €
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <StatusPill status={b.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
