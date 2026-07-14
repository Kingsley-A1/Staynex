export const HOST_ACQUISITION_PATHS = {
  register: "/host/register?next=/host/onboarding",
  signIn: "/sign-in?next=/host/dashboard",
} as const;

export const HOST_VALUE_POINTS = [
  {
    icon: "listing",
    title: "Present your property clearly",
    description:
      "Bring your rooms, photos, pricing, and property details into one trusted listing.",
  },
  {
    icon: "calendar",
    title: "Stay in control of availability",
    description:
      "Manage what guests can book while keeping room information organised.",
  },
  {
    icon: "booking",
    title: "Follow bookings in one place",
    description:
      "See confirmed bookings and the information your team needs to prepare.",
  },
  {
    icon: "operations",
    title: "Know what needs attention",
    description:
      "Use one host workspace for listing progress, booking updates, and earnings visibility.",
  },
] as const;

export const HOST_LISTING_STEPS = [
  {
    title: "Create your host account",
    description:
      "Set up the business profile and contact details that identify your operation.",
  },
  {
    title: "Build your property listing",
    description:
      "Add the property, rooms, photos, occupancy, pricing, and availability information.",
  },
  {
    title: "Submit it for review",
    description:
      "Staynex reviews the listing before publication and tells you if anything needs attention.",
  },
] as const;

export const HOST_PREPARATION_ITEMS = [
  "Business and contact details",
  "Property location and description",
  "Room types and guest capacity",
  "Clear property and room photos",
  "Nightly pricing and availability",
  "Payout details for host onboarding",
] as const;

export type HostValueIcon = (typeof HOST_VALUE_POINTS)[number]["icon"];
