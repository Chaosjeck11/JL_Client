import { useRef, useState } from "react";
import type { Member } from "../types/member";
import { updateMember, uploadAvatar, deleteAvatar } from "../api/members";

const API_BASE = "http://DEPLOY_SERVER_IP:3000";

type Props = {
  member: Member;
  onClose: () => void;
  onUpdated: (member: Member) => void;
  onAvatarChanged?: (member: Member) => void;
};

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 180, flexShrink: 0, fontSize: 13, color: "#555" }}>{label}</span>
      {children}
    </label>
  );
}

export default function ProfileModal({ member, onClose, onUpdated, onAvatarChanged }: Props) {
  const [localAvatarPath, setLocalAvatarPath] = useState(member.avatarPath ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    firstname: member.firstname,
    lastname: member.lastname,
    email: member.email,
    address: member.address ?? "",
    phone: member.phone ?? "",
    birthday: member.birthday ? member.birthday.substring(0, 10) : "",
    u18: member.u18 ?? false,
    bereitsMitglied: member.bereitsMitglied ?? false,
    schuelerStudentAzubi: member.schuelerStudentAzubi ?? false,
    berufstaetig: member.berufstaetig ?? false,
  });
  const [pwForm, setPwForm] = useState({ newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function save() {
    if (pwForm.newPassword || pwForm.confirmPassword) {
      if (pwForm.newPassword !== pwForm.confirmPassword) {
        setError("Passwörter stimmen nicht überein");
        return;
      }
      if (pwForm.newPassword.length < 6) {
        setError("Passwort muss mindestens 6 Zeichen lang sein");
        return;
      }
    }
    try {
      setSaving(true);
      const body: Record<string, unknown> = {
        firstname: form.firstname,
        lastname: form.lastname,
        email: form.email,
        address: form.address || null,
        phone: form.phone || null,
        birthday: form.birthday || null,
        u18: form.u18,
        bereitsMitglied: form.bereitsMitglied,
        schuelerStudentAzubi: form.schuelerStudentAzubi,
        berufstaetig: form.berufstaetig,
      };
      if (pwForm.newPassword) body.password = pwForm.newPassword;
      const updated = await updateMember(member.id, body);
      onUpdated(updated);
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  const avatarUrl = localAvatarPath ? `${API_BASE}/${localAvatarPath}` : null;

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUploading(true);
      setError("");
      const updated = await uploadAvatar(member.id, file);
      setLocalAvatarPath(updated.avatarPath ?? null);
      onAvatarChanged?.(updated);
    } catch {
      setError("Avatar-Upload fehlgeschlagen");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarDelete() {
    try {
      setAvatarUploading(true);
      setError("");
      await deleteAvatar(member.id);
      setLocalAvatarPath(null);
      onAvatarChanged?.({ ...member, avatarPath: null });
    } catch {
      setError("Avatar löschen fehlgeschlagen");
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 8, padding: 24,
        minWidth: 380, maxWidth: 500, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarFile}
            />
            <div
              onClick={() => !avatarUploading && fileInputRef.current?.click()}
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
              title="Bild hochladen"
              style={{
                width: 60, height: 60, borderRadius: "50%",
                background: "#4a90d9", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: "bold", overflow: "hidden",
                cursor: avatarUploading ? "default" : "pointer",
                position: "relative",
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : member.firstname.charAt(0).toUpperCase()}
              {(avatarHover || avatarUploading) && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: "rgba(0,0,0,0.45)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>
                  {avatarUploading ? "⏳" : "📷"}
                </div>
              )}
            </div>
            {localAvatarPath && !avatarUploading && (
              <button
                onClick={handleAvatarDelete}
                style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                  border: "1px solid #fca5a5", background: "#fff5f5",
                  color: "#dc2626", cursor: "pointer",
                }}
              >
                Löschen
              </button>
            )}
          </div>
          <h3 style={{ margin: 0 }}>Mein Profil</h3>
        </div>

        {error && <p style={{ color: "red", margin: "0 0 8px" }}>{error}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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

        <div style={{
          marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Passwort ändern
          </div>
          <FormField label="Neues Passwort">
            <input
              type="password"
              value={pwForm.newPassword}
              onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
              placeholder="Leer lassen = kein Wechsel"
              style={{ flex: 1 }}
            />
          </FormField>
          <FormField label="Passwort bestätigen">
            <input
              type="password"
              value={pwForm.confirmPassword}
              onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="Passwort wiederholen"
              style={{ flex: 1 }}
            />
          </FormField>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={save} disabled={saving}>Speichern</button>
          <button onClick={onClose} disabled={saving}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
