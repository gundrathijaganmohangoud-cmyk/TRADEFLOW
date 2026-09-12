import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, createUser, listUsers, type Role, type User } from "../api";

const ROLES: Role[] = ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"];

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "SALES" as Role,
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-user form
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers();
      setUsers(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateField<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setFieldErrors({});

    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      setFormError("Name, email and a password of at least 8 characters are required.");
      return;
    }

    setSaving(true);
    try {
      await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      setForm(EMPTY_FORM);
      setFormSuccess(`User "${form.name.trim()}" created.`);
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError(err instanceof Error ? err.message : "Failed to create user");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Users</h2>
          <p>Admin-only management of portal accounts and roles.</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card card-form">
        <h3>Create User</h3>
        {formError && <div className="form-error">{formError}</div>}
        {formSuccess && <div className="form-success">{formSuccess}</div>}

        <form onSubmit={handleCreate} noValidate>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="user-name">Name *</label>
              <input
                id="user-name"
                value={form.name}
                className={fieldErrors.name ? "invalid" : ""}
                onChange={(e) => updateField("name", e.target.value)}
              />
              {fieldErrors.name && <span className="error">{fieldErrors.name}</span>}
            </div>

            <div className="field">
              <label htmlFor="user-email">Email *</label>
              <input
                id="user-email"
                type="email"
                value={form.email}
                className={fieldErrors.email ? "invalid" : ""}
                onChange={(e) => updateField("email", e.target.value)}
              />
              {fieldErrors.email && <span className="error">{fieldErrors.email}</span>}
            </div>

            <div className="field">
              <label htmlFor="user-password">Password * (min 8 chars)</label>
              <input
                id="user-password"
                type="password"
                value={form.password}
                className={fieldErrors.password ? "invalid" : ""}
                onChange={(e) => updateField("password", e.target.value)}
              />
              {fieldErrors.password && <span className="error">{fieldErrors.password}</span>}
            </div>

            <div className="field">
              <label htmlFor="user-role">Role *</label>
              <select
                id="user-role"
                value={form.role}
                className={fieldErrors.role ? "invalid" : ""}
                onChange={(e) => updateField("role", e.target.value)}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              {fieldErrors.role && <span className="error">{fieldErrors.role}</span>}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="table-empty">No users found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Name">
                      <strong>{user.name}</strong>
                    </td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Role">
                      <span className="role-badge">{user.role}</span>
                    </td>
                    <td data-label="Created">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
