export interface SupportContactView {
  email: string | null;
  emailHref: string | null;
  phone: string | null;
  phoneHref: string | null;
}

function configured(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function supportEmail(): string | null {
  const email = configured("SUPPORT_EMAIL");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function supportPhone(): { display: string; href: string } | null {
  const display = configured("SUPPORT_PHONE");
  if (!display) return null;

  const digits = display.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  const international = display.trim().startsWith("+");
  return { display, href: `tel:${international ? "+" : ""}${digits}` };
}

export function getSupportContactFromEnv(): SupportContactView {
  const email = supportEmail();
  const phone = supportPhone();
  return {
    email,
    emailHref: email
      ? `mailto:${email}?subject=${encodeURIComponent("Staynex Bookings support request")}`
      : null,
    phone: phone?.display ?? null,
    phoneHref: phone?.href ?? null,
  };
}
