import { useState } from "react";
import { createMember } from "../api/members";
import type { Member, Role } from "../types/member";

type Props = {
  roles: Role[];
  onCreated: (member: Member) => void;
  onCancel: () => void;
};

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 190, flexShrink: 0, fontSize: 13, color: "#555" }}>{label}</span>
      {children}
    </label>
  );
}

export default function MemberCreate({ roles, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    address: "",
    phone: "",
    birthday: "",
    roleId: roles.length > 0 ? roles[0].id : 1,
    u18: false,
    bereitsMitglied: false,
    schuelerStudentAzubi: false,
    berufstaetig: false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.firstname || !form.lastname || !form.email || !form.password) {
      setError("Vorname, Nachname, E-Mail und Passwort sind Pflichtfelder");
      return;
    }
    try {
      setSaving(true);
      const member = await createMember({
        firstname: form.firstname,
        lastname: form.lastname,
        email: form.email,
        password: form.password,
        roleId: form.roleId,
        address: form.address || null,
        phone: form.phone || null,
        birthday: form.birthday || null,
        u18: form.u18,
        bereitsMitglied: form.bereitsMitglied,
        schuelerStudentAzubi: form.schuelerStudentAzubi,
        berufstaetig: form.berufstaetig,
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
      <h3 style={{ marginTop: 0 }}>Neues Mitglied</h3>
      {error && <p style={{ color: "red", margin: "0 0 8px" }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FormField label="Vorname *">
          <input value={form.firstname} onChange={e => set("firstname", e.target.value)} style={{ flex: 1 }} />
        </FormField>
        <FormField label="Nachname *">
          <input value={form.lastname} onChange={e => set("lastname", e.target.value)} style={{ flex: 1 }} />
        </FormField>
        <FormField label="E-Mail *">
          <input type="email" value={form.email} onChange={e => set("email", e.target.value)} style={{ flex: 1 }} />
        </FormField>
        <FormField label="Initiales Passwort *">
          <input type="password" value={form.password} onChange={e => set("password", e.target.value)} style={{ flex: 1 }} />
        </FormField>
        <FormField label="Adresse">
          <input value={form.address} onChange={e => set("address", e.target.value)} style={{ flex: 1 }} />
        </FormField>
        <FormField label="Telefon">
          <input value={form.phone} onChange={e => set("phone", e.target.value)} style={{ flex: 1 }} />
        </FormField>
        <FormField label="Geburtstag">
          <input type="date" value={form.birthday} onChange={e => set("birthday", e.target.value)} />
        </FormField>
        <FormField label="Rolle">
          {roles.length > 0 ? (
            <select value={form.roleId} onChange={e => set("roleId", Number(e.target.value))}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          ) : (
            <input type="number" value={form.roleId} onChange={e => set("roleId", Number(e.target.value))} style={{ width: 80 }} />
          )}
        </FormField>
        <FormField label="Unter 18">
          <input type="checkbox" checked={form.u18} onChange={e => set("u18", e.target.checked)} />
        </FormField>
        <FormField label="Bereits Mitglied (KG)">
          <input type="checkbox" checked={form.bereitsMitglied} onChange={e => set("bereitsMitglied", e.target.checked)} />
        </FormField>
        <FormField label="Schüler/Student/Azubi">
          <input type="checkbox" checked={form.schuelerStudentAzubi} onChange={e => set("schuelerStudentAzubi", e.target.checked)} />
        </FormField>
        <FormField label="Berufstätig">
          <input type="checkbox" checked={form.berufstaetig} onChange={e => set("berufstaetig", e.target.checked)} />
        </FormField>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={saving}>Anlegen</button>
        <button onClick={onCancel} disabled={saving}>Abbrechen</button>
      </div>
    </div>
  );
}
