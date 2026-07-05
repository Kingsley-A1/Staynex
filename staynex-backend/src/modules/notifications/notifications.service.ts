import { Injectable, Logger } from "@nestjs/common";
import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../../../db";
import { addUtcDays, utcToday } from "../../common/dates";
import { VoucherService } from "../vouchers/voucher.service";
import { DeviceTokensService } from "./device-tokens.service";
import { EmailAttachment, EmailService } from "./email.service";
import { PushService } from "./push.service";

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function naira(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

/** Outbox payloads — the exact deliverable, stored so retries re-send verbatim. */
interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /**
   * When set, the canonical voucher PDF for this reference is (re)rendered at
   * send time and attached. Stored (not the bytes) so the outbox row stays
   * small and every retry attaches the current truth.
   */
  attachVoucherReference?: string;
}
interface PushPayload {
  title: string;
  body: string;
  linkUrl?: string;
}

interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  bookingId?: string;
  /** Idempotency key — a trigger firing twice can never double-notify. */
  dedupeKey?: string;
  email?: EmailPayload;
}

export const MAX_DELIVERY_ATTEMPTS = 4;

/**
 * Notification authority. One entry point — {@link notifyUser} — fans out to
 * the in-app inbox, every registered device (FCM HTTP v1), and optionally
 * email, recording each channel as an outbox row (QUEUED → SENT/FAILED with
 * the deliverable payload) so the retry dispatcher can re-send failures.
 * Never throws into callers: a provider outage must not roll back the
 * business state that triggered the notification (skill.md §9).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly email: EmailService,
    private readonly push: PushService,
    private readonly devices: DeviceTokensService,
    private readonly vouchers: VoucherService,
  ) {}

  // --- core fan-out --------------------------------------------------------

  /** Notify one signed-in user across in-app + push (+ email when provided). */
  async notifyUser(userId: string, input: NotifyInput): Promise<void> {
    try {
      // The IN_APP row is the dedupe anchor: its unique dedupeKey makes the
      // whole fan-out idempotent.
      try {
        await prisma.notification.create({
          data: {
            userId,
            bookingId: input.bookingId ?? null,
            channel: "IN_APP",
            status: "SENT",
            type: input.type,
            title: input.title,
            body: input.body,
            linkUrl: input.linkUrl ?? null,
            dedupeKey: input.dedupeKey ?? null,
          },
        });
      } catch (err) {
        if (isUniqueViolation(err)) return; // already notified for this key
        throw err;
      }

      await this.pushToUser(userId, input);

      if (input.email) {
        await this.dispatchEmail({
          userId,
          bookingId: input.bookingId ?? null,
          type: input.type,
          title: input.email.subject,
          body: input.body,
          payload: input.email,
        });
      }
    } catch (err) {
      this.logger.error(
        `notifyUser(${userId}, ${input.type}) failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  /** Email a recipient with no account (anonymous guest checkout). */
  async notifyEmailOnly(
    input: Omit<NotifyInput, "email"> & { email: EmailPayload },
  ): Promise<void> {
    try {
      await this.dispatchEmail({
        userId: null,
        bookingId: input.bookingId ?? null,
        type: input.type,
        title: input.email.subject,
        body: input.body,
        payload: input.email,
        dedupeKey: input.dedupeKey ?? null,
      });
    } catch (err) {
      if (isUniqueViolation(err)) return;
      this.logger.error(
        `notifyEmailOnly(${input.type}) failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  // --- outbox delivery (shared with the retry dispatcher) ------------------

  /** Attempt delivery for an EMAIL outbox row and record the result. */
  async deliverEmailRow(row: { id: string; payload: unknown }): Promise<void> {
    const payload = row.payload as Partial<EmailPayload> | null;
    if (!payload?.to || !payload.subject || !payload.html) {
      await prisma.notification.update({
        where: { id: row.id },
        data: { status: "FAILED", attempts: MAX_DELIVERY_ATTEMPTS },
      });
      return;
    }
    const attachments = await this.resolveAttachments(payload);
    const result = await this.email.send({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.text ? { text: payload.text } : {}),
      ...(attachments.length ? { attachments } : {}),
    });
    await prisma.notification.update({
      where: { id: row.id },
      data: {
        status: result.delivered ? "SENT" : "FAILED",
        attempts: { increment: 1 },
      },
    });
  }

  /**
   * Render any voucher PDF the payload asks for, at send time. Best-effort: a
   * render failure never blocks the confirmation email — the guest can still
   * download the same PDF from the confirmation page.
   */
  private async resolveAttachments(
    payload: Partial<EmailPayload>,
  ): Promise<EmailAttachment[]> {
    if (!payload.attachVoucherReference) return [];
    try {
      const pdf = await this.vouchers.renderPdf(payload.attachVoucherReference);
      if (!pdf) return [];
      return [
        {
          filename: pdf.filename,
          content: pdf.buffer.toString("base64"),
          contentType: "application/pdf",
        },
      ];
    } catch (err) {
      this.logger.warn(
        `Voucher attachment skipped for ${payload.attachVoucherReference}: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      );
      return [];
    }
  }

  /** Attempt delivery for a PUSH outbox row across the user's devices. */
  async deliverPushRow(row: {
    id: string;
    userId: string | null;
    payload: unknown;
  }): Promise<void> {
    const payload = row.payload as Partial<PushPayload> | null;
    if (!row.userId || !payload?.title || !payload.body) {
      await prisma.notification.update({
        where: { id: row.id },
        data: { status: "FAILED", attempts: MAX_DELIVERY_ATTEMPTS },
      });
      return;
    }
    const tokens = await this.devices.tokensForUser(row.userId);
    if (tokens.length === 0) {
      // Devices vanished since queueing — nothing left to deliver to.
      await prisma.notification.update({
        where: { id: row.id },
        data: { status: "FAILED", attempts: MAX_DELIVERY_ATTEMPTS },
      });
      return;
    }

    const dead: string[] = [];
    let delivered = 0;
    for (const token of tokens) {
      const result = await this.push.send(token, {
        title: payload.title,
        body: payload.body,
        linkUrl: payload.linkUrl,
      });
      if (result.delivered) delivered += 1;
      if (result.deadToken) dead.push(token);
    }
    await this.devices.pruneDead(dead);
    await prisma.notification.update({
      where: { id: row.id },
      data: {
        status: delivered > 0 ? "SENT" : "FAILED",
        attempts: { increment: 1 },
      },
    });
  }

  // --- booking lifecycle ----------------------------------------------------

  /**
   * Called after a payment is verified and its booking transitions to
   * CONFIRMED. Re-checks the verified state itself (defense in depth) and is
   * idempotent via dedupe keys.
   */
  async onBookingConfirmed(bookingId: string): Promise<void> {
    try {
      const booking = await loadBooking(bookingId);
      if (!booking) return;
      if (booking.status !== "CONFIRMED") return;
      if (booking.payment?.status !== "SUCCESS") return;

      const property = booking.roomUnit.roomType.property;
      const stay = `${iso(booking.checkIn)} → ${iso(booking.checkOut)}`;
      const reference = booking.payment.reference ?? booking.id;
      const emailPayload: EmailPayload | undefined = booking.guestEmail
        ? {
            to: booking.guestEmail,
            subject: `Your Staynex booking is confirmed — ${property.name}`,
            html: confirmationEmailHtml({
              propertyName: property.name,
              cityName: property.city.name,
              roomName: booking.roomUnit.roomType.name,
              checkIn: iso(booking.checkIn),
              checkOut: iso(booking.checkOut),
              amount: naira(booking.payment.amount),
              reference,
              hasVoucher: Boolean(booking.payment.reference),
            }),
            // Attach the canonical PDF receipt (regenerated at send time).
            ...(booking.payment.reference
              ? { attachVoucherReference: booking.payment.reference }
              : {}),
          }
        : undefined;

      // Guest: full fan-out for account holders, email-only for anonymous.
      if (booking.userId) {
        await this.notifyUser(booking.userId, {
          type: "BOOKING_CONFIRMED",
          title: "Booking confirmed",
          body: `${property.name} · ${stay}. Your stay is reserved.`,
          linkUrl: `/booking/confirmed?booking=${booking.id}`,
          bookingId: booking.id,
          dedupeKey: `booking-confirmed:guest:${booking.id}`,
          email: emailPayload,
        });
      } else if (emailPayload) {
        await this.notifyEmailOnly({
          type: "BOOKING_CONFIRMED",
          title: "Booking confirmed",
          body: `Booking confirmed for ${property.name} (${stay}).`,
          bookingId: booking.id,
          dedupeKey: `booking-confirmed:guest:${booking.id}`,
          email: emailPayload,
        });
      }

      // Host: instant awareness of new business.
      await this.notifyUser(property.ownerId, {
        type: "BOOKING_CONFIRMED",
        title: "New confirmed booking",
        body: `${booking.roomUnit.roomType.name} at ${property.name}, ${stay}.`,
        linkUrl: `/host/bookings/${booking.id}`,
        bookingId: booking.id,
        dedupeKey: `booking-confirmed:host:${booking.id}`,
      });
    } catch (err) {
      this.logger.error(
        `onBookingConfirmed failed for ${bookingId}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  /** A captured payment was refunded — tell the guest their money is coming back. */
  async onPaymentRefunded(bookingId: string): Promise<void> {
    try {
      const booking = await loadBooking(bookingId);
      if (!booking?.payment) return;
      const property = booking.roomUnit.roomType.property;
      const amount = naira(booking.payment.amount);
      const reference = booking.payment.reference ?? booking.id;
      const body =
        `Your payment of ${amount} for ${property.name} has been refunded to your payment method. ` +
        `Reference: ${reference}. Refunds typically arrive within a few business days.`;
      const emailPayload: EmailPayload | undefined = booking.guestEmail
        ? {
            to: booking.guestEmail,
            subject: "Your Staynex refund is on the way",
            html: simpleEmailHtml("Your refund is on the way", [
              body,
              "You don't need to do anything — contact support if it hasn't arrived in 7 days.",
            ]),
            text: body,
          }
        : undefined;

      if (booking.userId) {
        await this.notifyUser(booking.userId, {
          type: "BOOKING_REFUNDED",
          title: "Refund on the way",
          body: `${amount} for ${property.name} is being refunded.`,
          linkUrl: `/payment/status?reference=${encodeURIComponent(reference)}`,
          bookingId: booking.id,
          dedupeKey: `refund:guest:${booking.payment.id}`,
          email: emailPayload,
        });
      } else if (emailPayload) {
        await this.notifyEmailOnly({
          type: "BOOKING_REFUNDED",
          title: "Refund on the way",
          body,
          bookingId: booking.id,
          dedupeKey: `refund:guest:${booking.payment.id}`,
          email: emailPayload,
        });
      }

      await this.notifyUser(property.ownerId, {
        type: "BOOKING_REFUNDED",
        title: "Booking refunded",
        body: `${booking.roomUnit.roomType.name} at ${property.name} (${iso(booking.checkIn)} → ${iso(booking.checkOut)}) was refunded and cancelled.`,
        linkUrl: `/host/bookings/${booking.id}`,
        bookingId: booking.id,
        dedupeKey: `refund:host:${booking.payment.id}`,
      });
    } catch (err) {
      this.logger.error(
        `onPaymentRefunded failed for ${bookingId}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  // --- payouts ---------------------------------------------------------------

  async onPayoutSettled(payoutId: string): Promise<void> {
    const payout = await loadPayout(payoutId);
    if (!payout) return;
    const destination = payout.owner.payoutMethod
      ? ` to your ${payout.owner.payoutMethod.bankName} account ····${payout.owner.payoutMethod.accountNumberLast4}`
      : "";
    const body = `${naira(payout.amount)} for ${payout.property.name} has been sent${destination}.`;
    await this.notifyUser(payout.ownerId, {
      type: "PAYOUT_PAID",
      title: "Payout sent",
      body,
      linkUrl: "/host/bookings",
      dedupeKey: `payout-paid:${payout.id}`,
      email: payout.owner.email
        ? {
            to: payout.owner.email,
            subject: "Your Staynex payout has been sent",
            html: simpleEmailHtml("Payout sent", [
              body,
              payout.note ? `Settlement note: ${payout.note}` : "",
            ]),
            text: body,
          }
        : undefined,
    });
  }

  async onPayoutFailed(payoutId: string, reason: string): Promise<void> {
    const payout = await loadPayout(payoutId);
    if (!payout) return;
    const body = `The payout of ${naira(payout.amount)} for ${payout.property.name} could not be settled: ${reason}`;
    await this.notifyUser(payout.ownerId, {
      type: "PAYOUT_FAILED",
      title: "Payout needs attention",
      body,
      linkUrl: "/host/settings",
      dedupeKey: `payout-failed:${payout.id}`,
      email: payout.owner.email
        ? {
            to: payout.owner.email,
            subject: "Your Staynex payout needs attention",
            html: simpleEmailHtml("Payout needs attention", [
              body,
              "Please check your payout details in Host settings, or contact support.",
            ]),
            text: body,
          }
        : undefined,
    });
  }

  // --- payment exceptions -----------------------------------------------------

  /** Funds moved but a human action is owed — alert every admin. */
  async onPaymentException(reference: string | null, detail: string): Promise<void> {
    try {
      const admins = await prisma.user.findMany({
        where: {
          OR: [
            { role: { in: ["ADMIN_REVIEWER", "ADMIN_MANAGER"] } },
            { capabilities: { some: { capability: { in: ["ADMIN_REVIEWER", "ADMIN_MANAGER"] } } } },
          ],
        },
        select: { id: true },
      });
      for (const admin of admins) {
        await this.notifyUser(admin.id, {
          type: "PAYMENT_EXCEPTION",
          title: "Payment exception — action required",
          body: `${reference ?? "unknown reference"}: ${detail}`,
          linkUrl: "/admin/bookings",
          dedupeKey: reference ? `payment-exception:${reference}:${admin.id}` : undefined,
        });
      }
    } catch (err) {
      this.logger.error(
        `onPaymentException failed for ${reference ?? "-"}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  // --- check-in reminders ------------------------------------------------------

  /**
   * Remind guests (and hosts) of tomorrow's arrivals. Runs on an interval;
   * dedupe keys make every run idempotent.
   */
  async sendCheckInReminders(): Promise<number> {
    const tomorrow = addUtcDays(utcToday(), 1);
    const dayAfter = addUtcDays(tomorrow, 1);
    const arrivals = await prisma.booking.findMany({
      where: { status: "CONFIRMED", checkIn: { gte: tomorrow, lt: dayAfter } },
      include: {
        roomUnit: {
          include: {
            roomType: {
              include: { property: { include: { city: { select: { name: true } } } } },
            },
          },
        },
      },
    });

    let reminded = 0;
    for (const booking of arrivals) {
      const property = booking.roomUnit.roomType.property;
      const guestBody = `You check in at ${property.name} (${property.city.name}) tomorrow, ${iso(booking.checkIn)}. Have a great stay!`;
      if (booking.userId) {
        await this.notifyUser(booking.userId, {
          type: "CHECKIN_REMINDER",
          title: "Check-in is tomorrow",
          body: guestBody,
          linkUrl: `/booking/confirmed?booking=${booking.id}`,
          bookingId: booking.id,
          dedupeKey: `checkin-reminder:guest:${booking.id}`,
          email: booking.guestEmail
            ? {
                to: booking.guestEmail,
                subject: `Check-in tomorrow — ${property.name}`,
                html: simpleEmailHtml("Your check-in is tomorrow", [guestBody]),
                text: guestBody,
              }
            : undefined,
        });
      } else if (booking.guestEmail) {
        await this.notifyEmailOnly({
          type: "CHECKIN_REMINDER",
          title: "Check-in is tomorrow",
          body: guestBody,
          bookingId: booking.id,
          dedupeKey: `checkin-reminder:guest:${booking.id}`,
          email: {
            to: booking.guestEmail,
            subject: `Check-in tomorrow — ${property.name}`,
            html: simpleEmailHtml("Your check-in is tomorrow", [guestBody]),
            text: guestBody,
          },
        });
      }

      await this.notifyUser(property.ownerId, {
        type: "CHECKIN_REMINDER",
        title: "Guest arriving tomorrow",
        body: `${booking.roomUnit.roomType.name} at ${property.name} — guest checks in ${iso(booking.checkIn)}.`,
        linkUrl: `/host/bookings/${booking.id}`,
        bookingId: booking.id,
        dedupeKey: `checkin-reminder:host:${booking.id}`,
      });
      reminded += 1;
    }
    return reminded;
  }

  // --- property review lifecycle ------------------------------------------------

  async onPropertyAutoReviewScheduled(propertyId: string, scheduledAt: Date): Promise<void> {
    await this.notifyPropertyOwner(propertyId, {
      title: "Property passed auto-review",
      body: `Your property passed Staynex checks and is scheduled to go live at ${scheduledAt.toISOString()}.`,
      emailSubject: "Your Staynex property is scheduled to go live",
    });
  }

  async onPropertyReviewNeedsChanges(propertyId: string, failedLabels: string[]): Promise<void> {
    const issues = failedLabels.length ? failedLabels.join(", ") : "listing readiness";
    await this.notifyPropertyOwner(propertyId, {
      title: "Property review needs changes",
      body: `Update these items before auto-publish can release your listing: ${issues}.`,
      emailSubject: "Your Staynex property needs changes",
    });
  }

  async onPropertyPublished(propertyId: string): Promise<void> {
    await this.notifyPropertyOwner(propertyId, {
      title: "Property is live",
      body: "Your property passed review and is now public on Staynex.",
      emailSubject: "Your Staynex property is live",
    });
  }

  async onPropertyManualDecision(
    propertyId: string,
    decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES",
    note?: string,
  ): Promise<void> {
    const copy = manualDecisionCopy(decision, note);
    await this.notifyPropertyOwner(propertyId, copy);
  }

  // --- internals ------------------------------------------------------------

  private async notifyPropertyOwner(
    propertyId: string,
    message: { title: string; body: string; emailSubject: string },
  ): Promise<void> {
    try {
      const property = await loadPropertyForNotification(propertyId);
      if (!property) return;
      const body = `${property.name}: ${message.body}`;
      await this.notifyUser(property.ownerId, {
        type: "PROPERTY_REVIEW",
        title: message.title,
        body,
        linkUrl: `/host/properties/${propertyId}`,
        email: property.owner.email
          ? {
              to: property.owner.email,
              subject: message.emailSubject,
              html: simpleEmailHtml(property.name, [message.body]),
              text: body,
            }
          : undefined,
      });
    } catch (err) {
      this.logger.error(
        `Property notification failed for ${propertyId}: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      );
    }
  }

  /** Queue + attempt push delivery for a user (only when devices exist). */
  private async pushToUser(userId: string, input: NotifyInput): Promise<void> {
    const tokens = await this.devices.tokensForUser(userId);
    if (tokens.length === 0) return;
    const payload: PushPayload = {
      title: input.title,
      body: input.body,
      ...(input.linkUrl ? { linkUrl: input.linkUrl } : {}),
    };
    const record = await prisma.notification.create({
      data: {
        userId,
        bookingId: input.bookingId ?? null,
        channel: "PUSH",
        status: "QUEUED",
        type: input.type,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl ?? null,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    await this.deliverPushRow({ id: record.id, userId, payload });
  }

  /** Queue + attempt an email delivery (outbox pattern). */
  private async dispatchEmail(entry: {
    userId: string | null;
    bookingId: string | null;
    type: NotificationType;
    title: string;
    body: string;
    payload: EmailPayload;
    dedupeKey?: string | null;
  }): Promise<void> {
    const record = await prisma.notification.create({
      data: {
        userId: entry.userId,
        bookingId: entry.bookingId,
        email: entry.payload.to,
        channel: "EMAIL",
        status: "QUEUED",
        type: entry.type,
        title: entry.title,
        body: entry.body,
        dedupeKey: entry.dedupeKey ?? null,
        payload: entry.payload as unknown as Prisma.InputJsonValue,
      },
    });
    await this.deliverEmailRow({ id: record.id, payload: entry.payload });
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

// Helper type anchor so the private methods can name the loaded shape.
async function loadBooking(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: {
      payment: true,
      roomUnit: {
        include: {
          roomType: {
            include: { property: { include: { city: { select: { name: true } }, owner: true } } },
          },
        },
      },
    },
  });
}

async function loadPayout(id: string) {
  return prisma.payout.findUnique({
    where: { id },
    include: {
      property: { select: { name: true } },
      owner: {
        select: {
          email: true,
          payoutMethod: { select: { bankName: true, accountNumberLast4: true } },
        },
      },
    },
  });
}

async function loadPropertyForNotification(id: string) {
  return prisma.property.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      name: true,
      owner: { select: { email: true, name: true } },
    },
  });
}

function confirmationEmailHtml(p: {
  propertyName: string;
  cityName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  amount: string;
  reference: string;
  hasVoucher: boolean;
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#6E6A83;font-size:14px">${label}</td>` +
    `<td style="padding:6px 0;color:#101014;font-size:14px;font-weight:600;text-align:right">${value}</td></tr>`;
  const voucherNote = p.hasVoucher
    ? `<p style="color:#6E6A83;font-size:13px;margin:14px 0 0">
        Your <strong style="color:#101014">Booking Confirmation &amp; Receipt</strong> is attached as a PDF.
        Present it (or its QR code) at check-in — the host can verify it instantly on Staynex.
      </p>`
    : "";
  return `<!doctype html>
<html><body style="margin:0;background:#F7F7FF;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <h1 style="color:#27187D;font-size:20px;margin:0 0 4px">Booking confirmed</h1>
    <p style="color:#6E6A83;font-size:14px;margin:0 0 16px">
      Your stay is reserved. Keep your reference handy for support.
    </p>
    <div style="background:#fff;border:1px solid #E7E5F2;border-radius:12px;padding:16px">
      <table style="width:100%;border-collapse:collapse">
        ${row("Property", `${p.propertyName} · ${p.cityName}`)}
        ${row("Room", p.roomName)}
        ${row("Dates", `${p.checkIn} → ${p.checkOut}`)}
        ${row("Amount", p.amount)}
        ${row("Reference", p.reference)}
      </table>
    </div>
    ${voucherNote}
    <p style="color:#6E6A83;font-size:12px;margin:16px 0 0">
      Staynex — Book trusted stays, Confidently.
    </p>
  </div>
</body></html>`;
}

function manualDecisionCopy(
  decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES",
  note?: string,
): { title: string; body: string; emailSubject: string } {
  const suffix = note ? ` Reviewer note: ${note}` : "";
  if (decision === "APPROVE") {
    return {
      title: "Property approved",
      body: `An admin approved your property and it is now live.${suffix}`,
      emailSubject: "Your Staynex property was approved",
    };
  }
  if (decision === "REQUEST_CHANGES") {
    return {
      title: "Property changes requested",
      body: `An admin requested changes before the property can go live.${suffix}`,
      emailSubject: "Staynex requested property changes",
    };
  }
  return {
    title: "Property rejected",
    body: `An admin rejected this property submission.${suffix}`,
    emailSubject: "Your Staynex property was not approved",
  };
}

/** Simple branded email: heading + paragraphs (all text HTML-escaped). */
function simpleEmailHtml(heading: string, lines: string[]): string {
  const paragraphs = lines
    .filter((line) => line.trim().length > 0)
    .map(
      (line) =>
        `<p style="color:#101014;font-size:14px;line-height:1.5;margin:0 0 12px">${escapeHtml(line)}</p>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;background:#F7F7FF;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <h1 style="color:#27187D;font-size:20px;margin:0 0 8px">${escapeHtml(heading)}</h1>
    ${paragraphs}
    <p style="color:#6E6A83;font-size:12px;margin:16px 0 0">
      Staynex — Book trusted stays, Confidently.
    </p>
  </div>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
