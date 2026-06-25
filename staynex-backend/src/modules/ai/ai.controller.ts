import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { parseBody } from "../../common/http";
import { AuthService } from "../auth/auth.service";
import { AssistantService } from "./assistant.service";
import { ConversationsService } from "./conversations.service";
import {
  assistantSchema,
  createConversationSchema,
  pinConversationSchema,
  renameConversationSchema,
} from "./dto";

// Staynex Agent. Identity is resolved from the session cookie (falling back to
// `x-user-id`); authenticated users get private history, anonymous users get a
// single session conversation.
@Controller("ai")
export class AiController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly conversations: ConversationsService,
    private readonly auth: AuthService,
  ) {}

  @Post("assistant")
  async ask(
    @Headers("cookie") cookie: string | undefined,    @Body() body: unknown,
  ) {
    const user = await this.auth.resolve(cookie);
    return this.assistant.ask(parseBody(assistantSchema, body), user);
  }

  @Get("conversations")
  async listConversations(
    @Headers("cookie") cookie: string | undefined,  ) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.list(user);
  }

  @Post("conversations")
  async createConversation(
    @Headers("cookie") cookie: string | undefined,    @Body() body: unknown,
  ) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.create(user, parseBody(createConversationSchema, body).title);
  }

  @Get("conversations/:id/messages")
  async messages(
    @Param("id") id: string,
    @Headers("cookie") cookie: string | undefined,  ) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.messages(user, id);
  }

  @Patch("conversations/:id")
  async rename(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("cookie") cookie: string | undefined,  ) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.rename(user, id, parseBody(renameConversationSchema, body).title);
  }

  @Post("conversations/:id/pin")
  async pin(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("cookie") cookie: string | undefined,  ) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.setPinned(user, id, parseBody(pinConversationSchema, body).pinned);
  }

  @Delete("conversations/:id")
  async remove(
    @Param("id") id: string,
    @Headers("cookie") cookie: string | undefined,  ) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.softDelete(user, id);
  }
}
