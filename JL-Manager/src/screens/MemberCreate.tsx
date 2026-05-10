import { useState } from "react";
import { createMember } from "../api/members";
import type { Member, Role } from "../types/member";

type Props = {
  roles: Role[];
  onCreated: (member: Member) => void;
  onCancel: () => void;
};

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "#94a3b8",
      textTransform: "uppercase" as const, letterSpacing: "0.07em",
      margin: "18px 0 8px", paddingBottom: 6, borderBottom: "1px solid #e2e8f0",
    }}>
      {label}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 170, flexShrink: 0, fontSize: 13, color: "#475569" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: "6px 10px", borderRadius: 6,
  border: "1px solid #d1d5db", fontSize: 13,
};

const btnPrimary: React.CSSProperties = {
  background: "#2563eb", color: "#fff", border: "none",
  borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  background: "#fff", color: "#374151", border: "1px solid #d1d5db",
  borderRadius: 7, padding: "8px 18px", fontSize: 13, cursor: "pointer",
};

export default function MemberCreate({ roles, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    email: "",
    address: "",
    phone: "",
    birthday: "",
    joinedAt: new Date().toISOString().slice(0, 10),
    roleId: roles.length > 0 ? roles[0].id : 1,
    u18: false,
    bereitsMitglied: false,
    schuelerStudentAzubi: false,
    berufstaetig: false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const generatedPassword = `${form.firstname}.${form.lastname}`.toLowerCase();

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.firstname || !form.lastname || !form.email) {
      setError("Vorname, Nachname und E-Mail sind Pflichtfelder");
      return;
    }
    try {
      setSaving(true);
      const member = await createMember({
        firstname: form.firstname,
        lastname: form.lastname,
        email: form.email,
        password: generatedPassword,
        roleId: form.roleId,
        address: form.address || null,
        phone: form.phone || null,
        birthday: form.birthday || null,
        joinedAt: form.joinedAt || null,
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
      <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Neues Mitglied</h3>
      {error && <p style={{ color: "#dc2626", margin: "0 0 10px", fontSize: 13 }}>{error}</p>}

      <SectionHeader label="Persönliche Daten" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FormField label="Vorname *">
          <input value={form.firstname} onChange={e => set("firstname", e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Nachname *">
          <input value={form.lastname} onChange={e => set("lastname", e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="E-Mail *">
          <input type="email" value={form.email} onChange={e => set("email", e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Initiales Passwort">
          <input
            readOnly
            value={form.firstname && form.lastname ? generatedPassword : ""}
            placeholder="wird aus Vor- und Nachname generiert"
            style={{ ...inputStyle, background: "#f8fafc", color: "#64748b", cursor: "default" }}
          />
        </FormField>
        <FormField label="Adresse">
          <input value={form.address} onChange={e => set("address", e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Telefon">
          <input value={form.phone} onChange={e => set("phone", e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Geburtstag">
          <input type="date" value={form.birthday} onChange={e => set("birthday", e.target.value)} style={{ ...inputStyle, flex: "unset" }} />
        </FormField>
      </div>

      <SectionHeader label="Mitgliedschaft" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FormField label="Beitrittsdatum">
          <input type="date" value={form.joinedAt} onChange={e => set("joinedAt", e.target.value)} style={{ ...inputStyle, flex: "unset" }} />
        </FormField>
        <FormField label="Rolle">
          {roles.length > 0 ? (
            <select value={form.roleId} onChange={e => set("roleId", Number(e.target.value))} style={{ ...inputStyle }}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          ) : (
            <input type="number" value={form.roleId} onChange={e => set("roleId", Number(e.target.value))} style={{ ...inputStyle, width: 80, flex: "unset" }} />
          )}
        </FormField>
      </div>

      <SectionHeader label="Beitragskategorie" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FormField label="Unter 18">
          <input type="checkbox" checked={form.u18} onChange={e => set("u18", e.target.checked)} style={{ cursor: "pointer" }} />
        </FormField>
        <FormField label="Bereits Mitglied (KG)">
          <input type="checkbox" checked={form.bereitsMitglied} onChange={e => set("bereitsMitglied", e.target.checked)} style={{ cursor: "pointer" }} />
        </FormField>
        <FormField label="Schüler/Student/Azubi">
          <input type="checkbox" checked={form.schuelerStudentAzubi} onChange={e => set("schuelerStudentAzubi", e.target.checked)} style={{ cursor: "pointer" }} />
        </FormField>
        <FormField label="Berufstätig">
          <input type="checkbox" checked={form.berufstaetig} onChange={e => set("berufstaetig", e.target.checked)} style={{ cursor: "pointer" }} />
        </FormField>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
          Anlegen
        </button>
        <button onClick={onCancel} disabled={saving} style={{ ...btnSecondary, opacity: saving ? 0.6 : 1 }}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
