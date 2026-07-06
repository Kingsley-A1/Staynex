// Typed API client for host/admin surfaces. Calls the NestJS backend over HTTP
// (the frontend never touches Prisma/DB). Used by client components; server
// components render from centralized fixtures until the API is wired live.

import type {
  AdminBookingsPage,
  AdminPaymentExceptionRow,
  AdminPaymentRow,
  AdminPaymentsPage,
  AdminPayoutRow,
  AdminPayoutsView,
  AdminTestimonialRow,
  AvailabilityDriftRow,
  AdminUserDetail,
  AdminUserRow,
  AgentConversation,
  AgentMessage,
  ApprovalActionResult,
  AreaOption,
  AssistantReply,
  AuditLogRow,
  AuthResponse,
  AuthUser,
  AiLogRow,
  AvailabilityDay,
  AvailabilityQuote,
  BookingReviewContext,
  BookingRow,
  BookingView,
  CheckoutResult,
  CityOption,
  HoldSummary,
  MediaItem,
  MediaUploadTarget,
  NotificationsPage,
  OwnerBookingsView,
  OwnerLocationView,
  OwnerOnboardingState,
  OwnerPayoutMethodView,
  OwnerProfileView,
  OwnerSettingsView,
  PaymentStatusView,
  PropertyDetail,
  PropertySummary,
  PublicTestimonial,
  RevealedPayoutMethod,
  SessionSummary,
} from "@/lib/types";
import { API_BASE } from "@/lib/api-base";

type RequestOptions = RequestInit;
const CSRF_COOKIE = "staynex_csrf";
const CSRF_HEADER = "X-CSRF-Token";
const BROWSER_API_BASE = "/api/backend";
const AI_STREAM_TIMEOUT_MS = 45_000;
let csrfTokenCache: string | null = null;
let csrfTokenRequest: Promise<string | null> | null = null;

function apiUrl(path: string): string {
  return `${typeof window === "undefined" ? API_BASE : BROWSER_API_BASE}${path}`;
}

function unsafeMethod(method: string | undefined): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes((method ?? "GET").toUpperCase());
}

function readBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix))
      return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return null;
}

async function csrfHeaderFor(
  method: string | undefined,
): Promise<Record<string, string>> {
  if (!unsafeMethod(method) || typeof window === "undefined") return {};

  let token = csrfTokenCache ?? readBrowserCookie(CSRF_COOKIE);
  if (!token) {
    csrfTokenRequest ??= fetch(apiUrl("/auth/csrf"), {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json().catch(() => null)) as {
          csrfToken?: unknown;
        } | null;
        return typeof body?.csrfToken === "string"
          ? body.csrfToken
          : readBrowserCookie(CSRF_COOKIE);
      })
      .finally(() => {
        csrfTokenRequest = null;
      });
    token = await csrfTokenRequest;
  }

  csrfTokenCache = token;
  return token ? { [CSRF_HEADER]: token } : {};
}

function clearCsrfCache(path: string): void {
  if (path === "/auth/logout" || path === "/auth/profile")
    csrfTokenCache = null;
}

/**
 * Error thrown for non-2xx responses. `status` enables precise handling; the
 * message keeps the `Request failed: <status>` prefix (so existing
 * `message.includes("409")` checks still work) and appends the backend detail
 * after " — " when present, for user-facing messages.
 */
export class ApiError extends Error {
  status: number;
  detail: string | null;
  constructor(status: number, statusText: string, detail: string | null) {
    super(
      `Request failed: ${status} ${statusText}${detail ? ` — ${detail}` : ""}`,
    );
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Human-facing message for an error: the backend detail, else a fallback. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.detail) return err.detail;
  return fallback;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { headers, ...rest } = options;
  const csrfHeaders = await csrfHeaderFor(rest.method);
  const res = await fetch(apiUrl(path), {
    ...rest,
    // Send/receive the session cookie so auth-aware endpoints resolve the user.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...csrfHeaders,
      ...headers,
    },
  });
  if (!res.ok) {
    if (res.status === 403) csrfTokenCache = null;
    let detail: string | null = null;
    try {
      const data = (await res.json()) as {
        message?: unknown;
        issues?: Array<{ message?: string }>;
      };
      const issueDetail = Array.isArray(data.issues)
        ? data.issues
            .map((i) => i.message)
            .filter(Boolean)
            .join(", ")
        : "";
      if (issueDetail) detail = issueDetail;
      else if (typeof data.message === "string") detail = data.message;
      else if (Array.isArray(data.message)) detail = data.message.join(", ");
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, res.statusText, detail);
  }
  clearCsrfCache(path);
  return (await res.json()) as T;
}

