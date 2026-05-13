import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMembers, fetchRoles } from "../api/members";
import type { Member } from "../types/member";
import MemberDetail from "./MemberDetail";
import MemberCreate from "./MemberCreate";
import MemberExportModal from "./members/MemberExportModal";
import { canCreateMembers } from "../auth/permissions";
import { getApiUrl } from "../api/client";

type MembersProps = {
  onLogout: () => void;
  isMobile?: boolean;
};

type SortDir = "asc" | "desc";
type SortField = "lastname" | "firstname" | "joinedAt";
type StatusFilter = "all" | "active" | "inactive";

const thStyle: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 11,
  fontWeight: 700,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export default function Members({ onLogout: _onLogout, isMobile = false }: MembersProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Member | null>(null);
  const [creating, setCreating] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sortField, setSortField] = useState<SortField>("lastname");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");

  const { data: members = [], isError: membersError } = useQuery({
    queryKey: ["members"],
    queryFn: fetchMembers,
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  const displayedMembers = members
    .filter(m => {
      if (statusFilter === "active" && !m.active) return false;
      if (statusFilter === "inactive" && m.active) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const fullName = `${m.firstname} ${m.lastname}`.toLowerCase();
        if (!fullName.includes(q)) return false;
      }
      if (joinedFrom && m.joinedAt < joinedFrom) return false;
      if (joinedTo && m.joinedAt > joinedTo + "T23:59:59") return false;
      return true;
    })
    .sort((a, b) => {
      let valA: string;
      let valB: string;
      if (sortField === "firstname") {
        valA = `${a.firstname} ${a.lastname}`.toLowerCase();
        valB = `${b.firstname} ${b.lastname}`.toLowerCase();
      } else if (sortField === "joinedAt") {
        valA = a.joinedAt;
        valB = b.joinedAt;
      } else {
        valA = `${a.lastname} ${a.firstname}`.toLowerCase();
        valB = `${b.lastname} ${b.firstname}`.toLowerCase();
      }
      return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

  const showDetailPanel = selected !== null || creating;

  return (
    <div style={{ display: "flex", height: "var(--content-h)" }}>
      {/* LEFT: TABLE */}
      <div style={{
        flex: isMobile ? 1 : 2,
        overflowY: "auto",
        display: isMobile && showDetailPanel ? "none" : "flex",
        flexDirection: "column",
      }}>
        <header style={{
          display: "flex", flexDirection: "column", gap: 10,
          padding: "14px 20px", borderBottom: "1px solid #e2e8f0",
          position: "sticky", top: 0, background: "#fff", zIndex: 1,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>Mitglieder</h2>
              <span style={{
                background: "#f1f5f9", color: "#64748b",
                borderRadius: 20, padding: "2px 9px", fontSize: 12, fontWeight: 600,
              }}>{displayedMembers.length}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowExport(true)}
                style={{
                  background: "#fff", color: "#374151", border: "1px solid #d1d5db",
                  borderRadius: 7, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Export
              </button>
              {canCreateMembers() && (
                <button
                  onClick={() => { setCreating(true); setSelected(null); }}
                  style={{
                    background: "#2563eb", color: "#fff", border: "none",
                    borderRadius: 7, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  + Neues Mitglied
                </button>
              )}
            </div>
          </div>

          {/* Search + filter row */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Name suchen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, minWidth: 120, padding: "6px 10px", fontSize: 13,
                border: "1px solid #d1d5db", borderRadius: 7, outline: "none",
                color: "#1e293b",
              }}
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              style={{
                padding: "6px 10px", fontSize: 13,
                border: "1px solid #d1d5db", borderRadius: 7,
                background: "#fff", color: "#374151", cursor: "pointer",
              }}
            >
              <option value="all">Alle</option>
              <option value="active">Aktiv</option>
              <option value="inactive">Inaktiv</option>
            </select>
            <select
              value={sortField}
              onChange={e => setSortField(e.target.value as SortField)}
              style={{
                padding: "6px 10px", fontSize: 13,
                border: "1px solid #d1d5db", borderRadius: 7,
                background: "#fff", color: "#374151", cursor: "pointer",
              }}
            >
              <option value="lastname">Nachname</option>
              <option value="firstname">Vorname</option>
              <option value="joinedAt">Beitrittsdatum</option>
            </select>
            <button
              onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
              title={sortDir === "asc" ? "aufsteigend" : "absteigend"}
              style={{
                padding: "6px 12px", fontSize: 13, fontWeight: 600,
                border: "1px solid #d1d5db", borderRadius: 7,
                background: "#fff", color: "#374151", cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {sortDir === "asc" ? "↑" : "↓"}
            </button>
          </div>
          {/* Beitrittsdatum filter row */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>Beitritt:</span>
            <input
              type="date"
              value={joinedFrom}
              onChange={e => setJoinedFrom(e.target.value)}
              style={{
                padding: "5px 8px", fontSize: 13,
                border: "1px solid #d1d5db", borderRadius: 7, outline: "none",
                color: "#1e293b", background: "#fff",
              }}
            />
            <span style={{ fontSize: 12, color: "#64748b" }}>–</span>
            <input
              type="date"
              value={joinedTo}
              onChange={e => setJoinedTo(e.target.value)}
              style={{
                padding: "5px 8px", fontSize: 13,
                border: "1px solid #d1d5db", borderRadius: 7, outline: "none",
                color: "#1e293b", background: "#fff",
              }}
            />
            {(joinedFrom || joinedTo) && (
              <button
                onClick={() => { setJoinedFrom(""); setJoinedTo(""); }}
                style={{
                  padding: "5px 10px", fontSize: 12,
                  border: "1px solid #d1d5db", borderRadius: 7,
                  background: "#fff", color: "#6b7280", cursor: "pointer",
                }}
              >
                ✕
              </button>
            )}
          </div>
        </header>

        {membersError && <p style={{ color: "#dc2626", margin: "10px 20px" }}>Fehler beim Laden der Mitglieder</p>}

        {isMobile ? (
          /* Mobile: card-style list */
          <div>
            {displayedMembers.map(m => (
              <div
                key={m.id}
                onClick={() => { setSelected(m); setCreating(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 16px", borderBottom: "1px solid #f1f5f9",
                  cursor: "pointer",
                  borderLeft: selected?.id === m.id ? "3px solid #2563eb" : "3px solid transparent",
                  background: selected?.id === m.id ? "#eff6ff" : "#fff",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: m.active ? "#dbeafe" : "#f1f5f9",
                  color: m.active ? "#1d4ed8" : "#94a3b8",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, overflow: "hidden",
                }}>
                  {m.avatarPath
                    ? <img src={`${getApiUrl()}/${m.avatarPath}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : `${m.firstname.charAt(0).toUpperCase()}${m.lastname.charAt(0).toUpperCase()}`}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "#1e293b", marginBottom: 2 }}>
                    {m.firstname} {m.lastname}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.email}
                  </div>
                </div>
                <span style={{
                  flexShrink: 0, padding: "3px 10px", borderRadius: 20,
                  fontSize: 12, fontWeight: 600,
                  background: m.active ? "#dcfce7" : "#f1f5f9",
                  color: m.active ? "#166534" : "#64748b",
                }}>
                  {m.active ? "Aktiv" : "Inaktiv"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: table */
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <th align="left" style={{ ...thStyle, paddingLeft: 20 }}>Name</th>
                <th align="left" style={thStyle}>E-Mail</th>
                <th align="left" style={thStyle}>Adresse</th>
                <th align="left" style={{ ...thStyle, paddingRight: 20 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedMembers.map(m => (
                <tr
                  key={m.id}
                  onClick={() => { setSelected(m); setCreating(false); }}
                  style={{
                    cursor: "pointer",
                    borderBottom: "1px solid #f1f5f9",
                    borderLeft: selected?.id === m.id ? "3px solid #2563eb" : "3px solid transparent",
                    background: selected?.id === m.id ? "#eff6ff" : "transparent",
                  }}
                >
                  <td style={{ padding: "10px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: m.active ? "#dbeafe" : "#f1f5f9",
                        color: m.active ? "#1d4ed8" : "#94a3b8",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, overflow: "hidden",
                      }}>
                        {m.avatarPath
                          ? <img src={`${getApiUrl()}/${m.avatarPath}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : `${m.firstname.charAt(0).toUpperCase()}${m.lastname.charAt(0).toUpperCase()}`}
                      </div>
                      <span style={{ fontWeight: 500, fontSize: 14, color: "#1e293b" }}>
                        {m.firstname} {m.lastname}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#475569" }}>{m.email}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#64748b" }}>{m.address ?? "–"}</td>
                  <td style={{ padding: "10px 20px 10px 12px" }}>
                    <span style={{
                      display: "inline-block", padding: "3px 10px", borderRadius: 20,
                      fontSize: 12, fontWeight: 600,
                      background: m.active ? "#dcfce7" : "#f1f5f9",
                      color: m.active ? "#166534" : "#64748b",
                    }}>
                      {m.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* RIGHT: DETAIL */}
      <div style={{
        flex: 1, overflowY: "auto",
        borderLeft: isMobile ? "none" : "1px solid #e2e8f0",
        background: "#f8fafc",
        display: isMobile && !showDetailPanel ? "none" : "block",
      }}>
        {isMobile && showDetailPanel && (
          <button
            onClick={() => { setSelected(null); setCreating(false); }}
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
        {creating ? (
          <div style={{ padding: 20 }}>
            <MemberCreate
              roles={roles}
              onCreated={(member) => {
                queryClient.invalidateQueries({ queryKey: ["members"] });
                setSelected(member);
                setCreating(false);
              }}
              onCancel={() => { setCreating(false); }}
            />
          </div>
        ) : selected ? (
          <div style={{ padding: 20 }}>
            <MemberDetail
              key={selected.id}
              member={selected}
              roles={roles}
              onUpdated={(updated) => {
                queryClient.invalidateQueries({ queryKey: ["members"] });
                setSelected(updated);
              }}
            />
          </div>
        ) : (
          !isMobile && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>Mitglied auswählen…</p>
            </div>
          )
        )}
      </div>
      {showExport && (
        <MemberExportModal members={members} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
