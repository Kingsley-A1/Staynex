import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Ip,
  Logger,
  Param,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import { parseBody } from "../../common/http";
import { RateLimiterService } from "../../common/rate-limiter";
import { AuthService } from "../auth/auth.service";
import { AssistantService } from "./assistant.service";
import { ConversationsService } from "./conversations.service";
import {
  assistantSchema,
  createConversationSchema,
  pinConversationSchema,
  renameConversationSchema,
} from "./dto";

// Per-principal limit on the (Gemini-backed) assistant endpoints: protects the
// shared provider quota from any single user/IP. Conversation CRUD is unmetered.
const ASSISTANT_MAX_PER_WINDOW = 10;
const ASSISTANT_WINDOW_MS = 60_000;

// Minimal structural type for the SSE response (avoids an @types/express dep).
interface StreamResponse {
  status(code: number): StreamResponse;
  setHeader(name: string, value: string): void;
  write(chunk: string): boolean;
  end(): void;
  json(body: unknown): void;
  flushHeaders?(): void;
}

// Staynex AI. Identity is resolved from the session cookie (session-only auth);
// authenticated users get private history, anonymous users get a single session
// conversation accessible by id.
@Controller("ai")
export class AiController {
  private readonly logger = new Logger("StaynexAI");

  constructor(
    private readonly assistant: AssistantService,
    private readonly conversations: ConversationsService,
    private readonly auth: AuthService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Post("assistant")
  async ask(
    @Headers("cookie") cookie: string | undefined,
    @Ip() ip: string,
    @Body() body: unknown,
  ) {
    const user = await this.auth.resolve(cookie);
    this.assertWithinRateLimit(user ? `user:${user.id}` : `ip:${ip}`);
    return this.assistant.ask(parseBody(assistantSchema, body), user);
  }

  /** Streaming variant: emits the reply as Server-Sent Events. */
  @Post("assistant/stream")
  async askStream(
    @Headers("cookie") cookie: string | undefined,
    @Ip() ip: string,
    @Body() body: unknown,
    @Res() res: StreamResponse,
  ) {
    const user = await this.auth.resolve(cookie);
    const key = user ? `user:${user.id}` : `ip:${ip}`;
    if (!this.rateLimiter.check(key, ASSISTANT_MAX_PER_WINDOW, ASSISTANT_WINDOW_MS)) {
      this.logger.warn(`Rate limit hit for ${key} (>${ASSISTANT_MAX_PER_WINDOW}/min).`);
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: "Too Many Requests",
        message: "You're sending messages quickly. Please wait a few seconds and try again.",
        retryable: true,
      });
      return;
    }

    // Validate before opening the SSE stream so a 400 is sent normally.
    const input = parseBody(assistantSchema, body);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // don't let proxies buffer the stream
    res.flushHeaders?.();

    try {
      for await (const event of this.assistant.askStream(input, user)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      this.logger.error(`Stream failed: ${err instanceof Error ? err.message : "unknown"}`);
      res.write(`data: ${JSON.stringify({ type: "done", error: true })}\n\n`);
    } finally {
      res.end();
    }
  }

  private assertWithinRateLimit(key: string): void {
    if (this.rateLimiter.check(key, ASSISTANT_MAX_PER_WINDOW, ASSISTANT_WINDOW_MS)) return;
    this.logger.warn(`Rate limit hit for ${key} (>${ASSISTANT_MAX_PER_WINDOW}/min).`);
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: "Too Many Requests",
        message: "You're sending messages quickly. Please wait a few seconds and try again.",
        retryable: true,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
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
