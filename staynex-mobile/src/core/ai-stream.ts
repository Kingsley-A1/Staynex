// SSE client for POST /ai/assistant/stream.
//
// React Native's fetch cannot stream response bodies, but its XMLHttpRequest
// delivers incremental `responseText` via onprogress — the standard RN way to
// consume Server-Sent Events. Frames are `data: {json}\n\n`; comment lines
// (": connected", ": keep-alive") are ignored per the SSE spec.
//
// Truth rules: the stream carries display text ("chunk") and one final "done"
// event with the persisted ids + verified property cards. If the transport
// yields nothing incrementally (a buffering proxy), the full buffer still
// parses on completion — the caller sees the same events, just later. Callers
// needing a guaranteed reply can fall back to aiApi.ask (non-streaming).

import type { AssistantStreamEvent } from "@staynex/backend/types";
import { buildAuthHeaders } from "@/core/client";
import { API_BASE_URL } from "@/core/env";
import type { AssistantAsk } from "@/data/ai";

export type { AssistantStreamEvent };

export interface StreamHandlers {
  onChunk: (text: string) => void;
  onDone: (done: Extract<AssistantStreamEvent, { type: "done" }>) => void;
  onError: (message: string) => void;
}

export interface StreamHandle {
  abort: () => void;
}

export function streamAssistant(body: AssistantAsk, handlers: StreamHandlers): StreamHandle {
  const xhr = new XMLHttpRequest();
  let cursor = 0; // how much of responseText has been consumed
  let sawDone = false;
  let finished = false;

  const finish = (fail?: string) => {
    if (finished) return;
    finished = true;
    if (fail) handlers.onError(fail);
  };

  const consume = () => {
    const text = xhr.responseText ?? "";
    // SSE frames are separated by a blank line; keep the trailing partial frame.
    const end = text.lastIndexOf("\n\n");
    if (end <= cursor - 2) return;
    const block = text.slice(cursor, end);
    cursor = end + 2;
    for (const frame of block.split("\n\n")) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue; // comments/heartbeats
        try {
          const event = JSON.parse(line.slice(5).trim()) as AssistantStreamEvent;
          if (event.type === "chunk") handlers.onChunk(event.text);
          else if (event.type === "done") {
            sawDone = true;
            handlers.onDone(event);
          }
        } catch {
          /* partial/foreign frame — skip */
        }
      }
    }
  };

  void (async () => {
    const headers = await buildAuthHeaders("POST");
    xhr.open("POST", `${API_BASE_URL}/ai/assistant/stream`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "text/event-stream");
    for (const [name, value] of Object.entries(headers)) {
      // Note: RN's XHR allows setting Cookie; on web the browser jar applies.
      try {
        xhr.setRequestHeader(name, value);
      } catch {
        /* header refused by the platform — cookie jar covers it */
      }
    }
    xhr.onprogress = consume;
    xhr.onload = () => {
      if (xhr.status !== 200) {
        let message = "The assistant is unavailable right now.";
        try {
          const parsed = JSON.parse(xhr.responseText) as { message?: string };
          if (typeof parsed.message === "string") message = parsed.message;
        } catch {
          /* non-JSON error body */
        }
        finish(message);
        return;
      }
      consume();
      finish(sawDone ? undefined : "The reply stream ended unexpectedly.");
    };
    xhr.onerror = () => finish("Network error — check your connection.");
    xhr.onabort = () => finish();
    xhr.send(JSON.stringify(body));
  })().catch((err) =>
    finish(err instanceof Error ? err.message : "Couldn't start the assistant."),
  );

  return { abort: () => xhr.abort() };
}
