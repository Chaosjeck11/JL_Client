import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Login from "./screens/Login";
import Members from "./screens/Members";
import Finance from "./screens/Finance";
import Mitgliederbeitraege from "./screens/Mitgliederbeitraege";
import Files from "./screens/Files";
import Veranstaltungen from "./screens/Veranstaltungen";
import Kalender from "./screens/Kalender";
import Strafen from "./screens/Strafen";
import Bierliste from "./screens/Bierliste";
import ProfileModal from "./screens/ProfileModal";
import { getToken, logout } from "./auth/auth";
import { checkForUpdate, UpdateInfo } from "./update/checkUpdate";
import { UpdateModal } from "./update/UpdateModal";
import { getCurrentUser } from "./auth/currentUser";
import { canSeeFinance, canSeeAllStrafen } from "./auth/permissions";
import { fetchMember } from "./api/members";
import { getApiUrl } from "./api/client";
import { useIsMobile } from "./hooks/useIsMobile";
import { version as APP_VERSION } from "../package.json";

type Tab = "members" | "finance" | "beitraege" | "strafen" | "meine_strafen" | "alle_strafen" | "files" | "veranstaltungen" | "kalender" | "bierliste";

const FINANCE_GROUP: Tab[] = ["finance", "beitraege", "strafen", "meine_strafen", "alle_strafen"];
const EVENTS_GROUP: Tab[] = ["veranstaltungen", "kalender"];

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "members",
    label: "Mitglieder",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: "finance",
    label: "Finanzen",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    id: "beitraege",
    label: "Beiträge",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    id: "strafen",
    label: "Strafen",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
        <line x1="4" y1="22" x2="4" y2="15"/>
      </svg>
    ),
  },
  {
    id: "files",
    label: "Dateien",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: "veranstaltungen",
    label: "Events",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    id: "kalender",
    label: "Kalender",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="3" y1="16" x2="21" y2="16"/>
        <line x1="9" y1="10" x2="9" y2="22"/>
        <line x1="15" y1="10" x2="15" y2="22"/>
      </svg>
    ),
  },
  {
    id: "bierliste",
    label: "Bierliste",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 11h1a3 3 0 0 1 0 6h-1"/>
        <path d="M9 12v6"/>
        <path d="M13 12v6"/>
        <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.44.5-3 .5"/>
        <path d="M6 5v17"/>
        <path d="M18 5v17"/>
        <path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2H5V5z"/>
      </svg>
    ),
  },
];

// Mobile bottom nav: 5 grouped items
const MOBILE_NAV_ITEMS = [
  { tab: TABS[0], groupTabs: null as Tab[] | null },
  { tab: TABS[1], groupTabs: FINANCE_GROUP },
  { tab: TABS[4], groupTabs: null as Tab[] | null },
  { tab: TABS[5], groupTabs: EVENTS_GROUP },
  { tab: TABS[7], groupTabs: null as Tab[] | null },
];

const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingEventId, setPendingEventId] = useState<number | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateCheckDone, setUpdateCheckDone] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const d = localStorage.getItem("dark_mode") === "true";
    document.documentElement.setAttribute("data-theme", d ? "dark" : "light");
    return d;
  });
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const isFinanceGroup = (FINANCE_GROUP as string[]).includes(activeTab);
  const isEventsGroup = (EVENTS_GROUP as string[]).includes(activeTab);

  // Update --content-h when subtab bar appears/disappears on mobile
  useEffect(() => {
    if (!isMobile) {
      document.documentElement.style.removeProperty("--content-h");
      return;
    }
    const hasSubtabs = isFinanceGroup || isEventsGroup;
    document.documentElement.style.setProperty(
      "--content-h",
      hasSubtabs
        ? "calc(100vh - 44px - 40px - 56px)"
        : "calc(100vh - 44px - 56px)",
    );
  }, [isMobile, isFinanceGroup, isEventsGroup]);

  useEffect(() => {
    if (loggedIn) checkForUpdate().then((info) => { if (info) setPendingUpdate(info); }).catch(() => {});
  }, [loggedIn]);

  const currentUser = loggedIn ? getCurrentUser() : null;
