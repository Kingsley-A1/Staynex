import assert from "node:assert/strict";
import test from "node:test";
import { completeReliably } from "../src/modules/ai/assistant-reliability.ts";
import {
  parseGeminiSseEvent,
  splitGeminiSseEvents,
} from "../src/modules/ai/gemini-sse.ts";

async function collect(provider) {
  const events = [];
  for await (const event of completeReliably(provider, "system", [
    { role: "user", text: "hello" },
  ])) {
    events.push(event);
  }
  return events;
}

function failure(reason) {
  const error = new Error(reason);
  error.reason = reason;
  return error;
}

test("successful streams do not call the fallback", async () => {
  let fallbackCalls = 0;
  const events = await collect({
    async *streamText() {
      yield "Hello";
      yield " there";
    },
    async generateResult() {
      fallbackCalls += 1;
      return { ok: true, text: "duplicate" };
    },
  });

  assert.equal(fallbackCalls, 0);
  assert.deepEqual(events.at(-1), {
    type: "result",
    text: "Hello there",
    recovery: "none",
    usedFallback: false,
    partial: false,
  });
});

test("a pre-token stream failure falls back within the same turn", async () => {
  let fallbackCalls = 0;
  const events = await collect({
    async *streamText() {
      throw failure("provider_error");
    },
    async generateResult() {
      fallbackCalls += 1;
      return { ok: true, text: "Fallback answer" };
    },
  });

  assert.equal(fallbackCalls, 1);
  assert.deepEqual(events, [
    { type: "chunk", text: "Fallback answer" },
    {
      type: "result",
      text: "Fallback answer",
      recovery: "none",
      usedFallback: true,
      partial: false,
    },
  ]);
});

test("a post-token failure is partial and never starts a second completion", async () => {
  let fallbackCalls = 0;
  const events = await collect({
    async *streamText() {
      yield "Partial";
      throw failure("provider_timeout");
    },
    async generateResult() {
      fallbackCalls += 1;
      return { ok: true, text: "must not run" };
    },
  });

  assert.equal(fallbackCalls, 0);
  assert.equal(events.at(-1).recovery, "partial_response");
  assert.equal(events.at(-1).text, "Partial");
});

test("an output-limit finish stays distinct and never looks complete", async () => {
  const events = await collect({
    async *streamText() {
      yield "The first part";
      throw failure("provider_output_limited");
    },
    async generateResult() {
      return { ok: true, text: "must not run" };
    },
  });

  assert.deepEqual(events.at(-1), {
    type: "result",
    text: "The first part",
    recovery: "provider_output_limited",
    usedFallback: false,
    partial: true,
  });
});

test("a JSON fallback preserves an explicitly partial provider answer", async () => {
  const events = await collect({
    async *streamText() {
      throw failure("provider_error");
    },
    async generateResult() {
      return {
        ok: false,
        reason: "provider_output_limited",
        partialText: "Useful but unfinished",
      };
    },
  });

  assert.deepEqual(events.at(-1), {
    type: "result",
    text: "Useful but unfinished",
    recovery: "provider_output_limited",
    usedFallback: true,
    partial: true,
  });
});

test("provider quota remains distinct from application throttling", async () => {
  const events = await collect({
    async *streamText() {
      throw failure("provider_rate_limited");
    },
    async generateResult() {
      return { ok: false, reason: "provider_rate_limited" };
    },
  });

  assert.equal(events.at(-1).recovery, "provider_rate_limited");
  assert.notEqual(events.at(-1).recovery, "application_throttled");
});

test("provider SSE framing accepts LF, CRLF, and an incomplete tail", () => {
  const framed = 'data: {"one":1}\r\n\r\ndata: {"two":2}\n\ndata: {"partial":';
  assert.deepEqual(splitGeminiSseEvents(framed), {
    events: ['data: {"one":1}', 'data: {"two":2}'],
    rest: 'data: {"partial":',
  });
});

test("provider SSE parsing captures the terminal finish reason", () => {
  const event = parseGeminiSseEvent(
    'data: {"candidates":[{"content":{"parts":[{"text":"done"}]},"finishReason":"MAX_TOKENS"}]}',
  );
  assert.deepEqual(event, {
    text: "done",
    finishReason: "MAX_TOKENS",
  });
});
