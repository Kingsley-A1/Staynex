# Staynex Prototype.md

**Product:** Staynex  
**Parent Company:** Bespoke Technologies  
**Prototype Type:** First mocked product experience / visual proof of concept  
**Status:** Prototype Specification v0.1  
**Internal Principle:** Local wedge. International architecture. Global-grade product quality.

---

## 1. What Staynex Is

Staynex is a modern hospitality booking platform for hotels, apartments, short-lets, resorts, serviced suites, and future travel-related stays. But were a stating with Hotels first.

The platform originates in Calabar, Nigeria, but it is not a Calabar-only product. Calabar is the first launch market because we understand the hospitality environment, the city has strong tourism energy, and many properties lack reliable digital booking systems.

Staynex must be designed from day one to expand beyond Calabar into other Nigerian cities, African cities, and international hospitality markets.

The prototype must visually demonstrate how Staynex will help guests discover trusted stays, check real-time availability, make future reservations, book securely, communicate with the platform/property side, and receive confirmation without friction.

---

## 2. Prototype Goal

The goal of this prototype is not to build the full backend system yet.

The goal is to create a polished, consistent, clickable, visually convincing first version that clearly demonstrates the product experience to:

- Hotel owners
- Property managers
- Potential partners
- Internal stakeholders
- Developers who will later build the POC
- Early users who need to understand the platform quickly

The prototype should make the system feel real, professional, trustworthy, and scalable.

It must show the complete booking loop:

**Search → View stay → Check availability → Select room → Book → Pay → Confirm → Notify owner/admin.**

---

## 3. Prototype Non-Goals

The prototype should not attempt to implement every production feature.

Do not build:

- Full real payment settlement
- Real escrow/legal payout infrastructure
- Real multi-country tax logic
- Advanced AI autonomy
- Real dispute resolution workflows
- Full Flutter mobile app
- Complex PMS/channel manager integrations
- Dynamic pricing engine
- Full owner analytics suite

These belong to later POC and production phases.

The first prototype must focus on clarity, confidence, and end-to-end demonstration.

---

## 4. Core Product Promise

Staynex helps guests book trusted stays clearly and gives property owners a reliable digital channel for visibility, availability, bookings, and growth.

The platform should feel:

- Premium
- Calm
- Secure
- Modern
- Fast
- Human
- International
- Operationally serious

Staynex must not feel like a cheap listing directory.

It must feel like hospitality commerce infrastructure.

---

## 5. Brand Foundation

### 5.1 Name

**Staynex**

The name combines “Stay” and “Nexus.” It implies a central connection point for trusted accommodation.

### 5.2 Brand Meaning

Staynex is the trusted connection point between guests and quality stays.

### 5.3 Positioning Line

**Book trusted stays.**

This is short, clear, product-relevant, and scalable.

### 5.4 Origin Line

**Book your trustted stay, stress-free**
This should appear in brand presentations and investor/product documents, not necessarily on every UI screen.

---

## 6. Visual Identity Direction

### 6.1 Primary Colors

| Token | Hex | Usage |
|---|---:|---|
| Blue Royale | `#27187D` | Primary brand color |
| Ghost White | `#F7F7FF` | App background |
| Ink Black | `#101014` | Main text |
| Slate Gray | `#6E6A83` | Secondary text |
| Line Gray | `#E7E5F2` | Borders |
| Success Green | `#15803D` | Confirmed states |
| Warning Amber | `#B7791F` | Pending states |
| Error Red | `#B42318` | Failed/cancelled states |

### 6.2 Design Language

Staynex should combine:

- Apple-level clarity
- Google Material structure
- Card-based hospitality browsing
- Instagram-style image previews
- Soft gradients
- Clean spacing
- Minimal but expressive motion

### 6.3 UI Personality

The UI should be visual, not noisy.

Every card should feel intentional. Every state should be clear. Every screen should help the user move forward.

---

## 7. Prototype Design Principles

### 7.1 Clarity Before Decoration

The user should understand what the platform does within five seconds.

