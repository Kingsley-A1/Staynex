export interface SupportContact {
  email: string | null;
  emailHref: string | null;
  phone: string | null;
  phoneHref: string | null;
}

function normalizeApiBase(input: string | undefined): string {
  const raw = input?.trim();
  if (!raw) return "http://localhost:4000";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

const SUPPORT_API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);

function configured(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function supportEmailFromEnv(): string | null {
  const email =
    configured("SUPPORT_EMAIL") ?? configured("NEXT_PUBLIC_SUPPORT_EMAIL");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function supportPhoneFromEnv(): { display: string; href: string } | null {
  const display =
    configured("SUPPORT_PHONE") ?? configured("NEXT_PUBLIC_SUPPORT_PHONE");
  if (!display) return null;

  const digits = display.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  const international = display.trim().startsWith("+");
  return { display, href: `tel:${international ? "+" : ""}${digits}` };
}

export function getSupportContactFromEnv(): SupportContact {
  const email = supportEmailFromEnv();
  const phone = supportPhoneFromEnv();
  return {
    email,
    emailHref: email
      ? `mailto:${email}?subject=${encodeURIComponent("Staynex Bookings support request")}`
      : null,
    phone: phone?.display ?? null,
    phoneHref: phone?.href ?? null,
  };
}

export async function getSupportContact(): Promise<SupportContact> {
  try {
    const res = await fetch(`${SUPPORT_API_BASE}/support/contact`, {
      cache: "no-store",
    });
    if (res.ok) {
      const contact = normalizeContact((await res.json()) as Partial<SupportContact>);
      if (contact.emailHref || contact.phoneHref) return contact;
    }
  } catch {
    /* Frontend env fallback below keeps local/offline docs usable. */
  }
  return getSupportContactFromEnv();
}

function normalizeContact(input: Partial<SupportContact>): SupportContact {
  return {
    email: typeof input.email === "string" ? input.email : null,
    emailHref: typeof input.emailHref === "string" ? input.emailHref : null,
    phone: typeof input.phone === "string" ? input.phone : null,
    phoneHref: typeof input.phoneHref === "string" ? input.phoneHref : null,
  };
}
