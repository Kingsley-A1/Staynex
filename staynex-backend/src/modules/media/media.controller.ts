import { Body, Controller, Headers, Param, Post } from "@nestjs/common";
import { parseBody } from "../../common/http";
import { AuthService } from "../auth/auth.service";
import { MediaService } from "./media.service";
import { attachMediaSchema, requestUploadSchema } from "./dto";

@Controller("owner/media")
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly auth: AuthService,
  ) {}

  @Post("upload-url")
  async requestUpload(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
    @Body() body: unknown,
  ) {
    await this.auth.requireOwner(cookie, userId);
    return this.media.requestUpload(parseBody(requestUploadSchema, body));
  }

  @Post("property/:propertyId")
  async attachProperty(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
    @Param("propertyId") propertyId: string,
    @Body() body: unknown,
  ) {
    const owner = await this.auth.requireOwner(cookie, userId);
    return this.media.attachPropertyMedia(
      owner.id,
      propertyId,
      parseBody(attachMediaSchema, body),
    );
  }

  @Post("room/:roomTypeId")
  async attachRoom(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
    @Param("roomTypeId") roomTypeId: string,
    @Body() body: unknown,
  ) {
    const owner = await this.auth.requireOwner(cookie, userId);
    return this.media.attachRoomMedia(
      owner.id,
      roomTypeId,
      parseBody(attachMediaSchema, body),
    );
  }
}
