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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", padding: "4px 0", gap: 8, alignItems: "flex-start" }}>
      <span style={{ width: 155, flexShrink: 0, fontSize: 13, color: "#94a3b8", fontWeight: 500, paddingTop: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: "#1e293b" }}>{children}</span>
    </div>
  );
}

function Chip({ label, active }: { label: string; active: boolean }) {
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 600, marginRight: 6, marginBottom: 4,
      background: active ? "#dbeafe" : "#f1f5f9",
      color: active ? "#1d4ed8" : "#94a3b8",
    }}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    BEZAHLT:   { label: "Bezahlt",    bg: "#dcfce7", color: "#166534" },
    TEILWEISE: { label: "Teilweise",  bg: "#fef9c3", color: "#854d0e" },
    AUSSTEHEND:{ label: "Ausstehend", bg: "#fee2e2", color: "#991b1b" },
  };
  const s = map[status] ?? { label: status, bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
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

  // ── VIEW MODE ─────────────────────────────────────────────────────────────
  if (!edit) {
    return (
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
            background: member.active ? "#dbeafe" : "#f1f5f9",
            color: member.active ? "#1d4ed8" : "#94a3b8",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, overflow: "hidden",
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : `${member.firstname.charAt(0).toUpperCase()}${member.lastname.charAt(0).toUpperCase()}`}
          </div>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              {member.firstname} {member.lastname}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {member.role && (
                <span style={{
                  display: "inline-block", padding: "2px 8px", borderRadius: 20,
                  fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#475569",
                }}>
                  {member.role.name}
                </span>
              )}
              <span style={{
                display: "inline-block", padding: "2px 8px", borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: member.active ? "#dcfce7" : "#f1f5f9",
                color: member.active ? "#166534" : "#64748b",
              }}>
                {member.active ? "Aktiv" : "Inaktiv"}
              </span>
            </div>
          </div>
        </div>

        <SectionHeader label="Kontakt" />
        <InfoRow label="E-Mail">{member.email}</InfoRow>
        <InfoRow label="Adresse">{member.address ?? "–"}</InfoRow>
        <InfoRow label="Telefon">{member.phone ?? "–"}</InfoRow>
        <InfoRow label="Geburtstag">{fmt(member.birthday)}</InfoRow>

        <SectionHeader label="Mitgliedschaft" />
        <InfoRow label="Eingetreten am">{fmt(member.joinedAt)}</InfoRow>
        {!member.active && (
          <InfoRow label="Inaktiv seit">{fmt(member.inactiveSince)}</InfoRow>
        )}

        <SectionHeader label="Beitragskategorie" />
        <div style={{ paddingTop: 2 }}>
          <Chip label="Unter 18"               active={member.u18 ?? false} />
          <Chip label="Bereits Mitglied (KG)"  active={member.bereitsMitglied ?? false} />
          <Chip label="Schüler/Student/Azubi"  active={member.schuelerStudentAzubi ?? false} />
          <Chip label="Berufstätig"            active={member.berufstaetig ?? false} />
        </div>

        {member.mitgliedsbeitraege && member.mitgliedsbeitraege.length > 0 && (
          <>
            <SectionHeader label="Mitgliedsbeiträge" />
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th align="left"  style={{ padding: "5px 8px 5px 0", color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Jahr</th>
                  <th align="right" style={{ padding: "5px 4px",       color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>JL</th>
                  <th align="right" style={{ padding: "5px 4px",       color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>KG</th>
                  <th align="right" style={{ padding: "5px 4px",       color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Bez. JL</th>
                  <th align="right" style={{ padding: "5px 4px",       color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Bez. KG</th>
                  <th align="left"  style={{ padding: "5px 0 5px 8px", color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {member.mitgliedsbeitraege.map(b => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "6px 8px 6px 0", color: "#1e293b", fontWeight: 500 }}>{b.businessYear?.year ?? b.businessYearId}</td>
                    <td align="right" style={{ padding: "6px 4px", color: "#475569" }}>{b.betragJL} €</td>
                    <td align="right" style={{ padding: "6px 4px", color: "#475569" }}>{b.betragKG} €</td>
                    <td align="right" style={{ padding: "6px 4px", color: "#475569" }}>{b.bezahltJL} €</td>
                    <td align="right" style={{ padding: "6px 4px", color: "#475569" }}>{b.bezahltKG} €</td>
                    <td style={{ padding: "6px 0 6px 8px" }}><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {canEditMembers() && (
          <div style={{ marginTop: 20 }}>
            <button onClick={() => setEdit(true)} style={btnPrimary}>Bearbeiten</button>
          </div>
        )}
      </div>
    );
  }

  // ── EDIT MODE ─────────────────────────────────────────────────────────────
  return (
    <div>
      <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Mitglied bearbeiten</h3>
      {error && <p style={{ color: "#dc2626", margin: "0 0 10px", fontSize: 13 }}>{error}</p>}

      <SectionHeader label="Persönliche Daten" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FormField label="Vorname">
          <input value={form.firstname} onChange={e => set("firstname", e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Nachname">
          <input value={form.lastname} onChange={e => set("lastname", e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="E-Mail">
          <input type="email" value={form.email} onChange={e => set("email", e.target.value)} style={inputStyle} />
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
        <FormField label="Eingetreten am">
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
        <FormField label="Aktiv">
          <input type="checkbox" checked={form.active} onChange={e => set("active", e.target.checked)} style={{ cursor: "pointer" }} />
        </FormField>
        {!form.active && (
          <FormField label="Inaktiv seit">
            <input type="date" value={form.inactiveSince} onChange={e => set("inactiveSince", e.target.value)} style={{ ...inputStyle, flex: "unset" }} />
          </FormField>
        )}
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

      {yearSelectStep && (
        <div style={{
          marginTop: 16, padding: "14px 16px",
          background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8,
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>
            Beitragsrelevante Felder geändert – rückwirkend übernehmen für:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {yearSelectStep.years.map(y => (
              <label key={y.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "#1e293b" }}>
                <input
                  type="checkbox"
                  checked={yearSelectStep.selected.has(y.id)}
                  onChange={() => toggleYear(y.id)}
                />
                {y.year}
              </label>
            ))}
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#475569" }}>
            Nicht ausgewählte Jahre behalten ihren bisherigen Beitragssatz.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
              Jetzt speichern
            </button>
            <button onClick={() => setYearSelectStep(null)} disabled={saving} style={{ ...btnSecondary, opacity: saving ? 0.6 : 1 }}>
              Zurück
            </button>
          </div>
        </div>
      )}

      {!yearSelectStep && (
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
            Speichern
          </button>
          <button onClick={cancelEdit} disabled={saving} style={{ ...btnSecondary, opacity: saving ? 0.6 : 1 }}>
            Abbrechen
          </button>
        </div>
      )}
    </div>
  );
}
