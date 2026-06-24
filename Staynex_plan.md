# Staynex plan.md

## Mission
Build an international hospitality booking platform originating in Calabar.

Staynex is not a Calabar-only platform. Calabar is the launch wedge. The architecture must support city-by-city, country-by-country expansion.

## Current Phase
POC v0.1 - prove the full booking loop:

Property -> Room -> Availability -> Booking -> Payment -> Confirmation.

## Product Principles
- Real booking engine before decorative features.
- Local wedge, international architecture.
- Secure by default, low-friction by design.
- Card-based, mobile-firs, clean and seamless  UI.
- Real-time availability and future reservation support.
- AI as assistance, not financial authority.
- Admin visibility from Day 1.
- Daily vertical slices.

## Core Stack
- Web: Next.js + TypeScript
- API: NestJS + TypeScript
- Database: CockroachDB
- Storage: Cloudflare R2
- Web deployment: Vercel
- API deployment: Railway
- AI: Google Gemini + Vercel AI SDK
- Maps: Google Maps
- Auth: Google OAuth + email auth
- Notifications: Firebase Cloud Messaging
- Email: Resend
- Payments: Paystack first
- Support automation: Respond.io later

## Monorepo Structure
```txt
staynex/
  staynex-frontend
    src/

  staynex-backend
    src/
    prisma/
    db/
    types/
    config/

  docs/
```

## POC Acceptance Criteria
- [ ] Guest can search by city and date.
- [ ] Guest can view property cards.
- [ ] Guest can swipe room/property images.
- [ ] Guest can check availability.
- [ ] Guest can create a booking hold.
- [ ] Guest can pay using Paystack test mode.
- [ ] Payment webhook confirms booking.
- [ ] Guest receives confirmation email.
- [ ] Owner sees booking in dashboard and gets a push notofication.
- [ ] Admin sees booking, payment, owner, and property.
- [ ] Booking flow works cleanly on mobile.

## Workstreams

### 1. Design System
- [ ] Define colors: #27187D, #F7F7FF, ink, muted, border, success, warning, error.
- [ ] Define typography scale.
- [ ] Define spacing scale.
- [ ] Define card component.
- [ ] Define carousel behavior.
- [ ] Define loading, empty, error, and success states.

### 2. Database
- [ ] User
- [ ] Role
- [ ] GuestProfile
- [ ] OwnerProfile
- [ ] Country
- [ ] Region
- [ ] City
- [ ] Property
- [ ] PropertyMedia
- [ ] RoomType
- [ ] RoomUnit
- [ ] RoomMedia
- [ ] AvailabilityCalendar
- [ ] BookingHold
- [ ] Booking
- [ ] Payment
- [ ] Payout
- [ ] Notification
- [ ] AuditLog
- [ ] AIConversation
- [ ] AIActionLog

### 3. Backend Modules
- [ ] AuthModule
- [ ] UsersModule
- [ ] PropertiesModule
- [ ] RoomsModule
- [ ] AvailabilityModule
- [ ] BookingsModule
- [ ] PaymentsModule
- [ ] NotificationsModule
- [ ] MediaModule
- [ ] AdminModule
- [ ] AiModule
- [ ] AuditModule

### 4. Public Web
- [ ] Home page
- [ ] Search results
- [ ] Property details
- [ ] Room details
- [ ] Checkout
- [ ] Payment status
- [ ] Confirmation
- [ ] Legal
- [ ] About
- [ ] Terms
- [ ] Policies

### 5. Owner Dashboard
- [ ] Owner onboarding
- [ ] Property setup
- [ ] Room setup
- [ ] Image upload
- [ ] Availability calendar
- [ ] Bookings
- [ ] Earnings 
All have KPIs and Individual pages

### 6. Admin Dashboard
- [ ] Overview
- [ ] Property approval
- [ ] Owners
- [ ] Guests
- [ ] Bookings
- [ ] Payments
- [ ] Audit logs
- [ ] User Management
All have KPIs and Individual pages
## Week 1
- [ ] Create monorepo.
- [ ] Configure TypeScript, linting, formatting.
- [ ] Configure environment validation.
- [ ] Setup Next.js app.
- [ ] Setup NestJS API.
- [ ] Setup CockroachDB connection.
- [ ] Setup Cloudflare R2 bucket.
- [ ] Build design tokens.
- [ ] Seed cities and sample properties.

## Week 2
- [ ] Build owner onboarding.
- [ ] Build property creation.
- [ ] Build room creation.
- [ ] Build image upload.
- [ ] Build property card.
- [ ] Build room gallery carousel.
- [ ] Build admin property approval.
- [ ] Build availability calendar v1.

## Week 3
- [ ] Build search results.
- [ ] Build availability check.
- [ ] Build booking hold.
- [ ] Build checkout.
- [ ] Integrate Paystack test payment.
- [ ] Verify payment webhook.
- [ ] Build confirmation page.

## Week 4
- [ ] Add Resend email confirmation.
- [ ] Add owner booking notification foundation.
- [ ] Build owner booking dashboard.
- [ ] Build admin booking dashboard.
- [ ] Add AI assistant prototype.
- [ ] Add mobile polish.
- [ ] Run POC QA.
- [ ] Prepare hotel partner demo.

## Key Engineering Rules
- Booking creation must be transactional.
- No confirmed booking without payment verification.
- No stale availability after checkout begins.
- Every admin override must write to AuditLog.
- AI must not promise availability, refunds, or financial actions without platform verification. AI should be Tool first
- Do not build Flutter app until web POC proves the loop.
