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

type Tab = "members" | "finance" | "beitraege" | "files";

const TABS: { id: Tab; label: string }[] = [
  { id: "members",    label: "Mitglieder" },
  { id: "finance",    label: "Finanzen" },
  { id: "beitraege",  label: "Beiträge" },
  { id: "files",      label: "Dateien" },
];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [showProfile, setShowProfile] = useState(false);
  const queryClient = useQueryClient();

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

  return (
    <div>
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

      {activeTab === "members"   && <Members onLogout={handleLogout} />}
      {activeTab === "finance"   && <Finance />}
      {activeTab === "beitraege" && <Mitgliederbeitraege />}
      {activeTab === "files"     && <Files />}

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
    </div>
  );
}
