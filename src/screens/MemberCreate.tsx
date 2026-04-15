import { useState } from "react";
import { createMember } from "../api/members";
import type { Member } from "../types/member";

type Props = {
  onCreated: (member: Member) => void;
  onCancel: () => void;
};

export default function MemberCreate({ onCreated, onCancel }: Props) {
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    try {
      setSaving(true);
      const member = await createMember({
        firstname,
        lastname,
        email,
        password,
        roleId: 1, // vorerst fix, Rollen kommen später
      });
      onCreated(member);
    } catch {
      setError("Anlegen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3>Neues Mitglied</h3>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <input
        placeholder="Vorname"
        value={firstname}
        onChange={e => setFirstname(e.target.value)}
      />

      <input
        placeholder="Nachname"
        value={lastname}
        onChange={e => setLastname(e.target.value)}
      />

      <input
        placeholder="E-Mail"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Initiales Passwort"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <div style={{ marginTop: 12 }}>
        <button onClick={submit} disabled={saving}>
          Anlegen
        </button>
        <button onClick={onCancel} disabled={saving}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
