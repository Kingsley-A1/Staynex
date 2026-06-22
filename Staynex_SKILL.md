# Staynex Agent Skill.md

**Project:** Staynex  
**Parent Company:** Bespoke Technologies  
**Document Type:** Reusable Agent Skill / Execution Standard  
**Version:** 1.0  
**Status:** Active Project Standard  
**Core Principle:** Local wedge. International architecture. Global-grade product quality.

---

## 1. Purpose of This Skill

This `SKILL.md` defines how any AI agent, coding agent, design agent, product agent, or implementation assistant must work on the Staynex project.

Staynex is not a casual prototype, local directory, or generic hotel website. It is a serious hospitality booking platform originating from Calabar and designed from day one for international expansion.

This skill exists to keep every agent aligned on:

- What Staynex is
- Why it exists
- How it must feel
- What must be built first
- What quality bar must be met
- What design language must be followed
- What technical standards must be respected
- What agents must never compromise

Any agent working on Staynex must read and obey this file before making product, design, engineering, or content decisions.

---

## 2. Product Definition

Staynex is a modern hospitality booking platform for hotels, apartments, short-lets, resorts, serviced suites, and future travel-related stays.

The platform starts from Calabar, Nigeria, because Calabar is the first market we understand deeply. However, Staynex must not be designed as a Calabar-only product.

Calabar is the launch wedge.

The product must be built so it can expand to:

- Other Nigerian cities
- African hospitality markets
- International stay-booking markets
- Multiple currencies
- Multiple countries
- Multiple property types
- Multiple owner/operator models

Staynex must feel like a serious hospitality technology company, not a listing directory.

---

## 3. Product Promise

Staynex helps guests book trusted stays clearly and gives property owners a reliable digital channel for visibility, availability, bookings, communication, and growth.

The guest should feel:

- Safe
- Informed
- Guided
- Confident
- In control

The property owner should feel:

- Seen
- Supported
- Organized
- More bookable
- More professional

The admin team should feel:

- In control
- Able to verify listings
- Able to monitor bookings
- Able to manage payments and support issues
- Able to maintain trust across the platform

---

## 4. Brand Foundation

### 4.1 Name

**Staynex**

Staynex combines “Stay” and “Nexus.” It means the trusted connection point for quality stays.

### 4.2 Positioning Line

**Book trusted stays.**

### 4.3 Origin Line

**Born in Calabar. Built for the world.**

Use the origin line in brand documents, product presentations, investor decks, and launch storytelling. Do not force it into every UI screen.

---

## 5. Non-Negotiable Product Truths

1. Staynex is international by architecture, even while Calabar is the first market.
2. The booking loop is the heart of the product.
3. Real-time availability is not decoration; it is central to trust.
4. The platform must be clean, fast, secure, and consistent.
5. AI is useful only when it improves booking, support, onboarding, or trust.
6. The user interface must never look cheap, noisy, or generic.
7. The owner experience is as important as the guest experience.
8. Admin control is required for trust, verification, and operational safety.
9. Prototype quality must make the future product believable.
10. Industry standard is the minimum standard.

---

## 6. Primary Product Loop

Every major build decision should support the core Staynex booking loop:

```txt
Search → View stay → Check availability → Select room → Book → Pay → Confirm → Notify owner/admin
```

The first proof of concept must visually and functionally demonstrate this loop.

Do not spend time polishing secondary ideas if this loop is incomplete.

---

## 7. User Sides

Staynex is a three-sided platform.

### 7.1 Guests

Guests use Staynex to:

- Search stays
- Compare properties
- Preview room/property images
- Check availability
- Make future reservations
- Pay securely
- Receive confirmation
- Get directions
- Ask support or AI assistant questions
- Review bookings

### 7.2 Property Owners and Managers

Owners use Staynex to:

- Register their property
- Submit property details
- Upload images
- Add room types
- Set prices
- Set availability
- Receive booking alerts
- View booking history
- Manage payout previews
- Communicate with Staynex support/admin

### 7.3 Staynex Admin Team

Admins use Staynex to:

- Approve/reject properties
- Verify property media and details
- Monitor bookings
- Monitor payment status
- Manage disputes/support tickets
- Manage users
- Review AI logs
- Control cities, fees, featured listings, and platform settings

---

## 8. Current Build Stage

The current stage is the **mocked prototype / first visual proof of concept**.

This stage should demonstrate the system end to end using mock data.

### Prototype Goals

