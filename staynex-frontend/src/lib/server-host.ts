// Server-only fetch helpers for the host property-authoring surface. Auth is
// session-only: the request's cookies are forwarded to the backend, which
// resolves the host. Properties are real platform state, so there is no fixture
// fallback for the host's own listings. Cities fall back to display-only
// fixtures when the catalog API is unreachable, so the form select is never empty.

import { cookies } from "next/headers";
import { API_BASE } from "@/lib/api-base";
import { CITIES, type CityOption } from "@/features/properties/fixtures";
import type { PropertyDetail, PropertySummary } from "@/lib/types";

async function authHeaders(): Promise<HeadersInit | undefined> {
  const store = await cookies();
  const all = store.getAll();
  if (all.length === 0) return undefined;
  return { cookie: all.map((c) => `${c.name}=${c.value}`).join("; ") };
}

/**
 * Real DB cities (id + name) for the property form. The ids MUST be the live
 * backend ids — submitting a stale/fixture id fails the cityId foreign key.
 * Fixtures are used only as a display fallback when the API is down (a submit in
 * that state fails at the API anyway, so no bad id is ever persisted).
 */
export async function getCities(): Promise<CityOption[]> {
  try {
    const res = await fetch(`${API_BASE}/catalog/cities`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const rows = (await res.json()) as Array<{ id: string; name: string }>;
    if (rows.length === 0) return CITIES;
    return rows.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    return CITIES;
  }
}

export async function getHostProperties(): Promise<PropertySummary[] | null> {
  try {
    const res = await fetch(`${API_BASE}/host/properties`, {
      cache: "no-store",
      headers: await authHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as PropertySummary[];
  } catch {
    return null;
  }
}

export async function getHostProperty(id: string): Promise<PropertyDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/host/properties/${id}`, {
      cache: "no-store",
      headers: await authHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as PropertyDetail;
  } catch {
    return null;
  }
}
