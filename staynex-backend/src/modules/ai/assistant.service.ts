import { Injectable } from "@nestjs/common";
import { prisma } from "../../../db";
import type { AssistantReply } from "../../../types";
import { CatalogService } from "../catalog/catalog.service";
import { GeminiService, type GeminiTurn } from "./gemini.service";
import type { AssistantInput } from "./dto";

const SYSTEM_PROMPT = `You are "Staynex Assistant", a helpful, concise assistant for the Staynex hospitality booking platform (born in Calabar, Nigeria; built for the world).

You MAY:
- Explain listings, rooms, amenities, and how they differ.
- Compare rooms using ONLY the verified facts provided to you.
- Explain Staynex policies and how the booking flow works (search, view stay, check availability, hold, pay with Paystack, confirm).
- Guide a guest through the next step.

You MUST NOT, under any circumstances:
- Invent or guarantee availability for specific dates. Availability is only known after the guest checks it on the property page; tell them to do that.
- Confirm, verify, approve, or process payments. Payment is confirmed only by Staynex after Paystack verification.
- Promise, approve, or process refunds.
- Change or claim to change any booking, payment, or financial record.
- Override booking rules (hold expiry, payment-before-confirmation).
- Reveal private data about other guests, owners, or internal systems.
- Make legal claims or give legal advice.
- Pretend to be a human. You are an AI assistant.

If asked to do any forbidden thing, briefly decline and point the guest to the correct, verified path (the property page, checkout, or Staynex support). Keep answers short and plain. Never state a specific room price or detail unless it appears in the verified facts you were given.`;

interface Guardrail {
  reply: string;
  reason: string; // logged summary
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly catalog: CatalogService,
  ) {}

  async ask(input: AssistantInput, userId: string | null): Promise<AssistantReply> {
    const conversationId = await this.ensureConversation(input.conversationId, userId, input.message);

    // 1) Deterministic safety gate — never reaches the model for unsafe asks.
    const blocked = this.guardrail(input.message);
    if (blocked) {
      await this.log(conversationId, "REFUSAL", blocked.reason);
      return { conversationId, reply: blocked.reply, refused: true, unavailable: false, groundedFacts: [] };
    }

    // 2) Provider availability — fail gracefully with a clear state.
    if (!this.gemini.isConfigured()) {
      await this.log(conversationId, "UNAVAILABLE", "AI provider not configured");
      return {
        conversationId,
        reply: "The Staynex Assistant is temporarily unavailable. You can still search stays, view rooms, and book directly on the property page.",
        refused: false,
        unavailable: true,
        groundedFacts: [],
      };
    }

    // 3) Tool-first grounding: pull verified public facts before answering.
    const groundedFacts = await this.groundFacts(input.propertySlug);

    const systemPrompt = groundedFacts.length
      ? `${SYSTEM_PROMPT}\n\nVerified facts you may use (do not contradict or go beyond these):\n- ${groundedFacts.join("\n- ")}`
      : SYSTEM_PROMPT;

    const history: GeminiTurn[] = [{ role: "user", text: input.message }];
    const reply = await this.gemini.generate(systemPrompt, history);

    if (!reply) {
      await this.log(conversationId, "UNAVAILABLE", "AI provider returned no answer");
      return {
        conversationId,
        reply: "The Staynex Assistant couldn't respond right now. Please try again, or continue booking directly on the property page.",
        refused: false,
        unavailable: true,
        groundedFacts,
      };
    }

    await this.log(
      conversationId,
      groundedFacts.length ? "ASSISTANT_REPLY_GROUNDED" : "ASSISTANT_REPLY",
      summarize(input.message),
    );
    return { conversationId, reply, refused: false, unavailable: false, groundedFacts };
  }

  // --- internals -----------------------------------------------------------

  private guardrail(message: string): Guardrail | null {
    const m = message.toLowerCase();

    if (/\brefund(s|ed|ing)?\b/.test(m)) {
      return {
        reason: "Refused: refund request",
        reply:
          "I can't promise or process refunds. Refunds follow Staynex policy and are handled by the Staynex support team — please contact support for your specific booking.",
      };
    }
    if (/\b(confirm|verify|approve|mark)\b[^.?!]{0,24}\b(payment|paid|transaction)\b/.test(m)) {
      return {
        reason: "Refused: manual payment confirmation",
        reply:
          "I can't confirm or verify payments. A booking is only confirmed after Staynex verifies your Paystack payment. Check your payment status page for the live result.",
      };
    }
    if (/\b(guarantee|promise)\b[^.?!]{0,24}\b(availab|room|book|date)/.test(m)) {
      return {
        reason: "Refused: availability guarantee",
        reply:
          "I can't guarantee availability. Please pick your dates on the property page and check availability there — that's the only verified source.",
      };
    }
    if (/\b(other guests?|another user|someone else'?s|card number|cvv|owner'?s (phone|email|number))\b/.test(m)) {
      return {
        reason: "Refused: private data request",
        reply: "I can't share private account, payment-card, or other users' information.",
      };
    }
    if (/\b(sue|lawsuit|legally liable|legal advice|take you to court)\b/.test(m)) {
      return {
        reason: "Refused: legal claim",
        reply:
          "I can't give legal advice or make legal claims. For policy or dispute matters, please contact Staynex support.",
      };
    }
    return null;
  }

  /** Pull verified, public, APPROVED-only facts for grounding (never private data). */
  private async groundFacts(propertySlug?: string): Promise<string[]> {
    if (!propertySlug) return [];
    try {
      const property = await this.catalog.getPublicProperty(propertySlug);
      const facts: string[] = [
        `Property: ${property.name} in ${property.cityName}.`,
      ];
      if (property.description) facts.push(`About: ${property.description}`);
      for (const rt of property.roomTypes) {
        const price = `₦${Math.round(rt.basePriceKobo / 100).toLocaleString("en-NG")}`;
        facts.push(`Room "${rt.name}": ${price}/night, up to ${rt.maxGuests} guests.`);
      }
      facts.push(
        "Live date-by-date availability is NOT included here; the guest must check it on the property page.",
      );
      return facts;
    } catch {
      return [];
    }
  }

  private async ensureConversation(
    conversationId: string | undefined,
    userId: string | null,
    firstMessage: string,
  ): Promise<string> {
    if (conversationId) {
      const existing = await prisma.aIConversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });
      if (existing) return existing.id;
    }
    const created = await prisma.aIConversation.create({
      data: { userId, topic: summarize(firstMessage) },
    });
    return created.id;
  }

  private async log(conversationId: string, actionType: string, summary: string): Promise<void> {
    await prisma.aIActionLog.create({
      data: { conversationId, actionType, summary },
    });
  }
}

function summarize(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
}