- Show what Staynex is within five seconds.
- Demonstrate the full booking loop.
- Make the guest experience feel real.
- Make the owner dashboard feel useful.
- Make the admin dashboard feel controlled.
- Demonstrate the AI assistant as useful but bounded.
- Provide a strong foundation for the real POC.

### Prototype Non-Goals

Do not attempt to build:

- Real payment settlement
- Real payout infrastructure
- Real multi-country tax rules
- Real PMS/channel manager integrations
- Real AI autonomy
- Real dispute resolution
- Full Flutter app
- Production authentication
- Dynamic pricing engine

Mock these areas professionally where needed.

---

## 9. Technology Standard

### 9.1 Prototype Stack

Use:

- Next.js
- React
- TypeScript
- Tailwind CSS
- App Router
- Reusable components
- Central mock data
- Responsive mobile-first UI

### 9.2 Future POC / Production Stack

Prepare the architecture for:

- Next.js
- NestJS
- TypeScript
- CockroachDB
- Railway
- Vercel
- Cloudflare
- Cloudflare R2
- Paystack
- Google Gemini
- Vercel AI SDK
- Firebase notifications
- Resend
- Google Maps
- Google OAuth
- Respond.io when needed

Do not require production credentials during prototype work.

---

## 10. Engineering Principles

### 10.1 Architecture First

Before implementing, understand the product structure and route flow. Do not build random pages or isolated UI fragments.

### 10.2 Vertical Slice First

Prioritize a complete usable slice over scattered features.

The first vertical slice is:

```txt
Home → Search → Property Detail → Room Selection → Checkout → Payment Status → Booking Confirmation
```

### 10.3 Reusable Components

Build reusable components rather than duplicating UI.

Core components should include:

- AppHeader
- AppFooter
- SearchBar
- PropertyCard
- ImageCarousel
- RoomCard
- AvailabilityBadge
- PriceSummary
- BookingStepper
- PaymentStatusCard
- ConfirmationCard
- DashboardStatCard
- EmptyState
- LoadingSkeleton
- StatusPill
- NotificationToast
- AssistantPanel
- MapPreview
- ReviewPreview
- OwnerSidebar
- AdminSidebar

### 10.4 Mock Data Discipline

All demo data must live in a central mock data file, such as:

```txt
src/data/mock-staynex.ts
```

Do not scatter hardcoded property data across components.

### 10.5 Strict TypeScript

Use TypeScript types/interfaces for:

- City
- Property
- Room
- Booking
- Guest
- Owner
- Payment status
- Booking status
- Support ticket
- AI conversation
- Dashboard metrics

### 10.6 No Broken Core Flow

Do not leave the main CTAs dead.

At minimum:

- Search should lead to search results.
- Property card should lead to property detail.
- Room selection should lead to checkout.
- Payment action should lead to payment status.
- Payment success should lead to booking confirmation.

---

## 11. Design System

### 11.1 Brand Colors

| Token | Hex | Usage |
|---|---:|---|
| Blue Royale | `#27187D` | Primary brand color |
| Ghost White | `#F7F7FF` | App background |
| Ink Black | `#101014` | Main text |
| Slate Gray | `#6E6A83` | Secondary text |
| Line Gray | `#E7E5F2` | Borders/dividers |
| Success Green | `#15803D` | Confirmed states |
| Warning Amber | `#B7791F` | Pending states |
| Error Red | `#B42318` | Failed/cancelled states |

### 11.2 Visual Feel

Staynex must feel:

- Premium
- Calm
- Trustworthy
- International
- Mobile-first
- Fast
- Clean
- Operationally serious

### 11.3 UI Direction

Use:

- Apple-level clarity
- Google Material structure
- Card-based hospitality browsing
- Instagram-style image previews
- Soft gradients
- Clear hierarchy
- Minimal but expressive motion

### 11.4 Card System

Property and room cards are core to Staynex.

Cards should use:

- Rounded corners
- Soft shadows
- Subtle gradient border where appropriate
- High-quality images
- Clear pricing
- Clear availability states
- Minimal text
- One dominant action

### 11.5 Property Card Requirements

Each property card must include:

- Swipeable image carousel
- Property name
- Location
- Price from
- Rating
- Review count
- Availability badge
- Amenities preview
- Favorite button
- View stay action

Users should be able to preview multiple images inside the card.

### 11.6 Motion Rules

Motion should clarify, not entertain.

Allowed motion:

- Card hover lift
- Image carousel slide
- Assistant panel open/close
- Drawer slide
- Stepper transition
- Loading skeleton shimmer
- Button micro-interaction

Forbidden motion:

- Childish bounce effects
- Overanimated backgrounds
- Distracting loops
- Random movement without purpose

