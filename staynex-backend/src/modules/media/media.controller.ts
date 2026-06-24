import { Body, Controller, Headers, Param, Post } from "@nestjs/common";
import { parseBody, requiredHeader } from "../../common/http";
import { MediaService } from "./media.service";
import { attachMediaSchema, requestUploadSchema } from "./dto";

@Controller("owner/media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("upload-url")
  requestUpload(@Headers("x-user-id") ownerId: string, @Body() body: unknown) {
    requiredHeader(ownerId, "x-user-id");
    return this.media.requestUpload(parseBody(requestUploadSchema, body));
  }

  @Post("property/:propertyId")
  attachProperty(
    @Headers("x-user-id") ownerId: string,
    @Param("propertyId") propertyId: string,
    @Body() body: unknown,
  ) {
    return this.media.attachPropertyMedia(
      requiredHeader(ownerId, "x-user-id"),
      propertyId,
      parseBody(attachMediaSchema, body),
    );
  }

  @Post("room/:roomTypeId")
  attachRoom(
    @Headers("x-user-id") ownerId: string,
    @Param("roomTypeId") roomTypeId: string,
    @Body() body: unknown,
  ) {
    return this.media.attachRoomMedia(
      requiredHeader(ownerId, "x-user-id"),
      roomTypeId,
      parseBody(attachMediaSchema, body),
    );
  }
}
