import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AreaType, Prisma } from "@prisma/client";
import { prisma } from "../../../db";
import type { AreaOption, AuthUser } from "../../../types";
import { AuditService } from "../audit/audit.service";
import { auditActorId } from "../auth/auth.service";
import type { CreateAreaInput, UpdateAreaInput } from "./dto";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

@Injectable()
export class AreasService {
  constructor(private readonly audit: AuditService) {}

  /**
   * Areas for a city (resolved by id, slug, or name), ordered: notable first,
   * then areas that have approved properties, then the rest alphabetically.
   */
  async listForCity(city: string): Promise<AreaOption[]> {
    const cityRow = await prisma.city.findFirst({
      where: { OR: [{ id: city }, { slug: city.toLowerCase() }, { name: { equals: city, mode: "insensitive" } }] },
      select: { id: true },
    });
    if (!cityRow) return [];

    const areas = await prisma.area.findMany({
      where: { cityId: cityRow.id },
      include: { _count: { select: { properties: { where: { status: "APPROVED" } } } } },
    });

    return areas
      .map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        type: a.type,
        notable: a.notable,
        hasProperties: a._count.properties > 0,
      }))
      .sort(
        (x, y) =>
          Number(y.notable) - Number(x.notable) ||
          Number(y.hasProperties) - Number(x.hasProperties) ||
          x.name.localeCompare(y.name),
      );
  }

  /** Admin: every area for a city (management view). */
  async adminList(city?: string): Promise<AreaOption[]> {
    if (city) return this.listForCity(city);
    const areas = await prisma.area.findMany({
      orderBy: [{ notable: "desc" }, { name: "asc" }],
      include: { _count: { select: { properties: { where: { status: "APPROVED" } } } } },
    });
    return areas.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      type: a.type,
      notable: a.notable,
      hasProperties: a._count.properties > 0,
    }));
  }

  async create(admin: AuthUser, input: CreateAreaInput): Promise<AreaOption> {
    const city = await prisma.city.findUnique({ where: { id: input.cityId }, select: { id: true } });
    if (!city) throw new NotFoundException("City not found");
    const slug = `${slugify(input.name) || "area"}-${slugify(input.cityId).slice(0, 6)}`;
    try {
      const area = await prisma.area.create({
        data: {
          cityId: input.cityId,
          name: input.name,
          slug,
          type: input.type as AreaType,
          notable: input.notable ?? false,
        },
      });
      await this.audit.record({
        actorUserId: auditActorId(admin),
        action: "AREA_CREATED",
        entityType: "Area",
        entityId: area.id,
      });
      return this.toOption(area, false);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("An area with a similar name already exists");
      }
      throw err;
    }
  }

  async update(admin: AuthUser, id: string, input: UpdateAreaInput): Promise<AreaOption> {
    const existing = await prisma.area.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Area not found");
    const area = await prisma.area.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type as AreaType | undefined,
        notable: input.notable,
      },
    });
    await this.audit.record({
      actorUserId: auditActorId(admin),
      action: "AREA_UPDATED",
      entityType: "Area",
      entityId: id,
    });
    return this.toOption(area, false);
  }

  private toOption(
    area: { id: string; name: string; slug: string; type: AreaType; notable: boolean },
    hasProperties: boolean,
  ): AreaOption {
    return {
      id: area.id,
      name: area.name,
      slug: area.slug,
      type: area.type,
      notable: area.notable,
      hasProperties,
    };
  }
}
