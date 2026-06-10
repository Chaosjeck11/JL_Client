import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBierDrinks, createBierDrink, updateBierDrink, uploadBierDrinkImage,
  fetchBierFridge, updateBierFridge,
  fetchMyConsumption, postConsumption,
  fetchMyBalance, fetchAllBalances, payMember,
  fetchCashbox, postCashboxTransaction,
  fetchBierStats,
} from "../api/bierliste";
import { getApiUrl } from "../api/client";
import { getCurrentUser } from "../auth/currentUser";
import type { BierDrink, BierMemberBalance } from "../types/bierliste";

type SubTab = "home" | "fridge" | "scoreboard" | "kasse" | "admin";

const PAYPAL_LINK_KEY = "bierliste_paypal_link";
const WARN_THRESHOLD = 10;
const CRIT_THRESHOLD = 5;
function warnDisabledKey(drinkId: number) { return `bierliste_warn_off_${drinkId}`; }

function isBierAdmin(): boolean {
  return (getCurrentUser()?.accessLevel ?? 0) >= 3;
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 6,
  border: "1px solid var(--c-border)", fontSize: 13,
  background: "var(--c-bg)", color: "var(--c-text)", boxSizing: "border-box",
};
const btnPrimary: React.CSSProperties = {
  padding: "7px 16px", borderRadius: 7, border: "none",
  background: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

function fmtEur(v: number) { return v.toFixed(2).replace(".", ",") + " €"; }
function fmtDate(d: string) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Drink image ───────────────────────────────────────────────────────────────
function DrinkImage({ drink, size = 48 }: { drink: BierDrink; size?: number }) {
  const [err, setErr] = useState(false);
  if (drink.imagePath && !err) {
    return (
      <img
        src={`${getApiUrl()}/bierliste/drinks/${drink.id}/image`}
        alt={drink.name}
        style={{ width: size, height: size, objectFit: "contain", borderRadius: 6 }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 6,
      background: "var(--c-bg-2)", border: "1px solid var(--c-border)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45,
    }}>🍺</div>
  );
}

// ── PayPal settings modal (admin only) ────────────────────────────────────────
function PaypalSettingsModal({ onClose }: { onClose: () => void }) {
  const [link, setLink] = useState(() => localStorage.getItem(PAYPAL_LINK_KEY) ?? "");
  function save() {
    localStorage.setItem(PAYPAL_LINK_KEY, link.trim());
    onClose();
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
      <div style={{ background: "var(--c-bg)", borderRadius: 12, padding: 24, width: 340, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>PayPal.me Link</div>
        <div style={{ fontSize: 12, color: "var(--c-text-2)", marginBottom: 10 }}>
          Vollständige URL, z. B. <code>https://paypal.me/NutzernameXY</code>
        </div>
        <input
          style={{ ...inputStyle, width: "100%", marginBottom: 16 }}
          value={link}
          onChange={e => setLink(e.target.value)}
          placeholder="https://paypal.me/..."
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "8px", borderRadius: 7, border: "1px solid var(--c-border)", background: "var(--c-bg-2)", cursor: "pointer", fontSize: 13 }}>
            Abbrechen
          </button>
          <button onClick={save} style={{ ...btnPrimary, flex: 1, padding: "8px" }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

// ── Home subtab ───────────────────────────────────────────────────────────────
function HomeTab({ isMobile }: { isMobile?: boolean }) {
  const qc = useQueryClient();
  const admin = isBierAdmin();
  const [loadingDrink, setLoadingDrink] = useState<number | null>(null);
  const [showPaypalSettings, setShowPaypalSettings] = useState(false);
  // Synchronous ref-lock prevents spam even before React re-renders the disabled state.
  // Cooldown of 800 ms keeps button visually locked after the API calls complete.
  const bookingLock = useRef<Set<number>>(new Set());

  const { data: balance } = useQuery({
    queryKey: ["bier-balance-me"],
    queryFn: fetchMyBalance,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const { data: drinks = [] } = useQuery({
    queryKey: ["bier-drinks"],
    queryFn: () => fetchBierDrinks(false),
    staleTime: 30_000,
  });
  const { data: consumption = [] } = useQuery({
    queryKey: ["bier-consumption-me"],
    queryFn: fetchMyConsumption,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const { data: fridge = [] } = useQuery({
    queryKey: ["bier-fridge"],
    queryFn: fetchBierFridge,
    staleTime: 10_000,
  });

  async function book(drinkId: number, amount: number) {
    if (bookingLock.current.has(drinkId)) return;
    bookingLock.current.add(drinkId);
    setLoadingDrink(drinkId);
    try {
      const fridgeItem = fridge.find(f => f.drinkId === drinkId);
      const stock = fridgeItem?.stock ?? 0;
      await postConsumption(drinkId, amount);
      if (amount > 0 && stock > 0) {
        await updateBierFridge(drinkId, { mode: "subtract", value: 1 });
      } else if (amount < 0) {
        await updateBierFridge(drinkId, { mode: "add", value: 1 });
      }
      qc.invalidateQueries({ queryKey: ["bier-balance-me"] });
      qc.invalidateQueries({ queryKey: ["bier-consumption-me"] });
      qc.invalidateQueries({ queryKey: ["bier-fridge"] });
    } catch {
      // On error release lock immediately so the user can retry
      bookingLock.current.delete(drinkId);
      setLoadingDrink(null);
      return;
    }
    // 800 ms cooldown: button stays visually disabled after success
    setTimeout(() => {
      bookingLock.current.delete(drinkId);
      setLoadingDrink(null);
    }, 800);
  }

  const drinkCounts: Record<number, number> = {};
  for (const c of consumption) {
    drinkCounts[c.drinkId] = (drinkCounts[c.drinkId] ?? 0) + c.amount;
  }

  const paypalLink = localStorage.getItem(PAYPAL_LINK_KEY) ?? "";
  const openAmount = balance?.openAmount ?? 0;

  function openPaypal() {
    if (!paypalLink) return;
    const url = paypalLink.includes("?")
      ? `${paypalLink}&amount=${openAmount.toFixed(2)}`
      : `${paypalLink}/${openAmount.toFixed(2)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ padding: "16px", maxWidth: 600, margin: "0 auto" }}>
      {/* Balance cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 120, padding: "14px 18px", borderRadius: 10, background: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
          <div style={{ fontSize: 11, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Offener Betrag</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: openAmount > 0 ? "#ef4444" : "#16a34a" }}>{fmtEur(openAmount)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, padding: "14px 18px", borderRadius: 10, background: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
          <div style={{ fontSize: 11, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Bezahlt</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#16a34a" }}>{fmtEur(balance?.paidAmount ?? 0)}</div>
        </div>
      </div>

      {/* PayPal button row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button
          onClick={openPaypal}
          disabled={!paypalLink || openAmount <= 0}
          style={{
            flex: 1, padding: "10px 16px", borderRadius: 8, border: "none",
            background: paypalLink && openAmount > 0 ? "#0070ba" : "var(--c-bg-2)",
            color: paypalLink && openAmount > 0 ? "#fff" : "var(--c-text-3)",
            fontSize: 14, fontWeight: 700, cursor: paypalLink && openAmount > 0 ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <span>💳</span>
          Jetzt bezahlen ({fmtEur(openAmount)})
        </button>
        {admin && (
          <button
            onClick={() => setShowPaypalSettings(true)}
            title="PayPal-Link konfigurieren"
            style={{ width: 36, height: 36, borderRadius: 7, border: "1px solid var(--c-border)", background: "var(--c-bg-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}
          >
            ⚙
          </button>
        )}
      </div>

      {/* Drinks table */}
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--c-border)", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", background: "var(--c-bg-2)", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.6, gap: 8 }}>
          <span>Getränk</span>
          <span style={{ textAlign: "right" }}>Preis</span>
          <span style={{ textAlign: "center" }}>+1</span>
          <span style={{ textAlign: "center" }}>-1</span>
          <span style={{ textAlign: "right" }}>Mein Score</span>
        </div>
        {drinks.map(d => (
          <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", padding: "10px 14px", gap: 8, alignItems: "center", borderTop: "1px solid var(--c-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <DrinkImage drink={d} size={32} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{d.name}</span>
            </div>
            <span style={{ fontSize: 13, color: "var(--c-text-2)", textAlign: "right" }}>{fmtEur(d.pricePerUnit)}</span>
            <button
              disabled={loadingDrink === d.id}
              onClick={() => book(d.id, 1)}
              style={{ width: 32, height: 32, borderRadius: 7, border: "none", background: "#3b82f6", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: loadingDrink === d.id ? 0.6 : 1 }}
            >+</button>
            <button
              disabled={loadingDrink === d.id}
              onClick={() => book(d.id, -1)}
              style={{ width: 32, height: 32, borderRadius: 7, border: "none", background: "#ef4444", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: loadingDrink === d.id ? 0.6 : 1 }}
            >−</button>
            <span style={{ fontSize: 14, fontWeight: 700, textAlign: "right" }}>{drinkCounts[d.id] ?? 0}</span>
          </div>
        ))}
        {drinks.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--c-text-2)", fontSize: 13 }}>Keine Getränke verfügbar</div>
        )}
      </div>

      {/* Personal score summary */}
      {drinks.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Mein Gesamtscore
          </div>
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--c-border)" }}>
            {drinks.filter(d => (drinkCounts[d.id] ?? 0) > 0).map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: "1px solid var(--c-border)" }}>
                <DrinkImage drink={d} size={28} />
                <span style={{ flex: 1, fontSize: 14 }}>{d.name}</span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{drinkCounts[d.id]}</span>
                <span style={{ fontSize: 13, color: "var(--c-text-2)", minWidth: 60, textAlign: "right" }}>
                  {fmtEur((drinkCounts[d.id] ?? 0) * d.pricePerUnit)}
                </span>
              </div>
            ))}
            {drinks.every(d => (drinkCounts[d.id] ?? 0) === 0) && (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--c-text-2)", fontSize: 13 }}>
                Noch nichts getrunken 🎉
              </div>
            )}
            {drinks.some(d => (drinkCounts[d.id] ?? 0) > 0) && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderTop: "2px solid var(--c-border)", fontWeight: 700 }}>
                <span>Gesamt</span>
                <span>{fmtEur(drinks.reduce((sum, d) => sum + (drinkCounts[d.id] ?? 0) * d.pricePerUnit, 0))}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {showPaypalSettings && <PaypalSettingsModal onClose={() => setShowPaypalSettings(false)} />}
    </div>
  );
}

// ── Fridge subtab ─────────────────────────────────────────────────────────────
function FridgeTab() {
  const { data: fridge = [], isLoading } = useQuery({
    queryKey: ["bier-fridge"],
    queryFn: fetchBierFridge,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const sorted = [...fridge].sort((a, b) => (a.drink?.sortOrder ?? 0) - (b.drink?.sortOrder ?? 0));

  return (
    <div style={{ padding: "16px", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ fontSize: 13, color: "var(--c-text-2)", marginBottom: 14 }}>Aktueller Kühlschrankbestand</div>
      {isLoading && <div style={{ padding: 24, textAlign: "center", color: "var(--c-text-2)" }}>Lädt…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map(item => {
          const drink = item.drink;
          const stockPct = item.maxStock ? Math.min(item.stock / item.maxStock, 1) : null;
          const isCrit = item.stock < CRIT_THRESHOLD;
          const isWarn = !isCrit && item.stock < WARN_THRESHOLD;
          const stockColor = isCrit ? "#ef4444" : isWarn ? "#f59e0b" : "var(--c-text)";
          const cardBorder = isCrit ? "1px solid #ef4444" : isWarn ? "1px solid #f59e0b" : "1px solid var(--c-border)";
          return (
            <div key={item.drinkId} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 10, background: "var(--c-bg)", border: cardBorder }}>
              {drink && <DrinkImage drink={drink} size={52} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{drink?.name ?? `Drink #${item.drinkId}`}</div>
                <div style={{ fontSize: 12, color: "var(--c-text-2)" }}>
                  {drink?.pricePerUnit != null && `${fmtEur(drink.pricePerUnit)} / Stück`}
                  {item.location && ` · ${item.location}`}
                </div>
                {(isCrit || isWarn) && (
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: stockColor }}>
                    {isCrit ? "⚠ Kritisch niedrig!" : "⚠ Bestand niedrig"}
                  </div>
                )}
                {stockPct !== null && (
                  <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: "var(--c-border)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${stockPct * 100}%`, background: "#3b82f6", borderRadius: 2 }} />
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: stockColor }}>{item.stock}</div>
                <div style={{ fontSize: 11, color: "var(--c-text-2)" }}>Bestand</div>
              </div>
            </div>
          );
        })}
        {!isLoading && sorted.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--c-text-2)" }}>Keine Einträge</div>
        )}
      </div>
    </div>
  );
}

