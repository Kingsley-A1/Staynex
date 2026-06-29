# Staynex AI — Professionalization Plan

> A deep review of the current Staynex AI (assistant) implementation and a phased,
> S.M.A.R.T. plan to turn it into a genuinely professional, trustworthy product
> intelligence for Staynex — backend and frontend.
>
> - **Status:** Plan (some items already shipped — marked ✅)
> - **Last updated:** 2026-06-29
> - **Scope:** `staynex-backend/src/modules/ai/*`, `staynex-frontend/src/features/ai/*`
> - **Companion docs:** `skill.md` (§9 rules, §11 AI safety), `docs/architecture.md`

---

## 1. What exists today (honest audit)

**Backend (`staynex-backend/src/modules/ai/`)**

| Piece | State |
|---|---|
| `AssistantService.ask()` | Pipeline: deterministic **safety gate** → **canned trained answers** → **Gemini** call. Solid safety-first ordering. |
| Safety guardrail | Regex matchers for refunds, payment confirmation, availability guarantees, private-data, legal. Deterministic, never reaches the model. Good defense-in-depth, but brittle (regex only). |
| Conversation store | ✅ **Server-persisted.** `AIConversation`, `AIMessage`, `AIActionLog` in Prisma. Soft-delete, pin, rename, auto-title, per-user scoping. This is already real. |
| Grounding | ✅ Now intent-based: property page facts **and** real approved listings for a named city (Phase 2). Was previously property-slug-only. |
| Conversation memory | ✅ Now replays the last ~12 turns to the model (Phase 1). Was previously single-message (no memory). |
| Model | `gemini-2.0-flash`, temp 0.3, 512 max tokens. ✅ Now retries 429/503 with backoff honoring `Retry-After`. |
| Rename to "Staynex AI" | ✅ Done in system prompt, canned replies, controller. |

**Frontend (`staynex-frontend/src/features/ai/assistant-widget.tsx`)**

| Piece | State |
|---|---|
| Panel + FAB | Slide-in dialog, suggestions, history panel. |
| Close button | ✅ Added (prominent, always visible). |
| Auto-expanding input | ✅ Textarea grows with content; Enter sends, Shift+Enter newlines. |
| Message state | ⚠️ **Local React state only.** On reopen, the active conversation is not restored unless the user manually opens history and clicks a chat. |
| Reply rendering | ✅ Formatted (bold, lists, line breaks) via zero-dep `FormattedMessage` (Phase 3). Was plain text with raw `**`/`1.`. |
| Grounded sources | ✅ `/stays/<slug>` paths in replies now render as deep links (Phase 3). A labelled sources block remains a future refinement. |
| Disclaimer | ✅ Persistent, under the input bar (Phase 3). Was shown once in the empty state only. |
| Rate limiting | ✅ 10 req/60s per user/IP on the assistant endpoint (Phase 4). |

### 1.1 The single biggest gap — ✅ RESOLVED (Phase 1)

**Previously the model had no memory within a conversation.** The call was:

```ts
const history: GeminiTurn[] = [{ role: "user", text: input.message }];
```

Only the current message was sent — conversations were persisted but never
replayed, so every turn started cold. **Fixed in Phase 1:** `ask()` now replays
the last ~12 turns (windowed, USER-first) so follow-ups like "what about cheaper
ones?" carry context.

---

## 2. Target: what "fully professional" means here

A professional Staynex AI is:

1. **Grounded** — answers about stays, prices, cities, and policy come from
   verified Staynex data, never invented (skill.md §11).
2. **Contextual** — remembers the conversation; follow-ups work.
3. **Safe** — never confirms payments, promises availability, or handles refunds;
   declines cleanly and routes to the verified path.
4. **Transparent** — shows it's an AI, shows what it grounded on, admits limits, under trhe input bar, not on top of the panel
5. **Reliable** — degrades honestly under rate limits / outages (no crashes, no
   fabricated answers).
6. **Persistent & private** — history survives sessions for signed-in users;
   anonymous users get a single capability-scoped session.

