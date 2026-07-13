import type { Metadata } from "next";
import Link from "next/link";
import { PagesHero } from "@/components/pages-hero";

export const metadata: Metadata = {
  title: "Documentation | How Staynex Bookings works",
  description:
    "A complete guide to Staynex Bookings — searching stays, checking availability, secure Paystack payments, confirmations, reviews, hosting, and support.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Staynex Bookings Documentation",
    description:
      "Everything guests and hosts need to know about booking and listing verified stays on Staynex Bookings.",
    url: "/docs",
  },
};

/* ============================================================================
   Public documentation content — guest- and host-facing only. No internal
   architecture, endpoints, credentials, or admin tooling is described here.
   ========================================================================== */

type DocBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] };

type DocSection = {
  id: string;
  title: string;
  summary: string;
  blocks: DocBlock[];
};

type DocGroup = {
  group: string;
  sections: DocSection[];
};

const DOCS: DocGroup[] = [
  {
    group: "Get started",
    sections: [
      {
        id: "overview",
        title: "What Staynex Bookings is",
        summary:
          "A platform for booking trusted, verified stays with secure payment and real-time availability.",
        blocks: [
          {
            kind: "p",
            text: "Staynex Bookings connects guests with verified hotels, resorts, apartments, and short-let stays. Every property is reviewed before it appears publicly, availability is shown in real time, and bookings are only confirmed after payment is verified.",
          },
          {
            kind: "p",
            text: "We start in Nigeria — with launch cities including Calabar, Uyo, Port Harcourt, Lagos, and Abuja — and are built to expand. You do not need an account to search and explore; you sign in when you are ready to book.",
          },
        ],
      },
      {
        id: "booking-loop",
        title: "The booking journey at a glance",
        summary:
          "From search to confirmation in a few clear steps.",
        blocks: [
          {
            kind: "steps",
            items: [
              "Search a city, area, dates, and guests.",
              "Open a stay to view rooms, photos, amenities, and policies.",
              "Check availability for your dates and pick a room.",
              "Hold your selection and sign in to continue.",
              "Pay securely with Paystack.",
              "Get an instant confirmation and a booking voucher.",
            ],
          },
        ],
      },
    ],
  },
  {
    group: "Booking a stay",
    sections: [
      {
        id: "search",
        title: "Searching for stays",
        summary: "Find the right stay by city, area, dates, and guests.",
        blocks: [
          {
            kind: "p",
            text: "Start from the search panel on the home page or the Stays page. Choose a city first; you can then narrow to a specific area or keep all areas. Add your check-in and check-out dates and the number of guests to see stays that fit.",
          },
          {
            kind: "list",
            items: [
              "Results show verified properties with a starting nightly price.",
              "Prices are shown in Nigerian Naira (₦).",
              "You can refine your search at any time without losing your place.",
            ],
          },
        ],
      },
      {
        id: "stay-detail",
        title: "Understanding a stay",
        summary:
          "Photos, room types, amenities, location, and the Verified badge.",
        blocks: [
          {
            kind: "p",
            text: "Each stay page shows the property’s photos, description, location, room types, amenities, and house policies. A Verified badge means the property passed Staynex review before going live.",
          },
          {
            kind: "p",
            text: "A stay can offer several room types, each with its own price and capacity. Compare them on the same page before you choose.",
          },
        ],
      },
      {
        id: "availability",
        title: "Checking availability",
        summary: "See real, bookable dates — never a guess.",
        blocks: [
          {
            kind: "p",
            text: "Availability reflects live calendars, so the dates you can select are dates you can actually book. If a room is unavailable for your dates, choose different dates or another room type.",
          },
        ],
      },
      {
        id: "holds",
        title: "Holding a booking",
        summary: "A short hold keeps your room while you check out.",
        blocks: [
          {
            kind: "p",
            text: "When you continue to checkout, Staynex places a temporary hold on your selected room so it is not booked by someone else while you pay. Holds expire automatically after a short window, which releases the room if checkout is not completed.",
          },
          {
            kind: "p",
            text: "If a hold expires before you finish, simply search again and re-select — your dates and room may still be available.",
          },
        ],
      },
    ],
  },
  {
    group: "Payment & confirmation",
    sections: [
      {
        id: "payments",
        title: "Paying securely",
        summary: "Payments are processed by Paystack. Card details are never stored by Staynex.",
        blocks: [
          {
            kind: "p",
            text: "Checkout payments are handled by Paystack, a trusted payment processor. Staynex does not store your raw card details. Your booking is confirmed only after your payment is verified.",
          },
          {
            kind: "list",
            items: [
              "Pay with the options Paystack supports at checkout.",
              "A booking is never confirmed without a verified payment.",
              "If a payment fails or is interrupted, no confirmed booking is created and any hold is released.",
            ],
          },
        ],
      },
      {
        id: "confirmation",
        title: "Confirmation & your voucher",
        summary: "Instant confirmation and a downloadable booking voucher.",
        blocks: [
          {
            kind: "p",
            text: "Once payment is verified, you receive an instant confirmation and a booking voucher with your reference, stay details, dates, and amount paid. Keep your reference handy for check-in and support.",
          },
          {
            kind: "p",
            text: "You can review your confirmed booking and its status from your account at any time.",
          },
        ],
      },
    ],
  },
  {
    group: "Your account",
    sections: [
      {
        id: "accounts",
        title: "Accounts & sign in",
        summary: "Create an account to book, track stays, and manage your details.",
        blocks: [
          {
            kind: "p",
            text: "You can browse without an account, but you sign in to hold and pay for a booking. Registering lets you track bookings, save your details, and manage your profile.",
          },
        ],
      },
      {
        id: "password-reset",
        title: "Resetting your password",
        summary: "Reset with a 6-digit code sent to your email.",
        blocks: [
          {
            kind: "steps",
            items: [
              "On the sign-in page, choose “Forgot password”.",
              "Enter your account email.",
              "Check your email for a 6-digit verification code.",
              "Enter the code and set a new password.",
            ],
          },
          {
            kind: "p",
            text: "For your security, codes are time-limited. If a code expires, request a new one.",
          },
        ],
      },
      {
        id: "reviews",
        title: "Reviews",
        summary: "Reviews come from real, completed bookings.",
        blocks: [
          {
            kind: "p",
            text: "Guest reviews are tied to genuine booking activity before they are published, so ratings reflect real stays. After a completed stay, you may be invited to share your experience.",
          },
        ],
      },
    ],
  },
  {
    group: "For hosts",
    sections: [
      {
        id: "hosting",
        title: "Listing your property",
        summary: "Turn your property into a reliable booking channel.",
        blocks: [
          {
            kind: "p",
            text: "Hosts can list a property from the List your property page. After you submit your listing, it is reviewed before it goes live, so guests only ever see approved stays.",
          },
          {
            kind: "list",
            items: [
              "Add property details, room types, photos, and pricing.",
              "Set and manage availability with live calendars.",
              "Review incoming bookings and guest details in one place.",
              "Track earnings and payout activity from your dashboard.",
            ],
          },
        ],
      },
      {
        id: "host-bookings",
        title: "Managing bookings & check-in",
        summary: "See confirmed bookings, guest details, and a check-in link.",
        blocks: [
          {
            kind: "p",
            text: "Each confirmed booking appears in your host workspace with the guest’s details, a Verified indicator, and a check-in link to help you welcome guests smoothly. Availability updates as bookings are confirmed, helping prevent double bookings.",
          },
        ],
      },
    ],
  },
  {
    group: "Help & assistant",
    sections: [
      {
        id: "assistant",
        title: "The Staynex AI",
        summary: "An AI assistant that helps you find and book stays.",
        blocks: [
          {
            kind: "p",
            text: "The Staynex AI helps you search stays, compare rooms, understand policies, and move through the booking steps with confidence. It is a guide — it will not invent availability, confirm payments, or promise refunds. For anything that affects money or a confirmed booking, it points you to the verified step in the product.",
          },
        ],
      },
      {
        id: "trust-safety",
        title: "Trust & safety",
        summary: "Verification, secure payments, and honest reviews.",
        blocks: [
          {
            kind: "list",
            items: [
              "Properties are reviewed before they appear publicly.",
              "Bookings are confirmed only after payment is verified.",
              "Payments run through Paystack; raw card data is never stored by Staynex.",
              "Reviews are linked to real bookings before publication.",
            ],
          },
        ],
      },
      {
        id: "support",
        title: "Getting support",
        summary: "Reach us when you need a hand.",
        blocks: [
          {
            kind: "p",
            text: "If something does not look right with a search, a payment, or a confirmed booking, keep your booking reference ready and contact support at support@staynexbookings.ng. You can also review our Terms, Policies, and Legal pages for the details that govern bookings and use of the platform.",
          },
        ],
      },
    ],
  },
];

