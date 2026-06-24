import { Body, Controller, Headers, Post } from "@nestjs/common";
import { parseBody } from "../../common/http";
import { AssistantService } from "./assistant.service";
import { assistantSchema } from "./dto";

// `x-user-id` is optional here — guests may be anonymous. When present it links
// the conversation to the user for admin AI-log visibility.
@Controller("ai")
export class AiController {
  constructor(private readonly assistant: AssistantService) {}

  @Post("assistant")
  ask(@Headers("x-user-id") userId: string | undefined, @Body() body: unknown) {
    return this.assistant.ask(parseBody(assistantSchema, body), userId?.trim() || null);
  }
}
