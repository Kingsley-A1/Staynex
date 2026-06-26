import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type { CityOption, PropertyDetail, PropertySummary } from "../../../types";
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

    const propertyIds = query.checkIn && query.checkOut
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

  private async availablePropertyIds(cityIds: string[], query: SearchQuery): Promise<string[]> {
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
        roomType.availability.every((day) => day.totalUnits - day.bookedUnits - day.heldUnits > 0)
      ) {
        ids.add(roomType.propertyId);
      }
    }
    return [...ids];
  }
}
