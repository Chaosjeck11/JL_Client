import { useState } from "react";
import { createTransaction } from "../api/finance";
import type { BusinessYear, Category, Transaction } from "../types/finance";
import type { Member } from "../types/member";

type Props = {
  businessYears: BusinessYear[];
  defaultBusinessYearId: number | null;
  categories: Category[];
  members: Member[];
  onCreated: (transaction: Transaction) => void;
  onCancel: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db",
  fontSize: 14, background: "#fff", width: "100%", boxSizing: "border-box",
};

function businessYearForDate(dateStr: string, years: BusinessYear[]): number | null {
  const parts = dateStr.split("-");
  if (parts.length < 2) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  // GJ Y läuft Feb Y – Jan Y+1; Januar gehört also noch zu GJ des Vorjahres
  const gjYear = m === 1 ? y - 1 : y;
  return years.find(by => by.year === gjYear)?.id ?? null;
}

export default function TransactionCreate({
  businessYears,
  defaultBusinessYearId,
  categories,
  members,
  onCreated,
  onCancel,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"EINZAHLUNG" | "AUSZAHLUNG">("EINZAHLUNG");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [businessYearId, setBusinessYearId] = useState<number>(
    defaultBusinessYearId ?? businessYears[0]?.id ?? 0,
  );

  function handleDateChange(newDate: string) {
    setDate(newDate);
    if (newDate) {
      const matched = businessYearForDate(newDate, businessYears);
      if (matched !== null) setBusinessYearId(matched);
    }
  }
  const [memberId, setMemberId] = useState<number | null>(null);
  const [tag, setTag] = useState<"ONLINE" | "BAR">("ONLINE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedCategory = categories.find(c => c.id === categoryId);
  const showMemberSelector = type === "EINZAHLUNG" && selectedCategory?.isMitgliedsbeitrag === true;

  async function submit() {
    if (!description.trim()) { setError("Beschreibung ist erforderlich"); return; }
    if (!amount || parseFloat(amount) <= 0) { setError("Bitte einen gültigen Betrag eingeben"); return; }
    if (!categoryId) { setError("Bitte eine Kategorie wählen"); return; }
    if (!businessYearId) { setError("Bitte ein Geschäftsjahr wählen"); return; }
    if (!tag) { setError("Bitte eine Zahlungsart wählen"); return; }
    try {
      setSaving(true);
      setError("");
      const t = await createTransaction({
        date,
        description: description.trim(),
        type,
        amount: parseFloat(amount),
        categoryId,
        businessYearId,
        memberId: showMemberSelector ? memberId : null,
        tag,
      });
      onCreated(t);
    } catch {
      setError("Anlegen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 style={{ margin: "0 0 20px", fontSize: 16, color: "#1e293b" }}>Neue Buchung</h3>

      {error && (
        <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Datum">
          <input
            type="date"
            value={date}
            onChange={e => handleDateChange(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Geschäftsjahr">
          <select
            value={businessYearId}
            onChange={e => setBusinessYearId(Number(e.target.value))}
            style={inputStyle}
          >
            {businessYears.map(y => (
              <option key={y.id} value={y.id}>{y.year}</option>
            ))}
          </select>
        </Field>

        <Field label="Beschreibung">
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="z.B. Monatsbeitrag Januar"
            style={inputStyle}
          />
        </Field>

        <Field label="Typ">
          <div style={{ display: "flex", gap: 8 }}>
            {(["EINZAHLUNG", "AUSZAHLUNG"] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 6, border: "1px solid",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  borderColor: type === t ? (t === "EINZAHLUNG" ? "#16a34a" : "#dc2626") : "#d1d5db",
                  background: type === t ? (t === "EINZAHLUNG" ? "#f0fdf4" : "#fef2f2") : "#fff",
                  color: type === t ? (t === "EINZAHLUNG" ? "#16a34a" : "#dc2626") : "#374151",
                }}
              >
                {t === "EINZAHLUNG" ? "Einzahlung" : "Auszahlung"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Betrag (€)">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0,00"
            style={inputStyle}
          />
        </Field>

        <Field label="Kategorie">
          <select
            value={categoryId}
            onChange={e => { setCategoryId(Number(e.target.value)); setMemberId(null); }}
            style={inputStyle}
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        {showMemberSelector && (
          <Field label="Mitglied (optional)">
            <select
              value={memberId ?? ""}
              onChange={e => setMemberId(e.target.value ? Number(e.target.value) : null)}
              style={inputStyle}
            >
              <option value="">— kein Mitglied zuordnen —</option>
              {members
                .filter(m => m.active)
                .sort((a, b) => `${a.lastname}${a.firstname}`.localeCompare(`${b.lastname}${b.firstname}`))
                .map(m => (
                  <option key={m.id} value={m.id}>
                    {m.lastname}, {m.firstname}
                  </option>
                ))}
            </select>
          </Field>
        )}

        <Field label="Zahlungsart">
          <div style={{ display: "flex", gap: 8 }}>
            {(["ONLINE", "BAR"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTag(t)}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 6, border: "1px solid",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  borderColor: tag === t ? "#3b82f6" : "#d1d5db",
                  background: tag === t ? "#eff6ff" : "#fff",
                  color: tag === t ? "#1d4ed8" : "#374151",
                }}
              >
                {t === "ONLINE" ? "Online" : "Bar"}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button
          onClick={submit}
          disabled={saving}
          style={{
            flex: 1, padding: "8px 0", borderRadius: 6, border: "none",
            background: "#1e293b", color: "#fff", fontSize: 14, fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Anlegen…" : "Anlegen"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db",
            background: "#fff", fontSize: 14, cursor: "pointer",
          }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
