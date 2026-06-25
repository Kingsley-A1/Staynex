// Central role navigation data — reused by the owner/admin dashboard shells and
// the guest nav so navigation isn't duplicated per layout.

export interface NavItem {
  href: string;
  label: string;
}

export const GUEST_NAV: NavItem[] = [
  { href: "/search", label: "Find a stay" },
  { href: "/reviews", label: "Reviews" },
  { href: "/list-your-property", label: "List your property" },
  { href: "/profile", label: "Profile" },
];

export const OWNER_NAV: NavItem[] = [
  { href: "/owner/dashboard", label: "Dashboard" },
  { href: "/owner/properties", label: "Properties" },
  { href: "/owner/bookings", label: "Bookings" },
  { href: "/owner/onboarding", label: "Onboarding" },
  { href: "/owner/profile", label: "Profile" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/bookings", label: "Bookings & payments" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/testimonials", label: "Testimonials" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/ai-logs", label: "AI logs" },
  { href: "/admin/profile", label: "Profile" },
];