Keep most transitions under 250ms.

---

## 12. Route Standard

### 12.1 Public Routes

```txt
/
/search
/stays/[slug]
/checkout
/payment/status
/booking/confirmed
/help
/about
/list-your-property
/auth/sign-in
/auth/sign-up
```

### 12.2 Guest Routes

```txt
/guest
/guest/bookings
/guest/bookings/[bookingId]
/guest/saved
/guest/profile
/guest/support
```

### 12.3 Owner Routes

```txt
/owner
/owner/onboarding
/owner/property
/owner/rooms
/owner/availability
/owner/bookings
/owner/payouts
/owner/messages
/owner/settings
/owner/support
```

### 12.4 Admin Routes

```txt
/admin
/admin/properties
/admin/properties/[propertyId]
/admin/bookings
/admin/payments
/admin/payouts
/admin/users
/admin/support
/admin/ai-logs
/admin/settings
```

If implementation time is limited, build route shells for lower-priority pages, but never leave the core booking loop incomplete.

---

## 13. Public Guest Experience Standard

### 13.1 Home Page

Must include:

- Header
- Hero section
- Search card
- Featured stays
- Why Staynex
- Popular cities
- Owner CTA
- Footer

Hero headline:

```txt
Book trusted stays, clearly.
```

Hero supporting text:

```txt
Find verified hotels, apartments, short-lets, and resorts with real availability and secure booking.
```

### 13.2 Search Results Page

Must include:

- Search summary bar
- Filter drawer/section
- Sort dropdown
- Property cards
- Map preview placeholder
- Empty state
- Loading state pattern

### 13.3 Property Detail Page

Must include:

- Image gallery
- Property name and location
- Rating
- Verification badge
- Overview
- Amenities
- Room options
- Availability checker
- Map/landmark preview
- Policies
- Reviews preview
- AI assistant entry

Primary CTA:

```txt
Check availability
```

Secondary CTA:

```txt
Ask Staynex Assistant
```

### 13.4 Checkout Page

Must include:

- Booking summary
- Guest information
- Contact details
- Special request
- Payment method mock
- Cancellation agreement
- Total price
- Confirm and pay CTA

CTA:

```txt
Confirm and pay securely
```

### 13.5 Confirmation Page

Must include:

- Confirmation number
- Property name
- Room name
- Check-in/check-out dates
- Guest details
- Amount paid
- Payment status
- Address
- Direction button mock
- Support action
- Receipt action mock

---

## 14. Owner Experience Standard

### 14.1 Owner Landing Page

Headline:

```txt
Bring your property online with trusted booking infrastructure.
```

CTA:

```txt
List your property
```

### 14.2 Owner Onboarding Steps

1. Create owner account
2. Add property information
3. Add location
4. Upload property images
5. Add rooms
6. Set prices
7. Set availability
8. Submit for approval

### 14.3 Owner Dashboard Cards

Must show:

- Today’s bookings
- Upcoming bookings
- Available rooms
- Pending actions
- Estimated earnings
- Property status

### 14.4 Payout Language

Do not use the word “escrow” in public UI unless legally approved.

Use:

```txt
Managed payout after booking validation.
```

---

## 15. Admin Experience Standard

Admin pages must communicate operational control and trust.

### 15.1 Admin Dashboard Cards

Must show:

- Total bookings
- Gross booking value
- Pending property approvals
- Active properties
- Payment issues
- Support tickets
- Cancellation requests

### 15.2 Property Approval Page

Must support:

- View submitted property
- Review images
- Review location
- Review room details
- View owner details
- Approve property
- Reject property
- Request changes

### 15.3 AI Logs Page

Must show a simple mock log with:

- Conversation ID
- User type
- Topic
- Last message
- Suggested action
- Safety status
- Timestamp

---

## 16. AI Assistant Rules

### 16.1 Name

**Staynex Assistant**

### 16.2 Purpose

The assistant helps guests and owners understand the platform, find stays, compare rooms, ask about policies, and get support guidance.

### 16.3 Assistant Can

- Recommend properties based on mocked user intent
- Explain room differences
- Summarize amenities
- Explain cancellation rules
- Guide booking steps
- Explain listing steps to owners
- Explain managed payout language
- Suggest better property descriptions

### 16.4 Assistant Must Not

- Promise refunds
- Invent availability
- Confirm payment manually
- Change financial records
- Reveal private data
- Override booking rules
- Make legal claims
- Pretend to be human

### 16.5 AI UX Standard

The AI assistant must feel useful, calm, and bounded. It must not feel forced or decorative.

---

## 17. Security and Trust Standard

