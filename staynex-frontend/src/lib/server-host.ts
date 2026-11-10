// Server-only fetch helpers for the host property-authoring surface. Auth is
// session-only: the request's cookies are forwarded to the backend, which
// resolves the host. Properties and destination identifiers are live platform
// state; unavailable responses are explicit and never replaced with fixtures.

import { cookies } from "next/headers";
import { API_BASE } from "@/lib/api-base";
import type { CityOption, PropertyDetail, PropertySummary } from "@/lib/types";

export type HostListResult<T> =
  | { status: "data"; data: T[] }
  | { status: "empty"; data: [] }
  | { status: "unavailable"; data: null; reason: string };

export type HostDetailResult<T> =
  | { status: "data"; data: T }
  | { status: "not_found"; data: null }
  | { status: "unavailable"; data: null; reason: string };

async function authHeaders(): Promise<HeadersInit | undefined> {
  const store = await cookies();
  const all = store.getAll();
  if (all.length === 0) return undefined;
  return { cookie: all.map((c) => `${c.name}=${c.value}`).join("; ") };
}

/**
 * Real DB cities (id + name) for the property form. The ids MUST be live backend
 * ids; property creation stays disabled when this source is empty or unavailable.
 */
export async function getCities(): Promise<HostListResult<CityOption>> {
  try {
    const res = await fetch(`${API_BASE}/catalog/cities`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        status: "unavailable",
        data: null,
        reason: `The destination service returned status ${res.status}.`,
      };
    }
    const rows = (await res.json()) as CityOption[];
    if (rows.length === 0) return { status: "empty", data: [] };
    return {
      status: "data",
      data: rows,
    };
  } catch {
    return {
      status: "unavailable",
      data: null,
      reason: "Staynex could not reach the live destination service.",
    };
  }
}

export async function getHostProperties(): Promise<
  HostListResult<PropertySummary>
> {
  try {
    const res = await fetch(`${API_BASE}/host/properties`, {
      cache: "no-store",
      headers: await authHeaders(),
    });
    if (!res.ok) {
      return {
        status: "unavailable",
        data: null,
        reason: `The host property service returned status ${res.status}.`,
      };
    }
    const properties = (await res.json()) as PropertySummary[];
    return properties.length > 0
      ? { status: "data", data: properties }
      : { status: "empty", data: [] };
  } catch {
    return {
      status: "unavailable",
      data: null,
      reason: "Staynex could not reach your live property records.",
    };
  }
}

export async function getHostProperty(
  id: string,
): Promise<HostDetailResult<PropertyDetail>> {
  try {
    const res = await fetch(`${API_BASE}/host/properties/${id}`, {
      cache: "no-store",
      headers: await authHeaders(),
    });
    if (res.status === 404) return { status: "not_found", data: null };
    if (!res.ok) {
      return {
        status: "unavailable",
        data: null,
        reason: `The property editor service returned status ${res.status}.`,
      };
    }
    return {
      status: "data",
      data: (await res.json()) as PropertyDetail,
    };
  } catch {
    return {
      status: "unavailable",
      data: null,
      reason: "Staynex could not reach this live property record.",
    };
  }
}
