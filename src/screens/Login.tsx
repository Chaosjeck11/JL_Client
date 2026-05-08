import { useState } from "react";
import { login } from "../auth/auth";

type Props = {
  onSuccess: () => void;
};

export default function Login({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      await login(email, password);
      onSuccess(); // ✅ HIER
    } catch {
      setError("Login fehlgeschlagen");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>

      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="E-Mail"
      />

      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Passwort"
      />

      <button type="submit">Login</button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}