// ── Drink column selector dropdown ────────────────────────────────────────────
function DrinkColumnSelector({
  drinks,
  selected,
  onChange,
}: {
  drinks: BierDrink[];
  selected: Set<number>;
  onChange: (s: Set<number>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    onChange(next);
  }

  const allSelected = drinks.every(d => selected.has(d.id));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ ...inputStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
      >
        <span>Getränke</span>
        <span style={{ fontSize: 11, color: "var(--c-text-2)" }}>
          ({selected.size}/{drinks.length})
        </span>
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
          background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 8,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", minWidth: 200, padding: "6px 0",
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, borderBottom: "1px solid var(--c-border)" }}>
            <input type="checkbox" checked={allSelected} onChange={() => {
              if (allSelected) { onChange(new Set()); } else { onChange(new Set(drinks.map(d => d.id))); }
            }} />
            Alle
          </label>
          {drinks.map(d => (
            <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
              {d.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Scoreboard subtab ─────────────────────────────────────────────────────────
type SortKey = "name" | "total" | "open" | number;

function ScoreboardTab() {
  const { data: stats = [], isLoading, error } = useQuery({
    queryKey: ["bier-stats"],
    queryFn: fetchBierStats,
    staleTime: 30_000,
  });

  const { data: drinks = [] } = useQuery({
    queryKey: ["bier-drinks"],
    queryFn: () => fetchBierDrinks(false),
    staleTime: 60_000,
  });

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });
  const [selectedDrinks, setSelectedDrinks] = useState<Set<number> | null>(null);

  // Default: all drinks selected once data loads
  const visibleDrinkSet: Set<number> = selectedDrinks ?? new Set(drinks.map(d => d.id));
  const visibleDrinks = drinks.filter(d => visibleDrinkSet.has(d.id));

  function handleSort(key: SortKey) {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  }

  function sortIndicator(key: SortKey) {
    if (sort.key !== key) return <span style={{ color: "var(--c-text-3)", fontSize: 9, marginLeft: 3 }}>⇅</span>;
    return <span style={{ fontSize: 9, marginLeft: 3 }}>{sort.dir === "asc" ? "▲" : "▼"}</span>;
  }

  const sorted = [...stats].sort((a, b) => {
    let cmp = 0;
    if (sort.key === "name") {
      cmp = `${a.member.firstname} ${a.member.lastname}`.localeCompare(`${b.member.firstname} ${b.member.lastname}`, "de");
    } else if (sort.key === "total") {
      cmp = a.totalAmount - b.totalAmount;
    } else if (sort.key === "open") {
      cmp = a.openAmount - b.openAmount;
    } else {
      const drinkId = sort.key as number;
      const aMap: Record<number, number> = {};
      for (const x of a.byDrink) aMap[x.drink.id] = x.amount;
      const bMap: Record<number, number> = {};
      for (const x of b.byDrink) bMap[x.drink.id] = x.amount;
      cmp = (aMap[drinkId] ?? 0) - (bMap[drinkId] ?? 0);
    }
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const thStyle = (key: SortKey): React.CSSProperties => ({
    padding: "8px 12px", textAlign: key === "name" ? "left" : "center",
    fontWeight: 700, cursor: "pointer", userSelect: "none",
    background: sort.key === key ? "var(--c-bg-3, #e2e8f0)" : undefined,
    whiteSpace: "nowrap",
  });

  if (isLoading) return <div style={{ padding: 24, textAlign: "center", color: "var(--c-text-2)" }}>Lädt…</div>;
  if (error) return <div style={{ padding: 24, textAlign: "center", color: "#ef4444" }}>Fehler beim Laden</div>;

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ marginBottom: 12 }}>
        <DrinkColumnSelector
          drinks={drinks}
          selected={visibleDrinkSet}
          onChange={s => setSelectedDrinks(new Set(s))}
        />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--c-bg-2)" }}>
              <th style={thStyle("name")} onClick={() => handleSort("name")}>
                Name {sortIndicator("name")}
              </th>
              {visibleDrinks.map(d => (
                <th key={d.id} style={{ ...thStyle(d.id), textAlign: "center" }} onClick={() => handleSort(d.id)}>
                  {d.name} {sortIndicator(d.id)}
                </th>
              ))}
              <th style={{ ...thStyle("total"), textAlign: "right" }} onClick={() => handleSort("total")}>
                Gesamt {sortIndicator("total")}
              </th>
              <th style={{ ...thStyle("open"), textAlign: "right" }} onClick={() => handleSort("open")}>
                Offen {sortIndicator("open")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const byDrinkMap: Record<number, number> = {};
              for (const b of s.byDrink) byDrinkMap[b.drink.id] = b.amount;

              return (
                <tr key={s.member.id} style={{ background: i % 2 === 0 ? "var(--c-bg)" : "var(--c-bg-2)", borderTop: "1px solid var(--c-border)" }}>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{s.member.firstname} {s.member.lastname}</td>
                  {visibleDrinks.map(d => (
                    <td key={d.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                      {byDrinkMap[d.id] ?? 0}
                    </td>
                  ))}
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>{s.totalAmount}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: s.openAmount > 0 ? "#ef4444" : "#16a34a", fontWeight: 600 }}>
                    {fmtEur(s.openAmount)}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={visibleDrinks.length + 3} style={{ padding: 24, textAlign: "center", color: "var(--c-text-2)" }}>Keine Daten</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Kasse subtab ──────────────────────────────────────────────────────────────
function KasseTab() {
  const qc = useQueryClient();
  const admin = isBierAdmin();
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"IN" | "OUT" | "CORRECTION">("IN");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const { data: cashbox } = useQuery({
    queryKey: ["bier-cashbox"],
    queryFn: fetchCashbox,
    staleTime: 15_000,
    enabled: admin,
  });

  if (!admin) return <div style={{ padding: 32, textAlign: "center", color: "var(--c-text-2)" }}>Nur für Admins sichtbar.</div>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = parseFloat(amount.replace(",", "."));
    if (!a || a <= 0) { setErr("Betrag ungültig"); return; }
    setSaving(true); setErr("");
    try {
      await postCashboxTransaction({ amount: a, direction, reason: reason || undefined });
      qc.invalidateQueries({ queryKey: ["bier-cashbox"] });
      setAmount(""); setReason("");
    } catch (e: any) {
      setErr(e.message ?? "Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: "0 auto" }}>
      <div style={{ padding: "14px 18px", borderRadius: 10, marginBottom: 20, background: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
        <div style={{ fontSize: 11, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Kassenstand</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#3b82f6" }}>{fmtEur(cashbox?.balance ?? 0)}</div>
      </div>
      <form onSubmit={submit} style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Neue Buchung</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {(["IN", "OUT", "CORRECTION"] as const).map(d => (
            <button key={d} type="button" onClick={() => setDirection(d)}
              style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--c-border)", background: direction === d ? "#3b82f6" : "var(--c-bg-2)", color: direction === d ? "#fff" : "var(--c-text-2)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {d === "IN" ? "Einnahme" : d === "OUT" ? "Ausgabe" : "Korrektur"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input style={{ ...inputStyle, width: 120 }} value={amount} onChange={e => setAmount(e.target.value)} placeholder="Betrag" type="text" inputMode="decimal" required />
          <input style={{ ...inputStyle, flex: 1 }} value={reason} onChange={e => setReason(e.target.value)} placeholder="Grund (optional)" />
        </div>
        {err && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <button type="submit" style={btnPrimary} disabled={saving}>{saving ? "Speichern…" : "Buchen"}</button>
      </form>
      {cashbox && cashbox.transactions.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-2)", marginBottom: 8 }}>Letzte Buchungen</div>
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--c-border)" }}>
            {cashbox.transactions.slice(0, 20).map(t => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderTop: "1px solid var(--c-border)", fontSize: 13 }}>
                <div>
                  <div style={{ color: "var(--c-text-2)", fontSize: 11 }}>{fmtDate(t.createdAt)}</div>
                  <div>{t.reason || t.direction}</div>
                </div>
                <span style={{ fontWeight: 700, color: t.direction === "IN" ? "#16a34a" : t.direction === "OUT" ? "#ef4444" : "#f59e0b" }}>
                  {t.direction === "IN" ? "+" : t.direction === "OUT" ? "−" : "±"}{fmtEur(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin subtab ──────────────────────────────────────────────────────────────
function AdminTab() {
  const qc = useQueryClient();
  const admin = isBierAdmin();
  const [selectedMember, setSelectedMember] = useState<BierMemberBalance | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payErr, setPayErr] = useState("");

  // Drink management
  const [showDrinkForm, setShowDrinkForm] = useState(false);
  const [editingDrink, setEditingDrink] = useState<BierDrink | null>(null);
  const [drinkName, setDrinkName] = useState("");
  const [drinkPrice, setDrinkPrice] = useState("");
  const [drinkDesc, setDrinkDesc] = useState("");
  const [drinkSaving, setDrinkSaving] = useState(false);
  const [drinkErr, setDrinkErr] = useState("");

  // Fridge management — with Kasten support
  const [fridgeMode, setFridgeMode] = useState<"set" | "add" | "subtract">("add");
  const [fillType, setFillType] = useState<"single" | "kasten">("single");
  const [fridgeValue, setFridgeValue] = useState("1");
  const [kastenzahl, setKastenzahl] = useState("1");
  const [flaschenProKasten, setFlaschenProKasten] = useState("24");
  const [selectedFridgeDrink, setSelectedFridgeDrink] = useState<number | null>(null);
  const [fridgeSaving, setFridgeSaving] = useState(false);

  // Warning toggles — stored per-drink in localStorage
  const [warnToggles, setWarnToggles] = useState<Record<number, boolean>>({});

  const imgInputRef = useRef<HTMLInputElement>(null);
  const [imgDrinkId, setImgDrinkId] = useState<number | null>(null);

  const { data: balances = [] } = useQuery({
    queryKey: ["bier-balances"],
    queryFn: fetchAllBalances,
    staleTime: 15_000,
    enabled: admin,
  });
  const { data: drinks = [] } = useQuery({
    queryKey: ["bier-drinks"],
    queryFn: () => fetchBierDrinks(true),
    staleTime: 30_000,
    enabled: admin,
  });
  const { data: fridge = [] } = useQuery({
    queryKey: ["bier-fridge"],
    queryFn: fetchBierFridge,
    staleTime: 15_000,
    enabled: admin,
  });

  // Load warning toggles from localStorage once drinks are available
  useEffect(() => {
    const loaded: Record<number, boolean> = {};
    for (const d of drinks) {
      loaded[d.id] = localStorage.getItem(warnDisabledKey(d.id)) === "1";
    }
    setWarnToggles(loaded);
  }, [drinks.length]);

  function setWarnDisabled(drinkId: number, disabled: boolean) {
    localStorage.setItem(warnDisabledKey(drinkId), disabled ? "1" : "0");
    setWarnToggles(prev => ({ ...prev, [drinkId]: disabled }));
  }

  // Collect fridge warnings
  const fridgeWarnings = fridge.filter(item => {
    if (warnToggles[item.drinkId]) return false;
    return item.stock < WARN_THRESHOLD;
  });
  const critWarnings = fridgeWarnings.filter(item => item.stock < CRIT_THRESHOLD);
  const normalWarnings = fridgeWarnings.filter(item => item.stock >= CRIT_THRESHOLD);

  if (!admin) return <div style={{ padding: 32, textAlign: "center", color: "var(--c-text-2)" }}>Nur für Admins sichtbar.</div>;

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMember) return;
    const a = parseFloat(payAmount.replace(",", "."));
    if (!a || a <= 0) { setPayErr("Betrag ungültig"); return; }
    setPayLoading(true); setPayErr("");
    try {
      await payMember(selectedMember.memberId, a);
      qc.invalidateQueries({ queryKey: ["bier-balances"] });
      qc.invalidateQueries({ queryKey: ["bier-cashbox"] });
      setPayAmount(""); setSelectedMember(null);
    } catch (e: any) {
      setPayErr(e.message ?? "Fehler");
    } finally {
      setPayLoading(false);
    }
  }

  function openDrinkForm(drink?: BierDrink) {
    if (drink) {
      setEditingDrink(drink);
      setDrinkName(drink.name);
      setDrinkPrice(String(drink.pricePerUnit));
      setDrinkDesc(drink.description ?? "");
    } else {
      setEditingDrink(null);
      setDrinkName(""); setDrinkPrice(""); setDrinkDesc("");
    }
    setShowDrinkForm(true); setDrinkErr("");
  }

  async function saveDrink(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(drinkPrice.replace(",", "."));
    if (!drinkName || !price) { setDrinkErr("Name und Preis erforderlich"); return; }
    setDrinkSaving(true); setDrinkErr("");
    try {
      if (editingDrink) {
        await updateBierDrink(editingDrink.id, { name: drinkName, pricePerUnit: price, description: drinkDesc || undefined });
      } else {
        await createBierDrink({ name: drinkName, pricePerUnit: price, description: drinkDesc || undefined });
      }
      qc.invalidateQueries({ queryKey: ["bier-drinks"] });
      qc.invalidateQueries({ queryKey: ["bier-fridge"] });
      setShowDrinkForm(false);
    } catch (e: any) {
      setDrinkErr(e.message ?? "Fehler");
    } finally {
      setDrinkSaving(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !imgDrinkId) return;
    try {
      await uploadBierDrinkImage(imgDrinkId, file);
      qc.invalidateQueries({ queryKey: ["bier-drinks"] });
      qc.invalidateQueries({ queryKey: ["bier-fridge"] });
    } catch (err: any) {
      alert("Fehler beim Hochladen: " + (err.message ?? "Unbekannt"));
    }
    e.target.value = "";
  }

  async function handleFridgeUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFridgeDrink) return;
    let val: number;
    if (fillType === "kasten") {
      const k = parseInt(kastenzahl) || 1;
      const f = parseInt(flaschenProKasten) || 24;
      val = k * f;
    } else {
      val = parseInt(fridgeValue);
    }
    if (!val || val <= 0) return;
    setFridgeSaving(true);
    try {
      await updateBierFridge(selectedFridgeDrink, { mode: fridgeMode, value: val });
      qc.invalidateQueries({ queryKey: ["bier-fridge"] });
      setFridgeValue("1"); setKastenzahl("1");
    } finally {
      setFridgeSaving(false);
    }
  }

  const computedFridgeValue = fillType === "kasten"
    ? (parseInt(kastenzahl) || 1) * (parseInt(flaschenProKasten) || 24)
    : parseInt(fridgeValue) || 0;

  const section = (title: string) => (
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-2)", marginBottom: 10, marginTop: 24, textTransform: "uppercase", letterSpacing: 0.6 }}>
      {title}
    </div>
  );

  return (
    <div style={{ padding: 16, maxWidth: 700, margin: "0 auto" }}>

      {/* Fridge warnings summary */}
      {fridgeWarnings.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {critWarnings.map(item => (
            <div key={item.drinkId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fca5a5", marginBottom: 6, fontSize: 13 }}>
              <span style={{ fontSize: 18 }}>🚨</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, color: "#dc2626" }}>{item.drink?.name ?? `Drink #${item.drinkId}`}</span>
                <span style={{ color: "#dc2626" }}> — Kritisch! Nur noch {item.stock} Stück</span>
              </div>
            </div>
          ))}
          {normalWarnings.map(item => (
            <div key={item.drinkId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fcd34d", marginBottom: 6, fontSize: 13 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, color: "#d97706" }}>{item.drink?.name ?? `Drink #${item.drinkId}`}</span>
                <span style={{ color: "#d97706" }}> — Bestand niedrig: {item.stock} Stück</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Salden */}
      {section("Mitglieder-Salden")}
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--c-border)", marginBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", background: "var(--c-bg-2)", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", gap: 8 }}>
          <span>Name</span>
          <span style={{ textAlign: "right" }}>Offen</span>
          <span style={{ textAlign: "right" }}>Bezahlt</span>
          <span />
        </div>
        {balances.map(b => (
          <div key={b.memberId} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", padding: "10px 14px", borderTop: "1px solid var(--c-border)", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>{b.member ? `${b.member.firstname} ${b.member.lastname}` : `Mitglied #${b.memberId}`}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: b.openAmount > 0 ? "#ef4444" : "var(--c-text)" }}>{fmtEur(b.openAmount)}</span>
            <span style={{ fontSize: 13, color: "#16a34a" }}>{fmtEur(b.paidAmount)}</span>
            <button onClick={() => { setSelectedMember(b); setPayAmount(b.openAmount.toFixed(2)); }}
              style={{ ...btnPrimary, padding: "4px 10px", fontSize: 12 }} disabled={b.openAmount <= 0}>
              Bezahlen
            </button>
          </div>
        ))}
        {balances.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--c-text-2)" }}>Keine Salden</div>}
      </div>

      {/* Pay modal */}
      {selectedMember && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: "var(--c-bg)", borderRadius: 12, padding: 24, width: 320, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Zahlung — {selectedMember.member ? `${selectedMember.member.firstname} ${selectedMember.member.lastname}` : `Mitglied #${selectedMember.memberId}`}
            </div>
            <form onSubmit={handlePay}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Betrag</label>
                <input style={{ ...inputStyle, width: "100%" }} value={payAmount} onChange={e => setPayAmount(e.target.value)} type="text" inputMode="decimal" required />
              </div>
              {payErr && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{payErr}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setSelectedMember(null)} style={{ flex: 1, padding: "8px", borderRadius: 7, border: "1px solid var(--c-border)", background: "var(--c-bg-2)", cursor: "pointer", fontSize: 13 }}>
                  Abbrechen
                </button>
                <button type="submit" style={{ ...btnPrimary, flex: 1, padding: "8px" }} disabled={payLoading}>
                  {payLoading ? "…" : "Buchen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drink management */}
      {section("Getränke verwalten")}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => openDrinkForm()} style={btnPrimary}>+ Neues Getränk</button>
      </div>
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--c-border)", marginBottom: 8 }}>
        {drinks.map(d => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: "1px solid var(--c-border)" }}>
            <DrinkImage drink={d} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: d.active ? "var(--c-text)" : "var(--c-text-3)" }}>
                {d.name} {!d.active && <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>(inaktiv)</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--c-text-2)" }}>{fmtEur(d.pricePerUnit)}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setImgDrinkId(d.id); imgInputRef.current?.click(); }} title="Bild hochladen"
                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg-2)", cursor: "pointer", fontSize: 14 }}>📷</button>
              <button onClick={() => openDrinkForm(d)}
                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-bg-2)", cursor: "pointer", fontSize: 12 }}>Bearbeiten</button>
            </div>
          </div>
        ))}
        {drinks.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--c-text-2)" }}>Keine Getränke</div>}
      </div>
      <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />

      {/* Drink form modal */}
      {showDrinkForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: "var(--c-bg)", borderRadius: 12, padding: 24, width: 340, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{editingDrink ? "Getränk bearbeiten" : "Neues Getränk"}</div>
            <form onSubmit={saveDrink}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Name</label>
                <input style={{ ...inputStyle, width: "100%" }} value={drinkName} onChange={e => setDrinkName(e.target.value)} required />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Preis (€)</label>
                <input style={{ ...inputStyle, width: "100%" }} value={drinkPrice} onChange={e => setDrinkPrice(e.target.value)} type="text" inputMode="decimal" required />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Beschreibung (optional)</label>
                <input style={{ ...inputStyle, width: "100%" }} value={drinkDesc} onChange={e => setDrinkDesc(e.target.value)} />
              </div>
              {editingDrink && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={editingDrink.active}
                      onChange={async e => {
                        await updateBierDrink(editingDrink.id, { active: e.target.checked });
                        qc.invalidateQueries({ queryKey: ["bier-drinks"] });
                        setEditingDrink(prev => prev ? { ...prev, active: e.target.checked } : prev);
                      }} />
                    Aktiv
                  </label>
                </div>
              )}
              {drinkErr && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{drinkErr}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setShowDrinkForm(false)} style={{ flex: 1, padding: "8px", borderRadius: 7, border: "1px solid var(--c-border)", background: "var(--c-bg-2)", cursor: "pointer", fontSize: 13 }}>Abbrechen</button>
                <button type="submit" style={{ ...btnPrimary, flex: 1, padding: "8px" }} disabled={drinkSaving}>{drinkSaving ? "…" : "Speichern"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fridge management with Kasten support */}
      {section("Kühlschrank befüllen")}
      <form onSubmit={handleFridgeUpdate} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Getränk</label>
            <select style={{ ...inputStyle, minWidth: 160 }} value={selectedFridgeDrink ?? ""} onChange={e => setSelectedFridgeDrink(Number(e.target.value) || null)} required>
              <option value="">Auswählen…</option>
              {drinks.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Modus</label>
            <select style={inputStyle} value={fridgeMode} onChange={e => setFridgeMode(e.target.value as any)}>
              <option value="add">Hinzufügen</option>
              <option value="subtract">Abziehen</option>
              <option value="set">Setzen</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Art</label>
            <div style={{ display: "flex", gap: 4 }}>
              {(["single", "kasten"] as const).map(t => (
                <button key={t} type="button" onClick={() => setFillType(t)}
                  style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid var(--c-border)", background: fillType === t ? "#3b82f6" : "var(--c-bg-2)", color: fillType === t ? "#fff" : "var(--c-text-2)", fontSize: 13, cursor: "pointer" }}>
                  {t === "single" ? "Einzeln" : "Kasten"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {fillType === "single" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Menge</label>
              <input style={{ ...inputStyle, width: 80 }} value={fridgeValue} onChange={e => setFridgeValue(e.target.value)} type="number" min={1} required />
            </div>
            <button type="submit" style={btnPrimary} disabled={fridgeSaving || !selectedFridgeDrink}>
              {fridgeSaving ? "…" : "Aktualisieren"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Anzahl Kasten</label>
              <input style={{ ...inputStyle, width: 80 }} value={kastenzahl} onChange={e => setKastenzahl(e.target.value)} type="number" min={1} required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Flaschen / Kasten</label>
              <input style={{ ...inputStyle, width: 80 }} value={flaschenProKasten} onChange={e => setFlaschenProKasten(e.target.value)} type="number" min={1} required />
            </div>
            <div style={{ paddingBottom: 1 }}>
              <div style={{ fontSize: 12, color: "var(--c-text-2)", marginBottom: 4 }}>&nbsp;</div>
              <div style={{ padding: "7px 12px", borderRadius: 6, background: "var(--c-bg-2)", border: "1px solid var(--c-border)", fontSize: 13, color: "var(--c-text-2)", minWidth: 80, textAlign: "center" }}>
                = {computedFridgeValue} Fl.
              </div>
            </div>
            <button type="submit" style={btnPrimary} disabled={fridgeSaving || !selectedFridgeDrink}>
              {fridgeSaving ? "…" : "Aktualisieren"}
            </button>
          </div>
        )}
      </form>

      {/* Fridge state with warning toggles */}
      {section("Kühlschrankbestand & Warnungen")}
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--c-border)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", background: "var(--c-bg-2)", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", gap: 8 }}>
          <span>Getränk</span>
          <span style={{ textAlign: "right" }}>Bestand</span>
          <span style={{ textAlign: "center" }}>Status</span>
          <span style={{ textAlign: "center" }}>Warnung</span>
        </div>
        {fridge.map(item => {
          const disabled = !!warnToggles[item.drinkId];
          const isCrit = !disabled && item.stock < CRIT_THRESHOLD;
          const isWarn = !disabled && !isCrit && item.stock < WARN_THRESHOLD;
          return (
            <div key={item.drinkId} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", padding: "10px 14px", borderTop: "1px solid var(--c-border)", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 14 }}>{item.drink?.name ?? `Drink #${item.drinkId}`}</span>
              <span style={{ fontSize: 14, fontWeight: 700, textAlign: "right", color: isCrit ? "#ef4444" : isWarn ? "#f59e0b" : "var(--c-text)" }}>
                {item.stock}
              </span>
              <span style={{ textAlign: "center", fontSize: 13 }}>
                {disabled ? <span style={{ color: "var(--c-text-3)" }}>—</span>
                  : isCrit ? <span style={{ color: "#ef4444", fontWeight: 700 }}>Kritisch</span>
                  : isWarn ? <span style={{ color: "#f59e0b", fontWeight: 600 }}>Niedrig</span>
                  : <span style={{ color: "#16a34a" }}>OK</span>}
              </span>
              <div style={{ textAlign: "center" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer", color: "var(--c-text-2)" }}>
                  <input
                    type="checkbox"
                    checked={!disabled}
                    onChange={e => setWarnDisabled(item.drinkId, !e.target.checked)}
                  />
                  An
                </label>
              </div>
            </div>
          );
        })}
        {fridge.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--c-text-2)" }}>Keine Einträge</div>}
      </div>
    </div>
  );
}

// ── Main Bierliste screen ─────────────────────────────────────────────────────
export default function Bierliste({ isMobile, initialSubTab = "home" }: { isMobile?: boolean; initialSubTab?: SubTab }) {
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab);
  const admin = isBierAdmin();

  const tabs: { id: SubTab; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "fridge", label: "Kühlschrank" },
    { id: "scoreboard", label: "Score" },
    ...(admin ? [{ id: "kasse" as SubTab, label: "Kasse" }, { id: "admin" as SubTab, label: "Admin" }] : []),
  ];

  return (
    <div style={{ height: "var(--content-h)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", height: 40, alignItems: "stretch", borderBottom: "1px solid var(--c-border)", background: "var(--c-bg)", overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"], flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ flex: "none", border: "none", background: "transparent", fontSize: 13, padding: "0 18px", whiteSpace: "nowrap", fontWeight: subTab === t.id ? 700 : 400, color: subTab === t.id ? "var(--c-text)" : "var(--c-text-2)", borderBottom: `2px solid ${subTab === t.id ? "var(--c-text)" : "transparent"}`, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {subTab === "home" && <HomeTab isMobile={isMobile} />}
        {subTab === "fridge" && <FridgeTab />}
        {subTab === "scoreboard" && <ScoreboardTab />}
        {subTab === "kasse" && <KasseTab />}
        {subTab === "admin" && <AdminTab />}
      </div>
    </div>
  );
}
