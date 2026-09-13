import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const TEST_ACCOUNTS: Array<{ role: string; email: string; password: string; title: string; description: string }> = [
  { role: "ADMIN", email: "admin@erp.com", password: "Admin@123", title: "Admin", description: "See the whole operation" },
  { role: "SALES", email: "sales@erp.com", password: "Sales@123", title: "Sales", description: "Grow customer relationships" },
  { role: "WAREHOUSE", email: "warehouse@erp.com", password: "Warehouse@123", title: "Warehouse", description: "Keep stock moving" },
  { role: "ACCOUNTS", email: "accounts@erp.com", password: "Accounts@123", title: "Accounts", description: "Own the dispatch trail" },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState("SALES");

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

  function prefill(account: (typeof TEST_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setSelectedRole(account.role);
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
    <div className={`login-page login-${selectedRole.toLowerCase()}`}>
      <div className="login-aside">
        <Link to="/about" className="brand-lockup"><span className="brand-mark">T</span><strong>TradeFlow</strong></Link>
        <div className="login-aside-copy"><span className="eyebrow">Operations OS</span><h1>Move business forward, together.</h1><p>One connected workspace for the people who sell, stock, dispatch and steer the operation.</p></div>
        <Link to="/about" className="about-link">How TradeFlow works <span>→</span></Link>
      </div>
      <div className="login-card">
        <div className="login-heading"><span className="eyebrow">Welcome back</span><h2>Enter your workspace.</h2><p className="subtitle">Choose your team view, then sign in securely.</p></div>

        <div className="role-picker" aria-label="Choose workspace">
          {TEST_ACCOUNTS.map((account) => (
            <button type="button" key={account.role} className={`role-option ${selectedRole === account.role ? "selected" : ""}`} onClick={() => prefill(account)}>
              <span className="role-option-mark">{account.title.charAt(0)}</span><span><strong>{account.title}</strong><small>{account.description}</small></span>
            </button>
          ))}
        </div>

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

        <div className="login-security"><span>●</span> Secure role-based access <span className="security-divider" /> <Link to="/about">Learn about TradeFlow</Link></div>
      </div>
    </div>
  );
}