> **Note on "training":** we are **not** fine-tuning a model. For a booking
> platform, fine-tuning is the wrong tool — facts change daily (prices,
> availability) and a fine-tuned model would hallucinate stale data. The right
> approach is **grounding / retrieval**: feed the model verified, current facts at
> inference time from the DB + a curated knowledge base. Phase 5 defines that
> knowledge base. This is what makes it "Staynex-intelligent" without the cost,
> staleness, and safety risk of fine-tuning.

---

## 3. Phased plan (S.M.A.R.T.)

### Phase 1 — Conversation memory + session restore · ~2–3 days · **highest leverage** · ✅ SHIPPED

- **Specific:** Replay recent conversation history to the model and restore the
  active conversation in the UI on open.
- **Deliverables:**
  - ✅ Backend: `ConversationsService.recentForModel()` loads the last 12 messages
    (windowed by a ~6k-char budget), guaranteed to start on a USER turn; `ask()`
    maps them to `GeminiTurn[]` (USER→user, AGENT→model). The current message is
    already persisted, so it's the last turn. System prompt stays in
    `systemInstruction`, never in history.
  - ✅ Frontend: `activeId` persisted to `localStorage` (`staynex_ai_active_conversation`);
    the panel restores the last conversation on first open via
    `GET /ai/conversations/:id/messages`, and clears the stored id on new chat /
    failed restore.
- **Measurable exit gate:** a two-turn exchange ("stays in Calabar" → "any cheaper?")
  uses prior context; closing and reopening the panel restores the last chat. ✅
- **Relevant:** removes the amnesia that makes the assistant feel broken.

### Phase 2 — Real grounding & retrieval (RAG-lite) · ~1 week · ✅ SHIPPED (backend)

- **Specific:** Ground general queries in live Staynex data, not just a single
  property page.
- **Deliverables:**
  - ✅ A **retrieval step** before the model call (`groundFacts(message, slug)`),
    most-specific-first:
    - property slug → `propertyFacts()` (room types + prices) — kept.
    - message names a known city → `cityListingFacts()` runs `CatalogService.search`
      and grounds in real approved listings (name, from-price, `/stays/<slug>` path),
      or an explicit "no listings" fact so the model can't hallucinate one.
  - ✅ Retrieved facts injected under the existing "Verified facts you may use"
    block; the hard rule (*never state a price/detail not in the verified facts*)
    is unchanged.
  - ✅ Grounded facts now embed property slugs (`/stays/<slug>`) so the Phase 3 UI
    can deep-link.
  - ✅ **Decision:** deterministic retrieve-then-ground (not open Gemini
    function-calling) — safer, matches the safety-first posture. Revisit in Phase 6.
- **Measurable exit gate:** "Show me stays in Uyo" returns an answer grounded in
  actual approved listings with correct prices; the AI still refuses to *guarantee*
  date availability. ✅ (Backend.) The visible **sources UI / deep links** are
  Phase 3 — the user asked for the disclaimer/sources to render **under the input
  bar, not atop the panel.**
- **Relevant:** this is what makes it useful, not just conversational.

### Phase 3 — Frontend professionalization · ~3–4 days · ✅ SHIPPED (core)

- **Specific:** Make the panel read as a premium, trustworthy assistant.
- **Deliverables:**
  - ✅ **Formatted rendering** of replies via a new zero-dependency, XSS-safe
    `FormattedMessage` (`features/ai/formatted-message.tsx`): **bold**, numbered &
    bulleted lists, line breaks — no raw `**`/`1.` artifacts. Kept the frontend's
    no-runtime-dependency footprint (no markdown library added).
  - ✅ **Inline deep links** — `/stays/<slug>` paths render as internal `Link`s
    (and close the panel on navigate); URLs become safe external links. This is the
    simpler-first form of "grounded sources"; a labelled sources block is a future
    refinement.
  - ✅ **Persistent disclaimer** rendered **under the input bar** (per the §2
    note): "Staynex AI can make mistakes — confirm availability and prices on the
    property page."
  - ✅ Restore-on-open (Phase 1); ✅ close button; ✅ auto-expanding input.
  - ✅ Friendly inline message on rate-limit (429) instead of a generic error.
