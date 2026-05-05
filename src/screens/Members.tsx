import { useEffect, useState } from "react";
import { fetchMembers } from "../api/members";
import type { Member, Role } from "../types/member";
import MemberDetail from "./MemberDetail";
import MemberCreate from "./MemberCreate";
import { canCreateMembers } from "../auth/permissions";

type MembersProps = {
  onLogout: () => void;
};

export default function Members({ onLogout: _onLogout }: MembersProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchMembers()
      .then(setMembers)
      .catch(() => setError("Fehler beim Laden der Mitglieder"));
  }, []);

  const roles: Role[] = Array.from(
    new Map(
      members.filter(m => m.role).map(m => [m.role!.id, m.role!]),
    ).values(),
  );

  return (
    <div style={{ display: "flex", height: "calc(100vh - 45px)" }}>
      {/* LEFT: TABLE */}
      <div style={{ flex: 2, padding: 16, overflowY: "auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Mitglieder</h2>
          {canCreateMembers() && (
            <button onClick={() => { setCreating(true); setSelected(null); }}>
              + Neues Mitglied
            </button>
          )}
        </header>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <table width="100%" cellPadding={8} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ccc" }}>
              <th align="left">Name</th>
              <th align="left">E-Mail</th>
              <th align="left">Adresse</th>
              <th align="left">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr
                key={m.id}
                onClick={() => { setSelected(m); setCreating(false); }}
                style={{
                  cursor: "pointer",
                  background: selected?.id === m.id ? "#eef" : "transparent",
                  borderBottom: "1px solid #eee",
                }}
              >
                <td>{m.firstname} {m.lastname}</td>
                <td>{m.email}</td>
                <td>{m.address ?? "–"}</td>
                <td>{m.active ? "aktiv" : "inaktiv"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RIGHT: DETAIL */}
      <div style={{ flex: 1, padding: 16, borderLeft: "1px solid #ccc", overflowY: "auto" }}>
        {creating ? (
          <MemberCreate
            roles={roles}
            onCreated={(member) => {
              setMembers(ms => [...ms, member]);
              setSelected(member);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : selected ? (
          <MemberDetail
            key={selected.id}
            member={selected}
            roles={roles}
            onUpdated={(updated) => {
              setMembers(ms => ms.map(m => (m.id === updated.id ? updated : m)));
              setSelected(updated);
            }}
          />
        ) : (
          <p style={{ color: "#888" }}>Mitglied auswählen…</p>
        )}
      </div>
    </div>
  );
}
