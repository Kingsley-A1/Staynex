import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "../../../db";
import type { AuthUser } from "../../../types";
import {
  hostPropertyId,
  isOwnerCapable,
  shouldLoadHostInsights,
} from "./assistant-context";

/**
 * Read-only, owner-scoped facts for Staynex AI. The client supplies page context,
 * but access always comes from the server-resolved OWNER capability and every
 * query is constrained by that authenticated user's id.
 */
@Injectable()
export class HostInsightsService {
  private readonly logger = new Logger(HostInsightsService.name);

  async facts(
    user: AuthUser | null,
    message: string,
    pagePath?: string,
  ): Promise<string[]> {
    if (!user || !isOwnerCapable(user)) return [];
    if (!shouldLoadHostInsights(message, pagePath)) return [];

    try {
      const propertyId = hostPropertyId(pagePath);
      return propertyId
        ? await this.propertyFacts(user.id, propertyId)
        : await this.portfolioFacts(user.id);
    } catch (error) {
      this.logger.warn(
        `Owner insight query failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
      return [];
    }
  }

  private async portfolioFacts(ownerId: string): Promise<string[]> {
    const ownerBookingScope = {
      roomUnit: { roomType: { property: { ownerId } } },
    } as const;
    const now = new Date();
    const [
      properties,
      confirmedBookings,
      pendingPayments,
      upcomingStays,
      activeUnits,
      earnings,
      pendingPayout,
      reviews,
    ] = await Promise.all([
      prisma.property.findMany({
        where: { ownerId },
        orderBy: { updatedAt: "desc" },
        select: { name: true, status: true, reviewStatus: true },
      }),
      prisma.booking.count({
        where: { ...ownerBookingScope, status: "CONFIRMED" },
      }),
      prisma.booking.count({
        where: { ...ownerBookingScope, status: "PENDING_PAYMENT" },
      }),
      prisma.booking.count({
        where: {
          ...ownerBookingScope,
          status: "CONFIRMED",
          checkIn: { gte: now },
        },
      }),
      prisma.roomUnit.count({
        where: {
          isActive: true,
          roomType: { property: { ownerId, status: "APPROVED" } },
        },
      }),
      prisma.payment.aggregate({
        _sum: { ownerPayoutKobo: true },
        where: { status: "SUCCESS", booking: ownerBookingScope },
      }),
      prisma.payout.aggregate({
        _sum: { amount: true },
        where: { ownerId, status: { in: ["PENDING", "PROCESSING"] } },
      }),
      prisma.testimonial.aggregate({
        where: { status: "APPROVED", property: { ownerId } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    const statusCounts = new Map<string, number>();
    for (const property of properties) {
      statusCounts.set(
        property.status,
        (statusCounts.get(property.status) ?? 0) + 1,
      );
    }
    const statusSummary = [...statusCounts.entries()]
      .map(([status, count]) => `${status} ${count}`)
      .join(", ");
    const facts = [
      `Host portfolio snapshot: ${properties.length} ${plural(properties.length, "property", "properties")}${statusSummary ? ` (${statusSummary})` : ""}.`,
      `All-time confirmed bookings across this host's properties: ${confirmedBookings}.`,
      `Bookings currently awaiting verified payment: ${pendingPayments}.`,
      `Upcoming confirmed stays with check-in from today onward: ${upcomingStays}.`,
      `Active room units on approved properties: ${activeUnits}. This is inventory, not date-specific availability.`,
      `All-time net host earnings recorded from successful payments: ${formatKobo(earnings._sum.ownerPayoutKobo ?? 0)}.`,
      `Payouts currently pending or processing: ${formatKobo(pendingPayout._sum.amount ?? 0)}. Do not claim they have been paid.`,
    ];
    if (reviews._count._all > 0 && reviews._avg.rating != null) {
      facts.push(
        `Approved guest review average across the portfolio: ${roundOne(reviews._avg.rating)}/5 from ${reviews._count._all} ${plural(reviews._count._all, "review", "reviews")}.`,
      );
    }
    if (properties.length > 0) {
      facts.push(
        `Most recently updated owned properties: ${properties
          .slice(0, 5)
          .map(
            (property) =>
              `${JSON.stringify(property.name)} [${property.status}; review ${property.reviewStatus}]`,
          )
          .join(", ")}.`,
      );
    }
    return facts;
  }

  private async propertyFacts(
    ownerId: string,
    propertyId: string,
  ): Promise<string[]> {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId },
      select: {
        id: true,
        name: true,
        status: true,
        reviewStatus: true,
        city: { select: { name: true } },
        roomTypes: {
          select: {
            _count: {
              select: { roomUnits: { where: { isActive: true } } },
            },
          },
        },
      },
    });
    if (!property) {
      return [
        "The current property route does not resolve to a property owned by this authenticated host. Do not infer or expose property details.",
      ];
    }

    const bookingScope = {
      roomUnit: { roomType: { propertyId: property.id } },
    } as const;
    const [confirmed, pendingPayment, earnings, pendingPayout, reviews] =
      await Promise.all([
        prisma.booking.count({
          where: { ...bookingScope, status: "CONFIRMED" },
        }),
        prisma.booking.count({
          where: { ...bookingScope, status: "PENDING_PAYMENT" },
        }),
        prisma.payment.aggregate({
          _sum: { ownerPayoutKobo: true },
          where: { status: "SUCCESS", booking: bookingScope },
        }),
        prisma.payout.aggregate({
          _sum: { amount: true },
          where: {
            ownerId,
            propertyId: property.id,
            status: { in: ["PENDING", "PROCESSING"] },
          },
        }),
        prisma.testimonial.aggregate({
          where: { propertyId: property.id, status: "APPROVED" },
          _avg: { rating: true },
          _count: { _all: true },
        }),
      ]);

    const activeUnits = property.roomTypes.reduce(
      (sum, roomType) => sum + roomType._count.roomUnits,
      0,
    );
    const facts = [
      `Current owned property: ${JSON.stringify(property.name)} in ${property.city.name}.`,
      `Listing state: ${property.status}; review state: ${property.reviewStatus}.`,
      `Configured inventory: ${property.roomTypes.length} ${plural(property.roomTypes.length, "room type", "room types")} and ${activeUnits} active ${plural(activeUnits, "unit", "units")}. This is not date-specific availability.`,
      `All-time confirmed bookings for this property: ${confirmed}.`,
      `Bookings currently awaiting verified payment for this property: ${pendingPayment}.`,
      `All-time net host earnings recorded from successful payments for this property: ${formatKobo(earnings._sum.ownerPayoutKobo ?? 0)}.`,
      `Payouts for this property currently pending or processing: ${formatKobo(pendingPayout._sum.amount ?? 0)}. Do not claim they have been paid.`,
    ];
    if (reviews._count._all > 0 && reviews._avg.rating != null) {
      facts.push(
        `Approved guest review average for this property: ${roundOne(reviews._avg.rating)}/5 from ${reviews._count._all} ${plural(reviews._count._all, "review", "reviews")}.`,
      );
    } else {
      facts.push("This property has no approved guest reviews yet.");
    }
    return facts;
  }
}

function formatKobo(kobo: number): string {
  return `NGN ${(kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function plural(count: number, singular: string, pluralValue: string): string {
  return count === 1 ? singular : pluralValue;
}
