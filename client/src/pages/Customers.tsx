import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ApiError,
  createCustomer,
  listCustomers,
  type Customer,
  type CustomerStatus,
  type CustomerType,
  type PaginationMeta,
} from "../api";
import { useAuth } from "../auth";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: "",
  mobile: "",
  businessName: "",
  type: "RETAIL" as CustomerType,
  status: "ACTIVE" as CustomerStatus,
  address: "",
  city: "",
  state: "",
  followUpDate: "",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusBadgeClass(status: CustomerStatus): string {
  switch (status) {
    case "ACTIVE":
      return "badge badge-green";
    case "LEAD":
      return "badge badge-blue";
    default:
      return "badge badge-gray";
  }
}

export default function Customers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = user?.role === "ADMIN" || user?.role === "SALES";

  // Filter state (raw input + debounced query)
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | CustomerStatus>("");
  const [type, setType] = useState<"" | CustomerType>("");
  const [page, setPage] = useState(1);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Debounce the search box (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listCustomers({
        search: search || undefined,
        status: status || undefined,
        type: type || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setCustomers(result.data);
      setMeta(result.meta ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [search, status, type, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openModal() {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setModalError(null);
    setShowModal(true);
  }

  function updateField<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setModalError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      await createCustomer({
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        businessName: form.businessName.trim() || undefined,
        type: form.type,
        status: form.status,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        followUpDate: form.followUpDate || undefined,
      });
      setShowModal(false);
      setPage(1);
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setModalError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setModalError(err instanceof Error ? err.message : "Failed to create customer");
      }
    } finally {
      setSaving(false);
    }
  }

  const pageNumbers = useMemo(() => {
    if (!meta || meta.totalPages <= 1) return [];
    const pages: number[] = [];
    const start = Math.max(1, meta.page - 2);
    const end = Math.min(meta.totalPages, start + 4);
    for (let p = start; p <= end; p += 1) pages.push(p);
    return pages;
  }, [meta]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Customers</h2>
          <p>Manage retail, wholesale and distributor accounts.</p>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={openModal}>
            + Add Customer
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search name, mobile or business…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | CustomerStatus);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="LEAD">Lead</option>
        </select>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as "" | CustomerType);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          <option value="RETAIL">Retail</option>
          <option value="WHOLESALE">Wholesale</option>
          <option value="DISTRIBUTOR">Distributor</option>
        </select>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading">Loading customers…</div>
        ) : customers.length === 0 ? (
          <div className="table-empty">No customers found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Business</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="clickable"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    <td data-label="Name">
                      <Link
                        to={`/customers/${customer.id}`}
                        style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td data-label="Mobile">{customer.mobile}</td>
                    <td data-label="Business">{customer.businessName || "—"}</td>
                    <td data-label="Type">{customer.type}</td>
                    <td data-label="Status">
                      <span className={statusBadgeClass(customer.status)}>{customer.status}</span>
                    </td>
                    <td data-label="Follow-up">{formatDate(customer.followUpDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > 0 && (
          <div className="pagination" style={{ padding: "14px 16px" }}>
            <span className="info">
              Page {meta.page} of {meta.totalPages} · {meta.total} customers
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            {pageNumbers.map((p) => (
              <button
                key={p}
                type="button"
                className={`btn btn-sm ${p === meta.page ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Customer</h3>

            {modalError && <div className="form-error">{modalError}</div>}

            <form onSubmit={handleSave} noValidate>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="cust-name">Name *</label>
                  <input
                    id="cust-name"
                    value={form.name}
                    className={fieldErrors.name ? "invalid" : ""}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                  {fieldErrors.name && <span className="error">{fieldErrors.name}</span>}
                </div>

                <div className="field">
                  <label htmlFor="cust-mobile">Mobile *</label>
                  <input
                    id="cust-mobile"
                    value={form.mobile}
                    className={fieldErrors.mobile ? "invalid" : ""}
                    onChange={(e) => updateField("mobile", e.target.value)}
                  />
                  {fieldErrors.mobile && <span className="error">{fieldErrors.mobile}</span>}
                </div>

                <div className="field full">
                  <label htmlFor="cust-business">Business name</label>
                  <input
                    id="cust-business"
                    value={form.businessName}
                    className={fieldErrors.businessName ? "invalid" : ""}
                    onChange={(e) => updateField("businessName", e.target.value)}
                  />
                  {fieldErrors.businessName && (
                    <span className="error">{fieldErrors.businessName}</span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="cust-type">Type</label>
                  <select
                    id="cust-type"
                    value={form.type}
                    className={fieldErrors.type ? "invalid" : ""}
                    onChange={(e) => updateField("type", e.target.value)}
                  >
                    <option value="RETAIL">RETAIL</option>
                    <option value="WHOLESALE">WHOLESALE</option>
                    <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                  </select>
                  {fieldErrors.type && <span className="error">{fieldErrors.type}</span>}
                </div>

                <div className="field">
                  <label htmlFor="cust-status">Status</label>
                  <select
                    id="cust-status"
                    value={form.status}
                    className={fieldErrors.status ? "invalid" : ""}
                    onChange={(e) => updateField("status", e.target.value)}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="LEAD">LEAD</option>
                  </select>
                  {fieldErrors.status && <span className="error">{fieldErrors.status}</span>}
                </div>

                <div className="field full">
                  <label htmlFor="cust-address">Address</label>
                  <input
                    id="cust-address"
                    value={form.address}
                    className={fieldErrors.address ? "invalid" : ""}
                    onChange={(e) => updateField("address", e.target.value)}
                  />
                  {fieldErrors.address && <span className="error">{fieldErrors.address}</span>}
                </div>

                <div className="field">
                  <label htmlFor="cust-city">City</label>
                  <input
                    id="cust-city"
                    value={form.city}
                    className={fieldErrors.city ? "invalid" : ""}
                    onChange={(e) => updateField("city", e.target.value)}
                  />
                  {fieldErrors.city && <span className="error">{fieldErrors.city}</span>}
                </div>

                <div className="field">
                  <label htmlFor="cust-state">State</label>
                  <input
                    id="cust-state"
                    value={form.state}
                    className={fieldErrors.state ? "invalid" : ""}
                    onChange={(e) => updateField("state", e.target.value)}
                  />
                  {fieldErrors.state && <span className="error">{fieldErrors.state}</span>}
                </div>

                <div className="field">
                  <label htmlFor="cust-followup">Next follow-up date</label>
                  <input
                    id="cust-followup"
                    type="date"
                    value={form.followUpDate}
                    className={fieldErrors.followUpDate ? "invalid" : ""}
                    onChange={(e) => updateField("followUpDate", e.target.value)}
                  />
                  {fieldErrors.followUpDate && (
                    <span className="error">{fieldErrors.followUpDate}</span>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}