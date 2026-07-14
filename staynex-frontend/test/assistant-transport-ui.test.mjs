import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseAssistantEvent,
  recoveryCopy,
  splitSseBlocks,
} from "../src/lib/ai-stream-protocol.ts";
import {
  clampFloatingPosition,
  floatingPanelSize,
} from "../src/features/ai/assistant-panel-layout.ts";

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
  assert.match(source, /label="Close Staynex AI"/);
  assert.match(source, /h-\[100dvh\]/);
  assert.doesNotMatch(
    source,
    /className="[^"]*\bhidden\b[^"]*"[^>]*>\s*Chats\s*</,
  );
});

test("assistant is globally mounted once and exposes desktop panel controls", async () => {
  const [rootLayout, publicLayout, source] = await Promise.all([
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/(public)/layout.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/features/ai/assistant-widget.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(rootLayout, /<DeferredAssistantWidget \/>/);
  assert.doesNotMatch(publicLayout, /DeferredAssistantWidget/);
  assert.match(source, /"Pop out assistant"/);
  assert.match(source, /"Dock assistant to the right"/);
  assert.match(source, /"Expand panel"/);
  assert.match(source, /data-mode=/);
  assert.doesNotMatch(source, /<svg/);
});

test("floating panel stays fully on-screen when expanded", () => {
  const compact = floatingPanelSize(false, 1365, 768);
  assert.deepEqual(compact, { width: 440, height: 600 });

  const expanded = floatingPanelSize(true, 1365, 768);
  const position = clampFloatingPosition(
    { x: 861, y: 72 },
    expanded,
    1365,
    768,
  );

  assert.equal(position.x + expanded.width, 1349);
  assert.equal(position.y + expanded.height, 752);
});
