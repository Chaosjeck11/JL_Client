import { useEffect, useState } from "react";
import { fetchMembers } from "../api/members";
import { logout } from "../auth/auth";
import type { Member } from "../types/member";
import MemberDetail from "./MemberDetail";
import MemberCreate from "./MemberCreate";
import { canCreateMembers } from "../auth/permissions";




type MembersProps = {
  onLogout: () => void;
};

export default function Members({ onLogout }: MembersProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);


  useEffect(() => {
    fetchMembers()
      .then(setMembers)
      .catch(() => setError("Fehler beim Laden der Mitglieder"));
  }, []);

  function handleLogout() {
    logout();
    onLogout();
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* LEFT: TABLE */}
      <div style={{ flex: 2, padding: 16 }}>
        <header style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>Mitglieder</h2>
            {canCreateMembers() && (
              <button onClick={() => setCreating(true)}>
                + Neues Mitglied
              </button>
            )}

          <button onClick={handleLogout}>Logout</button>
        </header>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <table width="100%" cellPadding={8}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">E-Mail</th>
              <th align="left">Rolle</th>
              <th align="left">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr
                key={m.id}
                onClick={() => setSelected(m)}
                style={{
                  cursor: "pointer",
                  background:
                    selected?.id === m.id ? "#eef" : "transparent",
                }}
              >
                <td>{m.firstname} {m.lastname}</td>
                <td>{m.email}</td>
                <td>{m.role?.name ?? "-"}</td>
                <td>{m.active ? "aktiv" : "inaktiv"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RIGHT: DETAIL */}
              <div
          style={{
            flex: 1,
            padding: 16,
            borderLeft: "1px solid #ccc",
          }}
        >
          {creating ? (
            <MemberCreate
              onCreated={(member) => {
                setMembers(ms => [...ms, member]);
                setSelected(member);
                setCreating(false);
              }}
              onCancel={() => setCreating(false)}
            />
          ) : selected ? (
            <MemberDetail
              member={selected}
              onUpdated={(updated) => {
                setMembers(ms =>
                  ms.map(m => (m.id === updated.id ? updated : m))
                );
                setSelected(updated);
              }}
            />
          ) : (
            <p>Mitglied auswählen…</p>
          )}
        </div>

    </div>
  );
}
