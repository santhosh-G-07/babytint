import { supabase } from "@/lib/supabase";
import { getAdminToken } from "@/lib/local-admin-auth";
import type {
  AdminDashboardSummary,
  AuthProfile,
  CartItemPayload,
  FrameTemplate,
  OrderRecord,
  SiteSettings,
  SiteTheme,
} from "@/types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

function isLocalApiBase() {
  try {
    const hostname = new URL(API_BASE).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
  } catch {
    return false;
  }
}

function normalizeUploadedUrl(url: string) {
  if (!isLocalApiBase()) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/local-storage/")) {
      return `${API_BASE}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return url;
  }

  return url;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  const adminToken = getAdminToken();
  return adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  requireAuth = false,
): Promise<T> {
  const headers: HeadersInit = {
    ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(init?.headers ?? {}),
  };

  if (requireAuth) {
    Object.assign(headers, await authHeader());
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      (typeof payload === "object" &&
        payload &&
        "detail" in payload &&
        String((payload as Record<string, unknown>).detail)) ||
      response.statusText ||
      "Request failed";
    throw new ApiError(message, response.status, payload);
  }
  return payload as T;
}

export async function getFrames(params?: {
  size?: string;
  category?: string;
  name_exact?: string;
  min_price?: string;
  max_price?: string;
  search?: string;
  active_only?: boolean;
}) {
  const query = new URLSearchParams();
  if (params?.size) query.set("size", params.size);
  if (params?.category) query.set("category", params.category);
  if (params?.name_exact) query.set("name_exact", params.name_exact);
  if (params?.min_price) query.set("min_price", params.min_price);
  if (params?.max_price) query.set("max_price", params.max_price);
  if (params?.search) query.set("search", params.search);
  if (params?.active_only !== undefined) query.set("active_only", String(params.active_only));
  const qs = query.toString();
  return apiFetch<FrameTemplate[]>(`/api/frames${qs ? `?${qs}` : ""}`);
}

export async function getFrame(frameRef: string) {
  return apiFetch<FrameTemplate>(`/api/frames/${frameRef}`);
}

export async function authMe() {
  return apiFetch<AuthProfile>("/api/auth/me", undefined, true);
}

export async function adminLogin(payload: { email: string; password: string }) {
  return apiFetch<{ access_token: string; token_type: string; role: string; expires_at?: string | null }>(
    "/api/auth/admin/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function registerLocal(payload: { name: string; email: string; password: string }) {
  return apiFetch<{ access_token: string; token_type: string; role: string; expires_at: string }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function loginLocal(payload: { email: string; password: string }) {
  return apiFetch<{ access_token: string; token_type: string; role: string; expires_at: string }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function requestPasswordReset(email: string) {
  return apiFetch<{ ok: boolean; dev_otp?: string | null }>(
    "/api/auth/password-reset/request",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

export async function confirmPasswordReset(payload: { email: string; otp: string; password: string }) {
  return apiFetch<{ ok: boolean }>(
    "/api/auth/password-reset/confirm",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const uploaded = await apiFetch<{ url: string; bucket: string; path: string }>(
    "/api/upload/image",
    {
      method: "POST",
      body: form,
    },
    false,
  );
  return { ...uploaded, url: normalizeUploadedUrl(uploaded.url) };
}

export async function uploadFrameAsset(file: File) {
  const form = new FormData();
  form.append("file", file);
  const uploaded = await apiFetch<{ url: string; bucket: string; path: string }>(
    "/api/upload/frame",
    {
      method: "POST",
      body: form,
    },
    true,
  );
  return { ...uploaded, url: normalizeUploadedUrl(uploaded.url) };
}

export async function listServerCart() {
  return apiFetch<
    {
      id: string;
      user_id: string;
      frame_id: string;
      customization_data: Record<string, unknown>;
      quantity: number;
      created_at: string;
    }[]
  >("/api/orders/cart", undefined, true);
}

export async function addServerCartItem(payload: {
  frame_id: string;
  quantity: number;
  customization_data: unknown;
}) {
  return apiFetch<{
    id: string;
    user_id: string;
    frame_id: string;
    customization_data: Record<string, unknown>;
    quantity: number;
    created_at: string;
  }>(
    "/api/orders/cart",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function updateServerCartItem(itemId: string, payload: { quantity: number }) {
  return apiFetch<{
    id: string;
    user_id: string;
    frame_id: string;
    customization_data: Record<string, unknown>;
    quantity: number;
    created_at: string;
  }>(
    `/api/orders/cart/${itemId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function removeServerCartItem(itemId: string) {
  return apiFetch<void>(`/api/orders/cart/${itemId}`, { method: "DELETE" }, true);
}

export async function createCheckout(payload: {
  delivery_address: Record<string, string>;
  items: CartItemPayload[];
}) {
  return apiFetch<OrderRecord>(
    "/api/orders/checkout",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function createRazorpayOrder(orderId: string) {
  return apiFetch<{
    razorpay_order_id: string;
    amount: number;
    currency: string;
    status: string;
    receipt: string;
  }>(
    "/api/payment/create-order",
    {
      method: "POST",
      body: JSON.stringify({
        order_id: orderId,
      }),
    },
    true,
  );
}

export async function verifyRazorpayPayment(payload: {
  app_order_id: string;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}) {
  return apiFetch<{
    ok: boolean;
    status: string;
    order_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
  }>(
    "/api/payment/verify-payment",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function getMyOrders() {
  return apiFetch<OrderRecord[]>("/api/orders/me", undefined, true);
}

export async function getMyOrder(orderId: string) {
  return apiFetch<OrderRecord>(`/api/orders/me/${orderId}`, undefined, true);
}

export async function getAdminOrders() {
  return apiFetch<OrderRecord[]>("/api/orders/admin/all", undefined, true);
}

export async function updateOrderStatus(
  orderId: string,
  payload: { status: string; tracking_link?: string | null },
) {
  return apiFetch<OrderRecord>(
    `/api/orders/${orderId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function regeneratePrintFile(itemId: string) {
  return apiFetch<OrderRecord>(
    `/api/orders/admin/items/${itemId}/print-file`,
    { method: "POST" },
    true,
  );
}

export async function downloadPrintFile(itemId: string) {
  const headers = await authHeader();
  const response = await fetch(`${API_BASE}/api/orders/admin/items/${itemId}/print-file/download`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ApiError(response.statusText || "Download failed", response.status, await response.text());
  }
  return response.blob();
}

export async function getAdminDashboard() {
  return apiFetch<AdminDashboardSummary>("/api/admin/dashboard", undefined, true);
}

export async function getSiteSettings() {
  return apiFetch<SiteSettings>("/api/settings/site");
}

export async function updateSiteSettings(payload: { active_theme: SiteTheme }) {
  return apiFetch<SiteSettings>(
    "/api/settings/site",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function createFrame(
  payload: Omit<FrameTemplate, "id" | "created_at">,
) {
  return apiFetch<FrameTemplate>(
    "/api/frames",
    { method: "POST", body: JSON.stringify(payload) },
    true,
  );
}

export async function updateFrame(
  frameId: string,
  payload: Partial<Omit<FrameTemplate, "id" | "created_at">>,
) {
  return apiFetch<FrameTemplate>(
    `/api/frames/${frameId}`,
    { method: "PUT", body: JSON.stringify(payload) },
    true,
  );
}

export async function deleteFrame(frameId: string) {
  return apiFetch<void>(`/api/frames/${frameId}`, { method: "DELETE" }, true);
}
