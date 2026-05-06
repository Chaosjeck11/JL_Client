import { useState } from "react";
import type { Member, Role } from "../types/member";
import type { BusinessYear } from "../types/finance";
import { updateMember } from "../api/members";
import { fetchBusinessYears } from "../api/finance";
import { canEditMembers } from "../auth/permissions";

const API_BASE = "http://100.91.210.125:3000";

type Props = {
  member: Member;
  roles: Role[];
  onUpdated: (member: Member) => void;
};

function fmt(dateStr?: string | null): string {
  if (!dateStr) return "–";
  return new Date(dateStr).toLocaleDateString("de-DE");
}

function toDateInput(dateStr?: string | null): string {
  if (!dateStr) return "";
  return dateStr.substring(0, 10);
}

function statusLabel(status: string): string {
  if (status === "BEZAHLT") return "Bezahlt";
  if (status === "TEILWEISE") return "Teilweise";
  return "Ausstehend";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: "3px 12px 3px 0", fontWeight: 600, width: 190, fontSize: 13, verticalAlign: "top", color: "#555" }}>
        {label}
      </td>
      <td style={{ padding: "3px 0", fontSize: 13 }}>{value}</td>
    </tr>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 190, flexShrink: 0, fontSize: 13, color: "#555" }}>{label}</span>
      {children}
    </label>
  );
}

type FormState = {
  firstname: string;
  lastname: string;
  email: string;
  address: string;
  phone: string;
  birthday: string;
  joinedAt: string;
  roleId: number;
  active: boolean;
  inactiveSince: string;
  u18: boolean;
  bereitsMitglied: boolean;
  schuelerStudentAzubi: boolean;
  berufstaetig: boolean;
};

function memberToForm(m: Member): FormState {
  return {
    firstname: m.firstname,
    lastname: m.lastname,
    email: m.email,
    address: m.address ?? "",
    phone: m.phone ?? "",
    birthday: toDateInput(m.birthday),
    joinedAt: toDateInput(m.joinedAt),
    roleId: m.roleId ?? m.role?.id ?? 1,
    active: m.active,
    inactiveSince: toDateInput(m.inactiveSince),
    u18: m.u18 ?? false,
    bereitsMitglied: m.bereitsMitglied ?? false,
    schuelerStudentAzubi: m.schuelerStudentAzubi ?? false,
    berufstaetig: m.berufstaetig ?? false,
  };
}

const BEITRAGSRELEVANT: (keyof FormState)[] = ["u18", "bereitsMitglied", "schuelerStudentAzubi"];

type YearSelectStep = {
  years: BusinessYear[];
  selected: Set<number>;
};

