import { useState } from "react";
import { createBusinessYear } from "../../api/finance";
import type { BusinessYear } from "../../types/finance";

type Props = {
  onCreated: (by: BusinessYear) => void;
  onCancel: () => void;
};

export default function BusinessYearForm({ onCreated, onCancel }: Props) {
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!year || year < 2000 || year > 2100) {
      setError("Bitte ein gültiges Jahr eingeben");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const by = await createBusinessYear({ year });
      onCreated(by);
    } catch {
      setError("Anlegen fehlgeschlagen — Jahr möglicherweise bereits vorhanden");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3>Neues Geschäftsjahr</h3>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ marginBottom: 12 }}>
        <label>
          Jahr
          <br />
          <input
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              if (error) setError("");
            }}
          />
        </label>
      </div>

      <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "0 0 16px" }}>
        Der Übertrag wird automatisch aus dem Vorjahr berechnet.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
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
