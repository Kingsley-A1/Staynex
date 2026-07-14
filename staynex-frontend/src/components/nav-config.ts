// Central role navigation data — reused by the host/admin dashboard shells and
// the guest nav so navigation isn't duplicated per layout. Workspace items carry
// an icon (drawn from components/icons.tsx) and an optional section label so the
// collapsible sidebar can group + show an icon rail when collapsed.

import type { IconName } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
}

export interface WorkspaceNavItem extends NavItem {
  icon: IconName;
  /** Group heading shown above the item in the expanded sidebar. */
  section?: string;
  /** Singular entity name used for safe dynamic-route breadcrumb labels. */
  entityLabel?: string;
}

export const GUEST_NAV: NavItem[] = [
  { href: "/search", label: "Find a stay" },
  { href: "/reviews", label: "Reviews" },
  { href: "/list-your-property", label: "List your property" },
  { href: "/settings", label: "Settings" },
];

export const HOST_NAV: WorkspaceNavItem[] = [
  {
    href: "/host/dashboard",
    label: "Dashboard",
    icon: "overview",
    section: "Workspace",
  },
  {
    href: "/host/properties",
    label: "Properties",
    icon: "properties",
    section: "Workspace",
    entityLabel: "Property",
  },
  {
    href: "/host/bookings",
    label: "Bookings",
    icon: "bookings",
    section: "Workspace",
    entityLabel: "Booking",
  },
  {
    href: "/host/notifications",
    label: "Notifications",
    icon: "notifications",
    section: "Workspace",
  },
  {
    href: "/host/onboarding",
    label: "Onboarding",
    icon: "onboarding",
    section: "Account",
  },
  {
    href: "/host/settings",
    label: "Settings",
    icon: "settings",
    section: "Account",
  },
];

export const ADMIN_NAV: WorkspaceNavItem[] = [
  { href: "/admin", label: "Overview", icon: "overview", section: "Workspace" },
  {
    href: "/admin/approvals",
    label: "Approvals",
    icon: "approvals",
    section: "Operations",
    entityLabel: "Approval",
  },
  {
    href: "/admin/bookings",
    label: "Bookings & payments",
    icon: "bookings",
    section: "Operations",
    entityLabel: "Booking",
  },
  {
    href: "/admin/payouts",
    label: "Payouts",
    icon: "payouts",
    section: "Operations",
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: "users",
    section: "People",
    entityLabel: "User",
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    icon: "notifications",
    section: "People",
  },
  {
    href: "/admin/testimonials",
    label: "Testimonials",
    icon: "testimonials",
    section: "Trust",
  },
  { href: "/admin/audit", label: "Audit log", icon: "audit", section: "Trust" },
  { href: "/admin/ai-logs", label: "AI logs", icon: "ai", section: "Trust" },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: "settings",
    section: "System",
  },
];