### 7.2 Trust Before Excitement

Do not use manipulative urgency messages like “Only 1 room left!” unless the data is real and verified.

### 7.3 Seamless by Default

The guest should not need to think too much. Search, availability, booking, payment, and confirmation should feel natural.

### 7.4 Consistent by Design

Use reusable spacing, cards, buttons, states, colors, typography, icons, and motion rules.

### 7.5 Secure Without Feeling Rigid

Security should be strong but not hostile. The prototype should show friendly verification, safe payment, confirmation, and support states.

### 7.6 International by Structure

Do not hardcode Calabar as the only possible location. Treat Calabar as the first city in a global location model.

---

## 8. Prototype Audience

### 8.1 Guests

Guests want to find and book stays with confidence.

They care about:

- Photos
- Location
- Price
- Availability
- Trust
- Reviews
- Amenities
- Payment safety
- Clear confirmation

### 8.2 Property Owners

Owners want more bookings without operational confusion.

They care about:

- Visibility
- Simple listing setup
- Booking alerts
- Availability control
- Payout confidence
- Property reputation
- Support access

### 8.3 Staynex Admin Team

Admins need control, trust, and operational visibility.

They care about:

- Property approval
- Booking oversight
- Payment status
- Support tickets
- Dispute visibility
- Fraud prevention
- System health

---

## 9. Prototype Experience Map

The prototype should include three main experience areas:

1. Public guest experience
2. Property owner experience
3. Staynex admin experience

Each area must look like one product, not three disconnected dashboards.

---

## 10. Public Guest Experience

### 10.1 Home Page

**Purpose:** Introduce Staynex and drive users into search.

#### Required Sections

1. Header
2. Hero search area
3. Featured stays
4. Why Staynex
5. Popular cities
6. Owner CTA
7. Footer

#### Header Items

- Staynex logo
- Stays
- Explore
- List your property
- Help
- Sign in
- Primary CTA: “Book a stay”

#### Hero Copy

**Headline:**  
Book trusted stays, clearly.

**Supporting Text:**  
Find verified hotels, apartments, short-lets, and resorts with real availability and secure booking.

#### Hero Search Inputs

- Destination
- Check-in date
- Check-out date
- Guests
- Search button

#### Hero Interaction

The search bar should feel premium and mobile-first. On desktop, it can appear as a wide rounded card. On mobile, it should stack cleanly.

---

### 10.2 Search Results Page

**Purpose:** Help users compare and choose stays quickly.

#### Required Elements

- Search summary bar
- Filter drawer
- Sort dropdown
- Property cards
- Map preview toggle
- Empty state
- Loading skeletons

#### Filters

- Price range
- Property type
- Rating
- Amenities
- Free cancellation
- Instant confirmation
- Verified property
- Distance from landmark

#### Sort Options

- Recommended
- Price low to high
- Price high to low
- Best rated
- Closest to destination

---

### 10.3 Property Card

The property card is one of the most important components in the prototype.

#### Required Card Content

- Swipeable image carousel
- Subtle gradient border
- Property name
- Location
- Price from
- Rating
- Review count
- Availability badge
- Amenities preview
- Favorite button
- Quick view action

#### Card Image Behavior

Users should swipe left and right to preview:

- Exterior
- Lobby/reception
- Room
- Bathroom
- Restaurant/lounge
- Pool or view

Clicking an image opens a full-screen gallery.

#### Card Rules

- Do not overcrowd the card.
- Use only high-quality images.
- Show price clearly.
- Show availability state clearly.
- Avoid fake urgency.

---

### 10.4 Property Detail Page

**Purpose:** Give guests confidence before booking.

#### Required Sections

1. Image gallery
2. Property name and location
3. Rating and verification badge
4. Overview
5. Amenities
6. Room options
7. Availability checker
8. Map and nearby landmarks
9. Policies
10. Reviews preview
11. Support/AI assistant entry

#### Primary CTA

**Check availability**

#### Secondary CTA

**Ask Staynex Assistant**

---

