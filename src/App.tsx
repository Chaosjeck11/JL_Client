import { useState } from "react";
import Login from "./screens/Login";
import Members from "./screens/Members";
import { getToken } from "./auth/auth";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());

  return loggedIn ? (
    <Members onLogout={() => setLoggedIn(false)} />
  ) : (
    <Login onSuccess={() => setLoggedIn(true)} />
  );
}
