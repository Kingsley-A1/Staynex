import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  HOST_ACQUISITION_PATHS,
  HOST_LISTING_STEPS,
  HOST_PREPARATION_ITEMS,
  HOST_VALUE_POINTS,
  type HostValueIcon,
} from "@/features/host/host-acquisition-content";
import { HostAcquisitionLink } from "@/features/host/host-acquisition-link";

export const metadata: Metadata = {
  title: "List your property",
  description:
    "Create a trusted Staynex listing and manage rooms, availability, bookings, and earnings from one host workspace.",
  alternates: { canonical: "/list-your-property" },
};

export default function ListYourPropertyPage() {
  return (
    <main className="overflow-hidden pb-24 sm:pb-20">
      <section
        className="layout-container py-8 sm:py-12 lg:py-16"
        aria-labelledby="host-page-title"
      >
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:gap-10">
          <div className="min-w-0">
            <p className="text-overline text-primary">For property owners</p>
            <h1
              id="host-page-title"
              className="mt-3 max-w-3xl text-display-sm text-ink sm:text-display-md"
            >
              Turn your property into a booking channel you can run with
              confidence
            </h1>
            <p className="mt-4 max-w-2xl text-body-lg text-muted-foreground sm:mt-5">
              Create a trusted listing, manage rooms and availability, and keep
              confirmed bookings organised from one host workspace.
            </p>
            <div className="mt-7 flex flex-col gap-3 min-[420px]:flex-row sm:mt-8">
              <HostAcquisitionLink
                href={HOST_ACQUISITION_PATHS.register}
                placement="hero"
                size="lg"
                className="w-full hover:no-underline min-[420px]:w-auto"
              >
                Start your listing
                <ArrowIcon />
              </HostAcquisitionLink>
              <HostAcquisitionLink
                href={HOST_ACQUISITION_PATHS.signIn}
                placement="sign_in"
                size="lg"
                variant="secondary"
                className="w-full hover:no-underline min-[420px]:w-auto"
              >
                Already a host? Sign in
              </HostAcquisitionLink>
            </div>
            <p className="mt-4 flex items-start gap-2 text-body-sm text-muted-foreground">
              <ShieldCheckIcon />
              Listings are reviewed before they become public on Staynex.
            </p>
          </div>

          <HostWorkspacePreview />
        </div>
      </section>

      <section
        className="border-y border-border bg-surface-raised"
        aria-label="How Staynex supports hosts"
      >
        <div className="layout-container grid gap-px py-2 sm:grid-cols-3 sm:py-0">
          <TrustPoint
            title="Clear listing setup"
            text="Property, rooms, photos, and pricing"
          />
          <TrustPoint
            title="Availability control"
            text="You decide what guests can book"
          />
          <TrustPoint
            title="Verified booking state"
            text="Confirmation follows verified payment"
          />
        </div>
      </section>

      <section
        className="layout-container py-14 sm:py-16 lg:py-20"
        aria-labelledby="host-value-title"
      >
        <SectionHeading
          eyebrow="One connected workspace"
          title="The essentials of hosting, without the operational clutter"
          description="Staynex gives property teams a structured way to publish trusted information and follow the booking journey."
          id="host-value-title"
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4">
          {HOST_VALUE_POINTS.map((point) => (
            <article
              key={point.title}
              className="surface-card flex min-h-52 flex-col p-5 sm:p-6"
            >
              <span
                className="grid size-11 place-items-center rounded-xl bg-primary-subtle text-primary"
                aria-hidden="true"
              >
                <ValueIcon name={point.icon} />
              </span>
              <h3 className="mt-5 text-title-sm text-ink">{point.title}</h3>
              <p className="mt-2 text-body-sm text-muted-foreground">
                {point.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="bg-surface-sunken py-14 sm:py-16 lg:py-20"
        aria-labelledby="host-steps-title"
      >
        <div className="layout-container">
          <SectionHeading
            eyebrow="A guided path to publication"
            title="Build the listing in three clear stages"
            description="Start with your operation, add the details guests need, then submit the property for review."
            id="host-steps-title"
          />
          <ol className="mt-8 grid gap-4 lg:mt-10 lg:grid-cols-3">
            {HOST_LISTING_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="surface-card relative overflow-hidden p-5 sm:p-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <span
                    className="grid size-10 place-items-center rounded-full bg-primary font-bold text-primary-foreground"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="text-overline text-muted-foreground">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-title-sm text-ink">{step.title}</h3>
                <p className="mt-2 text-body-sm text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="layout-container py-14 sm:py-16 lg:py-20"
        aria-labelledby="host-ready-title"
      >
        <div className="surface-card grid overflow-hidden lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="bg-primary p-6 text-primary-foreground sm:p-8 lg:p-10">
            <p className="text-overline text-primary-foreground/75">
              Prepare once, move faster
            </p>
            <h2
              id="host-ready-title"
              className="mt-3 text-display-sm text-primary-foreground"
            >
              Have the right property information ready
            </h2>
            <p className="mt-4 max-w-xl text-body-md text-primary-foreground/80">
              Good listing information helps guests understand the stay and
              helps the review process stay focused.
            </p>
          </div>
          <div className="p-5 sm:p-8 lg:p-10">
            <ul className="grid gap-3 sm:grid-cols-2">
              {HOST_PREPARATION_ITEMS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5 text-body-sm font-medium text-ink"
                >
                  <CheckIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        className="layout-container pb-4 sm:pb-8"
        aria-labelledby="host-final-title"
      >
        <div className="relative overflow-hidden rounded-2xl border border-border bg-primary-subtle px-5 py-9 text-center shadow-sm sm:px-8 sm:py-12">
          <div
            className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-primary/10"
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-2xl">
            <p className="text-overline text-primary">Ready when you are</p>
            <h2 id="host-final-title" className="mt-3 text-display-sm text-ink">
              Give your property a clearer path to trusted bookings
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-body-md text-muted-foreground">
              Create your host account, build the listing at your pace, and
              submit it when the property information is ready.
            </p>
            <HostAcquisitionLink
              href={HOST_ACQUISITION_PATHS.register}
              placement="final"
              size="lg"
              className="mt-7 w-full hover:no-underline min-[420px]:w-auto"
            >
              Start your listing
              <ArrowIcon />
            </HostAcquisitionLink>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <header className="max-w-2xl">
      <p className="text-overline text-primary">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-display-sm text-ink">
        {title}
      </h2>
      <p className="mt-3 text-body-md text-muted-foreground">{description}</p>
    </header>
  );
}

function HostWorkspacePreview() {
  const rows = [
    ["Listing setup", "Property, rooms, and pricing", "listing"],
    ["Availability", "Keep bookable dates current", "calendar"],
    ["Bookings", "Follow verified confirmations", "booking"],
  ] as const;

  return (
    <aside
      className="surface-card relative min-w-0 overflow-hidden p-4 sm:p-5"
      aria-label="Preview of the Staynex host workspace"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-primary"
        aria-hidden="true"
      />
      <div className="flex flex-col items-start gap-3 border-b border-border pb-4 pt-1 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
        <div className="min-w-0">
          <p className="text-overline text-muted-foreground">Host workspace</p>
          <h2 className="mt-1 text-title-sm text-ink">
            Your property operation
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-success-surface px-2.5 py-1 text-caption font-semibold text-success">
          In your control
        </span>
      </div>
      <div className="space-y-3 pt-4">
        {rows.map(([title, text, icon]) => (
          <div
            key={title}
            className="flex items-center gap-3 rounded-xl border border-border bg-background p-3.5"
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"
              aria-hidden="true"
            >
              <ValueIcon name={icon} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink">{title}</p>
              <p className="text-body-sm text-muted-foreground">
                {text}
              </p>
            </div>
            <ChevronIcon />
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-surface-sunken p-4">
        <p className="text-body-sm font-semibold text-ink">
          Built around verified booking state
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          A booking is confirmed only after Staynex verifies payment.
        </p>
      </div>
    </aside>
  );
}

function TrustPoint({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-4 sm:px-5 sm:py-5">
      <CheckIcon />
      <div>
        <p className="text-body-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-caption text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function ValueIcon({ name }: { name: HostValueIcon }) {
  const paths: Record<HostValueIcon, ReactNode> = {
    listing: (
      <>
        <path d="M5 4h14v16H5z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    calendar: (
      <>
        <path d="M5 6h14v14H5zM8 3v6M16 3v6M5 10h14" />
        <path d="m9 15 2 2 4-4" />
      </>
    ),
    booking: (
      <>
        <path d="M4 7h16v12H4zM8 7V5h8v2" />
        <path d="m9 13 2 2 4-4" />
      </>
    ),
    operations: (
      <>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        <path d="M3 9h2M9 5h2M15 12h2" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="mt-0.5 size-5 shrink-0 text-success"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m5 12 4 4L19 6" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="mt-0.5 size-5 shrink-0 text-primary"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3 4.5 6v5.5c0 4.5 3 7.7 7.5 9.5 4.5-1.8 7.5-5 7.5-9.5V6L12 3Z" />
    <path d="m8.5 12 2.2 2.2 4.8-5" />
  </svg>
);

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

const ChevronIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="ml-auto size-4 shrink-0 text-muted-foreground"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);
