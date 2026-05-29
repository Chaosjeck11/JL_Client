import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Member, MemberAttachment, Role } from "../types/member";
import type { BusinessYear } from "../types/finance";
import { updateMember, fetchMemberAttachments, uploadMemberAttachment, downloadMemberAttachment, deleteMemberAttachment, fetchMemberAttachmentBlob } from "../api/members";
import { fetchBusinessYears } from "../api/finance";
import { canEditMembers, canWriteMemberAttachments } from "../auth/permissions";
import AttachmentViewer from "../components/AttachmentViewer";
import { getApiUrl } from "../api/client";

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
      fontSize: 11, fontWeight: 700, color: "var(--c-text-3)",
      textTransform: "uppercase" as const, letterSpacing: "0.07em",
      margin: "18px 0 8px", paddingBottom: 6, borderBottom: "1px solid var(--c-border)",
    }}>
      {label}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", padding: "4px 0", gap: 8, alignItems: "flex-start" }}>
      <span style={{ width: 155, flexShrink: 0, fontSize: 13, color: "var(--c-text-3)", fontWeight: 500, paddingTop: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--c-text)" }}>{children}</span>
    </div>
  );
}

function Chip({ label, active }: { label: string; active: boolean }) {
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 600, marginRight: 6, marginBottom: 4,
      background: active ? "#dbeafe" : "var(--c-bg-3)",
      color: active ? "#1d4ed8" : "var(--c-text-3)",
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
  const s = map[status] ?? { label: status, bg: "var(--c-bg-3)", color: "var(--c-text-2)" };
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

const BEITRAGSRELEVANT: (keyof FormState)[] = ["u18", "bereitsMitglied", "schuelerStudentAzubi", "joinedAt"];

type YearSelectStep = {
  years: BusinessYear[];
  selected: Set<number>;
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MemberDetail({ member, roles, onUpdated }: Props) {
  const queryClient = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<FormState>(() => memberToForm(member));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [yearSelectStep, setYearSelectStep] = useState<YearSelectStep | null>(null);

  const [attachUploading, setAttachUploading] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [preview, setPreview] = useState<{ attachment: MemberAttachment; url: string; mimeType: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef(preview);
  useEffect(() => { previewRef.current = preview; });
  useEffect(() => {
    return () => { if (previewRef.current?.url) URL.revokeObjectURL(previewRef.current.url); };
  }, []);

  const { data: attachments = [] } = useQuery({
    queryKey: ["member-attachments", member.id],
    queryFn: () => fetchMemberAttachments(member.id),
  });

  async function openPreview(a: MemberAttachment) {
    if (preview?.attachment.id === a.id) { closePreview(); return; }
    if (preview) URL.revokeObjectURL(preview.url);
    setPreviewLoading(a.id);
    try {
      const { url, mimeType } = await fetchMemberAttachmentBlob(member.id, a.id);
      setPreview({ attachment: a, url, mimeType });
    } catch {
      setAttachError("Vorschau fehlgeschlagen");
    } finally {
      setPreviewLoading(null);
    }
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function handleUpload(files: FileList) {
    setAttachUploading(true);
    setAttachError("");
    try {
      for (const file of Array.from(files)) {
        await uploadMemberAttachment(member.id, file);
      }
      queryClient.invalidateQueries({ queryKey: ["member-attachments", member.id] });
    } catch {
      setAttachError("Upload fehlgeschlagen");
    } finally {
      setAttachUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAttachment(aid: number) {
    if (!confirm("Anhang löschen?")) return;
    try {
      await deleteMemberAttachment(member.id, aid);
      queryClient.invalidateQueries({ queryKey: ["member-attachments", member.id] });
      if (preview?.attachment.id === aid) closePreview();
    } catch {
      setAttachError("Löschen fehlgeschlagen");
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function cancelEdit() {
    setForm(memberToForm(member));
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setYearSelectStep(null);
    setEdit(false);
  }

  function beitragsrelevantChanged(): boolean {
    const orig = memberToForm(member);
    return BEITRAGSRELEVANT.some(k => form[k] !== orig[k]);
  }

  async function save() {
    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        setError("Passwörter stimmen nicht überein");
        return;
      }
      if (newPassword.length < 6) {
        setError("Passwort muss mindestens 6 Zeichen lang sein");
        return;
      }
    }
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
      if (newPassword) body.password = newPassword;
      const updated = await updateMember(member.id, body);
      onUpdated(updated);
      setNewPassword("");
      setConfirmPassword("");
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

  const avatarUrl = member.avatarPath ? `${getApiUrl()}/${member.avatarPath}` : null;

  // ── VIEW MODE ─────────────────────────────────────────────────────────────
  if (!edit) {
    return (
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
            background: member.active ? "#dbeafe" : "var(--c-bg-3)",
            color: member.active ? "#1d4ed8" : "var(--c-text-3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, overflow: "hidden",
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : `${member.firstname.charAt(0).toUpperCase()}${member.lastname.charAt(0).toUpperCase()}`}
          </div>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>
              {member.firstname} {member.lastname}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {member.role && (
                <span style={{
                  display: "inline-block", padding: "2px 8px", borderRadius: 20,
                  fontSize: 11, fontWeight: 600, background: "var(--c-bg-3)", color: "var(--c-text-2)",
                }}>
                  {member.role.name}
                </span>
              )}
              <span style={{
                display: "inline-block", padding: "2px 8px", borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: member.active ? "#dcfce7" : "var(--c-bg-3)",
                color: member.active ? "#166534" : "var(--c-text-2)",
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
                <tr style={{ borderBottom: "1px solid var(--c-border)" }}>
                  <th align="left"  style={{ padding: "5px 8px 5px 0", color: "var(--c-text-3)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Jahr</th>
                  <th align="right" style={{ padding: "5px 4px",       color: "var(--c-text-3)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>JL</th>
                  <th align="right" style={{ padding: "5px 4px",       color: "var(--c-text-3)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>KG</th>
                  <th align="right" style={{ padding: "5px 4px",       color: "var(--c-text-3)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Bez. JL</th>
                  <th align="right" style={{ padding: "5px 4px",       color: "var(--c-text-3)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Bez. KG</th>
                  <th align="left"  style={{ padding: "5px 0 5px 8px", color: "var(--c-text-3)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {member.mitgliedsbeitraege.map(b => (
                  <tr key={b.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
                    <td style={{ padding: "6px 8px 6px 0", color: "var(--c-text)", fontWeight: 500 }}>{b.businessYear?.year ?? b.businessYearId}</td>
                    <td align="right" style={{ padding: "6px 4px", color: "var(--c-text-2)" }}>{b.betragJL} €</td>
                    <td align="right" style={{ padding: "6px 4px", color: "var(--c-text-2)" }}>{b.betragKG} €</td>
                    <td align="right" style={{ padding: "6px 4px", color: "var(--c-text-2)" }}>{b.bezahltJL} €</td>
                    <td align="right" style={{ padding: "6px 4px", color: "var(--c-text-2)" }}>{b.bezahltKG} €</td>
                    <td style={{ padding: "6px 0 6px 8px" }}><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <SectionHeader label={`Anhänge${attachments.length > 0 ? ` (${attachments.length})` : ""}`} />

        {attachError && (
          <div style={{ padding: "6px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 12, marginBottom: 8 }}>
            {attachError}
          </div>
        )}

        {attachments.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--c-text-3)", marginBottom: 8 }}>Keine Anhänge</div>
        )}

        {attachments.map(a => {
          const isActive = preview?.attachment.id === a.id;
          const isLoading = previewLoading === a.id;
          return (
            <div
              key={a.id}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                borderBottom: "1px solid var(--c-border)", borderRadius: 6,
                background: isActive ? "#eff6ff" : "transparent",
              }}
            >
              <button
                onClick={() => openPreview(a)}
                title="Vorschau"
                style={{
                  flex: 1, textAlign: "left", background: "none", border: "none", padding: 0,
                  fontSize: 13, color: isActive ? "#1d4ed8" : "var(--c-text)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  cursor: "pointer", fontWeight: isActive ? 600 : 400,
                }}
              >
                {isLoading ? "Lädt…" : a.filename}
              </button>
              <span style={{ fontSize: 12, color: "var(--c-text-3)", whiteSpace: "nowrap" }}>{fmtSize(a.size)}</span>
              <button
                onClick={e => { e.stopPropagation(); downloadMemberAttachment(member.id, a.id, a.filename); }}
                title="Herunterladen"
                style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--c-border)", background: "var(--c-bg)", fontSize: 12, cursor: "pointer", color: "var(--c-text-2)" }}
              >
                ↓
              </button>
              {canWriteMemberAttachments() && (
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteAttachment(a.id); }}
                  title="Löschen"
                  style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, cursor: "pointer" }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        {canWriteMemberAttachments() && (
          <div style={{ marginTop: 8 }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={e => e.target.files && handleUpload(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={attachUploading}
              style={{
                padding: "6px 14px", borderRadius: 6, border: "1px dashed var(--c-text-3)",
                background: "var(--c-bg-2)", fontSize: 13, cursor: attachUploading ? "not-allowed" : "pointer",
                color: "var(--c-text-2)", opacity: attachUploading ? 0.6 : 1,
              }}
            >
              {attachUploading ? "Wird hochgeladen…" : "+ Anhang hinzufügen"}
            </button>
          </div>
        )}

        {canEditMembers() && (
          <div style={{ marginTop: 20 }}>
            <button onClick={() => setEdit(true)} style={btnPrimary}>Bearbeiten</button>
          </div>
        )}

        {preview && <AttachmentViewer
          filename={preview.attachment.filename}
          url={preview.url}
          mimeType={preview.mimeType}
          onDownload={() => downloadMemberAttachment(member.id, preview.attachment.id, preview.attachment.filename)}
          onClose={closePreview}
        />}
      </div>
    );
  }

  // ── EDIT MODE ─────────────────────────────────────────────────────────────
  return (
    <div>
      <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>Mitglied bearbeiten</h3>
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

      <SectionHeader label="Passwort ändern" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FormField label="Neues Passwort">
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Leer lassen = kein Wechsel"
            style={inputStyle}
          />
        </FormField>
        <FormField label="Passwort bestätigen">
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Passwort wiederholen"
            style={inputStyle}
          />
        </FormField>
      </div>

      {yearSelectStep && (
        <div style={{
          marginTop: 16, padding: "14px 16px",
          background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8,
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>
            Beitragsrelevante Änderung – rückwirkend übernehmen für:
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
