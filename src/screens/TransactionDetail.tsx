import { useState } from "react";
import { deleteTransaction, updateTransaction } from "../api/finance";
import type { Category, Transaction } from "../types/finance";

type Props = {
  transaction: Transaction;
  categories: Category[];
  onUpdated: (t: Transaction) => void;
  onDeleted: () => void;
};

function typeLabel(type: Transaction["type"]) {
  if (type === "EINZAHLUNG") return "Einzahlung";
  if (type === "AUSZAHLUNG") return "Auszahlung";
  return "Rückbuchung";
}

function typeColor(type: Transaction["type"]) {
  if (type === "EINZAHLUNG") return "green";
  if (type === "AUSZAHLUNG") return "red";
  return "gray";
}

export default function TransactionDetail({
  transaction,
  categories,
  onUpdated,
  onDeleted,
}: Props) {
  const [edit, setEdit] = useState(false);
  const [date, setDate] = useState(transaction.date);
  const [description, setDescription] = useState(transaction.description);
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sign = transaction.type === "EINZAHLUNG" ? "+" : "-";

  async function save() {
    try {
      setSaving(true);
      const updated = await updateTransaction(transaction.id, {
        date,
        description,
        categoryId,
      });
      onUpdated(updated);
      setEdit(false);
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Buchung wirklich löschen?")) return;
    try {
      setSaving(true);
      await deleteTransaction(transaction.id);
      onDeleted();
    } catch {
      setError("Löschen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  if (!edit) {
    return (
      <div>
        <h3>Buchung</h3>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <p>
          <b>Datum:</b> {transaction.date}
        </p>
        <p>
          <b>Beschreibung:</b> {transaction.description}
        </p>
        <p>
          <b>Kategorie:</b> {transaction.category.name}
        </p>
        <p>
          <b>Typ:</b>{" "}
          <span style={{ color: typeColor(transaction.type) }}>
            {typeLabel(transaction.type)}
          </span>
        </p>
        <p>
          <b>Betrag:</b>{" "}
          <span style={{ color: typeColor(transaction.type) }}>
            {sign}
            {transaction.amount.toFixed(2)} €
          </span>
        </p>
        {transaction.relatedTransactionId && (
          <p>
            <b>Verknüpfte Buchung:</b> #{transaction.relatedTransactionId}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => setEdit(true)}>Bearbeiten</button>
          <button
            onClick={handleDelete}
            disabled={saving}
            style={{ color: "red" }}
          >
            Löschen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3>Buchung bearbeiten</h3>

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
        <button onClick={save} disabled={saving}>
          Speichern
        </button>
        <button onClick={() => setEdit(false)} disabled={saving}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
