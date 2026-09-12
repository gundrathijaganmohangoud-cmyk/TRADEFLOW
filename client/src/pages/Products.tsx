import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ApiError,
  createProduct,
  createStockMovement,
  listProducts,
  updateProduct,
  type MovementType,
  type PaginationMeta,
  type Product,
} from "../api";
import { useAuth } from "../auth";

const PAGE_SIZE = 10;

const EMPTY_PRODUCT_FORM = {
  sku: "",
  name: "",
  description: "",
  unitPrice: "",
  currentStock: "0",
  minStock: "0",
};

const EMPTY_MOVEMENT_FORM = {
  type: "IN" as MovementType,
  quantity: "1",
  reason: "",
};

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Products() {
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "WAREHOUSE";

  // List state
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Product add/edit modal
  const [editing, setEditing] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [productFieldErrors, setProductFieldErrors] = useState<Record<string, string>>({});
  const [productModalError, setProductModalError] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Stock movement modal
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT_FORM);
  const [movementFieldErrors, setMovementFieldErrors] = useState<Record<string, string>>({});
  const [movementError, setMovementError] = useState<string | null>(null);
  const [savingMovement, setSavingMovement] = useState(false);

  // Debounce search
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
      const result = await listProducts({
        search: search || undefined,
        lowStock: lowStockOnly ? "true" : undefined,
        page,
        limit: PAGE_SIZE,
      });
      setProducts(result.data);
      setMeta(result.meta ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [search, lowStockOnly, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setProductForm(EMPTY_PRODUCT_FORM);
    setProductFieldErrors({});
    setProductModalError(null);
    setShowProductModal(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setProductForm({
      sku: product.sku,
      name: product.name,
      description: product.description ?? "",
      unitPrice: String(product.unitPrice),
      currentStock: String(product.currentStock),
      minStock: String(product.minStock),
    });
    setProductFieldErrors({});
    setProductModalError(null);
    setShowProductModal(true);
  }

  async function handleSaveProduct(event: FormEvent) {
    event.preventDefault();
    setProductModalError(null);
    setProductFieldErrors({});
    setSavingProduct(true);

    const payload = {
      sku: productForm.sku.trim(),
      name: productForm.name.trim(),
      description: productForm.description.trim() || undefined,
      unitPrice: Number(productForm.unitPrice),
      currentStock: Number(productForm.currentStock),
      minStock: Number(productForm.minStock),
    };

    try {
      if (editing) {
        await updateProduct(editing.id, payload);
      } else {
        await createProduct(payload);
      }
      setShowProductModal(false);
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setProductModalError(err.message);
        setProductFieldErrors(err.fieldErrors);
      } else {
        setProductModalError(err instanceof Error ? err.message : "Failed to save product");
      }
    } finally {
      setSavingProduct(false);
    }
  }

  function openMovement(product: Product) {
    setMovementProduct(product);
    setMovementForm(EMPTY_MOVEMENT_FORM);
    setMovementFieldErrors({});
    setMovementError(null);
  }

  async function handleSaveMovement(event: FormEvent) {
    event.preventDefault();
    if (!movementProduct) return;
    setMovementError(null);
    setMovementFieldErrors({});
    setSavingMovement(true);

    try {
      await createStockMovement({
        productId: movementProduct.id,
        type: movementForm.type,
        quantity: Number(movementForm.quantity),
        reason: movementForm.reason.trim(),
      });
      setMovementProduct(null);
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setMovementError(err.message);
        setMovementFieldErrors(err.fieldErrors);
      } else {
        setMovementError(err instanceof Error ? err.message : "Failed to record movement");
      }
    } finally {
      setSavingMovement(false);
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
          <h2>Products</h2>
          <p>Inventory catalogue with live stock levels.</p>
        </div>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Add Product
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search name or SKU…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => {
              setLowStockOnly(e.target.checked);
              setPage(1);
            }}
          />
          Low stock only
        </label>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading">Loading products…</div>
        ) : products.length === 0 ? (
          <div className="table-empty">No products found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th className="num">Price</th>
                  <th className="num">Stock</th>
                  <th className="num">Min</th>
                  <th>Status</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td data-label="Name">
                      <strong>{product.name}</strong>
                    </td>
                    <td data-label="SKU">
                      <code>{product.sku}</code>
                    </td>
                    <td data-label="Price" className="num">
                      {formatMoney(product.unitPrice)}
                    </td>
                    <td data-label="Stock" className="num">
                      {product.currentStock}
                    </td>
                    <td data-label="Min" className="num">
                      {product.minStock}
                    </td>
                    <td data-label="Status">
                      {product.isLowStock ? (
                        <span className="badge badge-amber">LOW STOCK</span>
                      ) : (
                        <span className="badge badge-green">IN STOCK</span>
                      )}
                    </td>
                    {canManage && (
                      <td data-label="Actions">
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(product)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => openMovement(product)}
                          >
                            Adjust Stock
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > 0 && (
          <div className="pagination" style={{ padding: "14px 16px" }}>
            <span className="info">
              Page {meta.page} of {meta.totalPages} · {meta.total} products
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

      {/* Add/Edit product modal */}
      {showProductModal && (
        <div className="modal-backdrop" onClick={() => setShowProductModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? `Edit ${editing.sku}` : "Add Product"}</h3>

            {productModalError && <div className="form-error">{productModalError}</div>}

            <form onSubmit={handleSaveProduct} noValidate>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="prod-sku">SKU *</label>
                  <input
                    id="prod-sku"
                    value={productForm.sku}
                    className={productFieldErrors.sku ? "invalid" : ""}
                    onChange={(e) => {
                      setProductForm((f) => ({ ...f, sku: e.target.value }));
                      setProductFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.sku;
                        return next;
                      });
                    }}
                  />
                  {productFieldErrors.sku && <span className="error">{productFieldErrors.sku}</span>}
                </div>

                <div className="field">
                  <label htmlFor="prod-name">Name *</label>
                  <input
                    id="prod-name"
                    value={productForm.name}
                    className={productFieldErrors.name ? "invalid" : ""}
                    onChange={(e) => {
                      setProductForm((f) => ({ ...f, name: e.target.value }));
                      setProductFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.name;
                        return next;
                      });
                    }}
                  />
                  {productFieldErrors.name && (
                    <span className="error">{productFieldErrors.name}</span>
                  )}
                </div>

                <div className="field full">
                  <label htmlFor="prod-desc">Description</label>
                  <textarea
                    id="prod-desc"
                    rows={2}
                    value={productForm.description}
                    className={productFieldErrors.description ? "invalid" : ""}
                    onChange={(e) => {
                      setProductForm((f) => ({ ...f, description: e.target.value }));
                      setProductFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.description;
                        return next;
                      });
                    }}
                  />
                  {productFieldErrors.description && (
                    <span className="error">{productFieldErrors.description}</span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="prod-price">Unit price (₹) *</label>
                  <input
                    id="prod-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.unitPrice}
                    className={productFieldErrors.unitPrice ? "invalid" : ""}
                    onChange={(e) => {
                      setProductForm((f) => ({ ...f, unitPrice: e.target.value }));
                      setProductFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.unitPrice;
                        return next;
                      });
                    }}
                  />
                  {productFieldErrors.unitPrice && (
                    <span className="error">{productFieldErrors.unitPrice}</span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="prod-min">Minimum stock *</label>
                  <input
                    id="prod-min"
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.minStock}
                    className={productFieldErrors.minStock ? "invalid" : ""}
                    onChange={(e) => {
                      setProductForm((f) => ({ ...f, minStock: e.target.value }));
                      setProductFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.minStock;
                        return next;
                      });
                    }}
                  />
                  {productFieldErrors.minStock && (
                    <span className="error">{productFieldErrors.minStock}</span>
                  )}
                </div>

                {!editing && (
                  <div className="field">
                    <label htmlFor="prod-stock">Opening stock</label>
                    <input
                      id="prod-stock"
                      type="number"
                      min="0"
                      step="1"
                      value={productForm.currentStock}
                      className={productFieldErrors.currentStock ? "invalid" : ""}
                      onChange={(e) => {
                        setProductForm((f) => ({ ...f, currentStock: e.target.value }));
                        setProductFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.currentStock;
                          return next;
                        });
                      }}
                    />
                    {productFieldErrors.currentStock && (
                      <span className="error">{productFieldErrors.currentStock}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowProductModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingProduct}>
                  {savingProduct ? "Saving…" : editing ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust stock modal */}
      {movementProduct && (
        <div className="modal-backdrop" onClick={() => setMovementProduct(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              Adjust Stock — {movementProduct.name}{" "}
              <span className="text-muted">(current: {movementProduct.currentStock})</span>
            </h3>

            {movementError && <div className="form-error">{movementError}</div>}

            <form onSubmit={handleSaveMovement} noValidate>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="mov-type">Movement type *</label>
                  <select
                    id="mov-type"
                    value={movementForm.type}
                    onChange={(e) =>
                      setMovementForm((f) => ({ ...f, type: e.target.value as MovementType }))
                    }
                  >
                    <option value="IN">IN (add stock)</option>
                    <option value="OUT">OUT (remove stock)</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="mov-qty">Quantity *</label>
                  <input
                    id="mov-qty"
                    type="number"
                    min="1"
                    step="1"
                    value={movementForm.quantity}
                    className={movementFieldErrors.quantity ? "invalid" : ""}
                    onChange={(e) => {
                      setMovementForm((f) => ({ ...f, quantity: e.target.value }));
                      setMovementFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.quantity;
                        return next;
                      });
                    }}
                  />
                  {movementFieldErrors.quantity && (
                    <span className="error">{movementFieldErrors.quantity}</span>
                  )}
                </div>

                <div className="field full">
                  <label htmlFor="mov-reason">Reason *</label>
                  <input
                    id="mov-reason"
                    value={movementForm.reason}
                    placeholder="e.g. Purchase receipt, damage, audit correction…"
                    className={movementFieldErrors.reason ? "invalid" : ""}
                    onChange={(e) => {
                      setMovementForm((f) => ({ ...f, reason: e.target.value }));
                      setMovementFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.reason;
                        return next;
                      });
                    }}
                  />
                  {movementFieldErrors.reason && (
                    <span className="error">{movementFieldErrors.reason}</span>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMovementProduct(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingMovement}>
                  {savingMovement ? "Recording…" : "Record Movement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}