import Link from "next/link";
import {
  MdEmail,
  MdOutlinePhoneInTalk,
  MdOutlineReceiptLong,
  MdOutlineSecurity,
} from "react-icons/md";
import { getSupportContact } from "@/lib/support-contact";

export async function SupportPanel({ compact = false }: { compact?: boolean }) {
  const contact = await getSupportContact();
  const hasDirectContact = Boolean(contact.emailHref || contact.phoneHref);

  return (
    <section
      aria-labelledby="support-heading"
      className={
        compact
          ? "space-y-6"
          : "overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-lg"
      }
    >
      <div
        className={compact ? "space-y-3" : "border-b border-border p-6 sm:p-8"}
      >
        <p className="text-overline text-primary">Staynex support</p>
        <h1 id="support-heading" className="mt-2 text-title-lg text-ink">
          How can we help?
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Contact the support team for account access, verified booking details,
          payment references, property reviews, or platform questions.
        </p>
      </div>

      <div
        className={
          compact ? "space-y-4" : "grid gap-4 p-6 sm:grid-cols-2 sm:p-8"
        }
      >
        {contact.emailHref && contact.email ? (
          <a
            href={contact.emailHref}
            className="group flex min-h-28 items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary">
              <MdEmail className="size-6" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">
                Email support
              </span>
              <span className="mt-1 block break-all text-sm text-muted-foreground group-hover:text-primary">
                {contact.email}
              </span>
            </span>
          </a>
        ) : null}

        {contact.phoneHref && contact.phone ? (
          <a
            href={contact.phoneHref}
            className="group flex min-h-28 items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary">
              <MdOutlinePhoneInTalk className="size-6" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">
                Call support
              </span>
              <span className="mt-1 block text-sm text-muted-foreground group-hover:text-primary">
                {contact.phone}
              </span>
            </span>
          </a>
        ) : null}

        {!hasDirectContact ? (
          <div
            className="rounded-xl border border-warning-border bg-warning-surface p-5 text-sm text-ink sm:col-span-2"
            role="status"
          >
            Direct support contact details are being configured. You can still
            use the Staynex documentation while the team completes setup.
          </div>
        ) : null}
      </div>

      <div
        className={
          compact
            ? "grid gap-4 sm:grid-cols-2"
            : "grid gap-5 border-t border-border bg-surface-sunken p-6 sm:grid-cols-2 sm:p-8"
        }
      >
        <div className="flex gap-3">
          <MdOutlineReceiptLong
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden
          />
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Have your reference ready
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Include the booking or payment reference and a concise description
              so the team can verify the correct record.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <MdOutlineSecurity
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden
          />
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Keep access private
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Staynex support will never ask for your password, one-time code,
              full card details, or admin access code.
            </p>
          </div>
        </div>
      </div>

      {!compact ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-6 py-4 text-sm sm:px-8">
          <Link href="/docs" className="font-semibold text-primary">
            Read Staynex guides
          </Link>
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <Link href="/policies" className="font-semibold text-primary">
            Review support policies
          </Link>
        </div>
      ) : null}
    </section>
  );
}
