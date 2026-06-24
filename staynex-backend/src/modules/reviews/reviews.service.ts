import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TestimonialStatus } from "@prisma/client";
import { prisma } from "../../../db";
import type {
  AdminTestimonialRow,
  AuthUser,
  BookingReviewContext,
  PublicTestimonial,
} from "../../../types";
import { AuditService } from "../audit/audit.service";
import { auditActorId } from "../auth/auth.service";
import type { CreateReviewInput, ModerateReviewInput } from "./dto";

const DECISION_STATUS: Record<ModerateReviewInput["decision"], TestimonialStatus> = {
  APPROVE: TestimonialStatus.APPROVED,
  REJECT: TestimonialStatus.REJECTED,
  PENDING: TestimonialStatus.PENDING_REVIEW,
};

/**
 * Testimonials. A guest may only review from a valid booking context (their own
 * CONFIRMED booking). New testimonials are PENDING_REVIEW; only the admin can
 * approve, and only APPROVED testimonials are ever exposed publicly.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly audit: AuditService) {}

  /** Whether `user` can review `bookingId`, and why not. */
  async bookingContext(bookingId: string, user: AuthUser): Promise<BookingReviewContext> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        testimonial: { select: { id: true } },
        roomUnit: { include: { roomType: { include: { property: { select: { name: true } } } } } },
      },
    });
    if (!booking) throw new NotFoundException("Booking not found");

    const owns = booking.userId != null && booking.userId === user.id;
    const confirmed = booking.status === "CONFIRMED";
    const alreadyReviewed = booking.testimonial != null;
    const reason = !owns
      ? "This booking isn't linked to your account."
      : !confirmed
        ? "You can review a stay after it's confirmed."
        : alreadyReviewed
          ? "You've already reviewed this stay."
          : null;

    return {
      bookingId,
      propertyName: booking.roomUnit.roomType.property.name,
      roomName: booking.roomUnit.roomType.name,
      canReview: owns && confirmed && !alreadyReviewed,
      alreadyReviewed,
      reason,
    };
  }

  async create(
    bookingId: string,
    user: AuthUser,
    input: CreateReviewInput,
  ): Promise<{ id: string; status: TestimonialStatus }> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { roomUnit: { include: { roomType: { select: { propertyId: true } } } } },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.userId == null || booking.userId !== user.id) {
      throw new ForbiddenException("This booking isn't linked to your account");
    }
    if (booking.status !== "CONFIRMED") {
      throw new BadRequestException("You can review a stay only after it's confirmed");
    }

    try {
      const created = await prisma.testimonial.create({
        data: {
          bookingId,
          userId: user.id,
          propertyId: booking.roomUnit.roomType.propertyId,
          rating: input.rating,
          title: input.title ?? null,
          body: input.body,
          guestName: input.guestName ?? user.name ?? null,
          status: TestimonialStatus.PENDING_REVIEW,
        },
      });
      return { id: created.id, status: created.status };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("You've already reviewed this stay");
      }
      throw err;
    }
  }

  /** Public approved testimonials, optionally for one property. */
  async publicList(propertySlug: string | undefined, limit = 12): Promise<PublicTestimonial[]> {
    const rows = await prisma.testimonial.findMany({
      where: {
        status: TestimonialStatus.APPROVED,
        ...(propertySlug ? { property: { slug: propertySlug } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 50),
      include: { property: { include: { city: { select: { name: true } } } } },
    });
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      guestName: r.guestName,
      propertyName: r.property.name,
      propertySlug: r.property.slug,
      cityName: r.property.city.name,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async adminList(status?: TestimonialStatus): Promise<AdminTestimonialRow[]> {
    const rows = await prisma.testimonial.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { property: { include: { city: { select: { name: true } } } } },
    });
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      guestName: r.guestName,
      propertyName: r.property.name,
      cityName: r.property.city.name,
      status: r.status,
      bookingId: r.bookingId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async moderate(
    admin: AuthUser,
    id: string,
    input: ModerateReviewInput,
  ): Promise<{ id: string; status: TestimonialStatus }> {
    const existing = await prisma.testimonial.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Testimonial not found");
    const status = DECISION_STATUS[input.decision];

    // State change + audit in one transaction (skill.md §9).
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.testimonial.update({ where: { id }, data: { status } });
      await this.audit.record(
        {
          actorUserId: auditActorId(admin),
          action: `TESTIMONIAL_${input.decision}`,
          entityType: "Testimonial",
          entityId: id,
        },
        tx,
      );
      return next;
    });
    return { id: updated.id, status: updated.status };
  }
}
