// Phase 4 Track A — API conformance harness for Staynex AI on mobile:
// non-streaming + SSE turns, deterministic safety guardrail, conversation
// history CRUD, tri-state feedback, retry/edit operations, and access scoping.
//
// Budget note: the assistant endpoints allow 10 calls/min per principal.
// This run makes 5 signed-in calls + 1 anonymous call — within budget.
//
// Usage (backend must be running):
//   node staynex-mobile/test/phase4-assistant.mjs
//
// Footprint: one guest user, AI conversations/messages + AI action logs.
// No bookings, no capacity, no money rows.

import { API, MobileClient, createGate } from "./lib/harness.mjs";

const runTag = Date.now().toString(36);
const GUEST_EMAIL = `deblessedking001+stx-p4-${runTag}@gmail.com`;
const PASSWORD = `Phase4!${runTag}A`;

/** Minimal SSE reader over Node's fetch stream: returns {chunks, done}. */
async function streamAssistant(client, body) {
  const headers = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };
  // Mirror the mobile client: session cookie + CSRF double-submit on POST.
  if (!client.csrfToken) await client.mintCsrf();
  headers["x-csrf-token"] = client.csrfToken;
  const cookies = [`staynex_csrf=${client.csrfToken}`];
  if (client.sessionCookie) cookies.unshift(`staynex_session=${client.sessionCookie}`);
  headers["Cookie"] = cookies.join("; ");

  const res = await fetch(`${API}/ai/assistant/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (res.status !== 200) {
    return { status: res.status, chunks: [], done: null };
  }
  const chunks = [];
  let done = null;
  let buffer = "";
  const decoder = new TextDecoder();
  for await (const part of res.body) {
    buffer += decoder.decode(part, { stream: true });
    let sep;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue; // ": connected" / keep-alive
        try {
          const event = JSON.parse(line.slice(5).trim());
          if (event.type === "chunk") chunks.push(event.text);
          if (event.type === "done") done = event;
        } catch {
          /* partial frame */
        }
      }
    }
    if (done) break;
  }
  return { status: 200, chunks, done };
}

async function main() {
  console.log(`Phase 4 Track A harness → ${API}\n`);
  const gate = createGate("PHASE 4 GATE");
  const { must, bail, artifacts } = gate;

  const guest = new MobileClient();
  const health = await guest.get("/health/ready");
  if (!must(health.ok, "backend ready (GET /health/ready)", `status ${health.status}`)) {
    bail("backend is not reachable — start it with `pnpm dev:backend`");
  }

  // 1. Anonymous guests can chat — and the deterministic safety gate holds
  //    without any session. "refund" always trips the guardrail (assistant
  //    service regex), so this assertion is model-independent.
  const anon = new MobileClient();
  const anonAsk = await anon.post("/ai/assistant", {
    message: "Please process a refund for my booking right now.",
  });
  must(
    anonAsk.ok && anonAsk.json?.refused === true && /refund/i.test(anonAsk.json?.reply ?? ""),
    "anonymous chat works and the safety guardrail refuses refund actions",
    anonAsk.ok ? `refused=${anonAsk.json.refused}` : `status ${anonAsk.status}`,
  );
  must(
    typeof anonAsk.json?.conversationId === "string" && anonAsk.json.conversationId.length > 0,
    "anonymous turns persist to a session conversation",
    anonAsk.json?.conversationId ?? "none",
  );

  // 2. Signed-in turn (non-streaming) — full AssistantReply contract
  await guest.mintCsrf();
  const reg = await guest.post("/auth/register", {
    email: GUEST_EMAIL,
    password: PASSWORD,
    phone: "08030000000",
    name: "Phase4 Harness",
    role: "GUEST",
  });
  if (!must(reg.ok, "register guest", reg.ok ? GUEST_EMAIL : `status ${reg.status}`)) {
    bail("registration failed");
  }
  artifacts.push(`guest: ${GUEST_EMAIL}`);

  const ask = await guest.post("/ai/assistant", {
    message: "Which cities can I book stays in on Staynex?",
  });
  const reply = ask.json;
  must(
    ask.ok &&
      typeof reply?.reply === "string" &&
      reply.reply.length > 0 &&
      typeof reply.conversationId === "string" &&
      typeof reply.messageId === "string" &&
      typeof reply.userMessageId === "string" &&
      Array.isArray(reply.properties) &&
      Array.isArray(reply.groundedFacts) &&
      reply.refused === false,
    "signed-in turn returns the full AssistantReply contract",
    ask.ok ? `recovery=${reply.recovery}` : `status ${ask.status}`,
  );
  must(
    reply?.unavailable === false,
    "the grounded model path is live (unavailable=false)",
    `recovery=${reply?.recovery}`,
  );
  const conversationId = reply?.conversationId;
  artifacts.push(`conversation: ${conversationId}`);

  // 3. History: the conversation is listed and its messages are persisted
  const list = await guest.get("/ai/conversations");
  must(
    list.ok && Array.isArray(list.json) && list.json.some((c) => c.id === conversationId),
    "GET /ai/conversations lists the new conversation",
    `${list.json?.length ?? 0} conversations`,
  );
  const messages1 = await guest.get(`/ai/conversations/${conversationId}/messages`);
  const agentRow = messages1.json?.find((m) => m.id === reply.messageId);
  must(
    messages1.ok &&
      messages1.json.some((m) => m.id === reply.userMessageId && m.role === "USER") &&
      agentRow?.role === "AGENT" &&
      Array.isArray(agentRow?.properties),
    "messages persist with ids, roles, and property-card arrays",
    `${messages1.json?.length ?? 0} messages`,
  );

  // 4. Streaming turn — SSE chunks then one done event with persisted ids
  const stream = await streamAssistant(guest, {
    message: "What should I know before paying for a stay?",
    conversationId,
  });
  must(
    stream.status === 200 && stream.done && stream.done.conversationId === conversationId,
    "SSE stream completes with a done event bound to the conversation",
    `chunks=${stream.chunks.length}, done=${Boolean(stream.done)}`,
  );
  must(
    typeof stream.done?.messageId === "string" && stream.done.messageId.length > 0,
    "streamed reply is persisted (done carries messageId)",
    stream.done?.messageId ?? "none",
  );
  const streamedText = stream.chunks.join("");
  must(
    streamedText.length > 0 || stream.done?.unavailable === true,
    "stream delivered incremental text",
    `${streamedText.length} chars streamed`,
  );

  // 5. Tri-state feedback on the streamed answer (idempotent PUT)
  const fbUp = await guest.put(
    `/ai/conversations/${conversationId}/messages/${stream.done.messageId}/feedback`,
    { feedback: "UP" },
  );
  must(fbUp.ok && fbUp.json?.feedback === "UP", "feedback UP accepted", `status ${fbUp.status}`);
  const fbUpAgain = await guest.put(
    `/ai/conversations/${conversationId}/messages/${stream.done.messageId}/feedback`,
    { feedback: "UP" },
  );
  must(fbUpAgain.ok && fbUpAgain.json?.feedback === "UP", "feedback PUT is idempotent");
  const fbClear = await guest.put(
    `/ai/conversations/${conversationId}/messages/${stream.done.messageId}/feedback`,
    { feedback: null },
  );
  must(fbClear.ok && fbClear.json?.feedback === null, "feedback clears back to null");

  // 6. Retry replaces the latest answer; the old message is superseded
  const retry = await guest.post("/ai/assistant", {
    message: "What should I know before paying for a stay?",
    conversationId,
    operation: { type: "retry", assistantMessageId: stream.done.messageId },
  });
  must(
    retry.ok && retry.json?.messageId && retry.json.messageId !== stream.done.messageId,
    "retry produces a new persisted answer",
    retry.ok ? `new ${retry.json.messageId}` : `status ${retry.status}`,
  );
  const afterRetry = await guest.get(`/ai/conversations/${conversationId}/messages`);
  must(
    afterRetry.ok &&
      !afterRetry.json.some((m) => m.id === stream.done.messageId) &&
      afterRetry.json.some((m) => m.id === retry.json.messageId),
    "the superseded answer disappears from history; the retry remains",
  );

  // 7. Edit rewrites the latest user turn (5th signed-in assistant call)
  const editTarget = retry.json.userMessageId;
  const edit = await guest.post("/ai/assistant", {
    message: "Actually — how do check-in QR codes work?",
    conversationId,
    operation: { type: "edit", userMessageId: editTarget },
  });
  must(
    edit.ok && edit.json?.userMessageId && edit.json.messageId,
    "edit operation replaces the latest turn",
    edit.ok ? `recovery=${edit.json.recovery}` : `status ${edit.status}`,
  );
  const afterEdit = await guest.get(`/ai/conversations/${conversationId}/messages`);
  must(
    afterEdit.ok &&
      afterEdit.json.some(
        (m) => m.id === edit.json.userMessageId && /QR codes/i.test(m.content),
      ),
    "edited user message is the persisted content",
  );

  // 8. Conversation management: rename, pin, delete
  const renamed = await guest.patch(`/ai/conversations/${conversationId}`, {
    title: "Phase 4 gate",
  });
  must(renamed.ok && renamed.json?.title === "Phase 4 gate", "rename persists", `status ${renamed.status}`);
  const pinned = await guest.post(`/ai/conversations/${conversationId}/pin`, { pinned: true });
  must(pinned.ok && pinned.json?.pinned === true, "pin persists");
  const listAfter = await guest.get("/ai/conversations");
  must(
    listAfter.ok && listAfter.json[0]?.id === conversationId,
    "pinned conversations sort first",
  );

  // 9. Scoping: an anonymous client cannot read the guest's conversation
  const foreign = await new MobileClient().get(`/ai/conversations/${conversationId}/messages`);
  must(
    foreign.status >= 400,
    "another principal cannot read the conversation",
    `status ${foreign.status}`,
  );

  const removed = await guest.delete(`/ai/conversations/${conversationId}`);
  const listFinal = await guest.get("/ai/conversations");
  must(
    removed.ok && listFinal.ok && !listFinal.json.some((c) => c.id === conversationId),
    "delete removes the conversation from history",
  );

  gate.report();
  process.exit(gate.state.failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`\nUnhandled error: ${err instanceof Error ? err.stack : err}`);
  process.exit(1);
});
