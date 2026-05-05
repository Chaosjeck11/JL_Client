import { useState } from "react";
import Login from "./screens/Login";
import Members from "./screens/Members";
import Finance from "./screens/Finance";
import { getToken } from "./auth/auth";

type Tab = "members" | "finance";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [activeTab, setActiveTab] = useState<Tab>("members");

  function handleLogout() {
    setLoggedIn(false);
    setActiveTab("members");
  }

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <div>
      <nav style={{ display: "flex", gap: "8px", padding: "8px", borderBottom: "1px solid #ccc" }}>
        <button
          onClick={() => setActiveTab("members")}
          style={{ fontWeight: activeTab === "members" ? "bold" : "normal" }}
        >
          Mitglieder
        </button>
        <button
          onClick={() => setActiveTab("finance")}
          style={{ fontWeight: activeTab === "finance" ? "bold" : "normal" }}
        >
          Finanzen
        </button>
        <button onClick={handleLogout} style={{ marginLeft: "auto" }}>
          Logout
        </button>
      </nav>
      {activeTab === "members" ? (
        <Members onLogout={handleLogout} />
      ) : (
        <Finance />
      )}
    </div>
  );
}
