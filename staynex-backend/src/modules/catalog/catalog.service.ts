import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type {
  CityOption,
  DestinationShowcase,
  HomeCatalogView,
  PropertyDetail,
  PropertySummary,
} from "../../../types";
import {
  propertyDetailInclude,
  propertySummaryInclude,
  toPropertyDetail,
  toPropertySummary,
} from "../properties/mappers";
import { nightsOf } from "../bookings/util";
import type { SearchQuery } from "./dto";

/** Public guest catalog. Only APPROVED properties are ever exposed. */
@Injectable()
export class CatalogService {
  async home(): Promise<HomeCatalogView> {
    const [latestRows, mostBooked, destinations] = await Promise.all([
      prisma.property.findMany({
        where: { status: "APPROVED" },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: propertySummaryInclude,
      }),
      this.mostBookedProperties(),
      this.destinationShowcases(),
    ]);

    return {
      latestProperties: latestRows.map(toPropertySummary),
      mostBookedProperties: mostBooked,
      destinations,
    };
  }

  async search(query: SearchQuery): Promise<PropertySummary[]> {
    const cities = await prisma.city.findMany({
      where: {
        OR: [
          { name: { equals: query.city, mode: "insensitive" } },
          { slug: query.city.toLowerCase() },
        ],
      },
      select: { id: true },
    });
    if (cities.length === 0) return [];

    const propertyIds =
      query.checkIn && query.checkOut
        ? await this.availablePropertyIds(
            cities.map((c) => c.id),
            query,
          )
        : null;
    if (propertyIds?.length === 0) return [];

    const rows = await prisma.property.findMany({
      where: {
        status: "APPROVED",
        cityId: { in: cities.map((c) => c.id) },
        ...(propertyIds ? { id: { in: propertyIds } } : {}),
        ...(query.area ? { area: { slug: query.area } } : {}),
        ...(query.guests
          ? { roomTypes: { some: { maxGuests: { gte: query.guests } } } }
          : {}),
      },
      orderBy: { name: "asc" },
      include: propertySummaryInclude,
    });
    return rows.map(toPropertySummary);
  }

  /** Real DB cities for owner location / property forms (id + name + slug). */
  async cities(): Promise<CityOption[]> {
    const rows = await prisma.city.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    return rows;
  }

  async getPublicProperty(slug: string): Promise<PropertyDetail> {
    const property = await prisma.property.findFirst({
      where: { slug, status: "APPROVED" },
      include: propertyDetailInclude,
    });
    if (!property) throw new NotFoundException("Property not found");
    return toPropertyDetail(property);
  }

  /**
   * Resolve approved properties explicitly named in free text. This is used by
   * Staynex AI before generation so property names and prices come from the
   * public catalog rather than model inference.
   */
  async mentionedProperties(
    message: string,
    limit = 3,
  ): Promise<PropertySummary[]> {
    const candidates = await prisma.property.findMany({
      where: { status: "APPROVED" },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { id: true, name: true, slug: true },
    });
    const normalizedMessage = normalizeSearchText(message);
    const matchingIds = candidates
      .filter((property) => {
        const name = normalizeSearchText(property.name);
        const slug = normalizeSearchText(property.slug.replace(/-/g, " "));
        return (
          (name.length >= 4 && normalizedMessage.includes(name)) ||
          (slug.length >= 4 && normalizedMessage.includes(slug))
        );
      })
      .slice(0, limit)
      .map((property) => property.id);
    if (matchingIds.length === 0) return [];

    const rows = await prisma.property.findMany({
      where: { id: { in: matchingIds }, status: "APPROVED" },
      include: propertySummaryInclude,
    });
    const byId = new Map(rows.map((row) => [row.id, toPropertySummary(row)]));
    return matchingIds.flatMap((id) => {
      const property = byId.get(id);
      return property ? [property] : [];
    });
  }

  private async mostBookedProperties(): Promise<PropertySummary[]> {
    const bookings = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        roomUnit: { roomType: { property: { status: "APPROVED" } } },
      },
      select: {
        roomUnit: { select: { roomType: { select: { propertyId: true } } } },
      },
      take: 5000,
    });

    const counts = new Map<string, number>();
    for (const booking of bookings) {
      const propertyId = booking.roomUnit.roomType.propertyId;
      counts.set(propertyId, (counts.get(propertyId) ?? 0) + 1);
    }

    const orderedIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);
    if (orderedIds.length === 0) return [];

    const rows = await prisma.property.findMany({
      where: { id: { in: orderedIds }, status: "APPROVED" },
      include: propertySummaryInclude,
    });
    const byId = new Map(rows.map((row) => [row.id, toPropertySummary(row)]));
    return orderedIds.flatMap((id) => {
      const property = byId.get(id);
      return property ? [property] : [];
    });
  }

  private async destinationShowcases(): Promise<DestinationShowcase[]> {
    const [cities, counts] = await Promise.all([
      prisma.city.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          properties: {
            where: { status: "APPROVED" },
            orderBy: { updatedAt: "desc" },
            take: 6,
            select: {
              media: {
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      }),
      prisma.property.groupBy({
        by: ["cityId"],
        where: { status: "APPROVED" },
        _count: { _all: true },
      }),
    ]);

    const countByCity = new Map(
      counts.map((row) => [row.cityId, row._count._all]),
    );
    return cities.map((city) => ({
      cityName: city.name,
      citySlug: city.slug,
      stayCount: countByCity.get(city.id) ?? 0,
      propertyImageUrls: city.properties
        .map((property) => property.media[0]?.url)
        .filter((url): url is string => Boolean(url)),
    }));
  }

  private async availablePropertyIds(
    cityIds: string[],
    query: SearchQuery,
  ): Promise<string[]> {
    if (!query.checkIn || !query.checkOut) return [];
    const nights = nightsOf(query.checkIn, query.checkOut);
    const roomTypes = await prisma.roomType.findMany({
      where: {
        property: { status: "APPROVED", cityId: { in: cityIds } },
        ...(query.guests ? { maxGuests: { gte: query.guests } } : {}),
      },
      select: {
        propertyId: true,
        availability: { where: { date: { in: nights } } },
      },
    });

    const ids = new Set<string>();
    for (const roomType of roomTypes) {
      if (
        roomType.availability.length === nights.length &&
        roomType.availability.every(
          (day) => day.totalUnits - day.bookedUnits - day.heldUnits > 0,
        )
      ) {
        ids.add(roomType.propertyId);
      }
    }
    return [...ids];
  }
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
