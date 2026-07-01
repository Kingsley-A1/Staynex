// Typed API client for owner/admin surfaces. Calls the NestJS backend over HTTP
// (the frontend never touches Prisma/DB). Used by client components; server
// components render from centralized fixtures until the API is wired live.

import type {
  AdminBookingsView,
  AdminPayoutRow,
  AdminPayoutsView,
  AdminTestimonialRow,
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
      if (typeof data.message === "string") detail = data.message;
      else if (Array.isArray(data.message)) detail = data.message.join(", ");
      else if (Array.isArray(data.issues))
        detail = data.issues.map((i) => i.message).join(", ");
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, res.statusText, detail);
  }
  clearCsrfCache(path);
  return (await res.json()) as T;
}

// All owner endpoints are authenticated by the session cookie (session-only auth).
export const ownerApi = {
  listProperties: () => request<PropertySummary[]>("/owner/properties"),
  getProperty: (id: string) =>
    request<PropertyDetail>(`/owner/properties/${id}`),
  createProperty: (body: {
    name: string;
    cityId: string;
    description?: string;
  }) =>
    request<PropertyDetail>("/owner/properties", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProperty: (
    id: string,
    body: { name?: string; cityId?: string; description?: string },
  ) =>
    request<PropertyDetail>(`/owner/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  submitProperty: (id: string) =>
    request<PropertyDetail>(`/owner/properties/${id}/submit`, {
      method: "POST",
    }),
  createRoomType: (body: {
    propertyId: string;
    name: string;
    basePriceKobo: number;
    maxGuests: number;
    description?: string;
  }) =>
    request<unknown>("/owner/room-types", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  addRoomUnit: (body: { roomTypeId: string; code?: string }) =>
    request<unknown>("/owner/room-units", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  requestUpload: (body: {
    scope: "property" | "room";
    filename: string;
    contentType: string;
  }) =>
    request<MediaUploadTarget>("/owner/media/upload-url", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  attachPropertyMedia: (
    propertyId: string,
    body: { publicUrl: string; altText?: string; sortOrder?: number },
  ) =>
    request<MediaItem>(`/owner/media/property/${propertyId}`, {
      method: "POST",
      body: JSON.stringify(body),
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
  listBookings: () => request<OwnerBookingsView>("/owner/bookings"),
  getBooking: (id: string) => request<BookingRow>(`/owner/bookings/${id}`),
};

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
  bookings: () => request<AdminBookingsView>("/admin/bookings"),
  payouts: () => request<AdminPayoutsView>("/admin/payouts"),
  markPayoutPaid: (id: string) =>
    request<AdminPayoutRow>(`/admin/payouts/${id}/paid`, { method: "POST" }),
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
    role?: "GUEST" | "OWNER";
  }) =>
    request<AuthUser>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  registerOwner: (body: { email: string; password: string; name?: string }) =>
    request<AuthUser>("/auth/owner/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminRegister: (body: {
    email: string;
    password: string;
    name?: string;
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
  resetPassword: (body: { token: string; password: string }) =>
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
  // Upgrade a signed-in guest to owner-capable (no duplicate account).
  becomeOwner: () => request<AuthUser>("/owner/become", { method: "POST" }),
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

export const ownerApiSettings = {
  onboarding: () => request<OwnerOnboardingState>("/owner/onboarding"),
  completeOnboarding: (skipPayout?: boolean) =>
    request<OwnerOnboardingState>("/owner/onboarding/complete", {
      method: "POST",
      body: JSON.stringify({ skipPayout: skipPayout ?? false }),
    }),
  settings: () => request<OwnerSettingsView>("/owner/settings"),
  updateProfile: (body: {
    displayName?: string;
    businessName?: string;
    phone?: string;
  }) =>
    request<OwnerProfileView>("/owner/settings/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  listLocations: () =>
    request<OwnerLocationView[]>("/owner/settings/locations"),
  createLocation: (body: LocationInput) =>
    request<OwnerLocationView>("/owner/settings/locations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateLocation: (id: string, body: Partial<LocationInput>) =>
    request<OwnerLocationView>(`/owner/settings/locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteLocation: (id: string, replacementLocationId?: string) =>
    request<OwnerLocationView[]>(
      `/owner/settings/locations/${id}${
        replacementLocationId
          ? `?replacementLocationId=${encodeURIComponent(replacementLocationId)}`
          : ""
      }`,
      { method: "DELETE" },
    ),
  getPayoutMethod: () =>
    request<OwnerPayoutMethodView | null>("/owner/settings/payout-method"),
  savePayoutMethod: (body: PayoutMethodInput) =>
    request<OwnerPayoutMethodView>("/owner/settings/payout-method", {
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
  const res = await fetch(apiUrl("/ai/assistant/stream"), {
    method: "POST",
    credentials: "include",
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

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = block.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      let event: { type?: string; text?: string } & Partial<AgentStreamMeta>;
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
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
  }

  if (doneMeta) handlers.onDone(doneMeta);
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

/** Direct PUT of a file to a storage upload target (step 2 of the media flow). */
export async function uploadToTarget(
  target: MediaUploadTarget,
  file: File,
): Promise<void> {
  const res = await fetch(target.uploadUrl, {
    method: target.method,
    headers: target.headers,
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}