const canFinance = loggedIn ? canSeeFinance() : false;
  const { data: currentMember = null } = useQuery({
    queryKey: ["members", currentUser?.sub],
    queryFn: () => fetchMember(currentUser!.sub),
    enabled: !!currentUser,
  });

  function handleLogout() {
    logout();
    queryClient.clear();
    setLoggedIn(false);
    setActiveTab("members");
  }

  async function handleManualCheck() {
    setCheckingUpdate(true);
    setUpdateCheckDone(false);
    try {
      const info = await checkForUpdate();
      if (info) {
        setPendingUpdate(info);
        setShowSettings(false);
      } else {
        setUpdateCheckDone(true);
        setTimeout(() => setUpdateCheckDone(false), 3000);
      }
    } finally {
      setCheckingUpdate(false);
    }
  }

  function toggleDarkMode() {
    setDarkMode(d => {
      const next = !d;
      document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
      localStorage.setItem("dark_mode", String(next));
      return next;
    });
  }

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  const avatarUrl = currentMember?.avatarPath ? `${getApiUrl()}/${currentMember.avatarPath}` : null;
  const initial   = currentMember?.firstname.charAt(0).toUpperCase() ?? "?";

  const avatarButton = (
    <button
      onClick={() => setShowProfile(true)}
      title="Mein Profil"
      style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "#3b82f6", color: "#fff",
        border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, padding: 0, overflow: "hidden", flexShrink: 0,
      }}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
        : initial}
    </button>
  );

  const settingsMenu = showSettings && (
    <>
      <div onClick={() => setShowSettings(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
      <div style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        background: "var(--c-bg)",
        border: "1px solid var(--c-border)",
        borderRadius: 10,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        padding: "12px 14px",
        minWidth: 176,
        zIndex: 200,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-2)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Darstellung
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => { if (darkMode) toggleDarkMode(); }}
            style={{
              flex: 1, padding: "10px 4px", borderRadius: 8,
              border: "1px solid var(--c-border)",
              background: !darkMode ? "#1e293b" : "var(--c-bg-2)",
              color: !darkMode ? "#ffffff" : "var(--c-text-2)",
              fontSize: 12, cursor: !darkMode ? "default" : "pointer",
              fontWeight: 600,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}
          >
            <span style={{ fontSize: 20 }}>☀️</span>
            <span>Hell</span>
          </button>
          <button
            onClick={() => { if (!darkMode) toggleDarkMode(); }}
            style={{
              flex: 1, padding: "10px 4px", borderRadius: 8,
              border: "1px solid var(--c-border)",
              background: darkMode ? "#3b82f6" : "var(--c-bg-2)",
              color: darkMode ? "#ffffff" : "var(--c-text-2)",
              fontSize: 12, cursor: darkMode ? "default" : "pointer",
              fontWeight: 600,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}
          >
            <span style={{ fontSize: 20 }}>🌙</span>
            <span>Dunkel</span>
          </button>
        </div>
        <div style={{ borderTop: "1px solid var(--c-border)", marginTop: 10, paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--c-text-3)", fontWeight: 500 }}>v{APP_VERSION}</span>
          <button
            onClick={handleManualCheck}
            disabled={checkingUpdate}
            style={{
              padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: "1px solid var(--c-border)", cursor: checkingUpdate ? "default" : "pointer",
              background: updateCheckDone ? "#dcfce7" : "var(--c-bg-2)",
              color: updateCheckDone ? "#16a34a" : "var(--c-text-2)",
            }}
          >
            {checkingUpdate ? "Prüfe…" : updateCheckDone ? "Aktuell ✓" : "Update prüfen"}
          </button>
        </div>
      </div>
    </>
  );

  const gearButton = (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowSettings(s => !s)}
        title="Einstellungen"
        style={{
          width: 32, height: 32, borderRadius: 6,
          background: showSettings ? "var(--c-bg-3)" : "var(--c-bg-2)",
          color: "var(--c-text-2)",
          border: "1px solid var(--c-border)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <GearIcon />
      </button>
      {settingsMenu}
    </div>
  );

  const mobileTitle = isFinanceGroup ? "Finanzen"
    : isEventsGroup ? "Events"
    : TABS.find(t => t.id === activeTab)?.label ?? "JL";

  const subtabBtnStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1, border: "none", background: "transparent", fontSize: 13,
    fontWeight: isActive ? 700 : 400,
    color: isActive ? "var(--c-text)" : "var(--c-text-2)",
    borderBottom: `2px solid ${isActive ? "var(--c-text)" : "transparent"}`,
    cursor: "pointer", padding: "0 4px",
  });

  return (
    <div>
      {/* ── Desktop nav (top tabs) ── */}
      {!isMobile && (
        <nav style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "0 12px", borderBottom: "1px solid var(--c-border)",
          height: 44, boxSizing: "border-box", background: "var(--c-nav)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <span style={{ fontSize: 11, color: "var(--c-text-3)", fontWeight: 500, marginRight: 4, flexShrink: 0 }}>
            v{APP_VERSION}
          </span>
          {TABS.filter(tab => {
            if (tab.id === "finance" || tab.id === "beitraege") return canFinance;
            return true;
          }).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "0 16px", height: "100%", border: "none", background: "transparent",
                fontSize: 14, cursor: "pointer",
                fontWeight: activeTab === tab.id ? 700 : 400,
                color: activeTab === tab.id ? "var(--c-text)" : "var(--c-text-2)",
                borderBottom: activeTab === tab.id ? "2px solid var(--c-text)" : "2px solid transparent",
                borderTop: "2px solid transparent",
              }}
            >
              {tab.label}
            </button>
          ))}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {gearButton}
            {avatarButton}
            <button
              onClick={handleLogout}
              style={{
                padding: "5px 14px", borderRadius: 6, border: "1px solid var(--c-border)",
                background: "var(--c-bg)", fontSize: 13, cursor: "pointer", color: "var(--c-text-2)",
              }}
            >
              Logout
            </button>
          </div>
        </nav>
      )}

      {/* ── Mobile top bar ── */}
      {isMobile && (
        <nav style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", borderBottom: "1px solid var(--c-border)",
          height: 44, boxSizing: "border-box", background: "var(--c-nav)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          position: "sticky", top: 0, zIndex: 50,
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--c-text)", letterSpacing: -0.5 }}>
            {mobileTitle}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {gearButton}
            {avatarButton}
            <button
              onClick={handleLogout}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "1px solid var(--c-border)",
                background: "var(--c-bg)", fontSize: 13, cursor: "pointer", color: "var(--c-text-2)",
              }}
            >
              Logout
            </button>
          </div>
        </nav>
      )}

      {/* ── Mobile Finance subtab bar ── */}
      {isMobile && isFinanceGroup && (
        <div style={{
          display: "flex", height: 40, alignItems: "stretch",
          borderBottom: "1px solid var(--c-border)",
          background: "var(--c-bg)", position: "sticky", top: 44, zIndex: 49,
          overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
        }}>
          {([
            ...(canFinance ? [{ id: "finance" as Tab, label: "Kassenbuch" }] : []),
            ...(canFinance ? [{ id: "beitraege" as Tab, label: "Beiträge" }] : []),
            { id: "strafen" as Tab, label: "Strafen" },
            { id: "meine_strafen" as Tab, label: "Deine Str." },
            ...(canSeeAllStrafen() ? [{ id: "alle_strafen" as Tab, label: "Alle Str." }] : []),
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: "none", border: "none", background: "transparent",
                fontSize: 13, padding: "0 14px", whiteSpace: "nowrap",
                fontWeight: activeTab === t.id ? 700 : 400,
                color: activeTab === t.id ? "var(--c-text)" : "var(--c-text-2)",
                borderBottom: `2px solid ${activeTab === t.id ? "var(--c-text)" : "transparent"}`,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Mobile Events subtab bar ── */}
      {isMobile && isEventsGroup && (
        <div style={{
          display: "flex", height: 40, alignItems: "stretch",
          borderBottom: "1px solid var(--c-border)",
          background: "var(--c-bg)", position: "sticky", top: 44, zIndex: 49,
        }}>
          {[
            { id: "veranstaltungen" as Tab, label: "Events" },
            { id: "kalender" as Tab, label: "Kalender" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={subtabBtnStyle(activeTab === t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Screen content ── */}
      {activeTab === "members"   && <Members onLogout={handleLogout} isMobile={isMobile} />}
      {activeTab === "finance"   && <Finance isMobile={isMobile} />}
      {activeTab === "beitraege" && <Mitgliederbeitraege isMobile={isMobile} />}
      {activeTab === "strafen"         && <Strafen isMobile={isMobile} hideSubTabBar={isMobile} />}
      {activeTab === "meine_strafen"   && <Strafen isMobile={isMobile} initialSubTab="meine" hideSubTabBar />}
      {activeTab === "alle_strafen"    && canSeeAllStrafen() && <Strafen isMobile={isMobile} initialSubTab="alle" hideSubTabBar />}
      {activeTab === "files"          && <Files isMobile={isMobile} />}
      {activeTab === "veranstaltungen" && <Veranstaltungen isMobile={isMobile} initialSelectedId={pendingEventId} />}
      {activeTab === "kalender" && (
        <Kalender
          isMobile={isMobile}
          onGoToEvent={(id) => { setPendingEventId(id); setActiveTab("veranstaltungen"); }}
        />
      )}
      {activeTab === "bierliste" && <Bierliste isMobile={isMobile} />}

      {pendingUpdate && (
        <UpdateModal info={pendingUpdate} onClose={() => setPendingUpdate(null)} />
      )}

      {showProfile && currentMember && (
        <ProfileModal
          member={currentMember}
          onClose={() => setShowProfile(false)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["members", currentUser?.sub] });
            setShowProfile(false);
          }}
          onAvatarChanged={() => {
            queryClient.invalidateQueries({ queryKey: ["members", currentUser?.sub] });
          }}
        />
      )}

      {/* ── Mobile bottom nav (4 grouped items) ── */}
      {isMobile && (
        <nav
          className="mobile-bottom-nav"
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            height: 56, background: "var(--c-nav)", borderTop: "1px solid var(--c-border)",
            display: "flex", alignItems: "stretch",
            zIndex: 100, boxShadow: "0 -1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {MOBILE_NAV_ITEMS.map(({ tab, groupTabs }) => {
            const isActive = groupTabs
              ? (groupTabs as string[]).includes(activeTab)
              : activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (groupTabs && isActive) return;
                  if (tab.id === "finance" && !canFinance) {
                    setActiveTab("strafen");
                  } else {
                    setActiveTab(tab.id);
                  }
                }}
                style={{
                  flex: 1, border: "none", background: "transparent",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 3, cursor: "pointer",
                  color: isActive ? "var(--c-text)" : "var(--c-text-3)",
                  borderTop: `2px solid ${isActive ? "var(--c-text)" : "transparent"}`,
                  fontSize: 10, fontWeight: isActive ? 700 : 400,
                  padding: "4px 0",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
