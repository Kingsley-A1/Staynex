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
import { randomUUID } from "node:crypto";
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
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,80}$/;

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
    @Headers("x-request-id") suppliedRequestId: string | undefined,
    @Ip() ip: string,
    @Body() body: unknown,
  ) {
    const requestId = safeRequestId(suppliedRequestId);
    const user = await this.auth.resolve(cookie);
    this.assertWithinRateLimit(
      `ai-assistant:${user ? `user:${user.id}` : `ip:${ip}`}`,
      requestId,
    );
    this.logger.log(`[${requestId}] non-stream request accepted`);
    const reply = await this.assistant.ask(
      parseBody(assistantSchema, body),
      user,
      requestId,
    );
    this.logger.log(
      `[${requestId}] non-stream completed recovery=${reply.recovery}`,
    );
    return reply;
  }

  /** Streaming variant: emits the reply as Server-Sent Events. */
  @Post("assistant/stream")
  async askStream(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-request-id") suppliedRequestId: string | undefined,
    @Ip() ip: string,
    @Body() body: unknown,
    @Res() res: StreamResponse,
  ) {
    const requestId = safeRequestId(suppliedRequestId);
    const user = await this.auth.resolve(cookie);
    const key = `ai-assistant:${user ? `user:${user.id}` : `ip:${ip}`}`;
    if (
      !this.rateLimiter.check(
        key,
        ASSISTANT_MAX_PER_WINDOW,
        ASSISTANT_WINDOW_MS,
      )
    ) {
      this.logger.warn(`[${requestId}] application throttle exceeded`);
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: "Too Many Requests",
        message:
          "You're sending messages quickly. Please wait a few seconds and try again.",
        retryable: true,
        code: "AI_APPLICATION_THROTTLED",
        recovery: "application_throttled",
        retryAfterSeconds: Math.ceil(ASSISTANT_WINDOW_MS / 1000),
        requestId,
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
    res.setHeader("X-Request-ID", requestId);
    res.flushHeaders?.();
    res.write(": connected\n\n");
    const heartbeat = setInterval(() => {
      try {
        res.write(": keep-alive\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, 15_000);
    this.logger.log(`[${requestId}] stream request accepted`);

    try {
      for await (const event of this.assistant.askStream(
        input,
        user,
        requestId,
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.type === "done") {
          this.logger.log(
            `[${requestId}] stream completed recovery=${event.recovery}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `[${requestId}] stream failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      res.write(
        `data: ${JSON.stringify({
          type: "done",
          conversationId: "",
          refused: false,
          unavailable: true,
          groundedFacts: [],
          recovery: "transport_interrupted",
          requestId,
          error: true,
        })}\n\n`,
      );
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  }

  private assertWithinRateLimit(key: string, requestId: string): void {
    if (
      this.rateLimiter.check(key, ASSISTANT_MAX_PER_WINDOW, ASSISTANT_WINDOW_MS)
    )
      return;
    this.logger.warn(`[${requestId}] application throttle exceeded`);
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: "Too Many Requests",
        message:
          "You're sending messages quickly. Please wait a few seconds and try again.",
        retryable: true,
        code: "AI_APPLICATION_THROTTLED",
        recovery: "application_throttled",
        retryAfterSeconds: Math.ceil(ASSISTANT_WINDOW_MS / 1000),
        requestId,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  @Get("conversations")
  async listConversations(@Headers("cookie") cookie: string | undefined) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.list(user);
  }

  @Post("conversations")
  async createConversation(
    @Headers("cookie") cookie: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.create(
      user,
      parseBody(createConversationSchema, body).title,
    );
  }

  @Get("conversations/:id/messages")
  async messages(
    @Param("id") id: string,
    @Headers("cookie") cookie: string | undefined,
  ) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.messages(user, id);
  }

  @Patch("conversations/:id")
  async rename(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("cookie") cookie: string | undefined,
  ) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.rename(
      user,
      id,
      parseBody(renameConversationSchema, body).title,
    );
  }

  @Post("conversations/:id/pin")
  async pin(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("cookie") cookie: string | undefined,
  ) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.setPinned(
      user,
      id,
      parseBody(pinConversationSchema, body).pinned,
    );
  }

  @Delete("conversations/:id")
  async remove(
    @Param("id") id: string,
    @Headers("cookie") cookie: string | undefined,
  ) {
    const user = await this.auth.resolve(cookie);
    return this.conversations.softDelete(user, id);
  }
}

function safeRequestId(value: string | undefined): string {
  const candidate = value?.trim();
  return candidate && REQUEST_ID_PATTERN.test(candidate)
    ? candidate
    : randomUUID();
}