### 10.5 Room Selection Section

Each room should be represented by a clean card.

#### Room Card Content

- Room name
- Swipeable room images
- Capacity
- Bed type
- Price per night
- Included amenities
- Cancellation policy summary
- Availability status
- Select room button

#### Example Room Names

- Deluxe King Room
- Executive Suite
- Standard Double Room
- Family Apartment
- Ocean View Suite

---

### 10.6 Availability Check

**Purpose:** Demonstrate real-time booking confidence.

#### Required Inputs

- Check-in date
- Check-out date
- Number of guests
- Number of rooms

#### Required States

| State | Message |
|---|---|
| Available | Room available for selected dates |
| Limited | Few matching rooms available |
| Unavailable | No room available for selected dates |
| Pending | Checking availability |
| Error | Could not check availability |

For prototype, the data can be mocked.

---

### 10.7 Booking Checkout

**Purpose:** Collect guest details and prepare payment.

#### Required Sections

1. Booking summary
2. Guest information
3. Contact details
4. Payment method
5. Cancellation policy agreement
6. Total price
7. Confirm and pay button

#### Required Guest Fields

- Full name
- Email
- Phone number
- Number of guests
- Special request

#### Payment CTA

**Confirm and pay securely**

---

### 10.8 Payment Status Page

**Purpose:** Show transition between payment and booking confirmation.

#### Required States

- Processing payment
- Payment successful
- Payment failed
- Booking confirmed
- Booking pending review

#### Payment Success Copy

Your booking is confirmed. We have sent your confirmation details to your email.

---

### 10.9 Booking Confirmation Page

**Purpose:** Give the guest everything needed after booking.

#### Required Content

- Confirmation number
- Property name
- Room name
- Check-in/check-out dates
- Guest details
- Amount paid
- Payment status
- Address
- Google Maps direction button
- Contact/support action
- Download receipt action

---

### 10.10 Guest Dashboard

**Purpose:** Let guests view and manage their bookings.

#### Required Pages

- Overview
- My bookings
- Saved stays
- Profile
- Support

#### Booking Statuses

| Status | Meaning |
|---|---|
| Pending payment | Booking created but unpaid |
| Confirmed | Payment successful and stay reserved |
| Checked in | Guest has arrived |
| Completed | Stay is complete |
| Cancelled | Booking cancelled |
| Refunded | Refund processed |

---

## 11. Property Owner Experience

### 11.1 Owner Landing Page

**Purpose:** Convince property owners to list with Staynex.

#### Headline

Bring your property online with trusted booking infrastructure.

#### Supporting Text

List your hotel, apartment, short-let, or resort on Staynex and receive verified booking requests, availability tools, and secure payment workflows.

#### CTA

**List your property**

---

### 11.2 Owner Onboarding

**Purpose:** Allow owners to register and submit property details.

#### Onboarding Steps

1. Create owner account
2. Add property information
3. Add location
4. Upload property images
5. Add rooms
6. Set prices
7. Set availability
8. Submit for approval

#### Owner Account Fields

- Full name
- Business email
- Phone number
- Business role
- Property name
- Property type

---

### 11.3 Owner Dashboard

**Purpose:** Give owners a simple operational view.

#### Dashboard Cards

- Today’s bookings
- Upcoming bookings
- Available rooms
- Pending actions
- Estimated earnings
- Property status

#### Dashboard Actions

- Add room
- Update availability
- View bookings
- Contact support
- Edit property

---

### 11.4 Property Management Page

#### Required Sections

- Property profile
- Images
- Amenities
- Location
- Policies
- Verification status
- Public preview

---

### 11.5 Room Management Page

#### Required Features

- Add room type
- Edit room type
- Upload room images
- Set room price
- Set capacity
- Add amenities
- Enable/disable room

---

### 11.6 Availability Calendar

**Purpose:** Help owners prevent double bookings.

#### Required Views

- Monthly calendar
- Room type filter
- Available days
- Blocked days
- Booked days
- Maintenance days

#### Color States

