import { useState } from "react";
import { createTransaction } from "../api/finance";
import type { Category, Transaction, TransactionType } from "../types/finance";

type Props = {
  businessYearId: number;
  categories: Category[];
  onCreated: (transaction: Transaction) => void;
  onCancel: () => void;
};

export default function TransactionCreate({
  businessYearId,
  categories,
  onCreated,
  onCancel,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TransactionType>("EINZAHLUNG");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!description || !amount || !categoryId) {
      setError("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    try {
      setSaving(true);
      const t = await createTransaction({
        date,
        description,
        type,
        amount: parseFloat(amount),
        categoryId,
        businessYearId,
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
      <h3>Neue Buchung</h3>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>
        Datum
        <br />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <br />
      <br />

      <label>
        Beschreibung
        <br />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: "100%" }}
        />
      </label>

      <br />
      <br />

      <label>
        Typ
        <br />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TransactionType)}
        >
          <option value="EINZAHLUNG">Einzahlung</option>
          <option value="AUSZAHLUNG">Auszahlung</option>
          <option value="RUECKBUCHUNG">Rückbuchung</option>
        </select>
      </label>

      <br />
      <br />

      <label>
        Betrag (€)
        <br />
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      <br />
      <br />

      <label>
        Kategorie
        <br />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

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
