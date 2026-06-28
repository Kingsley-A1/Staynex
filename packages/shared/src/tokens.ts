// Staynex brand design tokens (skill.md §6).
//
// Single source of truth for color, spacing, radius, and typography across the
// web and mobile clients. Premium, calm, trustworthy, mobile-first, WCAG 2.2 AA.

export const color = {
  /** Brand primary. */
  primary: "#27187D",
  /** Text/icon color that sits on top of `primary`. */
  onPrimary: "#FFFFFF",
  /** App background. */
  background: "#F7F7FF",
  /** Raised surface (cards, sheets). */
  surface: "#FFFFFF",
  /** Primary text. */
  ink: "#101014",
  /** Secondary / muted text. */
  muted: "#6E6A83",
  /** Hairline borders and dividers. */
  border: "#E7E5F2",
  /** Subtle fill (chips, skeletons). */
  subtle: "#EEEDF7",
  success: "#15803D",
  warning: "#B7791F",
  error: "#B42318",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/** Convenience grouping so a client can import a single `tokens` object. */
export const tokens = {
  color,
  spacing,
  radius,
  fontSize,
  fontWeight,
} as const;

export type Tokens = typeof tokens;
