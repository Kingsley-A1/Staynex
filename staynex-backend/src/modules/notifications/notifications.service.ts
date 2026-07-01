import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "../../../db";
import { EmailService } from "./email.service";
import { PushService } from "./push.service";

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function naira(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

/**
 * Notification orchestration. The single rule (skill.md §9): a guest
 * confirmation email is sent ONLY for a booking that is already CONFIRMED with a
 * SUCCESS payment. This service re-checks that invariant itself, is idempotent
 * (won't double-send), and never throws into the caller — a provider outage must
 * not roll back a verified booking.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly email: EmailService,
    private readonly push: PushService,
  ) {}

  /**
   * Called after a payment is verified and its booking transitions to CONFIRMED.
   * Best-effort: emails the guest and records notifications for guest + owner.
   */
  async onBookingConfirmed(bookingId: string): Promise<void> {
    try {
      const booking = await loadBooking(bookingId);

      // Defense in depth: never notify unless the verified state is real.
      if (!booking) return;
      if (booking.status !== "CONFIRMED") return;
      if (booking.payment?.status !== "SUCCESS") return;

      await this.sendGuestConfirmation(booking);
      await this.notifyOwner(booking);
    } catch (err) {
      this.logger.error(
        `onBookingConfirmed failed for ${bookingId}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

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

  private async sendGuestConfirmation(
    booking: Awaited<ReturnType<typeof loadBooking>>,
  ): Promise<void> {
    if (!booking) return;
    const to = booking.guestEmail ?? null;
    const property = booking.roomUnit.roomType.property;

    // Idempotency: one confirmation email per booking.
    const already = await prisma.notification.findFirst({
      where: { bookingId: booking.id, channel: "EMAIL", status: "SENT" },
      select: { id: true },
    });
    if (already) return;

    if (!to) {
      this.logger.warn(`Booking ${booking.id} confirmed without a guest email; nothing to send`);
      return;
    }

    const amountKobo = booking.payment?.amount ?? 0;
    const subject = `Your Staynex booking is confirmed — ${property.name}`;
    const html = confirmationEmailHtml({
      propertyName: property.name,
      cityName: property.city.name,
      roomName: booking.roomUnit.roomType.name,
      checkIn: iso(booking.checkIn),
      checkOut: iso(booking.checkOut),
      amount: naira(amountKobo),
      reference: booking.payment?.reference ?? booking.id,
    });

    const record = await prisma.notification.create({
      data: {
        userId: booking.userId,
        bookingId: booking.id,
        email: to,
        channel: "EMAIL",
        status: "QUEUED",
        title: subject,
        body: `Booking confirmed for ${property.name} (${iso(booking.checkIn)} → ${iso(booking.checkOut)}).`,
      },
    });

    const result = await this.email.send({ to, subject, html });
    await prisma.notification.update({
      where: { id: record.id },
      data: { status: result.delivered ? "SENT" : "FAILED" },
    });
    this.logger.log(
      `Guest confirmation for ${booking.id}: ${result.delivered ? "sent" : `not sent (${result.skippedReason})`}`,
    );
  }

  private async notifyOwner(
    booking: Awaited<ReturnType<typeof loadBooking>>,
  ): Promise<void> {
    if (!booking) return;
    const property = booking.roomUnit.roomType.property;
    const ownerId = property.ownerId;
    const title = "New confirmed booking";
    const body = `${booking.roomUnit.roomType.name} at ${property.name}, ${iso(booking.checkIn)} → ${iso(booking.checkOut)}.`;

    // In-app record the owner can see in their dashboard.
    await prisma.notification.create({
      data: {
        userId: ownerId,
        bookingId: booking.id,
        channel: "IN_APP",
        status: "SENT",
        title,
        body,
      },
    });

    // Push foundation (no-op until FCM + device tokens exist).
    await this.push.send({ title, body, data: { bookingId: booking.id } });
  }

  private async notifyPropertyOwner(
    propertyId: string,
    message: { title: string; body: string; emailSubject: string },
  ): Promise<void> {
    try {
      const property = await loadPropertyForNotification(propertyId);
      if (!property) return;
      await prisma.notification.create({
        data: {
          userId: property.ownerId,
          email: property.owner.email ?? null,
          channel: "IN_APP",
          status: "SENT",
          title: message.title,
          body: `${property.name}: ${message.body}`,
        },
      });
      if (property.owner.email) {
        const record = await prisma.notification.create({
          data: {
            userId: property.ownerId,
            email: property.owner.email,
            channel: "EMAIL",
            status: "QUEUED",
            title: message.emailSubject,
            body: `${property.name}: ${message.body}`,
          },
        });
        const result = await this.email.send({
          to: property.owner.email,
          subject: message.emailSubject,
          html: propertyNotificationHtml(property.name, message.body),
          text: `${property.name}\n\n${message.body}`,
        });
        await prisma.notification.update({
          where: { id: record.id },
          data: { status: result.delivered ? "SENT" : "FAILED" },
        });
      }
      await this.push.send({
        title: message.title,
        body: `${property.name}: ${message.body}`,
        data: { propertyId },
      });
    } catch (err) {
      this.logger.error(
        `Property notification failed for ${propertyId}: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      );
    }
  }
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
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#6E6A83;font-size:14px">${label}</td>` +
    `<td style="padding:6px 0;color:#101014;font-size:14px;font-weight:600;text-align:right">${value}</td></tr>`;
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

function propertyNotificationHtml(propertyName: string, body: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#F7F7FF;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <h1 style="color:#27187D;font-size:20px;margin:0 0 8px">${escapeHtml(propertyName)}</h1>
    <p style="color:#101014;font-size:14px;line-height:1.5;margin:0">${escapeHtml(body)}</p>
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
