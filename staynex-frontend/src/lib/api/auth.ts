// Authentication and account settings endpoints.

import { request } from "./client";
import type { AuthResponse, AuthUser, SessionSummary } from "@/lib/types";

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
    request<AuthResponse>("/auth/google", {
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
