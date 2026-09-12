import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cancelChallan, confirmChallan, getChallan, type Challan } from "../api";
import { useAuth } from "../auth";
import { challanStatusBadgeClass } from "./Challans";

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

export default function ChallanDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [challan, setChallan] = useState<Challan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState<"CONFIRM" | "CANCEL" | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getChallan(id);
      setChallan(result.data.challan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load challan");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Confirm: ADMIN, SALES, WAREHOUSE — only for DRAFT. */
  const canConfirm = challan?.status === "DRAFT" && user?.role !== "ACCOUNTS";
  /** Cancel: ADMIN, SALES — not for CANCELLED. */
  const canCancel =
    (challan?.status === "DRAFT" || challan?.status === "CONFIRMED") &&
    (user?.role === "ADMIN" || user?.role === "SALES");

  async function handleConfirm() {
    if (!challan) return;
    setActionError(null);
    setActing("CONFIRM");
    try {
      await confirmChallan(challan.id);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to confirm challan");
    } finally {
      setActing(null);
    }
  }

  async function handleCancel() {
    if (!challan) return;
    setActionError(null);
    setActing("CANCEL");
    try {
      await cancelChallan(challan.id);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel challan");
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return <div className="loading">Loading challan…</div>;
  }

  if (error || !challan) {
    return (
      <div>
        <Link to="/challans" className="back-link">
          ← Back to Challans
        </Link>
        <div className="form-error">{error || "Challan not found"}</div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/challans" className="back-link">
        ← Back to Challans
      </Link>

      <div className="page-header">
        <div>
          <h2>{challan.challanNumber}</h2>
          <p>
            Created {formatDate(challan.createdAt)} · Confirmed {formatDate(challan.confirmedAt)}
          </p>
        </div>
        <span className={challanStatusBadgeClass(challan.status)}>{challan.status}</span>
      </div>

      {actionError && <div className="form-error">{actionError}</div>}

      {(canConfirm || canCancel) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {canConfirm && (
            <button
              type="button"
              className="btn btn-success"
              disabled={acting !== null}
              onClick={handleConfirm}
            >
              {acting === "CONFIRM" ? "Confirming…" : "Confirm Challan"}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={acting !== null}
              onClick={handleCancel}
            >
              {acting === "CANCEL" ? "Cancelling…" : "Cancel Challan"}
            </button>
          )}
        </div>
      )}

      <div className="card">
        <h3>Customer</h3>
        <div className="detail-grid">
          <div className="field-item">
            <div className="label">Name</div>
            <div className="value">{challan.customer?.name ?? "—"}</div>
          </div>
          <div className="field-item">
            <div className="label">Business</div>
            <div className="value">{challan.customer?.businessName || "—"}</div>
          </div>
          <div className="field-item">
            <div className="label">Mobile</div>
            <div className="value">{challan.customer?.mobile ?? "—"}</div>
          </div>
          <div className="field-item">
            <div className="label">Type</div>
            <div className="value">{challan.customer?.type ?? "—"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Items (snapshotted at creation time)</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th className="num">Unit Price</th>
                <th className="num">Qty</th>
                <th className="num">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {challan.items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Product">{item.productName}</td>
                  <td data-label="SKU">
                    <code>{item.productSku}</code>
                  </td>
                  <td data-label="Unit Price" className="num">
                    {formatMoney(item.unitPrice)}
                  </td>
                  <td data-label="Qty" className="num">
                    {item.quantity}
                  </td>
                  <td data-label="Line Total" className="num">
                    {formatMoney(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="challan-totals">
          <div>
            <div className="total-label">Total Quantity</div>
            <div className="total-value">{challan.totalQuantity}</div>
          </div>
          <div>
            <div className="total-label">Total Amount</div>
            <div className="total-value">{formatMoney(challan.totalAmount)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
