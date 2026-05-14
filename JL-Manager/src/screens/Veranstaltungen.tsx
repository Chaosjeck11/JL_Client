import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVeranstaltung, fetchVeranstaltungen } from "../api/veranstaltungen";
import { canManageFinance } from "../auth/permissions";
import type { Veranstaltung } from "../types/veranstaltungen";
import VeranstaltungDetail from "./veranstaltungen/VeranstaltungDetail";
import VeranstaltungCreate from "./veranstaltungen/VeranstaltungCreate";
import FormTemplateManager from "./veranstaltungen/FormTemplateManager";

function fmtDate(d: string): string {
  if (!d) return "–";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

type RightPanel = "detail" | "create" | "template" | null;

export default function Veranstaltungen({ isMobile = false, initialSelectedId }: { isMobile?: boolean; initialSelectedId?: number | null }) {
  const queryClient = useQueryClient();
  const isAdmin = canManageFinance();

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId ?? null);
  const [rightPanel, setRightPanel] = useState<RightPanel>(initialSelectedId ? "detail" : null);
  const [mobileShowDetail, setMobileShowDetail] = useState(!!(initialSelectedId && isMobile));

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["veranstaltungen"],
    queryFn: fetchVeranstaltungen,
  });

  // Fetch full detail for selected event (includes transactions, attachments, form)
  const { data: selectedDetail } = useQuery({
    queryKey: ["veranstaltungen", selectedId],
    queryFn: () => fetchVeranstaltung(selectedId!),
    enabled: selectedId !== null && rightPanel === "detail",
  });

  const filtered = list
    .filter(v =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.description ?? "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  function selectEvent(v: Veranstaltung) {
    setSelectedId(v.id);
    setRightPanel("detail");
    if (isMobile) setMobileShowDetail(true);
  }

  function handleCreated(v: Veranstaltung) {
    setSelectedId(v.id);
    setRightPanel("detail");
    if (isMobile) setMobileShowDetail(true);
  }

  function handleDeleted() {
    setSelectedId(null);
    setRightPanel(null);
    if (isMobile) setMobileShowDetail(false);
    queryClient.invalidateQueries({ queryKey: ["veranstaltungen"] });
  }

  function handleUpdated(v: Veranstaltung) {
    queryClient.setQueryData(["veranstaltungen", v.id], v);
  }

  const showList = !isMobile || !mobileShowDetail;
  const showDetail = !isMobile || mobileShowDetail;

  return (
    <div style={{
      display: "flex",
      height: "var(--content-h)",
      overflow: "hidden",
      background: "#f8fafc",
    }}>
      {/* ── Left panel: list ── */}
      {showList && (
        <div style={{
          width: isMobile ? "100%" : 320,
          minWidth: isMobile ? undefined : 260,
          borderRight: isMobile ? "none" : "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          overflow: "hidden",
        }}>
          {/* Toolbar */}
          <div style={{
            padding: "10px 12px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexShrink: 0,
            flexWrap: "wrap",
          }}>
            <input
              type="text"
              placeholder="Suche…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, minWidth: 120, padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
                fontSize: 13, outline: "none", background: "#f8fafc",
              }}
            />
            {isAdmin && (
              <button
                onClick={() => { setRightPanel("template"); setSelectedId(null); if (isMobile) setMobileShowDetail(true); }}
                title="Formular-Vorlage"
                style={{
                  padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
                  background: rightPanel === "template" ? "#f1f5f9" : "#fff",
                  color: "#374151", fontSize: 12, cursor: "pointer", flexShrink: 0,
                  fontWeight: rightPanel === "template" ? 600 : 400,
                }}
              >
                Vorlage
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { setRightPanel("create"); setSelectedId(null); if (isMobile) setMobileShowDetail(true); }}
                style={{
                  padding: "6px 10px", borderRadius: 6, border: "none",
                  background: "#1e293b", color: "#fff",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                + Neu
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {isLoading && (
              <div style={{ padding: 20, color: "#94a3b8", fontSize: 13 }}>Lädt…</div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div style={{ padding: 20, color: "#94a3b8", fontSize: 13 }}>
                {search ? "Keine Treffer." : "Keine Veranstaltungen."}
              </div>
            )}
            {filtered.map(v => {
              const isSelected = selectedId === v.id && rightPanel === "detail";
              return (
                <div
                  key={v.id}
                  onClick={() => selectEvent(v)}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    background: isSelected ? "#eff6ff" : "transparent",
                    borderLeft: isSelected ? "3px solid #3b82f6" : "3px solid transparent",
                  }}
                >
                  <div style={{
                    fontWeight: 600, fontSize: 14, color: "#1e293b",
                    marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {v.name}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{fmtDate(v.date)}</span>
                    {v._count && (
                      <div style={{ display: "flex", gap: 6 }}>
                        {v._count.transactions > 0 && (
                          <span style={{
                            fontSize: 11, padding: "1px 6px", borderRadius: 8,
                            background: "#f0fdf4", color: "#16a34a", fontWeight: 600,
                          }}>
                            {v._count.transactions} Buchung{v._count.transactions !== 1 ? "en" : ""}
                          </span>
                        )}
                        {v._count.attachments > 0 && (
                          <span style={{
                            fontSize: 11, padding: "1px 6px", borderRadius: 8,
                            background: "#eff6ff", color: "#3b82f6", fontWeight: 600,
                          }}>
                            {v._count.attachments} Anhang/{v._count.attachments !== 1 ? "Anhänge" : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {v.description && (
                    <div style={{
                      fontSize: 12, color: "#94a3b8", marginTop: 3,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {v.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Right panel ── */}
      {showDetail && (
        <div style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
        }}>
          {/* Mobile back button */}
          {isMobile && (
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
              <button
                onClick={() => { setMobileShowDetail(false); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#3b82f6", fontSize: 14, fontWeight: 600, padding: 0,
                }}
              >
                ← Zurück
              </button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto" }}>
            {rightPanel === "create" && (
              <VeranstaltungCreate
                onCreated={handleCreated}
                onCancel={() => { setRightPanel(null); if (isMobile) setMobileShowDetail(false); }}
              />
            )}
            {rightPanel === "template" && <FormTemplateManager />}
            {rightPanel === "detail" && selectedDetail && (
              <VeranstaltungDetail
                veranstaltung={selectedDetail}
                onDeleted={handleDeleted}
                onUpdated={handleUpdated}
              />
            )}
            {rightPanel === "detail" && !selectedDetail && selectedId !== null && (
              <div style={{ padding: 24, color: "#94a3b8", fontSize: 13 }}>Lädt…</div>
            )}
            {rightPanel === null && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                height: "100%", color: "#94a3b8", fontSize: 14,
              }}>
                Veranstaltung auswählen
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
