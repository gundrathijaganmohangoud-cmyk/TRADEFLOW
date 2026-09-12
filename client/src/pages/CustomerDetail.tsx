import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiError,
  addFollowUp,
  getCustomer,
  type CustomerDetail,
  type FollowUpStatus,
} from "../api";
import { useAuth } from "../auth";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "ACTIVE":
    case "DONE":
      return "badge badge-green";
    case "LEAD":
      return "badge badge-blue";
    case "PENDING":
      return "badge badge-amber";
    default:
      return "badge badge-gray";
  }
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SALES";

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add follow-up form
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatus>("PENDING");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getCustomer(id);
      setCustomer(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddFollowUp(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setFormError(null);
    setFormSuccess(null);

    if (!note.trim()) {
      setFormError("Follow-up note is required.");
      return;
    }
    if (!nextDate) {
      setFormError("Next follow-up date is required.");
      return;
    }

    setSaving(true);
    try {
      await addFollowUp(id, {
        note: note.trim(),
        date: new Date(nextDate).toISOString(),
        status: followUpStatus,
      });
      setNote("");
      setNextDate("");
      setFollowUpStatus("PENDING");
      setFormSuccess("Follow-up added.");
      await load();
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError(err instanceof Error ? err.message : "Failed to add follow-up");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading customer…</div>;
  }

  if (error || !customer) {
    return (
      <div>
        <Link to="/customers" className="back-link">
          ← Back to Customers
        </Link>
        <div className="form-error">{error || "Customer not found"}</div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/customers" className="back-link">
        ← Back to Customers
      </Link>

      <div className="page-header">
        <div>
          <h2>{customer.name}</h2>
          <p>
            {customer.businessName || "No business name"} · {customer.city || "Unknown city"}
          </p>
        </div>
        <span className={statusBadgeClass(customer.status)}>{customer.status}</span>
      </div>

      <div className="card">
        <h3>Profile</h3>
        <div className="detail-grid">
          <div className="field-item">
            <div className="label">Mobile</div>
            <div className="value">{customer.mobile}</div>
          </div>
          <div className="field-item">
            <div className="label">Type</div>
            <div className="value">{customer.type}</div>
          </div>
          <div className="field-item">
            <div className="label">Business name</div>
            <div className="value">{customer.businessName || "—"}</div>
          </div>
          <div className="field-item">
            <div className="label">Next follow-up</div>
            <div className="value">{formatDate(customer.followUpDate)}</div>
          </div>
          <div className="field-item">
            <div className="label">Address</div>
            <div className="value">{customer.address || "—"}</div>
          </div>
          <div className="field-item">
            <div className="label">City</div>
            <div className="value">{customer.city || "—"}</div>
          </div>
          <div className="field-item">
            <div className="label">State</div>
            <div className="value">{customer.state || "—"}</div>
          </div>
          <div className="field-item">
            <div className="label">Challans</div>
            <div className="value">{customer._count.challans}</div>
          </div>
          <div className="field-item">
            <div className="label">Created</div>
            <div className="value">{formatDate(customer.createdAt)}</div>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="card card-form">
          <h3>Add Follow-up</h3>
          {formError && <div className="form-error">{formError}</div>}
          {formSuccess && <div className="form-success">{formSuccess}</div>}
          <form onSubmit={handleAddFollowUp} noValidate>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="fu-note">Note *</label>
                <textarea
                  id="fu-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What was discussed? Next steps…"
                />
              </div>
              <div className="field">
                <label htmlFor="fu-date">Next date *</label>
                <input
                  id="fu-date"
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="fu-status">Status</label>
                <select
                  id="fu-status"
                  value={followUpStatus}
                  onChange={(e) => setFollowUpStatus(e.target.value as FollowUpStatus)}
                >
                  <option value="PENDING">PENDING</option>
                  <option value="DONE">DONE</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Add Follow-up"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Follow-up History ({customer.followUps.length})</h3>
        {customer.followUps.length === 0 ? (
          <div className="table-empty">No follow-ups recorded yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Note</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {customer.followUps.map((followUp) => (
                  <tr key={followUp.id}>
                    <td data-label="Date">{formatDate(followUp.date)}</td>
                    <td data-label="Note">{followUp.note}</td>
                    <td data-label="Status">
                      <span className={statusBadgeClass(followUp.status)}>{followUp.status}</span>
                    </td>
                    <td data-label="Created">{formatDate(followUp.createdAt)}</td>
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
