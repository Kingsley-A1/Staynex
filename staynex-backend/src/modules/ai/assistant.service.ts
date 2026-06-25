import { Injectable } from "@nestjs/common";
import { AIMessageRole } from "@prisma/client";
import { prisma } from "../../../db";
import type { AssistantReply, AuthUser } from "../../../types";
import { CatalogService } from "../catalog/catalog.service";
import { ConversationsService } from "./conversations.service";
import { GeminiService, type GeminiTurn } from "./gemini.service";
import type { AssistantInput } from "./dto";

const SYSTEM_PROMPT = `You are "Staynex Agent", a professional AI agent for the Staynex hospitality booking platform. Your job is to help people find available stays on Staynex and guide them confidently through the booking journey.

You MAY:
- Help users find stays: suggest searching a city and dates, opening a property, and comparing rooms using ONLY the verified facts provided to you.
- Explain how booking works end to end: search, view a stay, check availability, place a hold, sign in, pay securely with Paystack, and view confirmation status.
- Explain Staynex policies and guide the next best step.

You MUST NOT, under any circumstances:
- Invent or guarantee availability for specific dates. Availability is only known after the user checks it on the property page; guide them to search by city and dates instead.
- Confirm, verify, approve, or process payments. Payment is confirmed only by Staynex after Paystack verification.
- Promise, approve, or process refunds.
- Change or claim to change any booking, payment, or financial record.
- Override booking rules (hold expiry, payment-before-confirmation).
- Reveal private data about other users, owners, or internal systems.
- Make legal claims or give legal advice.
- Pretend to be a human. You are an AI agent.

If asked to do any forbidden thing, briefly decline and point the user to the correct, verified path (search, the property page, checkout, or Staynex support). Keep answers short, warm, and practical. Never state a specific room price or detail unless it appears in the verified facts you were given.`;

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

  async ask(input: AssistantInput, user: AuthUser | null): Promise<AssistantReply> {
    const conversationId = await this.ensureConversation(input.conversationId, user, input.message);
    await this.conversations.saveMessage(conversationId, AIMessageRole.USER, input.message);
    await this.conversations.ensureTitle(conversationId, input.message);

    const respond = async (
      reply: string,
      actionType: string,
      flags: { refused?: boolean; unavailable?: boolean; groundedFacts?: string[] } = {},
    ): Promise<AssistantReply> => {
      await this.conversations.saveMessage(conversationId, AIMessageRole.AGENT, reply);
      await this.log(conversationId, actionType, summarize(input.message));
      return {
        conversationId,
        reply,
        refused: flags.refused ?? false,
        unavailable: flags.unavailable ?? false,
        groundedFacts: flags.groundedFacts ?? [],
      };
    };

    // 1) Deterministic safety gate — never reaches the model for unsafe asks.
    const blocked = this.guardrail(input.message);
    if (blocked) return respond(blocked.reply, blocked.summary, { refused: true });

    // 2) Trained, deterministic answers for the common booking-journey questions
    //    (work even when the model is unavailable; never invent availability).
    const trained = this.trainedAnswer(input.message);
    if (trained) return respond(trained.reply, "TRAINED_ANSWER");

    // 3) Provider availability — fail gracefully with a clear state.
    if (!this.gemini.isConfigured()) {
      return respond(
        "The Staynex Agent is temporarily unavailable. You can still search stays, view rooms, and book directly on the property page.",
        "UNAVAILABLE",
        { unavailable: true },
      );
    }

    // 4) Tool-first grounding: pull verified public facts before answering.
    const groundedFacts = await this.groundFacts(input.propertySlug);
    const systemPrompt = groundedFacts.length
      ? `${SYSTEM_PROMPT}\n\nVerified facts you may use (do not contradict or go beyond these):\n- ${groundedFacts.join("\n- ")}`
      : SYSTEM_PROMPT;

    const history: GeminiTurn[] = [{ role: "user", text: input.message }];
    const reply = await this.gemini.generate(systemPrompt, history);
    if (!reply) {
      return respond(
        "The Staynex Agent couldn't respond right now. Please try again, or continue booking directly on the property page.",
        "UNAVAILABLE",
        { unavailable: true, groundedFacts },
      );
    }

    return respond(reply, groundedFacts.length ? "AGENT_REPLY_GROUNDED" : "AGENT_REPLY", {
      groundedFacts,
    });
  }

  // --- internals -----------------------------------------------------------

  private guardrail(message: string): Canned | null {
    const m = message.toLowerCase();

    if (/\brefund(s|ed|ing)?\b/.test(m)) {
      return {
        summary: "Refused: refund request",
        reply:
          "I can't promise or process refunds. Refunds follow Staynex policy and are handled by the Staynex support team — please contact support for your specific booking.",
      };
    }
    if (/\b(confirm|verify|approve|mark)\b[^.?!]{0,24}\b(payment|paid|transaction)\b/.test(m)) {
      return {
        summary: "Refused: manual payment confirmation",
        reply:
          "I can't confirm or verify payments. A booking is only confirmed after Staynex verifies your Paystack payment. Check your payment status page for the live result.",
      };
    }
    if (/\b(guarantee|promise)\b[^.?!]{0,24}\b(availab|room|book|date)/.test(m)) {
      return {
        summary: "Refused: availability guarantee",
        reply:
          "I can't guarantee availability. Please pick your dates on the property page and check availability there — that's the only verified source.",
      };
    }
    if (/\b(other guests?|another user|someone else'?s|card number|cvv|owner'?s (phone|email|number))\b/.test(m)) {
      return {
        summary: "Refused: private data request",
        reply: "I can't share private account, payment-card, or other users' information.",
      };
    }
    if (/\b(sue|lawsuit|legally liable|legal advice|take you to court)\b/.test(m)) {
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

    if (/\bhow\b[^?]*\b(book|booking|pay|payment|paystack|work)\b/.test(m)) {
      return {
        summary: "Explained booking & payment flow",
        reply:
          "Here's how booking works on Staynex:\n1. Search a city and your dates.\n2. Open a stay and pick a room.\n3. Check availability for those exact dates.\n4. Place a short hold to lock it.\n5. Sign in (or register) and pay securely with Paystack.\n6. Your booking is confirmed only after Staynex verifies the payment — you'll see the status on your confirmation page.\nI can't confirm payments myself, but I can guide you to each step.",
      };
    }
    if (/\bwhat\b[^?]*\b(check|look for|consider|know)\b/.test(m)) {
      return {
        summary: "Listed what to check before booking",
        reply:
          "Before you book, it helps to check:\n• Room type and how many guests it fits\n• The nightly price and total for your dates\n• The property's city and area/location\n• Photos, description, and amenities\n• Guest reviews\nThen confirm your exact dates are available on the property page before paying.",
      };
    }
    if (/\b(find|show|see|available|availability|browse|looking for)\b[^?]*\b(stay|stays|hotel|hotels|room|rooms|place|apartment|accommodation)\b/.test(m)) {
      return {
        summary: "Guided to availability search",
        reply:
          "I can't confirm live availability from chat, but here's the fastest way to find stays that are actually available:\n1. Open Search.\n2. Choose your city (for example Calabar, Uyo, Port Harcourt, Lagos, or Abuja).\n3. Add your check-in and check-out dates.\nThe results will show approved stays you can book for those dates. Tell me your city and dates and I'll explain what to do next.",
      };
    }
    return null;
  }

  /** Pull verified, public, APPROVED-only facts for grounding (never private data). */
  private async groundFacts(propertySlug?: string): Promise<string[]> {
    if (!propertySlug) return [];
    try {
      const property = await this.catalog.getPublicProperty(propertySlug);
      const facts: string[] = [`Property: ${property.name} in ${property.cityName}.`];
      if (property.description) facts.push(`About: ${property.description}`);
      for (const rt of property.roomTypes) {
        const price = `₦${Math.round(rt.basePriceKobo / 100).toLocaleString("en-NG")}`;
        facts.push(`Room "${rt.name}": ${price}/night, up to ${rt.maxGuests} guests.`);
      }
      facts.push(
        "Live date-by-date availability is NOT included here; the user must check it on the property page.",
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
      if (convo && !convo.deletedAt && (convo.userId == null || convo.userId === user?.id)) {
        return convo.id;
      }
    }
    const created = await prisma.aIConversation.create({
      data: { userId: user?.id ?? null, topic: summarize(firstMessage) },
    });
    return created.id;
  }

  private async log(conversationId: string, actionType: string, summary: string): Promise<void> {
    await prisma.aIActionLog.create({ data: { conversationId, actionType, summary } });
  }
}

function summarize(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
}
