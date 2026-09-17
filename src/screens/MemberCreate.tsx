import { useState } from "react";
import { createMember } from "../api/members";
import type { Member, Role } from "../types/member";
import type { MemberAttributeDefinition } from "../types/memberAttributes";

type Props = {
  roles: Role[];
  attrDefs: MemberAttributeDefinition[];
  onCreated: (member: Member) => void;
  onCancel: () => void;
};

function defaultAttributes(defs: MemberAttributeDefinition[]): Record<number, string> {
  const attrs: Record<number, string> = {};
  for (const d of defs) attrs[d.id] = d.type === "BOOLEAN" ? "false" : "";
  return attrs;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "var(--c-text-3)",
      textTransform: "uppercase" as const, letterSpacing: "0.07em",
      margin: "18px 0 8px", paddingBottom: 6, borderBottom: "1px solid var(--c-border)",
    }}>
      {label}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 170, flexShrink: 0, fontSize: 13, color: "var(--c-text-2)" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: "6px 10px", borderRadius: 6,
  border: "1px solid var(--c-border)", fontSize: 13,
  background: "var(--c-bg)", color: "var(--c-text)",
};

const btnPrimary: React.CSSProperties = {
  background: "#2563eb", color: "#fff", border: "none",
  borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  background: "var(--c-bg)", color: "var(--c-text-2)", border: "1px solid var(--c-border)",
  borderRadius: 7, padding: "8px 18px", fontSize: 13, cursor: "pointer",
};

export default function MemberCreate({ roles, attrDefs, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    email: "",
    address: "",
    phone: "",
    birthday: "",
    joinedAt: new Date().toISOString().slice(0, 10),
    roleId: roles.length > 0 ? roles[0].id : 1,
    attributes: defaultAttributes(attrDefs),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const generatedPassword = `${form.firstname}.${form.lastname}`.toLowerCase();

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function setAttr(defId: number, value: string) {
    setForm(f => ({ ...f, attributes: { ...f.attributes, [defId]: value } }));
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
        attributes: form.attributes,
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
      <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>Neues Mitglied</h3>
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
            style={{ ...inputStyle, background: "var(--c-bg-2)", color: "var(--c-text-2)", cursor: "default" }}
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

      {attrDefs.length > 0 && (
        <>
          <SectionHeader label="Beitragskategorie" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {attrDefs.map(d => (
              <FormField key={d.id} label={d.label}>
                {d.type === "BOOLEAN" ? (
                  <input
                    type="checkbox"
                    checked={form.attributes[d.id] === "true"}
                    onChange={e => setAttr(d.id, e.target.checked ? "true" : "false")}
                    style={{ cursor: "pointer" }}
                  />
                ) : d.type === "NUMBER" ? (
                  <input type="number" value={form.attributes[d.id] ?? ""} onChange={e => setAttr(d.id, e.target.value)} style={{ ...inputStyle, flex: "unset", width: 120 }} />
                ) : d.type === "SELECT" ? (
                  <select value={form.attributes[d.id] ?? ""} onChange={e => setAttr(d.id, e.target.value)} style={inputStyle}>
                    <option value="">–</option>
                    {(d.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input value={form.attributes[d.id] ?? ""} onChange={e => setAttr(d.id, e.target.value)} style={inputStyle} />
                )}
              </FormField>
            ))}
          </div>
        </>
      )}

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
