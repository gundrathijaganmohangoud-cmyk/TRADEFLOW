import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const TEST_ACCOUNTS: Array<{ role: string; email: string; password: string }> = [
  { role: "ADMIN", email: "admin@erp.com", password: "Admin@123" },
  { role: "SALES", email: "sales@erp.com", password: "Sales@123" },
  { role: "WAREHOUSE", email: "warehouse@erp.com", password: "Warehouse@123" },
  { role: "ACCOUNTS", email: "accounts@erp.com", password: "Accounts@123" },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from || "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function prefill(account: { email: string; password: string }) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  }

  // Already signed in? The router will redirect away; render nothing fancy.
  if (user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>TradeFlow</h1>
          <p className="subtitle">You are already signed in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>TradeFlow</h1>
        <p className="subtitle">ERP/CRM Portal — sign in to continue</p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field" style={{ marginBottom: 18 }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="login-hint">
          <strong>Test credentials</strong> (click to prefill):
          <ul>
            {TEST_ACCOUNTS.map((account) => (
              <li
                key={account.email}
                onClick={() => prefill(account)}
                style={{ cursor: "pointer" }}
                title="Click to prefill"
              >
                <code>{account.email}</code> / <code>{account.password}</code>{" "}
                <em>({account.role})</em>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}