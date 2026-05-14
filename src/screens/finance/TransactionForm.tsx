import { useState } from "react";
import { createTransaction } from "../../api/finance";
import type { Category, Transaction, TransactionType } from "../../types/finance";

type Props = {
  businessYearId: number;
  categories: Category[];
  onCreated: (tx: Transaction) => void;
  onCancel: () => void;
};

type FormErrors = {
  description?: string;
  amount?: string;
  categoryId?: string;
  relatedTransactionId?: string;
};

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "EINZAHLUNG", label: "Einzahlung" },
  { value: "AUSZAHLUNG", label: "Auszahlung" },
  { value: "RUECKBUCHUNG", label: "Rückbuchung" },
];

export default function TransactionForm({
  businessYearId,
  categories,
  onCreated,
  onCancel,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [type, setType] = useState<TransactionType>("EINZAHLUNG");
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 0);
  const [relatedTransactionId, setRelatedTransactionId] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!description.trim()) e.description = "Beschreibung ist erforderlich";
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0)
      e.amount = "Betrag muss größer als 0 sein";
    if (!categoryId) e.categoryId = "Kategorie ist erforderlich";
    if (type === "RUECKBUCHUNG" && !relatedTransactionId.trim())
      e.relatedTransactionId = "Bitte die ID der zu stornierenden Buchung eingeben";
    return e;
  }

  async function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    try {
      setSaving(true);
      setApiError("");
      const tx = await createTransaction({
        date,
        description: description.trim(),
        type,
        amount: parseFloat(amount),
        categoryId,
        businessYearId,
        ...(type === "RUECKBUCHUNG" && relatedTransactionId
          ? { relatedTransactionId: parseInt(relatedTransactionId, 10) }
          : {}),
      });
      onCreated(tx);
    } catch {
      setApiError("Anlegen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3>Neue Buchung</h3>

      {apiError && <p style={{ color: "red" }}>{apiError}</p>}

      {/* Typ */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "inline-flex",
            border: "1px solid var(--c-border)",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                padding: "6px 14px",
                cursor: "pointer",
                background: type === opt.value ? "#333" : "transparent",
                color: type === opt.value ? "#fff" : "inherit",
                userSelect: "none",
              }}
            >
              <input
                type="radio"
                name="type"
                value={opt.value}
                checked={type === opt.value}
                onChange={() => setType(opt.value)}
                style={{ display: "none" }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Datum */}
      <div style={{ marginBottom: 12 }}>
        <label>
          Datum
          <br />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {/* Beschreibung */}
      <div style={{ marginBottom: 12 }}>
        <label>
          Beschreibung
          <br />
          <input
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) setErrors({ ...errors, description: undefined });
            }}
            style={{ width: "100%" }}
          />
        </label>
        {errors.description && (
          <p style={{ color: "red", margin: "2px 0 0", fontSize: 13 }}>
            {errors.description}
          </p>
        )}
      </div>

      {/* Betrag */}
      <div style={{ marginBottom: 12 }}>
        <label>
          Betrag (€)
          <br />
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (errors.amount) setErrors({ ...errors, amount: undefined });
            }}
          />
        </label>
        {errors.amount && (
          <p style={{ color: "red", margin: "2px 0 0", fontSize: 13 }}>
            {errors.amount}
          </p>
        )}
      </div>

      {/* Kategorie */}
      <div style={{ marginBottom: 12 }}>
        <label>
          Kategorie
          <br />
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(Number(e.target.value));
              if (errors.categoryId) setErrors({ ...errors, categoryId: undefined });
            }}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {errors.categoryId && (
          <p style={{ color: "red", margin: "2px 0 0", fontSize: 13 }}>
            {errors.categoryId}
          </p>
        )}
      </div>

      {/* Original-Buchung ID (nur bei RUECKBUCHUNG) */}
      {type === "RUECKBUCHUNG" && (
        <div style={{ marginBottom: 12 }}>
          <label>
            Original-Buchung ID
            <br />
            <input
              type="number"
              min="1"
              step="1"
              value={relatedTransactionId}
              onChange={(e) => {
                setRelatedTransactionId(e.target.value);
                if (errors.relatedTransactionId)
                  setErrors({ ...errors, relatedTransactionId: undefined });
              }}
            />
          </label>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--c-text-2)" }}>
            Bitte die ID der zu stornierenden Buchung eingeben
          </p>
          {errors.relatedTransactionId && (
            <p style={{ color: "red", margin: "2px 0 0", fontSize: 13 }}>
              {errors.relatedTransactionId}
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
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
