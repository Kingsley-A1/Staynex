import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type { PropertyDetail, PropertySummary } from "../../../types";
import type { CreatePropertyInput, UpdatePropertyInput } from "./dto";
import {
  propertyDetailInclude,
  propertySummaryInclude,
  toPropertyDetail,
  toPropertySummary,
} from "./mappers";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Owner-facing property authoring. The backend owns every state transition;
 * `ownerId` is the authenticated principal.
 */
@Injectable()
export class PropertiesService {
  async createDraft(ownerId: string, input: CreatePropertyInput): Promise<PropertyDetail> {
    await this.assertCityExists(input.cityId);
    const slug = `${slugify(input.name) || "property"}-${Date.now().toString(36)}`;
    const created = await prisma.property.create({
      data: {
        ownerId,
        cityId: input.cityId,
        name: input.name,
        slug,
        description: input.description ?? null,
        status: "DRAFT",
      },
    });
    return this.getById(created.id);
  }

  async update(ownerId: string, id: string, input: UpdatePropertyInput): Promise<PropertyDetail> {
    await this.assertOwned(ownerId, id);
    if (input.cityId) await this.assertCityExists(input.cityId);
    await prisma.property.update({
      where: { id },
      data: {
        name: input.name,
        cityId: input.cityId,
        description: input.description,
      },
    });
    return this.getById(id);
  }

  /** Owner submits a draft for admin review. */
  async submitForReview(ownerId: string, id: string): Promise<PropertyDetail> {
    await this.assertOwned(ownerId, id);
    await prisma.property.update({ where: { id }, data: { status: "PENDING_REVIEW" } });
    return this.getById(id);
  }

  async listForOwner(ownerId: string): Promise<PropertySummary[]> {
    const rows = await prisma.property.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
      include: propertySummaryInclude,
    });
    return rows.map(toPropertySummary);
  }

  async getForOwner(ownerId: string, id: string): Promise<PropertyDetail> {
    await this.assertOwned(ownerId, id);
    return this.getById(id);
  }

  async getById(id: string): Promise<PropertyDetail> {
    const property = await prisma.property.findUnique({
      where: { id },
      include: propertyDetailInclude,
    });
    if (!property) throw new NotFoundException("Property not found");
    return toPropertyDetail(property);
  }

  /**
   * Guard the `cityId` foreign key before writing. Without this, an unknown city
   * id (e.g. a stale client value) reaches Prisma as a constraint violation and
   * surfaces as an opaque 500; here it becomes an honest, actionable 400.
   */
  private async assertCityExists(cityId: string): Promise<void> {
    const city = await prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) throw new BadRequestException("Unknown city. Please pick a city from the list.");
  }

  private async assertOwned(ownerId: string, id: string): Promise<void> {
    const found = await prisma.property.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException("Property not found");
  }
}
