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
};

type SortDir = "asc" | "desc";
type StatusFilter = "all" | "active" | "inactive";

const thStyle: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 11,
  fontWeight: 700,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export default function Members({ onLogout: _onLogout }: MembersProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Member | null>(null);
  const [creating, setCreating] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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
      return true;
    })
    .sort((a, b) => {
      const nameA = `${a.lastname} ${a.firstname}`.toLowerCase();
      const nameB = `${b.lastname} ${b.firstname}`.toLowerCase();
      return sortDir === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  return (
    <div style={{ display: "flex", height: "calc(100vh - 45px)" }}>
      {/* LEFT: TABLE */}
      <div style={{ flex: 2, overflowY: "auto", display: "flex", flexDirection: "column" }}>
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Name suchen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, padding: "6px 10px", fontSize: 13,
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
            <button
              onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
              title={sortDir === "asc" ? "A → Z (klicken für Z → A)" : "Z → A (klicken für A → Z)"}
              style={{
                padding: "6px 12px", fontSize: 13, fontWeight: 600,
                border: "1px solid #d1d5db", borderRadius: 7,
                background: "#fff", color: "#374151", cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {sortDir === "asc" ? "A → Z" : "Z → A"}
            </button>
          </div>
        </header>

        {membersError && <p style={{ color: "#dc2626", margin: "10px 20px" }}>Fehler beim Laden der Mitglieder</p>}

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
      </div>

      {/* RIGHT: DETAIL */}
      <div style={{
        flex: 1, overflowY: "auto",
        borderLeft: "1px solid #e2e8f0",
        background: "#f8fafc",
      }}>
        {creating ? (
          <div style={{ padding: 20 }}>
            <MemberCreate
              roles={roles}
              onCreated={(member) => {
                queryClient.invalidateQueries({ queryKey: ["members"] });
                setSelected(member);
                setCreating(false);
              }}
              onCancel={() => setCreating(false)}
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>Mitglied auswählen…</p>
          </div>
        )}
      </div>
      {showExport && (
        <MemberExportModal members={members} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
