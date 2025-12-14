import { useState } from "react";
import { login } from "../core/api/aederaApi";

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => Promise<void> | void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, remember);
      await onLoggedIn();
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "48px auto", padding: 16 }}>
      <h2>Accedi</h2>

      <form onSubmit={submit}>
        <div style={{ marginTop: 12 }}>
          <label>Email</label>
          <input
            style={{ width: "100%", padding: 8 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Password</label>
          <input
            style={{ width: "100%", padding: 8 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <label style={{ display: "block", marginTop: 12 }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />{" "}
          Ricordami
        </label>

        {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

        <button style={{ marginTop: 16, padding: "8px 12px" }} disabled={loading}>
          {loading ? "..." : "Login"}
        </button>
      </form>
    </div>
  );
}