- **Measurable exit gate:** replies render formatted; stay links work and close
  the panel; disclaimer always visible under the input. ✅
- **Relevant:** trust and polish; the visible half of "professional."

### Phase 4 — Reliability, rate-limit protection & observability · ~3 days · ✅ SHIPPED (core)

- **Specific:** Protect the Gemini quota and make AI health visible.
- **Deliverables:**
  - ✅ Gemini 429/503 retry with backoff + `Retry-After`; honest "handling a lot
    of questions" message on exhaustion.
  - ✅ **Per-principal rate limiting** on `POST /ai/assistant` via a dependency-free
    in-memory sliding window (`common/rate-limiter.ts`), keyed by `user:<id>` or
    `ip:<ip>` — **10 requests / 60s**. Returns `429` with a friendly, `retryable`
    body; the widget shows it inline. Conversation CRUD is unmetered.
  - ✅ Throttle events logged (`StaynexAI` logger) for abuse visibility.
  - ⏳ **Metrics dashboard** (reply/refusal/unavailable counts + latency in
    `/admin/ai-logs`) — deferred. The data already exists in `AIActionLog`
    (`actionType` per turn); surfacing aggregates is the remaining Phase 4 item.
- **Measurable exit gate:** a burst from one principal is throttled gracefully (no
  provider 429 cascade); throttling is visible in logs. ✅ (Dashboard pending.)
- **Note:** the in-memory limiter is per-process — correct for the current
  single-instance deploy; move to a shared store (Redis) if horizontally scaled.
- **Relevant:** keeps the free tier viable and the system observable.

### Phase 5 — Identity, live retrieval & knowledge base ("training context") · ~1 week · ✅ SHIPPED

- **Specific:** Give the AI a distinct Staynex identity, real-time platform
  retrieval (not just static knowledge), and a curated authoritative knowledge
  base for policy/company/FAQ answers.
- **Deliverables:**
  - ✅ **Identity / persona** (`assistant.service.ts` system prompt): "a
    super-intelligent assistant built into Staynex by a team of perfectionist
    engineers at Bespoke Technologies (bespoketech.com.ng), led by Kingsley
    Maduabuchi, to make **your** booking experience stand out." Personalizes with
    "you/your"; still an AI, never human.
  - ✅ **Live retrieval each turn** (`groundFacts`) — pulls fresh from the DB, not
    cached knowledge:
    - open property → rooms + a **live approved-review summary** (avg + count;
      *omitted entirely when there are no reviews* — never fabricated).
    - named city → real approved listings (Phase 2).
    - coverage questions → **live cities served + approved-stay count**.
  - ✅ **Knowledge base** (`staynex-knowledge.ts`) — curated, truthful entries
    (company/Bespoke, holds, payments, confirmation, refunds/cancellation,
    verification/trust, reviews policy, owner listing, support), retrieved by
    intent and injected into the prompt. No DB table needed (simpler first);
    embeddings/vector search remains the documented next step.
  - ✅ **Payment provider masked** — the AI always says "a trusted payment
    provider", never names it, in the prompt, knowledge, and canned replies.
  - ✅ **Context "worth-it" test applied** — included identity, live listings,
    live coverage, live reviews (only when present), and policy/company knowledge.
    Deliberately **left out**: areas/neighborhoods grounding (marginal over
    city-level), and per-property date-availability snapshots (needs reliable date
    parsing — better as Phase 6 function-calling).
  - ✅ Live data (cities, prices, listings, reviews) always comes from the **DB**;
    the knowledge file holds only stable policy/company facts — preventing
    stale-fact hallucination.
- **Measurable exit gate:** "who are you / who built you" answers on-brand
  (Bespoke / Kingsley); "stays in <city>" lists real listings; coverage questions
  use live city + count; property pages cite real review scores only when reviews
  exist; payment provider never named. ✅
