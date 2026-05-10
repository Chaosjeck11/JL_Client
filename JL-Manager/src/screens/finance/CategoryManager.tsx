import { useEffect, useState } from "react";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
} from "../../api/finance";
import type { Category } from "../../types/finance";

type Props = {
  onCategoriesChanged: (cats: Category[]) => void;
};

export default function CategoryManager({ onCategoriesChanged }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setError("Fehler beim Laden der Kategorien"));
  }, []);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Name ist erforderlich");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const created = await createCategory({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      const updated = [...categories, created];
      setCategories(updated);
      onCategoriesChanged(updated);
      setName("");
      setDescription("");
    } catch {
      setError("Anlegen fehlgeschlagen — Name möglicherweise bereits vergeben");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Kategorie „${cat.name}" wirklich löschen?`)) return;
    try {
      setDeletingId(cat.id);
      setError("");
      await deleteCategory(cat.id);
      const updated = categories.filter((c) => c.id !== cat.id);
      setCategories(updated);
      onCategoriesChanged(updated);
    } catch {
      setError("Löschen fehlgeschlagen");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: 16,
        margin: "12px 0",
        background: "#fafafa",
      }}
    >
      <h4 style={{ margin: "0 0 12px" }}>Kategorien verwalten</h4>

      {error && <p style={{ color: "red", margin: "0 0 8px" }}>{error}</p>}

      <table width="100%" cellPadding={6} style={{ marginBottom: 16 }}>
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="left">Beschreibung</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {categories.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: "#888", fontStyle: "italic" }}>
                Keine Kategorien vorhanden
              </td>
            </tr>
          )}
          {categories.map((cat) => (
            <tr key={cat.id}>
              <td>{cat.name}</td>
              <td style={{ color: "#666" }}>{cat.description ?? "—"}</td>
              <td align="right">
                <button
                  onClick={() => handleDelete(cat)}
                  disabled={deletingId === cat.id}
                  style={{ color: "red" }}
                >
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <label style={{ flex: 1 }}>
          Name *
          <br />
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            style={{ width: "100%" }}
            placeholder="Kategorienname"
          />
        </label>
        <label style={{ flex: 2 }}>
          Beschreibung
          <br />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: "100%" }}
            placeholder="Optional"
          />
        </label>
        <button onClick={handleCreate} disabled={saving}>
          Anlegen
        </button>
      </div>
    </div>
  );
}