const RELATED_LINKS: ReadonlyArray<readonly [string, string]> = [
  ["Browse stays", "/search"],
  ["List your property", "/list-your-property"],
  ["Reviews", "/reviews"],
  ["Terms", "/terms"],
  ["Policies", "/policies"],
  ["Legal", "/legal"],
];

export default function DocsPage() {
  const allSections = DOCS.flatMap((g) => g.sections);

  return (
    <main>
      <PagesHero
        eyebrow="Documentation"
        title="How Staynex Bookings works,"
        gradientText="end to end"
        intro="A clear guide for guests and hosts — searching stays, checking availability, paying securely with Paystack, confirmations, reviews, hosting, and support."
      />

      <section className="layout-container py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
          {/* On-this-page navigation — sticky on desktop, quick-jump on mobile */}
          <nav
            aria-label="On this page"
            className="lg:sticky lg:top-24 lg:h-max"
          >
            <p className="text-overline mb-3">On this page</p>
            <ul className="space-y-5">
              {DOCS.map((group) => (
                <li key={group.group}>
                  <p className="text-caption font-semibold text-ink">
                    {group.group}
                  </p>
                  <ul className="mt-2 space-y-1.5 border-l border-border pl-3">
                    {group.sections.map((section) => (
                      <li key={section.id}>
                        <Link
                          href={`#${section.id}`}
                          className="block text-sm text-muted-foreground transition-colors hover:text-primary"
                        >
                          {section.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>

          {/* Documentation body */}
          <div className="min-w-0 max-w-3xl">
            <div className="space-y-12">
              {allSections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24 border-b border-border pb-10 last:border-b-0 last:pb-0"
                >
                  <h2 className="text-title-md tracking-normal text-ink">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-body-md text-muted-foreground">
                    {section.summary}
                  </p>
                  <div className="mt-4 space-y-4 text-body-md leading-relaxed text-muted-foreground">
                    {section.blocks.map((block, i) => (
                      <DocBlockView key={i} block={block} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Related links */}
            <div className="mt-12 rounded-lg border border-border bg-surface-raised p-6">
              <h2 className="text-title-sm text-ink">Keep exploring</h2>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {RELATED_LINKS.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function DocBlockView({ block }: { block: DocBlock }) {
  if (block.kind === "p") {
    return <p>{block.text}</p>;
  }
  if (block.kind === "list") {
    return (
      <ul className="list-disc space-y-2 pl-5 marker:text-primary">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <ol className="space-y-3">
      {block.items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-bold text-primary"
          >
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}