- **Relevant:** turns a generic chatbot into a Staynex domain expert grounded in
  live platform state.

### Phase 6 — Advanced (post-MVP, optional)

- ✅ **Streaming responses (SSE)** — SHIPPED (the simplest, highest-impact item;
  no new infrastructure). The reply now streams in token-by-token:
  - Backend: `GeminiService.streamText()` (SSE over `:streamGenerateContent`,
    single attempt + graceful fallback); `AssistantService.askStream()` keeps the
    full safety pipeline (guardrail → canned → grounding → history) and persists
    the complete reply once at the end; `POST /ai/assistant/stream` emits SSE
    (`chunk` events + a final `done` with metadata). Rate limit, masking, and
    grounding all still apply; deterministic outcomes emit as a single chunk.
  - Frontend: `askAgentStream()` reads the SSE body and fires `onChunk`/`onDone`;
    the widget appends deltas live and "Thinking…" shows only until the first
    chunk. Partial-stream interruptions and 429s degrade gracefully.
- ⏳ Gemini **function-calling** for live date-availability *lookups* (still never
  *guarantees*), behind the existing safety gate — deferred (highest complexity).
- ⏳ Embeddings-based semantic retrieval over the knowledge base + listings —
  deferred (new infra).
- ⏳ Multilingual support (en first) — deferred (broad surface).
- ⏳ LLM-assisted safety classifier layered **behind** the deterministic regex gate
  (defense in depth, not replacement) — deferred (adds a model call per message).

---

## 4. Cross-cutting safety rules (unchanged, enforced every phase)

From skill.md §9/§11 — the AI MUST NOT:
- Confirm/verify/process payments, or claim a booking is confirmed.
- Promise or guarantee availability for specific dates.
- Promise, approve, or process refunds.
- Change any booking/payment/financial record.
- Reveal private data about other users/owners/internal systems.
- Give legal advice or pretend to be human.

The deterministic guardrail runs **before** the model on every turn and stays as
the first line of defense. Grounded facts and user input never override the system
instruction (prompt-injection resistance): the system prompt explicitly forbids
going beyond verified facts.

---

## 5. Model & rate-limit notes (verified June 2026)

- Current model `gemini-2.0-flash` free tier: ~**15 RPM / 1M TPM / 1,500 RPD**.
  A `429 RESOURCE_EXHAUSTED` means one dimension was hit; it's transient. Limits
  are **per project**, not per key — hence the Phase 4 per-user throttle.
- Retries must use **exponential backoff with jitter** and honor `Retry-After`
  (now implemented in `gemini.service.ts`).
- **Model options if quality/limits become a constraint** (drop-in swaps — change
  the `MODEL` constant): `gemini-2.5-flash` (longer outputs, native reasoning) or
  the newer **Gemini 3 Flash** (Google's recommended free-tier model in 2026, ~10
  RPM). Evaluate cost vs. quality before switching; `gemini-2.0-flash` is the
  cheapest and is sufficient for the current grounded, short-answer use.

Sources:
- [Rate limits | Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API Free Tier 2026: 1,500 Req/Day, 1M TPM](https://tokenmix.ai/blog/gemini-api-free-tier-limits)
- [Gemini 2.0 Flash vs Gemini 2.5 Flash — comparison](https://docsbot.ai/models/compare/gemini-2-0-flash/gemini-2-5-flash)

---

## 6. Recommended sequencing

1. **Phase 1** (memory + restore) — immediate, highest perceived-quality jump.
2. **Phase 2** (grounding) — makes it actually useful for finding stays.
3. **Phase 3** (frontend polish) — makes it look and feel professional.
4. **Phase 4** (reliability) — protects the quota as usage grows.
5. **Phase 5** (knowledge base) — domain expertise.
6. **Phase 6** — advanced, as warranted.

Phases 1–3 together deliver the bulk of the "professional intelligence" the
product needs; 4–5 harden and deepen it.
