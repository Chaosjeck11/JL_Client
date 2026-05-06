import { useEffect, useState } from "react";
import { fetchMembers, fetchRoles } from "../api/members";
import type { Member, Role } from "../types/member";
import MemberDetail from "./MemberDetail";
import MemberCreate from "./MemberCreate";
import { canCreateMembers } from "../auth/permissions";

type MembersProps = {
  onLogout: () => void;
};

const thStyle: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 11,
  fontWeight: 700,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export default function Members({ onLogout: _onLogout }: MembersProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchMembers()
      .then(setMembers)
      .catch(() => setError("Fehler beim Laden der Mitglieder"));
    fetchRoles()
      .then(setRoles)
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 45px)" }}>
      {/* LEFT: TABLE */}
      <div style={{ flex: 2, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <header style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 20px", borderBottom: "1px solid #e2e8f0",
          position: "sticky", top: 0, background: "#fff", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>Mitglieder</h2>
            <span style={{
              background: "#f1f5f9", color: "#64748b",
              borderRadius: 20, padding: "2px 9px", fontSize: 12, fontWeight: 600,
            }}>{members.length}</span>
          </div>
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
        </header>

        {error && <p style={{ color: "#dc2626", margin: "10px 20px" }}>{error}</p>}

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
            {members.map(m => (
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
                      fontSize: 12, fontWeight: 700,
                    }}>
                      {m.firstname.charAt(0).toUpperCase()}{m.lastname.charAt(0).toUpperCase()}
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
                setMembers(ms => [...ms, member]);
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
                setMembers(ms => ms.map(m => (m.id === updated.id ? updated : m)));
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
    </div>
  );
}