| State | Color Use |
|---|---|
| Available | Success green |
| Booked | Blue Royale |
| Blocked | Slate gray |
| Maintenance | Warning amber |
| Error | Error red |

---

### 11.7 Owner Bookings Page

#### Required Booking Information

- Guest name
- Room booked
- Dates
- Amount
- Payment status
- Booking status
- Contact/support action

---

### 11.8 Owner Payout Preview

For prototype, this should be visual only.

#### Required Sections

- Pending payouts
- Completed payouts
- Platform commission
- Net earnings
- Payout method placeholder

Avoid using the word “escrow” publicly in prototype UI unless legally approved.

Use:

**Managed payout after booking validation.**

---

## 12. Admin Experience

### 12.1 Admin Dashboard

**Purpose:** Give Staynex internal operators control over the platform.

#### Required Dashboard Cards

- Total bookings
- Gross booking value
- Pending property approvals
- Active properties
- Payment issues
- Support tickets
- Cancellation requests

---

### 12.2 Property Approval Page

#### Required Actions

- View submitted property
- Review images
- Review location
- Review room details
- Approve property
- Reject property
- Request changes

---

### 12.3 Booking Management Page

#### Required Actions

- View booking
- Change booking status
- Contact owner
- Contact guest
- Mark as checked in
- Mark as completed
- Flag issue

---

### 12.4 Payment Management Page

#### Required Fields

- Booking ID
- Payment reference
- Amount
- Commission
- Owner net
- Payment status
- Payout status

---

### 12.5 Support Tickets Page

#### Ticket Categories

- Payment issue
- Booking issue
- Availability issue
- Property complaint
- Refund request
- Owner support
- Guest support

---

### 12.6 AI Logs Page

For prototype, show a simple view of AI conversations and actions.

#### Required Fields

- Conversation ID
- User type
- Topic
- Last message
- Suggested action
- Safety status
- Timestamp

---

## 13. AI Assistant Prototype

The AI assistant must feel useful, not decorative.

### 13.1 Name

**Staynex Assistant**

### 13.2 Purpose

Help guests and property owners understand the platform, find stays, compare rooms, ask about policies, and get support guidance.

### 13.3 Guest Assistant Can

- Recommend properties based on location and budget
- Explain room differences
- Summarize amenities
- Explain cancellation rules
- Help with booking steps
- Guide users to payment or support

### 13.4 Owner Assistant Can

- Explain how to list a property
- Help owners understand availability settings
- Explain payout process
- Suggest better property descriptions
- Guide owners to support

### 13.5 AI Boundaries

The assistant must not:

- Promise refunds
- Invent availability
- Confirm payment manually
- Change financial records
- Reveal private user data
- Override booking rules
- Make unsupported legal claims

### 13.6 Prototype AI Entry Points

- Floating assistant button on public pages
- Assistant panel on property detail page
- Help widget in owner dashboard
- Admin AI log preview

---

## 14. Sample Prototype Data

All sample data must be clearly treated as fake/demo data.

### 14.1 Sample Cities

- Calabar, Nigeria
- Uyo, Nigeria
- Port Harcourt, Nigeria
- Lagos, Nigeria
- Abuja, Nigeria

### 14.2 Sample Properties

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

## 15. Component System

The prototype should use reusable components.

### 15.1 Core Components

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

### 15.2 Button Styles

#### Primary Button

- Background: Blue Royale
- Text: Ghost White
- Radius: 999px or 14px depending on context
- Use for main actions

#### Secondary Button

- Background: Ghost White
- Border: Line Gray
- Text: Blue Royale

#### Danger Button

- Background: Error Red
- Text: White

### 15.3 Card Rules

Cards should use:

- Soft shadow
- Rounded corners
- Clean white/ghost surface
- Subtle border
- Clear internal spacing
- Minimal text
- One main action

---

## 16. Motion and Interaction Rules

Motion should be subtle, fast, and premium.

### 16.1 Allowed Motion

