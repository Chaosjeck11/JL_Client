import { useState } from "react";
import type { Member } from "../types/member";
import { updateMember } from "../api/members";
import { canEditMembers } from "../auth/permissions";


type Props = {
  member: Member;
  onUpdated: (member: Member) => void;
};

export default function MemberDetail({ member, onUpdated }: Props) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Member>(member);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function change<K extends keyof Member>(key: K, value: Member[K]) {
    setForm({ ...form, [key]: value });
  }

  async function save() {
    try {
      setSaving(true);
      const updated = await updateMember(member.id, {
        firstname: form.firstname,
        lastname: form.lastname,
        email: form.email,
        active: form.active,
      });
      onUpdated(updated);
      setEdit(false);
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  if (!edit) {
    return (
      <div>
        <h3>{member.firstname} {member.lastname}</h3>
        <p><b>E-Mail:</b> {member.email}</p>
        <p><b>Status:</b> {member.active ? "aktiv" : "inaktiv"}</p>
        <p><b>Rolle:</b> {member.role?.name}</p>

          {canEditMembers() && (
            <button onClick={() => setEdit(true)}>
              Bearbeiten
            </button>
          )}

      </div>
    );
  }

  return (
    <div>
      <h3>Mitglied bearbeiten</h3>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>
        Vorname
        <input
          value={form.firstname}
          onChange={e => change("firstname", e.target.value)}
        />
      </label>

      <label>
        Nachname
        <input
          value={form.lastname}
          onChange={e => change("lastname", e.target.value)}
        />
      </label>

      <label>
        E-Mail
        <input
          value={form.email}
          onChange={e => change("email", e.target.value)}
        />
      </label>

      <label>
        Aktiv
        <input
          type="checkbox"
          checked={form.active}
          onChange={e => change("active", e.target.checked)}
        />
      </label>

      <div style={{ marginTop: 12 }}>
        <button onClick={save} disabled={saving}>
          Speichern
        </button>
        <button onClick={() => setEdit(false)} disabled={saving}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