Even in prototype mode, the product must visually communicate security.

Use UI signals for:

- Verified properties
- Secure payment
- Clear booking confirmation
- Clear cancellation policy
- Support access
- Owner verification
- Admin approval

For production planning, assume:

- HTTPS everywhere
- Google OAuth
- Role-based access control
- Tenant isolation
- Signed image uploads
- Payment webhook verification
- Audit logs
- No card storage
- Secure environment variables
- Data privacy compliance

---

## 18. Accessibility Standard

Every agent must protect accessibility.

Minimum requirements:

- Semantic HTML
- Proper labels for form inputs
- Accessible buttons
- Visible focus states
- Good color contrast
- Meaningful alt text for images where possible
- No icon-only critical actions without text/aria-label
- Keyboard-friendly navigation where practical

---

## 19. Sample Data Standard

Use demo data clearly.

### Cities

- Calabar, Nigeria
- Uyo, Nigeria
- Port Harcourt, Nigeria
- Lagos, Nigeria
- Abuja, Nigeria

### Properties

#### Marina Crest Hotel

- Type: Hotel
- City: Calabar
- Price from: ₦45,000/night
- Rating: 4.7
- Status: Verified
- Amenities: Wi-Fi, restaurant, parking, pool

#### Duke Town Suites

- Type: Serviced apartment
- City: Calabar
- Price from: ₦65,000/night
- Rating: 4.8
- Status: Verified
- Amenities: kitchen, workspace, Wi-Fi, security

#### Harbor Nest Apartments

- Type: Short-let apartment
- City: Calabar
- Price from: ₦38,000/night
- Rating: 4.5
- Status: Verified
- Amenities: kitchen, Wi-Fi, smart TV, parking

#### Tinapa Grand Resort

- Type: Resort
- City: Calabar
- Price from: ₦80,000/night
- Rating: 4.6
- Status: Pending verification
- Amenities: pool, event hall, restaurant, bar

---

## 20. Agent Workflow

Before building:

1. Read this `SKILL.md`.
2. Read `prototype.md` if present.
3. Read `Staynex_plan.md` or blueprint documents if present.
4. Inspect the repository structure.
5. Identify the current build stage.
6. Plan the smallest complete vertical slice.
7. Implement without breaking existing work.

During building:

1. Build reusable components first when they unlock multiple pages.
2. Use central mock data.
3. Maintain design tokens.
4. Keep routes working.
5. Test mobile layout.
6. Run type/lint/build checks when available.
7. Fix errors before reporting done.

After building:

Return a concise handoff with:

- What was built
- Routes added/updated
- Components created/updated
- Mock data added/updated
- How to run locally
- Checks run
- Known limitations
- Recommended next step

---

## 21. Quality Gate

A Staynex prototype task is not complete unless:

- The main flow works visually.
- The UI is responsive.
- The design is consistent.
- The colors are controlled.
- Property cards feel premium.
- The owner dashboard shows clear value.
- The admin dashboard shows control.
- The assistant is useful but bounded.
- There are no obvious broken CTAs in the core flow.
- TypeScript/build errors are resolved or clearly documented.

---

## 22. Do Not Ship If

Do not mark work complete if:

- Only the homepage is built.
- The booking flow is missing.
- The UI looks like a cheap directory.
- The platform feels Calabar-only.
- Mock data is scattered everywhere.
- Buttons and cards are inconsistent.
- Colors are random.
- Mobile layout is broken.
- Admin/owner areas look unrelated to public UI.
- AI assistant makes unsafe promises.
- Core routes throw errors.
- There is no clear handoff.

---

## 23. Agent Prompting Standard

When prompting another agent for Staynex, use this structure:

```txt
Role → Goal → Context → Task → Constraints → Output Format → Evaluation Criteria → Iteration
```

For high-stakes agent work, always include:

- Role
- Goal
- Context
- Task
- Constraints
- Output format
- Evaluation criteria
- Stopping condition

Do not ask agents casual questions for production work. Give specifications.

---

## 24. Standard Agent Handoff Format

Every agent should end with this format:

```md
## Build Summary

## Routes Implemented

## Components Created

## Mock Data Added

## How to Run

## Checks Run

## Known Limitations

## Recommended Next Step
```

Keep the handoff concise but complete.

---

## 25. Final Operating Standard

Staynex must be built like a product that can survive for decades.

The prototype should show the future clearly.

The POC should prove the booking loop.

The production system should earn trust.

Every agent must protect the same standard:

```txt
Clear product. Clean design. Strong architecture. Real trust. Global readiness.
```

