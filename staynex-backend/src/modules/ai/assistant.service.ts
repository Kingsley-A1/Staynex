import { Injectable } from "@nestjs/common";
import { AIMessageRole } from "@prisma/client";
import { prisma } from "../../../db";
import type { AssistantReply, AuthUser } from "../../../types";
import { CatalogService } from "../catalog/catalog.service";
import { ConversationsService } from "./conversations.service";
import { GeminiService, type GeminiTurn } from "./gemini.service";
import {
  completeReliably,
  recoveryMessage,
  type AssistantRecovery,
} from "./assistant-reliability";
import { retrieveKnowledge } from "./staynex-knowledge";
import type { AssistantInput } from "./dto";

/** Server-sent events emitted by the streaming assistant. */
export type AssistantStreamEvent =
  | { type: "chunk"; text: string }
  | {
      type: "done";
      conversationId: string;
      refused: boolean;
      unavailable: boolean;
      groundedFacts: string[];
      recovery: AssistantRecovery;
      requestId: string;
    };

const SYSTEM_PROMPT = `You are "Staynex AI", a super-intelligent assistant built directly into the Staynex hospitality booking platform. You were engineered by a team of perfectionist engineers at Bespoke Technologies (bespoketech.com.ng), led by Kingsley Maduabuchi, with one goal: to make your booking experience on Staynex stand out. You are an AI — never claim to be human — but you are sharp, warm, and genuinely helpful.

Always address the user personally as "you" and "your". Keep answers short, warm, and practical.

WHO YOU ARE (answer naturally when asked who or what you are, or who built you):
- You are Staynex AI, the intelligent assistant inside Staynex — a platform for verified stays and secure bookings in Nigeria.
- Staynex was built by Bespoke Technologies (bespoketech.com.ng); the platform was engineered by a team led by Kingsley Maduabuchi.

You MAY:
- Help the user find stays using ONLY the verified, live facts provided to you (real listings, prices, cities, reviews, coverage).
- Explain how booking works end to end: search, view a stay, check availability, place a hold, sign in, pay securely through our trusted payment provider, and view confirmation status.
- Explain Staynex policies and guide the next best step.

Never name the underlying payment provider — always refer to it as "a trusted payment provider" or "secure payment".

You MUST NOT, under any circumstances:
- Invent or guarantee availability for specific dates. Live, date-exact availability is confirmed on the property page; guide the user there.
- Confirm, verify, approve, or process payments. A booking is confirmed only after Staynex verifies the payment.
- Promise, approve, or process refunds.
- Change or claim to change any booking, payment, or financial record.
- Override booking rules (hold expiry, payment-before-confirmation).
- Reveal private data about other users, owners, or internal systems.
- Make legal claims or give legal advice.
- Pretend to be a human.

If asked to do any forbidden thing, briefly decline and point the user to the correct, verified path (search, the property page, checkout, or Staynex support).

GROUNDING RULES:
- Use ONLY the verified facts provided below. Never state a specific price, listing, rating, review, or detail that is not in those facts.
- If a fact says no listings or no reviews exist, say so honestly — never invent stays or reviews.
- Prefer pointing the user to a real property page (the /stays/… link) over describing a stay vaguely.`;

