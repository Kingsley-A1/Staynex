/**
 * Curated, authoritative Staynex knowledge for grounding policy / company / FAQ
 * answers. This is NOT live data (cities, prices, availability, reviews come from
 * the DB at request time) — it is the stable "how Staynex works and who built it"
 * context the model can't infer on its own.
 *
 * Every entry earns its place by the test: *what can Staynex AI answer with this
 * that it cannot answer correctly without it?* Entries contain only facts that
 * are true of Staynex today — no invented policies, amounts, or guarantees.
 */
interface KnowledgeEntry {
  /** Triggers retrieval when the user's message matches. */
  match: RegExp;
  /** Verified fact injected into the prompt. */
  content: string;
}

const KNOWLEDGE: KnowledgeEntry[] = [
  {
    match: /\b(bespoke|who (built|made|created|develop|owns)|behind staynex|kingsley|maduabuchi|the company|your (maker|creator|team))\b/i,
    content:
      "Staynex was built by Bespoke Technologies (bespoketech.com.ng); the platform was engineered by a team of perfectionist engineers led by Kingsley Maduabuchi to make the customer's booking experience stand out.",
  },
  {
    match: /\b(hold|holds|reserve|locked?|expire|expiry|time limit)\b/i,
    content:
      "When a booking starts, Staynex places a short hold to lock the room while the user pays. If the hold expires before payment, the user re-checks availability on the property page and tries again — nothing is charged for an expired hold.",
  },
  {
    match: /\b(pay|payment|paystack|card|checkout|secure)\b/i,
    content:
      "Payments are processed securely through a trusted payment provider; Staynex never stores raw card details. A booking is confirmed only after Staynex verifies the payment — never on the client side.",
  },
  {
    match: /\b(confirm|confirmation|confirmed|verified payment|booking status)\b/i,
    content:
      "A booking is confirmed only after Staynex verifies the payment. The live result is shown on the user's payment/confirmation page.",
  },
  {
    match: /\b(refund|refunds|cancel|cancellation|cancelled)\b/i,
    content:
      "Refunds and cancellations follow Staynex policy and are handled by the Staynex support team for the user's specific booking. Staynex AI cannot process them.",
  },
  {
    match: /\b(verified|verify|trust|trusted|safe|legit|scam|approved|genuine)\b/i,
    content:
      "Every Staynex property is reviewed and approved by the Staynex team before it goes live, so users book verified stays.",
  },
  {
    match: /\b(review|reviews|rating|ratings|testimonial)\b/i,
    content:
      "Reviews on Staynex come only from guests with a confirmed stay, and each review is approved by the Staynex team before it appears publicly.",
  },
  {
    match: /\b(list (my|a)|become (a )?(host|owner)|host my|rent out|earn|property owner|landlord)\b/i,
    content:
      "Property owners can list on Staynex: create a listing, get it approved by the Staynex team, then manage availability, bookings, and earnings from one dashboard. There is no upfront cost to start.",
  },
  {
    match: /\b(support|help desk|contact|customer (care|service)|complain|complaint|reach (you|staynex))\b/i,
    content:
      "For account or booking issues, the user can contact Staynex support at support@staynexbookings.ng.",
  },
];

/** Up to `max` verified knowledge facts relevant to the message (most useful first). */
export function retrieveKnowledge(message: string, max = 3): string[] {
  const facts: string[] = [];
  for (const entry of KNOWLEDGE) {
    if (entry.match.test(message)) {
      facts.push(entry.content);
      if (facts.length >= max) break;
    }
  }
  return facts;
}
