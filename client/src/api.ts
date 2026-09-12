// ---------------------------------------------------------------------------
// API layer: fetch wrapper + typed endpoint functions
// ---------------------------------------------------------------------------

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

const TOKEN_KEY = "tradeflow_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role = "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTS";
export type CustomerType = "RETAIL" | "WHOLESALE" | "DISTRIBUTOR";
export type CustomerStatus = "ACTIVE" | "INACTIVE" | "LEAD";
export type FollowUpStatus = "PENDING" | "DONE";
export type MovementType = "IN" | "OUT";
export type ChallanStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  businessName: string | null;
  type: CustomerType;
  status: CustomerStatus;
  address: string | null;
  city: string | null;
  state: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  customerId: string;
  date: string;
  note: string;
  status: FollowUpStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends Customer {
  followUps: FollowUp[];
  _count: { followUps: number; challans: number };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: number;
  currentStock: number;
  minStock: number;
  isLowStock?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  reason: string;
  createdById: string;
  createdAt: string;
  product?: { id: string; sku: string; name: string; currentStock: number };
  createdBy?: { id: string; name: string; email: string };
}

export interface ChallanItem {
  id: string;
  challanId: string;
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Challan {
  id: string;
  challanNumber: string;
  customerId: string;
  status: ChallanStatus;
  totalQuantity: number;
  totalAmount: number;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: ChallanItem[];
  customer: {
    id: string;
    name: string;
    mobile: string;
    businessName: string | null;
    type: CustomerType;
    status: CustomerStatus;
  };
}

/** Field-level validation errors from the API (Zod). */
export interface FieldError {
  field: string;
  message: string;
}

/** Error thrown by the API wrapper. Carries status + field errors when present. */
export class ApiError extends Error {
  public readonly status: number;
  public readonly errors: FieldError[];

  constructor(status: number, message: string, errors: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }

  /** Map of field -> first message, convenient for inline form errors. */
  get fieldErrors(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const err of this.errors) {
      if (!(err.field in map)) map[err.field] = err.message;
    }
    return map;
  }
}

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  meta?: PaginationMeta;
  message?: string;
  errors?: FieldError[];
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

/**
 * Core request helper. Attaches the bearer token, parses the standard
 * { success, data, meta } envelope and throws ApiError with the server
 * message on failure.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the API running?");
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // non-JSON body (e.g. empty response or proxy error page)
  }

  if (!response.ok || !payload || payload.success !== true) {
    const message =
      (payload && payload.message) ||
      (response.status === 401 ? "Unauthorized" : `Request failed (${response.status})`);
    throw new ApiError(response.status, message, payload?.errors ?? []);
  }

  return { data: payload.data as T, meta: payload.meta };
}

export interface ApiResult<T> {
  data: T;
  meta?: PaginationMeta;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export interface ListParams {
  [key: string]: string | number | undefined;
}

function toQueryString(params: ListParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// ---- Auth ----

export interface LoginResponse {
  token: string;
  user: User;
}

export function login(email: string, password: string): Promise<ApiResult<LoginResponse>> {
  return request<LoginResponse>("/auth/login", { method: "POST", body: { email, password } });
}

export function fetchMe(): Promise<ApiResult<{ user: User }>> {
  return request<{ user: User }>("/auth/me");
}

// ---- Customers ----

export interface CustomerPayload {
  name: string;
  mobile: string;
  businessName?: string;
  type: CustomerType;
  status: CustomerStatus;
  address?: string;
  city?: string;
  state?: string;
  followUpDate?: string;
}

export function listCustomers(
  params: ListParams = {}
): Promise<ApiResult<Customer[]>> {
  return request<Customer[]>(`/customers${toQueryString(params)}`);
}

export function getCustomer(id: string): Promise<ApiResult<CustomerDetail>> {
  return request<CustomerDetail>(`/customers/${id}`);
}

export function createCustomer(payload: CustomerPayload): Promise<ApiResult<{ customer: Customer }>> {
  return request<{ customer: Customer }>("/customers", { method: "POST", body: payload });
}

export function updateCustomer(
  id: string,
  payload: Partial<CustomerPayload>
): Promise<ApiResult<{ customer: Customer }>> {
  return request<{ customer: Customer }>(`/customers/${id}`, { method: "PUT", body: payload });
}

export function addFollowUp(
  customerId: string,
  payload: { date: string; note: string; status?: FollowUpStatus }
): Promise<ApiResult<FollowUp>> {
  return request<FollowUp>(`/customers/${customerId}/follow-ups`, {
    method: "POST",
    body: payload,
  });
}

// ---- Products ----

export interface ProductPayload {
  sku: string;
  name: string;
  description?: string;
  unitPrice: number;
  currentStock: number;
  minStock: number;
}

export function listProducts(params: ListParams = {}): Promise<ApiResult<Product[]>> {
  return request<Product[]>(`/products${toQueryString(params)}`);
}

export function createProduct(payload: ProductPayload): Promise<ApiResult<{ product: Product }>> {
  return request<{ product: Product }>("/products", { method: "POST", body: payload });
}

export function updateProduct(
  id: string,
  payload: Partial<ProductPayload>
): Promise<ApiResult<{ product: Product }>> {
  return request<{ product: Product }>(`/products/${id}`, { method: "PUT", body: payload });
}

// ---- Stock ----

export function listStockMovements(
  params: ListParams = {}
): Promise<ApiResult<StockMovement[]>> {
  return request<StockMovement[]>(`/stock/movements${toQueryString(params)}`);
}

export function createStockMovement(payload: {
  productId: string;
  type: MovementType;
  quantity: number;
  reason: string;
}): Promise<ApiResult<{ movement: StockMovement; product: StockMovement["product"] }>> {
  return request("/stock/movements", { method: "POST", body: payload });
}

// ---- Challans ----

export interface ChallanPayload {
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  status: "DRAFT" | "CONFIRMED";
}

export function listChallans(params: ListParams = {}): Promise<ApiResult<Challan[]>> {
  return request<Challan[]>(`/challans${toQueryString(params)}`);
}

export function getChallan(id: string): Promise<ApiResult<{ challan: Challan }>> {
  return request<{ challan: Challan }>(`/challans/${id}`);
}

export function createChallan(payload: ChallanPayload): Promise<ApiResult<{ challan: Challan }>> {
  return request<{ challan: Challan }>("/challans", { method: "POST", body: payload });
}

export function updateChallan(
  id: string,
  payload: { customerId?: string; items?: Array<{ productId: string; quantity: number }> }
): Promise<ApiResult<{ challan: Challan }>> {
  return request<{ challan: Challan }>(`/challans/${id}`, { method: "PUT", body: payload });
}

export function confirmChallan(id: string): Promise<ApiResult<{ challan: Challan }>> {
  return request<{ challan: Challan }>(`/challans/${id}/confirm`, { method: "POST" });
}

export function cancelChallan(id: string): Promise<ApiResult<{ challan: Challan }>> {
  return request<{ challan: Challan }>(`/challans/${id}/cancel`, { method: "POST" });
}

// ---- Users (ADMIN) ----

export function listUsers(): Promise<ApiResult<User[]>> {
  return request<User[]>("/users");
}

export function createUser(payload: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<ApiResult<{ user: User }>> {
  return request<{ user: User }>("/users", { method: "POST", body: payload });
}