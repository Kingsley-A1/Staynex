import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
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
import { attachMediaSchema, requestUploadSchema } from "./dto";

@Controller("owner/media")
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
    @CurrentUser() owner: AuthUser,
    @Param("propertyId") propertyId: string,
    @Body() body: unknown,
  ) {
    return this.media.attachPropertyMedia(
      owner.id,
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
    @CurrentUser() owner: AuthUser,
    @Param("roomTypeId") roomTypeId: string,
    @Body() body: unknown,
  ) {
    return this.media.attachRoomMedia(
      owner.id,
      roomTypeId,
      parseBody(attachMediaSchema, body),
    );
  }
}
