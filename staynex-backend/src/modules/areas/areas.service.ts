import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AreaType, Prisma } from "@prisma/client";
import { prisma } from "../../../db";
import type {
  AdminCityRow,
  AdminLocationReferenceView,
  AreaOption,
  AuthUser,
} from "../../../types";
import { AuditService } from "../audit/audit.service";
import { auditActorId } from "../auth/auth.service";
import type {
  CreateAreaInput,
  CreateCityInput,
  UpdateAreaInput,
  UpdateCityInput,
} from "./dto";

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
      where: {
        OR: [
          { id: city },
          { slug: city.toLowerCase() },
          { name: { equals: city, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (!cityRow) return [];

    const areas = await prisma.area.findMany({
      where: { cityId: cityRow.id },
      include: {
        _count: { select: { properties: { where: { status: "APPROVED" } } } },
      },
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
      include: {
        _count: { select: { properties: { where: { status: "APPROVED" } } } },
      },
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

  async locationReferences(): Promise<AdminLocationReferenceView> {
    const [countries, regions] = await Promise.all([
      prisma.country.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      }),
      prisma.region.findMany({
        orderBy: { name: "asc" },
        select: { id: true, countryId: true, name: true, slug: true },
      }),
    ]);
    return { countries, regions };
  }

  async adminCityList(): Promise<AdminCityRow[]> {
    const cities = await prisma.city.findMany({
      orderBy: { name: "asc" },
      include: {
        country: { select: { name: true } },
        region: { select: { name: true } },
        _count: {
          select: { areas: true, properties: true, ownerLocations: true },
        },
      },
    });
    return cities.map((city) => this.toAdminCity(city));
  }

  async createCity(
    admin: AuthUser,
    input: CreateCityInput,
  ): Promise<AdminCityRow> {
    const { country, region } = await this.resolveCityParents(
      input.countryId,
      input.regionId ?? null,
    );
    const baseSlug = slugify(input.name) || "city";
    const existingName = await prisma.city.findFirst({
      where: {
        countryId: input.countryId,
        name: { equals: input.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existingName)
      throw new ConflictException(
        "This city already exists in the selected country",
      );

    const baseTaken = await prisma.city.findUnique({
      where: { slug: baseSlug },
      select: { id: true },
    });
    const slug = baseTaken
      ? `${baseSlug}-${country.code.toLowerCase()}`
      : baseSlug;
    try {
      const city = await prisma.$transaction(async (tx) => {
        const created = await tx.city.create({
          data: {
            countryId: country.id,
            regionId: region?.id ?? null,
            name: input.name,
            slug,
          },
          include: {
            country: { select: { name: true } },
            region: { select: { name: true } },
            _count: {
              select: { areas: true, properties: true, ownerLocations: true },
            },
          },
        });
        await this.audit.record(
          {
            actorUserId: auditActorId(admin),
            action: "CITY_CREATED",
            entityType: "City",
            entityId: created.id,
          },
          tx,
        );
        return created;
      });
      return this.toAdminCity(city);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          "A city with a similar name already exists",
        );
      }
      throw err;
    }
  }

  async updateCity(
    admin: AuthUser,
    id: string,
    input: UpdateCityInput,
  ): Promise<AdminCityRow> {
    const existing = await prisma.city.findUnique({
      where: { id },
      select: { id: true, countryId: true, regionId: true },
    });
    if (!existing) throw new NotFoundException("City not found");
    const countryId = input.countryId ?? existing.countryId;
    const regionId =
      input.regionId === undefined ? existing.regionId : input.regionId;
    await this.resolveCityParents(countryId, regionId);
    if (input.name) {
      const duplicate = await prisma.city.findFirst({
        where: {
          countryId,
          name: { equals: input.name, mode: "insensitive" },
          NOT: { id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(
          "This city already exists in the selected country",
        );
      }
    }

    const city = await prisma.$transaction(async (tx) => {
      const updated = await tx.city.update({
        where: { id },
        data: { countryId, regionId, name: input.name },
        include: {
          country: { select: { name: true } },
          region: { select: { name: true } },
          _count: {
            select: { areas: true, properties: true, ownerLocations: true },
          },
        },
      });
      await this.audit.record(
        {
          actorUserId: auditActorId(admin),
          action: "CITY_UPDATED",
          entityType: "City",
          entityId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toAdminCity(city);
  }

  async deleteCity(admin: AuthUser, id: string): Promise<{ ok: true }> {
    const city = await prisma.city.findUnique({
      where: { id },
      include: {
        _count: {
          select: { areas: true, properties: true, ownerLocations: true },
        },
      },
    });
    if (!city) throw new NotFoundException("City not found");
    const linked =
      city._count.areas + city._count.properties + city._count.ownerLocations;
    if (linked > 0) {
      throw new ConflictException(
        "This city is still used by areas, listings, or host locations. Remove or move those records first.",
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.city.delete({ where: { id } });
      await this.audit.record(
        {
          actorUserId: auditActorId(admin),
          action: "CITY_DELETED",
          entityType: "City",
          entityId: id,
        },
        tx,
      );
    });
    return { ok: true };
  }

  async create(admin: AuthUser, input: CreateAreaInput): Promise<AreaOption> {
    const city = await prisma.city.findUnique({
      where: { id: input.cityId },
      select: { id: true, slug: true },
    });
    if (!city) throw new NotFoundException("City not found");
    const slug = `${slugify(input.name) || "area"}-${city.slug}`;
    try {
      const area = await prisma.$transaction(async (tx) => {
        const created = await tx.area.create({
          data: {
            cityId: input.cityId,
            name: input.name,
            slug,
            type: input.type as AreaType,
            notable: input.notable ?? false,
          },
        });
        await this.audit.record(
          {
            actorUserId: auditActorId(admin),
            action: "AREA_CREATED",
            entityType: "Area",
            entityId: created.id,
          },
          tx,
        );
        return created;
      });
      return this.toOption(area, false);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          "An area with a similar name already exists",
        );
      }
      throw err;
    }
  }

  async update(
    admin: AuthUser,
    id: string,
    input: UpdateAreaInput,
  ): Promise<AreaOption> {
    const existing = await prisma.area.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Area not found");
    const area = await prisma.$transaction(async (tx) => {
      const updated = await tx.area.update({
        where: { id },
        data: {
          name: input.name,
          type: input.type as AreaType | undefined,
          notable: input.notable,
        },
      });
      await this.audit.record(
        {
          actorUserId: auditActorId(admin),
          action: "AREA_UPDATED",
          entityType: "Area",
          entityId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toOption(area, false);
  }

  async deleteArea(admin: AuthUser, id: string): Promise<{ ok: true }> {
    const area = await prisma.area.findUnique({
      where: { id },
      include: {
        _count: { select: { properties: true, ownerLocations: true } },
      },
    });
    if (!area) throw new NotFoundException("Area not found");
    if (area._count.properties > 0 || area._count.ownerLocations > 0) {
      throw new ConflictException(
        "This area is still used by listings or host locations. Move those records before deleting it.",
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.area.delete({ where: { id } });
      await this.audit.record(
        {
          actorUserId: auditActorId(admin),
          action: "AREA_DELETED",
          entityType: "Area",
          entityId: id,
        },
        tx,
      );
    });
    return { ok: true };
  }

  private async resolveCityParents(countryId: string, regionId: string | null) {
    const [country, region] = await Promise.all([
      prisma.country.findUnique({
        where: { id: countryId },
        select: { id: true, code: true },
      }),
      regionId
        ? prisma.region.findUnique({
            where: { id: regionId },
            select: { id: true, countryId: true },
          })
        : Promise.resolve(null),
    ]);
    if (!country) throw new NotFoundException("Country not found");
    if (regionId && (!region || region.countryId !== country.id)) {
      throw new ConflictException(
        "Select a region that belongs to the selected country",
      );
    }
    return { country, region };
  }

  private toAdminCity(city: {
    id: string;
    countryId: string;
    regionId: string | null;
    name: string;
    slug: string;
    country: { name: string };
    region: { name: string } | null;
    _count: { areas: number; properties: number; ownerLocations: number };
  }): AdminCityRow {
    return {
      id: city.id,
      name: city.name,
      slug: city.slug,
      countryId: city.countryId,
      countryName: city.country.name,
      regionId: city.regionId,
      regionName: city.region?.name ?? null,
      areaCount: city._count.areas,
      propertyCount: city._count.properties,
      ownerLocationCount: city._count.ownerLocations,
    };
  }

  private toOption(
    area: {
      id: string;
      name: string;
      slug: string;
      type: AreaType;
      notable: boolean;
    },
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
