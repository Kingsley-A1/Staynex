import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assistantSchema,
  messageFeedbackSchema,
} from "../src/modules/ai/dto.ts";

test("retry and edit operations require an existing conversation", () => {
  const retry = assistantSchema.safeParse({
    message: "Try that again",
    operation: { type: "retry", assistantMessageId: "agent-1" },
  });
  assert.equal(retry.success, false);

  const edit = assistantSchema.safeParse({
    message: "Show me verified stays in Calabar",
    conversationId: "conversation-1",
    operation: { type: "edit", userMessageId: "user-1" },
  });
  assert.equal(edit.success, true);
});

test("message feedback accepts only server-supported ratings", () => {
  assert.deepEqual(messageFeedbackSchema.parse({ feedback: "UP" }), {
    feedback: "UP",
  });
  assert.deepEqual(messageFeedbackSchema.parse({ feedback: null }), {
    feedback: null,
  });
  assert.equal(
    messageFeedbackSchema.safeParse({ feedback: "MAYBE" }).success,
    false,
  );
});

test("feedback and replacement persistence remain owner-scoped and atomic", async () => {
  const [controller, conversations, schema, migration] = await Promise.all([
    readFile(
      new URL("../src/modules/ai/ai.controller.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/modules/ai/conversations.service.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../prisma/migrations/20260714150000_ai_message_feedback/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(
    controller,
    /@Put\("conversations\/:conversationId\/messages\/:messageId\/feedback"\)/,
  );
  assert.match(
    conversations,
    /await this\.assertAccess\(user, conversationId\)/,
  );
  assert.match(conversations, /Only the latest completed Staynex AI turn/);
  assert.match(conversations, /return prisma\.\$transaction\(async \(tx\)/);
  assert.match(conversations, /supersededAt: now/);
  assert.match(conversations, /tx\.aIActionLog\.create/);
  assert.match(schema, /enum AIMessageFeedback[\s\S]*UP[\s\S]*DOWN/);
  assert.match(schema, /propertyCards\s+Json\?/);
  assert.match(migration, /ADD COLUMN "propertyCards" JSONB/);
});

test("grounding returns current prices and correction-safe property metadata", async () => {
  const [assistant, catalog, knowledge] = await Promise.all([
    readFile(
      new URL("../src/modules/ai/assistant.service.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/modules/catalog/catalog.service.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/modules/ai/staynex-knowledge.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(assistant, /CORRECTION SIGNAL/);
  assert.match(assistant, /latestAgentFeedback/);
  assert.match(assistant, /fromPriceKobo/);
  assert.match(assistant, /properties: uniqueProperties/);
  assert.match(assistant, /SIGNED-IN USER CONTEXT/);
  assert.match(assistant, /security in depth/i);
  assert.match(catalog, /async mentionedProperties/);
  assert.match(catalog, /status: "APPROVED"/);
  assert.match(knowledge, /security in depth/i);
});
