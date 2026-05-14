import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVeranstaltungen } from "../api/veranstaltungen";
import { getApiUrl } from "../api/client";
import type { Veranstaltung } from "../types/veranstaltungen";

const WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

interface Props {
  isMobile?: boolean;
  onGoToEvent?: (id: number) => void;
}

export default function Kalender({ isMobile = false, onGoToEvent }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [copied, setCopied] = useState(false);

  const icalUrl = `${getApiUrl()}/veranstaltungen/ical`;
  const webcalUrl = icalUrl.replace(/^https?:\/\//, "webcal://");

  function copyUrl() {
    navigator.clipboard.writeText(icalUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const { data: events = [] } = useQuery({
    queryKey: ["veranstaltungen"],
    queryFn: fetchVeranstaltungen,
  });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const totalCells = Math.ceil((daysInMonth + startDow) / 7) * 7;
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const result: Array<{ dateStr: string; day: number; inMonth: boolean }> = [];

    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const m2 = month === 0 ? 11 : month - 1;
      const y2 = month === 0 ? year - 1 : year;
      result.push({ dateStr: `${y2}-${String(m2 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: true });
    }
    const nextCount = totalCells - daysInMonth - startDow;
    const m2 = month === 11 ? 0 : month + 1;
    const y2 = month === 11 ? year + 1 : year;
    for (let d = 1; d <= nextCount; d++) {
      result.push({ dateStr: `${y2}-${String(m2 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: false });
    }
    return result;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, Veranstaltung[]> = {};
    for (const ev of events) {
      const d = ev.date.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(ev);
    }
    return map;
  }, [events]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const monthEvents = useMemo(() =>
    events
      .filter(ev => {
        const d = new Date(ev.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .sort((a, b) => a.date.localeCompare(b.date)),
    [events, year, month]
  );

  const navBtnStyle: React.CSSProperties = {
    padding: "6px 12px",
    border: "1px solid var(--c-border)",
    borderRadius: 6,
    background: "var(--c-bg)",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    color: "var(--c-text-2)",
  };

  return (
    <div style={{ height: "var(--content-h)", overflowY: "auto", padding: isMobile ? "12px 8px" : "20px 24px", boxSizing: "border-box", background: "var(--c-bg-2)" }}>
      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={prevMonth} style={navBtnStyle}>‹</button>
        <span style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, flex: 1, textAlign: "center", color: "var(--c-text)" }}>
          {MONTHS_DE[month]} {year}
        </span>
        <button onClick={nextMonth} style={navBtnStyle}>›</button>
        <button
          onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}
          style={{ ...navBtnStyle, fontSize: 12, color: "var(--c-text-2)", whiteSpace: "nowrap" }}
        >
          Heute
        </button>

        {/* Subscribe button */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowSubscribe(s => !s)}
            style={{
              padding: "6px 10px",
              border: "1px solid var(--c-border)",
              borderRadius: 6,
              background: showSubscribe ? "var(--c-bg-3)" : "var(--c-bg)",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--c-text-2)",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {!isMobile && "Abonnieren"}
          </button>

          {showSubscribe && (
            <>
              <div onClick={() => setShowSubscribe(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />
              <div style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: "var(--c-bg)",
                border: "1px solid var(--c-border)",
                borderRadius: 10,
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                padding: 16,
                minWidth: 300,
                zIndex: 50,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 4 }}>
                  Kalender abonnieren
                </div>
                <div style={{ fontSize: 12, color: "var(--c-text-2)", marginBottom: 12, lineHeight: 1.5 }}>
                  Abonniere den Feed in Google Calendar, Apple Calendar oder einer anderen Kalender-App.
                </div>

                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "var(--c-bg-2)",
                  border: "1px solid var(--c-border)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  marginBottom: 10,
                }}>
                  <span style={{ fontSize: 11, color: "var(--c-text-2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                    {icalUrl}
                  </span>
                  <button
                    onClick={copyUrl}
                    style={{
                      flexShrink: 0,
                      padding: "3px 8px",
                      border: "1px solid var(--c-border)",
                      borderRadius: 4,
                      background: copied ? "#f0fdf4" : "var(--c-bg)",
                      color: copied ? "#16a34a" : "var(--c-text-2)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {copied ? "Kopiert!" : "Kopieren"}
                  </button>
                </div>

                <a
                  href={webcalUrl}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "8px 12px",
                    background: "var(--c-text)",
                    color: "var(--c-bg)",
                    borderRadius: 6,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  In Kalender-App öffnen
                </a>

                <div style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 8, textAlign: "center" }}>
                  Öffnet die Standard-Kalender-App über webcal://
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ background: "var(--c-bg)", borderRadius: 12, border: "1px solid var(--c-border)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        {/* Weekday headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "2px solid var(--c-border)" }}>
          {WEEKDAYS_DE.map((wd, i) => (
            <div
              key={wd}
              style={{
                padding: "10px 4px",
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                color: i >= 5 ? "#ef4444" : "var(--c-text-2)",
                background: "var(--c-bg-2)",
                borderRight: i < 6 ? "1px solid var(--c-border)" : undefined,
                letterSpacing: "0.04em",
              }}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {cells.map((cell, i) => {
            const dayEvents = eventsByDate[cell.dateStr] ?? [];
            const isToday = cell.dateStr === todayStr;
            const isWeekend = i % 7 >= 5;
            const maxChips = 2;
            const overflow = dayEvents.length > maxChips;

            return (
              <div
                key={`${cell.dateStr}-${i}`}
                style={{
                  minHeight: isMobile ? 56 : 108,
                  padding: isMobile ? "6px 4px" : "8px 8px",
                  background: !cell.inMonth
                    ? "var(--c-bg-2)"
                    : isWeekend ? "var(--c-bg-2)" : "var(--c-bg)",
                  borderRight: (i + 1) % 7 !== 0 ? "1px solid var(--c-border)" : undefined,
                  borderBottom: "1px solid var(--c-border)",
                  boxSizing: "border-box",
                }}
              >
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: isToday ? "var(--c-today)" : "transparent",
                  color: isToday
                    ? "var(--c-today-fg)"
                    : !cell.inMonth ? "var(--c-text-3)"
                    : isWeekend ? "#ef4444"
                    : "var(--c-text)",
                  fontSize: 13,
                  fontWeight: isToday ? 700 : cell.inMonth ? 500 : 400,
                  marginBottom: 4,
                }}>
                  {cell.day}
                </div>

                {!isMobile && dayEvents.slice(0, maxChips).map(ev => (
                  <div
                    key={ev.id}
                    onClick={() => onGoToEvent?.(ev.id)}
                    title={ev.name}
                    style={{
                      background: "var(--c-event)",
                      color: "#fff",
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 11,
                      marginBottom: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      cursor: "pointer",
                      lineHeight: "16px",
                      fontWeight: 500,
                    }}
                  >
                    {ev.name}
                  </div>
                ))}
                {!isMobile && overflow && (
                  <div style={{ fontSize: 11, color: "var(--c-text-2)", paddingLeft: 2, fontWeight: 500 }}>
                    +{dayEvents.length - maxChips} weitere
                  </div>
                )}

                {isMobile && dayEvents.length > 0 && (
                  <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-event)", flexShrink: 0 }} />
                    ))}
                    {dayEvents.length > 3 && (
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-text-3)", flexShrink: 0 }} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: event list for current month */}
      {isMobile && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 8 }}>
            Events in {MONTHS_DE[month]} {year}
          </div>
          {monthEvents.length === 0 && (
            <div style={{ color: "var(--c-text-3)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
              Keine Events in diesem Monat.
            </div>
          )}
          {monthEvents.map(ev => {
            const d = new Date(ev.date);
            return (
              <div
                key={ev.id}
                onClick={() => onGoToEvent?.(ev.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: "var(--c-bg)",
                  border: "1px solid var(--c-border)",
                  borderRadius: 8,
                  marginBottom: 8,
                  cursor: onGoToEvent ? "pointer" : "default",
                }}
              >
                <div style={{ textAlign: "center", minWidth: 36, flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--c-text)", lineHeight: 1 }}>{d.getDate()}</div>
                  <div style={{ fontSize: 10, color: "var(--c-text-2)" }}>{MONTHS_DE[d.getMonth()].slice(0, 3)}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ev.name}
                  </div>
                  {ev.description && (
                    <div style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ev.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