// All host endpoints are authenticated by the session cookie (session-only auth).
export const hostApi = {
  listProperties: () => request<PropertySummary[]>("/host/properties"),
  getProperty: (id: string) =>
    request<PropertyDetail>(`/host/properties/${id}`),
  createProperty: (body: {
    name: string;
    cityId: string;
    description?: string;
  }) =>
    request<PropertyDetail>("/host/properties", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProperty: (
    id: string,
    body: { name?: string; cityId?: string; description?: string },
  ) =>
    request<PropertyDetail>(`/host/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  submitProperty: (id: string) =>
    request<PropertyDetail>(`/host/properties/${id}/submit`, {
      method: "POST",
    }),
  createRoomType: (body: {
    propertyId: string;
    name: string;
    basePriceKobo: number;
    maxGuests: number;
    description?: string;
  }) =>
    request<unknown>("/host/room-types", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRoomType: (
    id: string,
    body: {
      name?: string;
      basePriceKobo?: number;
      maxGuests?: number;
      description?: string;
    },
  ) =>
    request<unknown>(`/host/room-types/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  addRoomUnit: (body: { roomTypeId: string; code?: string }) =>
    request<unknown>("/host/room-units", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  requestUpload: (body: {
    scope: "property" | "room";
    filename: string;
    contentType: string;
  }) =>
    request<MediaUploadTarget>("/host/media/upload-url", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  // Attach is by storage KEY (from requestUpload) — the backend verifies the
  // object and derives the public URL itself; clients never supply URLs.
  attachPropertyMedia: (propertyId: string, body: { key: string; altText?: string }) =>
    request<MediaItem>(`/host/media/property/${propertyId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  attachRoomMedia: (roomTypeId: string, body: { key: string; altText?: string }) =>
    request<MediaItem>(`/host/media/room/${roomTypeId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deletePropertyMedia: (mediaId: string) =>
    request<{ ok: true }>(`/host/media/property-media/${mediaId}`, {
      method: "DELETE",
    }),
  deleteRoomMedia: (mediaId: string) =>
    request<{ ok: true }>(`/host/media/room-media/${mediaId}`, {
      method: "DELETE",
    }),
  updatePropertyMediaAlt: (mediaId: string, altText: string | null) =>
    request<MediaItem>(`/host/media/property-media/${mediaId}`, {
      method: "PATCH",
      body: JSON.stringify({ altText }),
    }),
  updateRoomMediaAlt: (mediaId: string, altText: string | null) =>
    request<MediaItem>(`/host/media/room-media/${mediaId}`, {
      method: "PATCH",
      body: JSON.stringify({ altText }),
    }),
  /** Full new order for a gallery — first id becomes the cover. */
  reorderPropertyMedia: (propertyId: string, mediaIds: string[]) =>
    request<MediaItem[]>(`/host/media/property/${propertyId}/order`, {
      method: "PUT",
      body: JSON.stringify({ mediaIds }),
    }),
  reorderRoomMedia: (roomTypeId: string, mediaIds: string[]) =>
    request<MediaItem[]>(`/host/media/room/${roomTypeId}/order`, {
      method: "PUT",
      body: JSON.stringify({ mediaIds }),
    }),
  setCapacity: (body: {
    roomTypeId: string;
    from: string;
    to: string;
    totalUnits: number;
  }) =>
    request<{ updatedDays: number }>("/availability/capacity", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getCalendar: (roomTypeId: string, from: string, to: string) =>
    request<AvailabilityDay[]>(
      `/availability/room-types/${roomTypeId}?from=${from}&to=${to}`,
    ),
  listBookings: () => request<OwnerBookingsView>("/host/bookings"),
  getBooking: (id: string) => request<BookingRow>(`/host/bookings/${id}`),
};

/** Search/filter/pagination inputs for the admin money lists. */
export interface AdminListQuery {
  q?: string;
  status?: string;
  cursor?: string;
  take?: number;
}

export function adminListQueryString(query?: AdminListQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.take) params.set("take", String(query.take));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const adminApi = {
  queue: () => request<PropertySummary[]>("/admin/approvals"),
  getForReview: (id: string) =>
    request<PropertyDetail>(`/admin/approvals/${id}`),
  decide: (
    id: string,
    body: { decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES"; note?: string },
  ) =>
    request<ApprovalActionResult>(`/admin/approvals/${id}/decision`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  bookings: (query?: AdminListQuery) =>
    request<AdminBookingsPage>(`/admin/bookings${adminListQueryString(query)}`),
  payments: (query?: AdminListQuery) =>
    request<AdminPaymentsPage>(`/admin/payments${adminListQueryString(query)}`),
  paymentExceptions: () =>
    request<AdminPaymentExceptionRow[]>("/admin/payments/exceptions"),
  reverifyPayment: (reference: string) =>
    request<AdminPaymentRow>(
      `/admin/payments/${encodeURIComponent(reference)}/reverify`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  refundPayment: (reference: string, note?: string) =>
    request<AdminPaymentRow>(
      `/admin/payments/${encodeURIComponent(reference)}/refund`,
      { method: "POST", body: JSON.stringify(note ? { note } : {}) },
    ),
  availabilityDrift: () =>
    request<AvailabilityDriftRow[]>("/admin/reconciliation/availability"),
  payouts: () => request<AdminPayoutsView>("/admin/payouts"),
  markPayoutPaid: (
    id: string,
    body: { note?: string; overrideEligibility?: boolean } = {},
  ) =>
    request<AdminPayoutRow>(`/admin/payouts/${id}/paid`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  markPayoutFailed: (id: string, reason: string) =>
    request<AdminPayoutRow>(`/admin/payouts/${id}/failed`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  auditLogs: () => request<AuditLogRow[]>("/admin/audit-logs"),
  aiLogs: () => request<AiLogRow[]>("/admin/ai-logs"),
  testimonials: (status?: string) =>
    request<AdminTestimonialRow[]>(
      `/admin/testimonials${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  moderateTestimonial: (
    id: string,
    decision: "APPROVE" | "REJECT" | "PENDING",
  ) =>
    request<{ id: string; status: string }>(
      `/admin/testimonials/${id}/decision`,
      {
        method: "POST",
        body: JSON.stringify({ decision }),
      },
    ),
  areas: (city?: string) =>
    request<AreaOption[]>(
      `/admin/areas${city ? `?city=${encodeURIComponent(city)}` : ""}`,
    ),
  createArea: (body: {
    cityId: string;
    name: string;
    type: string;
    notable?: boolean;
  }) =>
    request<AreaOption>("/admin/areas", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateArea: (
    id: string,
    body: { name?: string; type?: string; notable?: boolean },
  ) =>
    request<AreaOption>(`/admin/areas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

export const authApi = {
  me: () => request<AuthUser | null>("/auth/me"),
  register: (body: {
    email: string;
    password: string;
    name?: string;
    phone: string;
    role?: "GUEST" | "OWNER";
  }) =>
    request<AuthUser>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  registerOwner: (body: {
    email: string;
    password: string;
    name?: string;
    phone: string;
  }) =>
    request<AuthUser>("/auth/host/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminRegister: (body: {
    email: string;
    password: string;
    name?: string;
    phone: string;
    accessCode: string;
  }) =>
    request<AuthResponse>("/auth/admin/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  completeMfa: (body: { challengeId: string; code: string }) =>
    request<AuthUser>("/auth/mfa/complete", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  google: (idToken: string, intent?: "GUEST" | "OWNER") =>
    request<AuthUser>("/auth/google", {
      method: "POST",
      body: JSON.stringify(intent ? { idToken, intent } : { idToken }),
    }),
  forgotPassword: (email: string) =>
    request<{ ok: true }>("/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (body: { email: string; code: string; password: string }) =>
    request<{ ok: true }>("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProfile: (body: {
    name?: string;
    email?: string;
    phone?: string | null;
  }) =>
    request<AuthUser>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteAccount: () =>
    request<{ ok: true }>("/auth/profile", { method: "DELETE" }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  sessions: () => request<SessionSummary[]>("/auth/sessions"),
  revokeOtherSessions: () =>
    request<{ revoked: number }>("/auth/sessions/revoke-others", {
      method: "POST",
    }),
  // Upgrade a signed-in guest to host-capable (no duplicate account).
  becomeHost: () => request<AuthUser>("/host/become", { method: "POST" }),
};

export const settingsApi = {
  profile: () => request<AuthUser>("/settings/profile"),
  updateProfile: (body: {
    name?: string;
    email?: string;
    phone?: string | null;
  }) =>
    request<AuthUser>("/settings/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

interface LocationInput {
  cityId: string;
  areaId?: string | null;
  label?: string | null;
  addressLine?: string | null;
  isPrimary?: boolean;
}

interface PayoutMethodInput {
  bankName: string;
  accountName: string;
  accountNumber: string;
  provider?: string | null;
}

export const hostApiSettings = {
  onboarding: () => request<OwnerOnboardingState>("/host/onboarding"),
  completeOnboarding: (skipPayout?: boolean) =>
    request<OwnerOnboardingState>("/host/onboarding/complete", {
      method: "POST",
      body: JSON.stringify({ skipPayout: skipPayout ?? false }),
    }),
  settings: () => request<OwnerSettingsView>("/host/settings"),
  updateProfile: (body: {
    displayName?: string;
    businessName?: string;
    phone?: string;
  }) =>
    request<OwnerProfileView>("/host/settings/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  listLocations: () =>
    request<OwnerLocationView[]>("/host/settings/locations"),
  createLocation: (body: LocationInput) =>
    request<OwnerLocationView>("/host/settings/locations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateLocation: (id: string, body: Partial<LocationInput>) =>
    request<OwnerLocationView>(`/host/settings/locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteLocation: (id: string, replacementLocationId?: string) =>
    request<OwnerLocationView[]>(
      `/host/settings/locations/${id}${
        replacementLocationId
          ? `?replacementLocationId=${encodeURIComponent(replacementLocationId)}`
          : ""
      }`,
      { method: "DELETE" },
    ),
  getPayoutMethod: () =>
    request<OwnerPayoutMethodView | null>("/host/settings/payout-method"),
  savePayoutMethod: (body: PayoutMethodInput) =>
    request<OwnerPayoutMethodView>("/host/settings/payout-method", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export const adminUsersApi = {
  list: () => request<AdminUserRow[]>("/admin/users"),
  get: (id: string) => request<AdminUserDetail>(`/admin/users/${id}`),
  revealPayout: (id: string) =>
    request<RevealedPayoutMethod>(`/admin/users/${id}/payout-method/reveal`, {
      method: "POST",
    }),
};

export const catalogApi = {
  cities: () => request<CityOption[]>("/catalog/cities"),
};

export const reviewsApi = {
  list: (propertySlug?: string, limit?: number) => {
    const qs = new URLSearchParams();
    if (propertySlug) qs.set("propertySlug", propertySlug);
    if (limit) qs.set("limit", String(limit));
    const suffix = qs.toString();
    return request<PublicTestimonial[]>(
      `/reviews${suffix ? `?${suffix}` : ""}`,
    );
  },
  bookingContext: (bookingId: string) =>
    request<BookingReviewContext>(`/reviews/booking/${bookingId}/context`),
  submit: (
    bookingId: string,
    body: { rating: number; body: string; title?: string; guestName?: string },
  ) =>
    request<{ id: string; status: string }>(`/reviews/booking/${bookingId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const areasApi = {
  listForCity: (city: string) =>
    request<AreaOption[]>(`/areas?city=${encodeURIComponent(city)}`),
};

/** Metadata delivered by the final `done` event of a streamed reply. */
export interface AgentStreamMeta {
  conversationId: string;
  refused: boolean;
  unavailable: boolean;
  groundedFacts: string[];
}

/**
 * Streams an assistant reply over Server-Sent Events. `onChunk` fires for each
 * incremental text delta; `onDone` fires once with the final metadata. Throws
 * `ApiError` (e.g. 429) before any streaming begins.
 */
export async function askAgentStream(
  body: { message: string; conversationId?: string; propertySlug?: string },
  handlers: {
    onChunk: (text: string) => void;
    onDone: (meta: AgentStreamMeta) => void;
  },
): Promise<void> {
  const csrfHeaders = await csrfHeaderFor("POST");
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    AI_STREAM_TIMEOUT_MS,
  );
  try {
    const res = await fetch(apiUrl("/ai/assistant/stream"), {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...csrfHeaders },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      let detail: string | null = null;
      try {
        const data = (await res.json()) as { message?: string };
        if (typeof data.message === "string") detail = data.message;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, res.statusText, detail);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let doneMeta: AgentStreamMeta | null = null;

    function handleBlock(block: string) {
      const line = block.split("\n").find((l) => l.startsWith("data:"));
      if (!line) return;
      let event: { type?: string; text?: string } & Partial<AgentStreamMeta>;
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        return;
      }
      if (event.type === "chunk" && typeof event.text === "string") {
        handlers.onChunk(event.text);
      } else if (event.type === "done") {
        doneMeta = {
          conversationId: event.conversationId ?? body.conversationId ?? "",
          refused: Boolean(event.refused),
          unavailable: Boolean(event.unavailable),
          groundedFacts: event.groundedFacts ?? [],
        };
      }
    }

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        handleBlock(block);
      }
    }
    if (buffer.trim()) handleBlock(buffer);
    if (doneMeta) handlers.onDone(doneMeta);
  } finally {
    window.clearTimeout(timeout);
  }
}

export const agentApi = {
  ask: (body: {
    message: string;
    conversationId?: string;
    propertySlug?: string;
  }) =>
    request<AssistantReply>("/ai/assistant", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  askStream: askAgentStream,
  listConversations: () => request<AgentConversation[]>("/ai/conversations"),
  createConversation: (title?: string) =>
    request<AgentConversation>("/ai/conversations", {
      method: "POST",
      body: JSON.stringify(title ? { title } : {}),
    }),
  messages: (id: string) =>
    request<AgentMessage[]>(`/ai/conversations/${id}/messages`),
  rename: (id: string, title: string) =>
    request<AgentConversation>(`/ai/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  setPinned: (id: string, pinned: boolean) =>
    request<AgentConversation>(`/ai/conversations/${id}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned }),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/ai/conversations/${id}`, { method: "DELETE" }),
};

export const notificationsApi = {
  list: (cursor?: string) =>
    request<NotificationsPage>(
      `/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  markRead: (ids?: string[]) =>
    request<{ updated: number }>("/notifications/read", {
      method: "POST",
      body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
    }),
  registerDevice: (token: string, platform: "WEB" | "ANDROID" | "IOS" = "WEB") =>
    request<{ ok: true }>("/notifications/devices", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    }),
  removeDevice: (token: string) =>
    request<{ ok: true }>(`/notifications/devices/${encodeURIComponent(token)}`, {
      method: "DELETE",
    }),
};

type BookingDates = {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  infants: number;
};

export const guestApi = {
  quote: (body: BookingDates) =>
    request<AvailabilityQuote>("/bookings/quote", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createHold: (body: BookingDates) =>
    request<HoldSummary>("/bookings/holds", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getHold: (holdId: string) =>
    request<HoldSummary>(`/bookings/holds/${holdId}`),
  checkout: (body: { holdId: string; email: string }) =>
    request<CheckoutResult>("/checkout", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getPaymentStatus: (reference: string) =>
    request<PaymentStatusView>(`/payments/${encodeURIComponent(reference)}`),
  getBooking: (id: string) => request<BookingView>(`/bookings/${id}`),
};

/**
 * Direct PUT of a file to a storage upload target (step 2 of the media flow).
 * Uses XHR so callers can render real upload progress — fetch has no
 * upload-progress events.
 */
export function uploadToTarget(
  target: MediaUploadTarget,
  file: Blob,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.uploadUrl);
    for (const [name, value] of Object.entries(target.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.total > 0 ? event.loaded / event.total : 0);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        reject(
          new Error(
            `Upload failed: ${xhr.status} ${xhr.statusText || "storage rejected the file"}`,
          ),
        );
      }
    };
    // Network-level failure before a response — storage unreachable or the
    // browser blocked it (e.g. missing CORS on the bucket). Config/infra
    // issue, not something the host caused.
    xhr.onerror = () => {
      const host = safeHost(target.uploadUrl);
      reject(
        new Error(
          `Couldn't reach storage${host ? ` (${host})` : ""} to upload this file. ` +
            "Please try again in a moment, or contact support if this keeps happening.",
        ),
      );
    };
    xhr.send(file);
  });
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