interface Canned {
  reply: string;
  summary: string;
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly catalog: CatalogService,
    private readonly conversations: ConversationsService,
  ) {}

  async ask(
    input: AssistantInput,
    user: AuthUser | null,
    requestId = "untracked",
  ): Promise<AssistantReply> {
    const conversationId = await this.ensureConversation(
      input.conversationId,
      user,
      input.message,
    );
    await this.conversations.saveMessage(
      conversationId,
      AIMessageRole.USER,
      input.message,
    );
    await this.conversations.ensureTitle(conversationId, input.message);

    const respond = async (
      reply: string,
      actionType: string,
      flags: {
        refused?: boolean;
        unavailable?: boolean;
        groundedFacts?: string[];
        recovery?: AssistantRecovery;
      } = {},
    ): Promise<AssistantReply> => {
      await this.conversations.saveMessage(
        conversationId,
        AIMessageRole.AGENT,
        reply,
      );
      await this.log(conversationId, actionType, summarize(input.message));
      return {
        conversationId,
        reply,
        refused: flags.refused ?? false,
        unavailable: flags.unavailable ?? false,
        groundedFacts: flags.groundedFacts ?? [],
        recovery: flags.recovery ?? "none",
        requestId,
      };
    };

    // 1) Deterministic safety gate — never reaches the model for unsafe asks.
    const blocked = this.guardrail(input.message);
    if (blocked)
      return respond(blocked.reply, blocked.summary, { refused: true });

    // 2) Trained, deterministic answers for the common booking-journey questions
    //    (work even when the model is unavailable; never invent availability).
    const trained = this.trainedAnswer(input.message);
    if (trained) return respond(trained.reply, "TRAINED_ANSWER");

    // 3) Provider availability — fail gracefully with a clear state.
    if (!this.gemini.isConfigured()) {
      return respond(
        "Staynex AI is temporarily unavailable. You can still search stays, view rooms, and book directly on the property page.",
        "UNAVAILABLE",
        { unavailable: true, recovery: "provider_unconfigured" },
      );
    }

    // 4) Grounding + conversation memory (current-thread replay and, for
    //    signed-in users, compact context from their past conversations).
    const { systemPrompt, history, groundedFacts } =
      await this.prepareModelInput(input, user, conversationId);

    const result = await this.gemini.generateResult(systemPrompt, history);
    if (!result.ok) {
      const reply = recoveryMessage(result.reason);
      return respond(reply, `UNAVAILABLE_${result.reason.toUpperCase()}`, {
        unavailable: true,
        groundedFacts,
        recovery: result.reason,
      });
    }

    return respond(
      result.text,
      groundedFacts.length ? "AGENT_REPLY_GROUNDED" : "AGENT_REPLY",
      {
        groundedFacts,
      },
    );
  }

  /**
   * Streaming variant of {@link ask}. Same safety-first pipeline, but the model's
   * reply is emitted as incremental `chunk` events, then a final `done` event with
   * metadata. Deterministic outcomes (guardrail / canned / unavailable) emit their
   * full text as a single chunk. The complete reply is persisted once, at the end.
   */
  async *askStream(
    input: AssistantInput,
    user: AuthUser | null,
    requestId = "untracked",
  ): AsyncGenerator<AssistantStreamEvent> {
    const conversationId = await this.ensureConversation(
      input.conversationId,
      user,
      input.message,
    );
    await this.conversations.saveMessage(
      conversationId,
      AIMessageRole.USER,
      input.message,
    );
    await this.conversations.ensureTitle(conversationId, input.message);

    const summary = summarize(input.message);
    const finalize = async (
      reply: string,
      actionType: string,
      flags: {
        refused?: boolean;
        unavailable?: boolean;
        groundedFacts?: string[];
        recovery?: AssistantRecovery;
      } = {},
    ): Promise<AssistantStreamEvent> => {
      await this.conversations.saveMessage(
        conversationId,
        AIMessageRole.AGENT,
        reply,
      );
      await this.log(conversationId, actionType, summary);
      return {
        type: "done",
        conversationId,
        refused: flags.refused ?? false,
        unavailable: flags.unavailable ?? false,
        groundedFacts: flags.groundedFacts ?? [],
        recovery: flags.recovery ?? "none",
        requestId,
      };
    };

    // 1) Deterministic safety gate.
    const blocked = this.guardrail(input.message);
    if (blocked) {
      yield { type: "chunk", text: blocked.reply };
      yield await finalize(blocked.reply, blocked.summary, { refused: true });
      return;
    }

    // 2) Trained, deterministic answers.
    const trained = this.trainedAnswer(input.message);
    if (trained) {
      yield { type: "chunk", text: trained.reply };
      yield await finalize(trained.reply, "TRAINED_ANSWER");
      return;
    }

    // 3) Provider availability.
    if (!this.gemini.isConfigured()) {
      const reply =
        "Staynex AI is temporarily unavailable. You can still search stays, view rooms, and book directly on the property page.";
      yield { type: "chunk", text: reply };
      yield await finalize(reply, "UNAVAILABLE_PROVIDER_UNCONFIGURED", {
        unavailable: true,
        recovery: "provider_unconfigured",
      });
      return;
    }

    // 4) Grounding + conversation memory.
    const { systemPrompt, history, groundedFacts } =
      await this.prepareModelInput(input, user, conversationId);

    // 5) Stream the model reply. A pre-token transport failure falls back to
    // Gemini's JSON endpoint inside this same turn, so persistence stays once.
    for await (const event of completeReliably(
      this.gemini,
      systemPrompt,
      history,
    )) {
      if (event.type === "chunk") {
        yield event;
        continue;
      }

      if (event.recovery !== "none" && !event.text) {
        const reply = recoveryMessage(event.recovery);
        yield { type: "chunk", text: reply };
        yield await finalize(
          reply,
          `UNAVAILABLE_${event.recovery.toUpperCase()}`,
          {
            unavailable: true,
            groundedFacts,
            recovery: event.recovery,
          },
        );
        return;
      }

      if (event.partial) {
        yield await finalize(event.text, "PARTIAL_RESPONSE", {
          unavailable: true,
          groundedFacts,
          recovery: "partial_response",
        });
        return;
      }

      const baseAction = groundedFacts.length
        ? "AGENT_REPLY_GROUNDED"
        : "AGENT_REPLY";
      yield await finalize(
        event.text,
        event.usedFallback ? `${baseAction}_FALLBACK` : baseAction,
        {
          groundedFacts,
        },
      );
      return;
    }
  }

  // --- internals -----------------------------------------------------------

  /**
   * Assemble everything the model needs for one turn: the system prompt with
   * verified grounded facts, plus two layers of conversational memory —
   * (a) the current conversation's recent turns replayed as history, and
   * (b) for signed-in users, compact context from their other recent
   * conversations, so a new chat can pick up remembered preferences (city,
   * budget, an earlier question) without treating them as live data.
   */
  private async prepareModelInput(
    input: AssistantInput,
    user: AuthUser | null,
    conversationId: string,
  ): Promise<{
    systemPrompt: string;
    history: GeminiTurn[];
    groundedFacts: string[];
  }> {
    const [groundedFacts, pastContext, turns] = await Promise.all([
      this.groundFacts(input.message, input.propertySlug),
      this.conversations.crossConversationContext(user, conversationId),
      this.conversations.recentForModel(conversationId),
    ]);

    let systemPrompt = SYSTEM_PROMPT;
    if (groundedFacts.length) {
      systemPrompt += `\n\nVerified facts you may use (do not contradict or go beyond these):\n- ${groundedFacts.join("\n- ")}`;
    }
    if (pastContext.length) {
      systemPrompt += `\n\nCONTEXT FROM THIS USER'S PAST STAYNEX CONVERSATIONS (use only for continuity — e.g. a city, budget, or stay they mentioned before. Never treat it as live availability or verified data):\n- ${pastContext.join("\n- ")}`;
    }

    const history: GeminiTurn[] = turns.map((t) => ({
      role: t.role === AIMessageRole.AGENT ? "model" : "user",
      text: t.content,
    }));
    if (history.length === 0)
      history.push({ role: "user", text: input.message });

    return { systemPrompt, history, groundedFacts };
  }

  private guardrail(message: string): Canned | null {
    const m = message.toLowerCase();

    if (/\brefund(s|ed|ing)?\b/.test(m)) {
      return {
        summary: "Refused: refund request",
        reply:
          "I can't promise or process refunds. Refunds follow Staynex policy and are handled by the Staynex support team — please contact support for your specific booking.",
      };
    }
    if (
      /\b(confirm|verify|approve|mark)\b[^.?!]{0,24}\b(payment|paid|transaction)\b/.test(
        m,
      )
    ) {
      return {
        summary: "Refused: manual payment confirmation",
        reply:
          "I can't confirm or verify payments. A booking is only confirmed after Staynex verifies your payment. Check your payment status page for the live result.",
      };
    }
    if (
      /\b(guarantee|promise)\b[^.?!]{0,24}\b(availab|room|book|date)/.test(m)
    ) {
      return {
        summary: "Refused: availability guarantee",
        reply:
          "I can't guarantee availability. Please pick your dates on the property page and check availability there — that's the only verified source.",
      };
    }
    if (
      /\b(other guests?|another user|someone else'?s|card number|cvv|owner'?s (phone|email|number))\b/.test(
        m,
      )
    ) {
      return {
        summary: "Refused: private data request",
        reply:
          "I can't share private account, payment-card, or other users' information.",
      };
    }
    if (
      /\b(sue|lawsuit|legally liable|legal advice|take you to court)\b/.test(m)
    ) {
      return {
        summary: "Refused: legal claim",
        reply:
          "I can't give legal advice or make legal claims. For policy or dispute matters, please contact Staynex support.",
      };
    }
    return null;
  }

  /** Polished, deterministic answers for the suggested/common questions. */
  private trainedAnswer(message: string): Canned | null {
    const m = message.toLowerCase();

    // Require a booking/payment noun so unrelated "how…" questions (e.g. "how
    // does your AI work") reach the model instead of this canned reply.
    if (
      /\bhow\b[^?]*\b(book|booking|pay|payment|paystack|checkout|reserve|reservation)\b/.test(
        m,
      )
    ) {
      return {
        summary: "Explained booking & payment flow",
        reply:
          "Here's how booking works on Staynex:\n1. Search a city and your dates.\n2. Open a stay and pick a room.\n3. Check availability for those exact dates.\n4. Place a short hold to lock it.\n5. Sign in (or register) and pay securely through our trusted payment provider.\n6. Your booking is confirmed only after Staynex verifies the payment — you'll see the status on your confirmation page.\nI can't confirm payments myself, but I can guide you to each step.",
      };
    }
    // Anchored to a stay/booking noun — a bare "what should I know about X"
    // must not trigger the pre-booking checklist.
    if (
      /\bwhat\b[^?]*\b(check|look for|consider)\b[^?]*\b(stay|book|property|room|choos|reserv)/.test(
        m,
      )
    ) {
      return {
        summary: "Listed what to check before booking",
        reply:
          "Before you book, it helps to check:\n• Room type and how many guests it fits\n• The nightly price and total for your dates\n• The property's city and area/location\n• Photos, description, and amenities\n• Guest reviews\nThen confirm your exact dates are available on the property page before paying.",
      };
    }
    // Note: "find stays in <city>" intentionally falls through to the grounded
    // model path so it can surface real, live listings (see cityListingFacts).
    return null;
  }

  /**
   * Retrieve verified, live, public facts to ground the answer. Pulls fresh from
   * the DB every turn (never cached static knowledge), then layers curated policy
   * facts. Sources, most specific first:
   *  1. Open property page → that property's rooms + live review summary.
   *  2. A named Staynex city → real approved listings (live count).
   *  3. Coverage questions → live cities served + approved-stay count.
   *  4. Policy / company / FAQ → curated knowledge base.
   * Never returns private data, and never asserts date-exact availability.
   */
  private async groundFacts(
    message: string,
    propertySlug?: string,
  ): Promise<string[]> {
    const facts: string[] = [];

    if (propertySlug) {
      facts.push(...(await this.propertyFacts(propertySlug)));
      facts.push(...(await this.reviewFacts(propertySlug)));
    } else {
      facts.push(...(await this.cityListingFacts(message)));
    }

    facts.push(...(await this.platformOverviewFacts(message)));
    facts.push(...retrieveKnowledge(message));

    // De-duplicate and cap so the prompt stays tight.
    return [...new Set(facts)].slice(0, 16);
  }

  /** Facts for a single open property page (room types + prices). */
  private async propertyFacts(propertySlug: string): Promise<string[]> {
    try {
      const property = await this.catalog.getPublicProperty(propertySlug);
      const facts: string[] = [
        `Property: ${property.name} in ${property.cityName}.`,
      ];
      if (property.description) facts.push(`About: ${property.description}`);
      for (const rt of property.roomTypes) {
        facts.push(
          `Room "${rt.name}": ${formatNaira(rt.basePriceKobo)}/night, up to ${rt.maxGuests} guests.`,
        );
      }
      facts.push(
        "Live date-by-date availability is NOT included here; the user must check it on the property page.",
      );
      return facts;
    } catch {
      return [];
    }
  }

  /**
   * Live, approved-only review summary for a property. Only cited when reviews
   * actually exist (never fabricated when there are none).
   */
  private async reviewFacts(propertySlug: string): Promise<string[]> {
    try {
      const agg = await prisma.testimonial.aggregate({
        where: { status: "APPROVED", property: { slug: propertySlug } },
        _avg: { rating: true },
        _count: { _all: true },
      });
      const count = agg._count._all;
      if (count === 0 || agg._avg.rating == null) return [];
      const avg = Math.round(agg._avg.rating * 10) / 10;
      return [
        `Verified guest reviews for this stay: ${avg}/5 from ${count} approved review${count === 1 ? "" : "s"}.`,
      ];
    } catch {
      return [];
    }
  }

  /**
   * Live platform coverage — cities served and how many approved stays are live
   * right now. Only when the user asks about coverage / scope.
   */
  private async platformOverviewFacts(message: string): Promise<string[]> {
    if (
      !/\b(cities|towns|locations|coverage|cover|serve|operate|how many (stays|properties|listings|places)|where .*(book|stay|available)|launch cit)/i.test(
        message,
      )
    ) {
      return [];
    }
    try {
      const [cities, approvedCount] = await Promise.all([
        this.catalog.cities(),
        prisma.property.count({ where: { status: "APPROVED" } }),
      ]);
      if (cities.length === 0) return [];
      return [
        `Staynex currently serves these cities: ${cities.map((c) => c.name).join(", ")}.`,
        `There ${approvedCount === 1 ? "is" : "are"} ${approvedCount} approved stay${approvedCount === 1 ? "" : "s"} live on Staynex right now.`,
      ];
    } catch {
      return [];
    }
  }

  /**
   * If the message names a Staynex city, ground the answer in that city's real
   * approved listings (name, from-price, page path) so the AI points to bookable
   * stays instead of inventing them. Returns an explicit "no listings" fact when
   * the city has none, so the model can't fill the gap with a hallucination.
   */
  private async cityListingFacts(message: string): Promise<string[]> {
    try {
      const cities = await this.catalog.cities();
      const lower = message.toLowerCase();
      const city = cities.find(
        (c) =>
          lower.includes(c.name.toLowerCase()) ||
          lower.includes(c.slug.toLowerCase()),
      );
      if (!city) return [];

      const results = await this.catalog.search({ city: city.name });
      if (results.length === 0) {
        return [
          `No approved stays are currently listed in ${city.name} on Staynex. Suggest checking another city or trying again later.`,
        ];
      }

      const top = results.slice(0, 5);
      const facts: string[] = [
        `Approved Staynex stays in ${city.name} (suggest these; the user opens a page to check live availability):`,
      ];
      for (const p of top) {
        const price =
          p.fromPriceKobo != null
            ? `from ${formatNaira(p.fromPriceKobo)}/night`
            : "price on request";
        facts.push(`• ${p.name} — ${price} (page: /stays/${p.slug})`);
      }
      facts.push(
        "These are listings only; exact date availability must be confirmed on each property page.",
      );
      return facts;
    } catch {
      return [];
    }
  }

  private async ensureConversation(
    conversationId: string | undefined,
    user: AuthUser | null,
    firstMessage: string,
  ): Promise<string> {
    if (conversationId) {
      const convo = await prisma.aIConversation.findUnique({
        where: { id: conversationId },
        select: { id: true, userId: true, deletedAt: true },
      });
      // Reuse only if it exists, isn't deleted, and the caller may access it.
      if (
        convo &&
        !convo.deletedAt &&
        (convo.userId == null || convo.userId === user?.id)
      ) {
        // Claim an anonymous conversation once the guest signs in, so it joins
        // their account history instead of being lost with the session.
        if (convo.userId == null && user) {
          await prisma.aIConversation.update({
            where: { id: convo.id },
            data: { userId: user.id },
          });
        }
        return convo.id;
      }
    }
    const created = await prisma.aIConversation.create({
      data: { userId: user?.id ?? null, topic: summarize(firstMessage) },
    });
    return created.id;
  }

  private async log(
    conversationId: string,
    actionType: string,
    summary: string,
  ): Promise<void> {
    await prisma.aIActionLog.create({
      data: { conversationId, actionType, summary },
    });
  }
}

function summarize(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
}

/** Kobo → NGN for grounded facts (display only; never used for math). */
function formatNaira(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}