export default function MemberDetail({ member, roles, onUpdated }: Props) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<FormState>(() => memberToForm(member));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [yearSelectStep, setYearSelectStep] = useState<YearSelectStep | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function cancelEdit() {
    setForm(memberToForm(member));
    setError("");
    setYearSelectStep(null);
    setEdit(false);
  }

  function beitragsrelevantChanged(): boolean {
    const orig = memberToForm(member);
    return BEITRAGSRELEVANT.some(k => form[k] !== orig[k]);
  }

  async function save() {
    if (beitragsrelevantChanged() && yearSelectStep === null) {
      setSaving(true);
      try {
        const years = await fetchBusinessYears();
        years.sort((a, b) => b.year - a.year);
        setYearSelectStep({ years, selected: new Set(years.map(y => y.id)) });
      } catch {
        setError("Geschäftsjahre konnten nicht geladen werden");
      } finally {
        setSaving(false);
      }
      return;
    }
    await doSave(yearSelectStep ? [...yearSelectStep.selected] : undefined);
  }

  async function doSave(retroactiveYearIds?: number[]) {
    try {
      setSaving(true);
      const body: Record<string, unknown> = {
        firstname: form.firstname,
        lastname: form.lastname,
        email: form.email,
        address: form.address || null,
        phone: form.phone || null,
        birthday: form.birthday || null,
        joinedAt: form.joinedAt || undefined,
        roleId: form.roleId,
        active: form.active,
        inactiveSince: form.active ? null : (form.inactiveSince || null),
        u18: form.u18,
        bereitsMitglied: form.bereitsMitglied,
        schuelerStudentAzubi: form.schuelerStudentAzubi,
        berufstaetig: form.berufstaetig,
      };
      if (retroactiveYearIds !== undefined) {
        body.retroactiveYearIds = retroactiveYearIds;
      }
      const updated = await updateMember(member.id, body);
      onUpdated(updated);
      setYearSelectStep(null);
      setEdit(false);
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  function toggleYear(id: number) {
    setYearSelectStep(prev => {
      if (!prev) return prev;
      const next = new Set(prev.selected);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, selected: next };
    });
  }

  const avatarUrl = member.avatarPath ? `${API_BASE}/${member.avatarPath}` : null;

  if (!edit) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "#4a90d9", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: "bold", overflow: "hidden", flexShrink: 0,
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : member.firstname.charAt(0).toUpperCase()}
          </div>
          <h3 style={{ margin: 0 }}>{member.firstname} {member.lastname}</h3>
        </div>

        <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 12 }}>
          <tbody>
            <Row label="E-Mail" value={member.email} />
            <Row label="Adresse" value={member.address ?? "–"} />
            <Row label="Telefon" value={member.phone ?? "–"} />
            <Row label="Geburtstag" value={fmt(member.birthday)} />
            <Row label="Rolle" value={member.role?.name ?? "–"} />
            <Row label="Eingetreten am" value={fmt(member.joinedAt)} />
            <Row label="Status" value={member.active ? "aktiv" : "inaktiv"} />
            {!member.active && <Row label="Inaktiv seit" value={fmt(member.inactiveSince)} />}
            <Row label="Unter 18" value={(member.u18 ?? false) ? "Ja" : "Nein"} />
            <Row label="Bereits Mitglied (KG)" value={(member.bereitsMitglied ?? false) ? "Ja" : "Nein"} />
            <Row label="Schüler/Student/Azubi" value={(member.schuelerStudentAzubi ?? false) ? "Ja" : "Nein"} />
            <Row label="Berufstätig" value={(member.berufstaetig ?? false) ? "Ja" : "Nein"} />
          </tbody>
        </table>

        {member.mitgliedsbeitraege && member.mitgliedsbeitraege.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <b style={{ fontSize: 13 }}>Mitgliedsbeiträge</b>
            <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 6, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ccc", color: "#555" }}>
                  <th align="left" style={{ padding: "2px 8px 2px 0" }}>Jahr</th>
                  <th align="right" style={{ padding: "2px 4px" }}>JL</th>
                  <th align="right" style={{ padding: "2px 4px" }}>KG</th>
                  <th align="right" style={{ padding: "2px 4px" }}>Bez. JL</th>
                  <th align="right" style={{ padding: "2px 4px" }}>Bez. KG</th>
                  <th align="left" style={{ padding: "2px 0 2px 8px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {member.mitgliedsbeitraege.map(b => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "2px 8px 2px 0" }}>{b.businessYear?.year ?? b.businessYearId}</td>
                    <td align="right" style={{ padding: "2px 4px" }}>{b.betragJL} €</td>
                    <td align="right" style={{ padding: "2px 4px" }}>{b.betragKG} €</td>
                    <td align="right" style={{ padding: "2px 4px" }}>{b.bezahltJL} €</td>
                    <td align="right" style={{ padding: "2px 4px" }}>{b.bezahltKG} €</td>
                    <td style={{ padding: "2px 0 2px 8px" }}>{statusLabel(b.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canEditMembers() && (
          <button onClick={() => setEdit(true)}>Bearbeiten</button>
        )}
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Mitglied bearbeiten</h3>
      {error && <p style={{ color: "red", margin: "0 0 8px" }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FormField label="Vorname">
          <input value={form.firstname} onChange={e => set("firstname", e.target.value)} style={{ flex: 1 }} />
        </FormField>
        <FormField label="Nachname">
          <input value={form.lastname} onChange={e => set("lastname", e.target.value)} style={{ flex: 1 }} />
        </FormField>
        <FormField label="E-Mail">
          <input type="email" value={form.email} onChange={e => set("email", e.target.value)} style={{ flex: 1 }} />
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
        <FormField label="Eingetreten am">
          <input type="date" value={form.joinedAt} onChange={e => set("joinedAt", e.target.value)} />
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
        <FormField label="Aktiv">
          <input type="checkbox" checked={form.active} onChange={e => set("active", e.target.checked)} />
        </FormField>
        {!form.active && (
          <FormField label="Inaktiv seit">
            <input type="date" value={form.inactiveSince} onChange={e => set("inactiveSince", e.target.value)} />
          </FormField>
        )}
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

      {yearSelectStep && (
        <div style={{ marginTop: 16, padding: "12px 14px", background: "#f5f8ff", border: "1px solid #c8d8f0", borderRadius: 6 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>
            Beitragsrelevante Felder geändert – rückwirkend übernehmen für:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
            {yearSelectStep.years.map(y => (
              <label key={y.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={yearSelectStep.selected.has(y.id)}
                  onChange={() => toggleYear(y.id)}
                />
                {y.year}
              </label>
            ))}
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#666" }}>
            Nicht ausgewählte Jahre behalten ihren bisherigen Beitragssatz.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving}>Jetzt speichern</button>
            <button onClick={() => setYearSelectStep(null)} disabled={saving}>Zurück</button>
          </div>
        </div>
      )}

      {!yearSelectStep && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={save} disabled={saving}>Speichern</button>
          <button onClick={cancelEdit} disabled={saving}>Abbrechen</button>
        </div>
      )}
    </div>
  );
}
