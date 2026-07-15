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

test("final SSE metadata carries persisted ids and verified property cards", () => {
  const event = parseAssistantEvent(
    'data: {"type":"done","conversationId":"c1","userMessageId":"u1","messageId":"a1","properties":[{"id":"p1","name":"Marina Crest","slug":"marina-crest","cityName":"Calabar","fromPriceKobo":4500000}]}',
  );
  assert.equal(event.userMessageId, "u1");
  assert.equal(event.messageId, "a1");
  assert.equal(event.properties[0].fromPriceKobo, 4500000);
});

test("application and provider throttles have truthful, different copy", () => {
  const app = recoveryCopy("application_throttled");
  const provider = recoveryCopy("provider_rate_limited");
  assert.notEqual(app, provider);
  assert.match(app, /message limit/i);
  assert.match(provider, /Staynex message limit was not reached/i);
});

test("output limits are surfaced as partial rather than successful answers", () => {
  assert.match(recoveryCopy("provider_output_limited"), /response limit/i);
  assert.match(recoveryCopy("provider_output_limited"), /partial/i);
});

test("the widget sends route context and uses an activity-based stream timeout", async () => {
  const [widget, api] = await Promise.all([
    readFile(
      new URL("../src/features/ai/assistant-widget.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8"),
  ]);
  assert.match(widget, /pagePath: pathname/);
  assert.match(api, /AI_STREAM_IDLE_TIMEOUT_MS/);
  assert.match(api, /armIdleTimeout\(\)/);
  assert.doesNotMatch(api, /AI_STREAM_TIMEOUT_MS/);
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

test("message actions are server-backed and the universal launcher stays compact", async () => {
  const [widget, api, propertyCard] = await Promise.all([
    readFile(
      new URL("../src/features/ai/assistant-widget.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/ui/property-card.tsx", import.meta.url), "utf8"),
  ]);

  const launcher = widget.match(
    /<button[\s\S]*?aria-label="Open Staynex AI"[\s\S]*?<\/button>/,
  )?.[0];
  assert.ok(launcher);
  assert.doesNotMatch(launcher, /<IconAi/);
  assert.match(widget, /"Helpful response"/);
  assert.match(widget, /"Unhelpful response"/);
  assert.match(widget, /label="Regenerate response"/);
  assert.match(widget, /label="Edit message"/);
  assert.match(widget, /variant="assistant"/);
  assert.match(api, /method: "PUT"/);
  assert.match(api, /\/feedback`/);
  assert.match(propertyCard, /variant\?: "default" \| "assistant"/);
  assert.match(propertyCard, /formatNairaFromKobo\(property\.fromPriceKobo\)/);
});
