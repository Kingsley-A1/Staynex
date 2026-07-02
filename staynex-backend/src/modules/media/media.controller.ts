import { Body, Controller, Delete, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../../../types";
import { parseBody } from "../../common/http";
import { RateLimit } from "../../common/rate-limit.guard";
import {
  CapabilitiesGuard,
  CurrentUser,
  RequireAnyCapability,
  SessionGuard,
} from "../auth/access-control";
import { MediaService } from "./media.service";
import {
  attachMediaSchema,
  reorderMediaSchema,
  requestUploadSchema,
  updateMediaSchema,
} from "./dto";

@Controller("host/media")
@UseGuards(SessionGuard, CapabilitiesGuard)
@RequireAnyCapability("OWNER")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("upload-url")
  @RateLimit({
    bucket: "media:upload-url",
    limit: 20,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async requestUpload(@Body() body: unknown) {
    return this.media.requestUpload(parseBody(requestUploadSchema, body));
  }

  @Post("property/:propertyId")
  @RateLimit({
    bucket: "media:attach",
    limit: 60,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async attachProperty(
    @CurrentUser() host: AuthUser,
    @Param("propertyId") propertyId: string,
    @Body() body: unknown,
  ) {
    return this.media.attachPropertyMedia(
      host.id,
      propertyId,
      parseBody(attachMediaSchema, body),
    );
  }

  @Post("room/:roomTypeId")
  @RateLimit({
    bucket: "media:attach",
    limit: 60,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async attachRoom(
    @CurrentUser() host: AuthUser,
    @Param("roomTypeId") roomTypeId: string,
    @Body() body: unknown,
  ) {
    return this.media.attachRoomMedia(
      host.id,
      roomTypeId,
      parseBody(attachMediaSchema, body),
    );
  }

  @Put("property/:propertyId/order")
  async reorderProperty(
    @CurrentUser() host: AuthUser,
    @Param("propertyId") propertyId: string,
    @Body() body: unknown,
  ) {
    return this.media.reorderPropertyMedia(
      host.id,
      propertyId,
      parseBody(reorderMediaSchema, body).mediaIds,
    );
  }

  @Put("room/:roomTypeId/order")
  async reorderRoom(
    @CurrentUser() host: AuthUser,
    @Param("roomTypeId") roomTypeId: string,
    @Body() body: unknown,
  ) {
    return this.media.reorderRoomMedia(
      host.id,
      roomTypeId,
      parseBody(reorderMediaSchema, body).mediaIds,
    );
  }

  @Patch("property-media/:mediaId")
  async updatePropertyMedia(
    @CurrentUser() host: AuthUser,
    @Param("mediaId") mediaId: string,
    @Body() body: unknown,
  ) {
    return this.media.updatePropertyMediaAlt(
      host.id,
      mediaId,
      parseBody(updateMediaSchema, body).altText,
    );
  }

  @Patch("room-media/:mediaId")
  async updateRoomMedia(
    @CurrentUser() host: AuthUser,
    @Param("mediaId") mediaId: string,
    @Body() body: unknown,
  ) {
    return this.media.updateRoomMediaAlt(
      host.id,
      mediaId,
      parseBody(updateMediaSchema, body).altText,
    );
  }

  @Delete("property-media/:mediaId")
  async deletePropertyMedia(
    @CurrentUser() host: AuthUser,
    @Param("mediaId") mediaId: string,
  ) {
    return this.media.deletePropertyMedia(host.id, mediaId);
  }

  @Delete("room-media/:mediaId")
  async deleteRoomMedia(
    @CurrentUser() host: AuthUser,
    @Param("mediaId") mediaId: string,
  ) {
    return this.media.deleteRoomMedia(host.id, mediaId);
  }
}