- Card hover lift
- Image carousel swipe
- Drawer slide
- Assistant panel open/close
- Button micro-interaction
- Loading skeleton shimmer
- Stepper transition

### 16.2 Motion Rules

- Do not overanimate.
- Keep transitions below 250ms where possible.
- Use motion to clarify state changes.
- Do not use childish bounce effects.

---

## 17. Prototype Routes

### 17.1 Public Routes

```txt
/
/search
/stays/[propertySlug]
/checkout
/payment/status
/booking/confirmed
/help
/about
/list-your-property
/auth/sign-in
/auth/sign-up
```

### 17.2 Guest Routes

```txt
/guest
/guest/bookings
/guest/bookings/[bookingId]
/guest/saved
/guest/profile
/guest/support
```

### 17.3 Owner Routes

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

### 17.4 Admin Routes

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

---

## 18. Prototype Flow Requirements

### 18.1 Guest Booking Flow

1. User lands on homepage.
2. User enters destination and dates.
3. User views search results.
4. User swipes property images.
5. User opens property detail.
6. User checks availability.
7. User selects a room.
8. User enters guest details.
9. User clicks confirm and pay.
10. Prototype shows payment processing.
11. Prototype shows booking confirmed.
12. User sees booking details and map direction.

### 18.2 Owner Listing Flow

1. Owner visits “List your property.”
2. Owner creates account.
3. Owner enters property details.
4. Owner uploads images.
5. Owner adds room types.
6. Owner sets price and availability.
7. Owner submits property for approval.
8. Prototype shows pending approval state.

### 18.3 Admin Approval Flow

1. Admin opens dashboard.
2. Admin sees pending property.
3. Admin reviews property details.
4. Admin approves property.
5. Property becomes visible in public search.

---

## 19. Prototype Acceptance Criteria

The prototype is acceptable when:

- A new user understands Staynex within five seconds.
- The UI is consistent across public, owner, and admin areas.
- The booking flow is visually complete.
- Property cards feel premium and swipeable.
- The color system is controlled.
- The design does not look like a cheap directory.
- The owner dashboard shows clear operational value.
- The admin dashboard shows control and trust.
- The AI assistant is useful but bounded.
- The prototype can directly guide the POC build.

---

## 20. Implementation Notes for POC Developers

The later POC should preserve the prototype structure but replace mock data with real services.

### 20.1 Suggested Frontend Stack

- Next.js
- TypeScript
- Tailwind CSS
- Component library or internal design system
- Framer Motion or Motion One
- Vercel deployment

### 20.2 Suggested Backend Stack

- NestJS
- TypeScript
- CockroachDB
- Railway
- Paystack test mode
- Resend
- Firebase notifications foundation
- Cloudflare R2
- Google Maps
- Google OAuth
- Vercel AI SDK
- Gemini

### 20.3 POC Priority

Build the system in this order:

1. Design tokens and layout shell
2. Public homepage and search result mock
3. Property cards and detail page
4. Room cards and availability mock
5. Checkout flow
6. Confirmation page
7. Owner dashboard mock
8. Admin dashboard mock
9. AI assistant mock
10. Replace key mock flows with real POC services

---

## 21. Quality Bar

Staynex must be built to industry standard from day one.

The prototype should be:

- Clean
- Responsive
- Mobile-first
- Premium
- Fast
- Accessible
- Consistent
- Understandable
- Expansion-ready

Bad prototype signals to avoid:

- Cluttered UI
- Cheap colors
- Weak spacing
- Random fonts
- Generic hotel cards
- Fake-looking dashboards
- Confusing navigation
- Inconsistent button styles
- Overdecorated screens
- AI assistant that feels forced

---

## 22. Final Prototype Direction

The first Staynex prototype should feel like a serious hospitality technology company is emerging from Calabar with global ambition.

It should not try to impress through noise.

It should impress through clarity, trust, polish, and a complete booking story.

The prototype should visually prove that Staynex can become:

- A trusted booking marketplace
- A property owner growth platform
- A hospitality operating layer
- A scalable international product

**Build the first mocked version to show the future clearly.**
