import { Body, Controller, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { parseBody } from "../../common/http";
import { AuthService } from "../auth/auth.service";
import { PropertiesService } from "./properties.service";
import { createPropertySchema, updatePropertySchema } from "./dto";

@Controller("owner/properties")
export class PropertiesController {
  constructor(
    private readonly properties: PropertiesService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
  ) {
    const owner = await this.auth.requireOwner(cookie, userId);
    return this.properties.listForOwner(owner.id);
  }

  @Post()
  async create(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
    @Body() body: unknown,
  ) {
    const owner = await this.auth.requireOwner(cookie, userId);
    return this.properties.createDraft(
      owner.id,
      parseBody(createPropertySchema, body),
    );
  }

  @Get(":id")
  async get(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
    @Param("id") id: string,
  ) {
    const owner = await this.auth.requireOwner(cookie, userId);
    return this.properties.getForOwner(owner.id, id);
  }

  @Patch(":id")
  async update(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const owner = await this.auth.requireOwner(cookie, userId);
    return this.properties.update(
      owner.id,
      id,
      parseBody(updatePropertySchema, body),
    );
  }

  @Post(":id/submit")
  async submit(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
    @Param("id") id: string,
  ) {
    const owner = await this.auth.requireOwner(cookie, userId);
    return this.properties.submitForReview(owner.id, id);
  }
}
