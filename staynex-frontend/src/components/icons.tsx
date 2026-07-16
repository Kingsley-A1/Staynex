// Central inline-SVG icon set — 24px grid, 1.5 stroke, currentColor. Same visual
// language as the marketing icons in app/page.tsx, shared so the workspace nav,
// sidebar chrome, and guest selector all draw from one consistent set. No deps.

import type { ComponentType, SVGProps } from "react";

export type IconProps = { className?: string };

const base = (className?: string): SVGProps<SVGSVGElement> => ({
  className: className ?? "size-5",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

/* --- Workspace / nav --- */
export function IconOverview({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconApprovals({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17.5 20a5.5 5.5 0 0 0-3-4.9" />
    </svg>
  );
}

export function IconBookings({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      <path d="m9 14.5 2 2 3.5-3.5" />
    </svg>
  );
}

export function IconPayouts({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9.5v.01M17.5 14.5v.01" />
    </svg>
  );
}

export function IconTestimonials({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 17.77l-5.2 2.73.99-5.78-4.21-4.1 5.82-.85L12 3.5Z" />
    </svg>
  );
}

export function IconAudit({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="2.5" width="6" height="4" rx="1.2" />
      <path d="M8.5 12h7M8.5 16h4" />
    </svg>
  );
}

export function IconAi({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <g fill="currentColor" stroke="none">
        <circle cx="12" cy="2.75" r="1.1" />
        <circle cx="18.55" cy="5.45" r="1.1" />
        <circle cx="21.25" cy="12" r="1.1" />
        <circle cx="18.55" cy="18.55" r="1.1" />
        <circle cx="12" cy="21.25" r="1.1" />
        <circle cx="5.45" cy="18.55" r="1.1" />
        <circle cx="2.75" cy="12" r="1.1" />
        <circle cx="5.45" cy="5.45" r="1.1" />
      </g>
      <path
        d="m7.7 15 2.25-6 2.25 6M8.55 12.8h2.8M15.35 9v6"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function IconBell({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V20a2 2 0 1 1-4 0v-.07a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H4a2 2 0 1 1 0-4h.07a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.56V4a2 2 0 1 1 4 0v.07a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05a1.7 1.7 0 0 0-.34 1.87V10a1.7 1.7 0 0 0 1.56 1H20a2 2 0 1 1 0 4h-.07a1.7 1.7 0 0 0-1.53 1.03Z" />
    </svg>
  );
}

export function IconProperties({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 21V8.5l8-5 8 5V21" />
      <path d="M4 21h16" />
      <path d="M9.5 21v-5h5v5" />
      <path d="M9.5 11h.01M14.5 11h.01" />
    </svg>
  );
}

export function IconOnboarding({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 16c-1.5 1.5-2 5-2 5s3.5-.5 5-2l1.5-1.5" />
      <path d="M14.5 4.5C18 6 19 11 18 14l-4 4-5-5 4-4c1-1 .5-3.5-.5-4.5" />
      <path d="M14.5 4.5C13 4 9.5 4.5 8 6L6 8l3 3" />
      <circle cx="14.5" cy="9.5" r="1.4" />
    </svg>
  );
}

export function IconSupport({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 13a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2ZM20 13a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2Z" />
      <path d="M17 17c0 2-1.8 3-4 3h-1" />
    </svg>
  );
}

/* --- UI / chrome --- */
export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m14 6-6 6 6 6" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function IconLogout({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M15 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" />
      <path d="M10 12h10M17 9l3 3-3 3" />
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconMinus({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 12h14" />
    </svg>
  );
}

/** Staynex verification mark: brand-indigo seal with a high-contrast check. */
export function IconVerified({ className }: IconProps) {
  return (
    <svg
      className={className ?? "size-5"}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="m7.75 12.25 2.75 2.75 5.75-6"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChart({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 19V5M4 19h16" />
      <path d="m7 14 3.5-3.5 3 3L20 7" />
      <path d="M20 11V7h-4" />
    </svg>
  );
}

export function IconPercent({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M19 5 5 19" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </svg>
  );
}

export type IconName =
  | "overview"
  | "approvals"
  | "users"
  | "bookings"
  | "payouts"
  | "testimonials"
  | "audit"
  | "ai"
  | "settings"
  | "properties"
  | "onboarding"
  | "support"
  | "chart"
  | "notifications";

export const NAV_ICONS: Record<IconName, ComponentType<IconProps>> = {
  overview: IconOverview,
  approvals: IconApprovals,
  users: IconUsers,
  bookings: IconBookings,
  payouts: IconPayouts,
  testimonials: IconTestimonials,
  audit: IconAudit,
  ai: IconAi,
  settings: IconSettings,
  properties: IconProperties,
  onboarding: IconOnboarding,
  support: IconSupport,
  chart: IconChart,
  notifications: IconBell,
};
