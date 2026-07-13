import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseAssistantEvent,
  recoveryCopy,
  splitSseBlocks,
} from "../src/lib/ai-stream-protocol.ts";

test("SSE parsing survives CRLF proxy framing and heartbeat comments", () => {
  const input =
    ': connected\r\n\r\ndata: {"type":"chunk","text":"Hi"}\r\n\r\n' +
    'data: {"type":"done","conversationId":"c1","recovery":"none"}\r\n\r\n';
  const { blocks, rest } = splitSseBlocks(input);
  assert.equal(rest, "");
  assert.equal(parseAssistantEvent(blocks[0]), null);
  assert.deepEqual(parseAssistantEvent(blocks[1]), {
    type: "chunk",
    text: "Hi",
  });
  assert.equal(parseAssistantEvent(blocks[2]).conversationId, "c1");
});

test("application and provider throttles have truthful, different copy", () => {
  const app = recoveryCopy("application_throttled");
  const provider = recoveryCopy("provider_rate_limited");
  assert.notEqual(app, provider);
  assert.match(app, /message limit/i);
  assert.match(provider, /Staynex message limit was not reached/i);
});

test("assistant shell keeps history and close controls visible at narrow viewports", async () => {
  const source = await readFile(
    new URL("../src/features/ai/assistant-widget.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, />\s*Chats\s*</);
  assert.match(source, /aria-label="Close Staynex AI"/);
  assert.match(source, /h-\[100dvh\]/);
  assert.doesNotMatch(source, /hidden[^"\n]*>\s*Chats\s*</);
});
