import { Body, Controller, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { parseBody, requiredHeader } from "../../common/http";
import { PropertiesService } from "./properties.service";
import { createPropertySchema, updatePropertySchema } from "./dto";

// `x-user-id` is a temporary stand-in for the authenticated principal until
// AuthModule lands. The backend still owns all validation and state transitions.
@Controller("owner/properties")
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list(@Headers("x-user-id") ownerId: string) {
    return this.properties.listForOwner(requiredHeader(ownerId, "x-user-id"));
  }

  @Post()
  create(@Headers("x-user-id") ownerId: string, @Body() body: unknown) {
    return this.properties.createDraft(
      requiredHeader(ownerId, "x-user-id"),
      parseBody(createPropertySchema, body),
    );
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.properties.getById(id);
  }

  @Patch(":id")
  update(
    @Headers("x-user-id") ownerId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.properties.update(
      requiredHeader(ownerId, "x-user-id"),
      id,
      parseBody(updatePropertySchema, body),
    );
  }

  @Post(":id/submit")
  submit(@Headers("x-user-id") ownerId: string, @Param("id") id: string) {
    return this.properties.submitForReview(requiredHeader(ownerId, "x-user-id"), id);
  }
}
