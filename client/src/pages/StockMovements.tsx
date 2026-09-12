import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listProducts,
  listStockMovements,
  type MovementType,
  type PaginationMeta,
  type Product,
  type StockMovement,
} from "../api";

const PAGE_SIZE = 10;

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StockMovements() {
  // Filters
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"" | MovementType>("");
  const [page, setPage] = useState(1);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Product options for the filter dropdown
  const [products, setProducts] = useState<Product[]>([]);

  // Load products once for the filter select (fetch up to 100).
  useEffect(() => {
    let cancelled = false;
    listProducts({ limit: 100, page: 1 })
      .then((result) => {
        if (!cancelled) setProducts(result.data);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listStockMovements({
        productId: productId || undefined,
        type: type || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setMovements(result.data);
      setMeta(result.meta ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stock movements");
    } finally {
      setLoading(false);
    }
  }, [productId, type, page]);

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Stock Movements</h2>
          <p>Audit log of every inventory IN/OUT adjustment.</p>
        </div>
      </div>

      <div className="toolbar">
        <select
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.sku})
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as "" | MovementType);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          <option value="IN">IN</option>
          <option value="OUT">OUT</option>
        </select>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading">Loading movements…</div>
        ) : movements.length === 0 ? (
          <div className="table-empty">No stock movements recorded.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th className="num">Qty</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td data-label="Product">
                      <strong>{movement.product?.name ?? "Unknown product"}</strong>
                      {movement.product?.sku && (
                        <div className="text-muted">
                          <code>{movement.product.sku}</code>
                        </div>
                      )}
                    </td>
                    <td data-label="Type">
                      <span className={`badge badge-${movement.type.toLowerCase()}`}>
                        {movement.type}
                      </span>
                    </td>
                    <td data-label="Qty" className="num">
                      {movement.type === "IN" ? "+" : "−"}
                      {movement.quantity}
                    </td>
                    <td data-label="Reason">{movement.reason}</td>
                    <td data-label="By">{movement.createdBy?.name ?? "—"}</td>
                    <td data-label="Timestamp">{formatTimestamp(movement.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > 0 && (
          <div className="pagination" style={{ padding: "14px 16px" }}>
            <span className="info">
              Page {meta.page} of {meta.totalPages} · {meta.total} movements
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
