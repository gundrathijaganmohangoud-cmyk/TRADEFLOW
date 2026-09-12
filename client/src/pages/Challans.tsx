import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ApiError,
  createChallan,
  listChallans,
  listCustomers,
  listProducts,
  type Challan,
  type ChallanStatus,
  type Customer,
  type PaginationMeta,
  type Product,
} from "../api";
import { useAuth } from "../auth";

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Challan list page
// ---------------------------------------------------------------------------

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

export function challanStatusBadgeClass(status: ChallanStatus): string {
  switch (status) {
    case "CONFIRMED":
      return "badge badge-green";
    case "CANCELLED":
      return "badge badge-red";
    default:
      return "badge badge-gray"; // DRAFT
  }
}

export default function Challans() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = user?.role === "ADMIN" || user?.role === "SALES";

  const [status, setStatus] = useState<"" | ChallanStatus>("");
  const [page, setPage] = useState(1);

  const [challans, setChallans] = useState<Challan[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listChallans({
        status: status || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setChallans(result.data);
      setMeta(result.meta ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load challans");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pageNumbers = useMemo(() => {
    if (!meta || meta.totalPages <= 1) return [];
    const pages: number[] = [];
    const start = Math.max(1, meta.page - 2);
    const end = Math.min(meta.totalPages, start + 4);
    for (let p = start; p <= end; p += 1) pages.push(p);
    return pages;
  }, [meta]);

  if (showForm) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h2>New Challan</h2>
            <p>Pick a customer, add product lines, then save as draft or confirm.</p>
          </div>
        </div>
        <ChallanForm
          onCancel={() => setShowForm(false)}
          onSaved={(challan) => {
            setShowForm(false);
            navigate(`/challans/${challan.id}`);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Challans</h2>
          <p>Delivery challans with immutable product snapshots.</p>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            + New Challan
          </button>
        )}
      </div>

      <div className="toolbar">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | ChallanStatus);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading">Loading challans…</div>
        ) : challans.length === 0 ? (
          <div className="table-empty">No challans found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Challan #</th>
                  <th>Customer</th>
                  <th className="num">Items</th>
                  <th className="num">Total Qty</th>
                  <th className="num">Total Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {challans.map((challan) => (
                  <tr
                    key={challan.id}
                    className="clickable"
                    onClick={() => navigate(`/challans/${challan.id}`)}
                  >
                    <td data-label="Challan #">
                      <Link
                        to={`/challans/${challan.id}`}
                        style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {challan.challanNumber}
                      </Link>
                    </td>
                    <td data-label="Customer">
                      {challan.customer?.name}
                      {challan.customer?.businessName && (
                        <div className="text-muted">{challan.customer.businessName}</div>
                      )}
                    </td>
                    <td data-label="Items" className="num">
                      {challan.items?.length ?? 0}
                    </td>
                    <td data-label="Total Qty" className="num">
                      {challan.totalQuantity}
                    </td>
                    <td data-label="Total Amount" className="num">
                      {formatMoney(challan.totalAmount)}
                    </td>
                    <td data-label="Status">
                      <span className={challanStatusBadgeClass(challan.status)}>
                        {challan.status}
                      </span>
                    </td>
                    <td data-label="Created">{formatDate(challan.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > 0 && (
          <div className="pagination" style={{ padding: "14px 16px" }}>
            <span className="info">
              Page {meta.page} of {meta.totalPages} · {meta.total} challans
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Challan form (create)
// ---------------------------------------------------------------------------

interface ItemRow {
  key: number;
  productId: string;
  quantity: string;
}

let rowKey = 1;

function nextKey(): number {
  return (rowKey += 1);
}

interface ChallanFormProps {
  onCancel: () => void;
  onSaved: (challan: Challan) => void;
}

export function ChallanForm({ onCancel, onSaved }: ChallanFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([{ key: nextKey(), productId: "", quantity: "1" }]);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<"DRAFT" | "CONFIRMED" | null>(null);

  useEffect(() => {
    async function loadOptions() {
      setLoadError(null);
      try {
        const [customerResult, productResult] = await Promise.all([
          listCustomers({ limit: 100 }),
          listProducts({ limit: 100 }),
        ]);
        setCustomers(customerResult.data);
        setProducts(productResult.data);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load form options");
      }
    }
    loadOptions();
  }, []);

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  // Running totals
  const totals = useMemo(() => {
    let totalQuantity = 0;
    let totalAmount = 0;
    for (const row of rows) {
      const quantity = Number(row.quantity);
      const product = productsById.get(row.productId);
      if (product && Number.isFinite(quantity) && quantity > 0) {
        totalQuantity += quantity;
        totalAmount += product.unitPrice * quantity;
      }
    }
    totalAmount = Math.round(totalAmount * 100) / 100;
    return { totalQuantity, totalAmount };
  }, [rows, productsById]);

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`items.${prev && Object.keys(prev).find((k) => k.startsWith("items."))}`];
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, { key: nextKey(), productId: "", quantity: "1" }]);
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  async function handleSave(targetStatus: "DRAFT" | "CONFIRMED") {
    setFormError(null);
    setFieldErrors({});

    if (!customerId) {
      setFormError("Please select a customer.");
      return;
    }
    const items = rows
      .filter((row) => row.productId)
      .map((row) => ({ productId: row.productId, quantity: Number(row.quantity) }));

    if (items.length === 0) {
      setFormError("Add at least one item with a product.");
      return;
    }
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
      setFormError("Every item needs a whole-number quantity of at least 1.");
      return;
    }

    setSaving(targetStatus);
    try {
      const result = await createChallan({ customerId, items, status: targetStatus });
      onSaved(result.data.challan);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError(err instanceof Error ? err.message : "Failed to create challan");
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="card card-form">
      {loadError && <div className="form-error">{loadError}</div>}
      {formError && <div className="form-error">{formError}</div>}

      <div className="form-grid">
        <div className="field full">
          <label htmlFor="ch-customer">Customer *</label>
          <select
            id="ch-customer"
            value={customerId}
            className={fieldErrors.customerId ? "invalid" : ""}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">— Select a customer —</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.businessName ? ` — ${customer.businessName}` : ""} ({customer.mobile})
              </option>
            ))}
          </select>
          {fieldErrors.customerId && <span className="error">{fieldErrors.customerId}</span>}
        </div>
      </div>

      <h3 style={{ marginTop: 20 }}>Items</h3>
      <div className="item-rows">
        {rows.map((row, index) => {
          const product = productsById.get(row.productId);
          const lineTotal = product
            ? Math.round(product.unitPrice * (Number(row.quantity) || 0) * 100) / 100
            : 0;
          const itemError = Object.entries(fieldErrors).find(([field]) =>
            field.startsWith(`items.${index}.`)
          );
          return (
            <div className="item-row" key={row.key}>
              <select
                aria-label={`Product for item ${index + 1}`}
                value={row.productId}
                onChange={(e) => updateRow(row.key, { productId: e.target.value })}
              >
                <option value="">— Select product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — ₹{p.unitPrice}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Quantity for item ${index + 1}`}
                type="number"
                min="1"
                step="1"
                value={row.quantity}
                onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
              />
              <span className="row-total">{product ? formatMoney(lineTotal) : "—"}</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={rows.length === 1}
                onClick={() => removeRow(row.key)}
                title="Remove row"
              >
                ✕
              </button>
              {itemError && <span className="error">{itemError[1]}</span>}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
          + Add item row
        </button>
      </div>

      <div className="challan-totals">
        <div>
          <div className="total-label">Total Quantity</div>
          <div className="total-value">{totals.totalQuantity}</div>
        </div>
        <div>
          <div className="total-label">Total Amount</div>
          <div className="total-value">{formatMoney(totals.totalAmount)}</div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={saving !== null}
          onClick={() => handleSave("DRAFT")}
        >
          {saving === "DRAFT" ? "Saving…" : "Save as Draft"}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving !== null}
          onClick={() => handleSave("CONFIRMED")}
        >
          {saving === "CONFIRMED" ? "Confirming…" : "Confirm Challan"}
        </button>
      </div>
    </div>
  );
}
