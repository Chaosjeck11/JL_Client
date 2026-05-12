import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Login from "./screens/Login";
import Members from "./screens/Members";
import Finance from "./screens/Finance";
import Mitgliederbeitraege from "./screens/Mitgliederbeitraege";
import Files from "./screens/Files";
import ProfileModal from "./screens/ProfileModal";
import { getToken, logout } from "./auth/auth";
import { getCurrentUser } from "./auth/currentUser";
import { fetchMember } from "./api/members";
import { getApiUrl } from "./api/client";
import { useIsMobile } from "./hooks/useIsMobile";

type Tab = "members" | "finance" | "beitraege" | "files";

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
    id: "files",
    label: "Dateien",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [showProfile, setShowProfile] = useState(false);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const currentUser = loggedIn ? getCurrentUser() : null;
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

  return (
    <div>
      {/* ── Desktop nav (top tabs) ── */}
      {!isMobile && (
        <nav style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "0 12px", borderBottom: "1px solid #e2e8f0",
          height: 44, boxSizing: "border-box", background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "0 16px", height: "100%", border: "none", background: "transparent",
                fontSize: 14, cursor: "pointer",
                fontWeight: activeTab === tab.id ? 700 : 400,
                color: activeTab === tab.id ? "#1e293b" : "#64748b",
                borderBottom: activeTab === tab.id ? "2px solid #1e293b" : "2px solid transparent",
                borderTop: "2px solid transparent",
              }}
            >
              {tab.label}
            </button>
          ))}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {avatarButton}
            <button
              onClick={handleLogout}
              style={{
                padding: "5px 14px", borderRadius: 6, border: "1px solid #d1d5db",
                background: "#fff", fontSize: 13, cursor: "pointer", color: "#374151",
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
          padding: "0 16px", borderBottom: "1px solid #e2e8f0",
          height: 44, boxSizing: "border-box", background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          position: "sticky", top: 0, zIndex: 50,
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", letterSpacing: -0.5 }}>
            {TABS.find(t => t.id === activeTab)?.label ?? "JL"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {avatarButton}
            <button
              onClick={handleLogout}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db",
                background: "#fff", fontSize: 13, cursor: "pointer", color: "#374151",
              }}
            >
              Logout
            </button>
          </div>
        </nav>
      )}

      {/* ── Screen content ── */}
      {activeTab === "members"   && <Members onLogout={handleLogout} isMobile={isMobile} />}
      {activeTab === "finance"   && <Finance isMobile={isMobile} />}
      {activeTab === "beitraege" && <Mitgliederbeitraege isMobile={isMobile} />}
      {activeTab === "files"     && <Files isMobile={isMobile} />}

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

      {/* ── Mobile bottom nav ── */}
      {isMobile && (
        <nav
          className="mobile-bottom-nav"
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            height: 56, background: "#fff", borderTop: "1px solid #e2e8f0",
            display: "flex", alignItems: "stretch",
            zIndex: 100, boxShadow: "0 -1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, border: "none", background: "transparent",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 3, cursor: "pointer",
                color: activeTab === tab.id ? "#1e293b" : "#94a3b8",
                borderTop: `2px solid ${activeTab === tab.id ? "#1e293b" : "transparent"}`,
                fontSize: 10, fontWeight: activeTab === tab.id ? 700 : 400,
                padding: "4px 0",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
