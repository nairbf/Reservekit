# ReserveSit Application Audit Report
Generated: 2026-02-19 08:59:28 UTC

## Executive Summary
The codebase is functional and builds successfully across all three apps (`root`, `marketing-site`, `platform-admin`), but there are critical security and consistency issues around settings exposure, permission enforcement, and legacy key drift. The largest risks are unauthorized access to sensitive integration credentials through `/api/settings`, partial permission gating on state-changing routes, and environment/config drift between code and `.env.example` files. The architecture is also carrying legacy/stale routes and very large monolithic files that increase regression risk.

## Critical Issues (fix immediately)
- `Critical` — Sensitive settings are exposed to any authenticated user and writes are unbounded: `/Users/brianfelix/Bots/reservekit/src/app/api/settings/route.ts:16`, `/Users/brianfelix/Bots/reservekit/src/app/api/settings/route.ts:45`
- `Critical` — OAuth/Stripe and POS/SpotOn mutation routes use `requireAuth` instead of permission checks (`manage_billing` / `manage_integrations`):
  - `/Users/brianfelix/Bots/reservekit/src/app/api/stripe/connect/route.ts:11`
  - `/Users/brianfelix/Bots/reservekit/src/app/api/stripe/disconnect/route.ts:9`
  - `/Users/brianfelix/Bots/reservekit/src/app/api/pos/sync/route.ts:110`
  - `/Users/brianfelix/Bots/reservekit/src/app/api/spoton/sync/route.ts:215`
  - `/Users/brianfelix/Bots/reservekit/src/app/api/spoton/mapping/route.ts:21`
- `Critical` — Public payment-intent creation can be triggered by numeric reservation ID only (no user challenge/ownership check): `/Users/brianfelix/Bots/reservekit/src/app/api/payments/create-intent/route.ts:6`, `/Users/brianfelix/Bots/reservekit/src/app/api/payments/create-intent/route.ts:14`
- `Critical` — Root auth has production-dangerous fallbacks and auto-bootstrap defaults:
  - `/Users/brianfelix/Bots/reservekit/src/lib/auth.ts:7`
  - `/Users/brianfelix/Bots/reservekit/src/lib/auth.ts:9`
  - `/Users/brianfelix/Bots/reservekit/src/lib/auth.ts:24`

## High Priority (fix before launch)
- `High` — Legacy/new settings key drift breaks predictable email behavior (`emailReplyTo` vs `replyToEmail`, `emailStaffNotification` vs `staffNotificationEmail`, `depositEnabled` vs `depositsEnabled`):
  - `/Users/brianfelix/Bots/reservekit/src/app/dashboard/setup/page.tsx:246`
  - `/Users/brianfelix/Bots/reservekit/src/app/dashboard/setup/page.tsx:248`
  - `/Users/brianfelix/Bots/reservekit/src/lib/send-notification.ts:53`
  - `/Users/brianfelix/Bots/reservekit/src/app/dashboard/settings/page.tsx:1283`
  - `/Users/brianfelix/Bots/reservekit/src/app/dashboard/settings/page.tsx:1289`
- `High` — Dynamic host migration incomplete; multiple server paths still use `APP_URL` directly instead of request host utility:
  - `/Users/brianfelix/Bots/reservekit/src/lib/notifications.ts:18`
  - `/Users/brianfelix/Bots/reservekit/src/lib/sms-templates.ts:5`
  - `/Users/brianfelix/Bots/reservekit/src/app/api/cron/reminders/route.ts:37`
  - `/Users/brianfelix/Bots/reservekit/src/app/api/reservations/self-service/route.ts:124`
  - `/Users/brianfelix/Bots/reservekit/src/app/api/checkout/route.ts:26`
- `High` — Marketing webhook accepts unsigned payloads when webhook secret is absent: `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/api/webhooks/stripe/route.ts:35`
- `High` — Permission model is partially wired; some mutating routes still bypass granular permission checks:
  - `/Users/brianfelix/Bots/reservekit/src/app/api/tables/positions/route.ts:6`
  - `/Users/brianfelix/Bots/reservekit/src/app/api/menu/upload/route.ts:73`
- `High` — Rate limiting is missing on reservation self-service and lookup endpoints:
  - `/Users/brianfelix/Bots/reservekit/src/app/api/reservations/lookup/route.ts:8`
  - `/Users/brianfelix/Bots/reservekit/src/app/api/reservations/self-service/route.ts:22`

## Medium Priority (fix soon after launch)
- `Medium` — Legacy/stale root checkout flow still exists (`/api/checkout` + `/purchase/success`) with old model and minimal UX:
  - `/Users/brianfelix/Bots/reservekit/src/app/api/checkout/route.ts:4`
  - `/Users/brianfelix/Bots/reservekit/src/app/purchase/success/page.tsx:1`
- `Medium` — Root Stripe webhook route is still log-only and does not execute post-purchase provisioning flow: `/Users/brianfelix/Bots/reservekit/src/app/api/webhooks/stripe/route.ts:14`
- `Medium` — Marketing support/demo APIs are placeholders and portal support uses mock tickets:
  - `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/api/support-ticket/route.ts:7`
  - `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/api/demo-request/route.ts:7`
  - `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/portal/support/page.tsx:5`
- `Medium` — Domain portal computes slug from user identity instead of backend restaurant record:
  - `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/portal/domain/page.tsx:62`
  - `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/api/auth/me/route.ts:24`
- `Medium` — Revenue fallback logic can diverge from actual sold prices (old static plan table fallback):
  - `/Users/brianfelix/Bots/reservekit/platform-admin/src/lib/platform.ts:5`
  - `/Users/brianfelix/Bots/reservekit/platform-admin/src/lib/overview.ts:64`

## Low Priority (nice to have)
- `Low` — Very large files reduce maintainability and increase merge/regression risk:
  - `/Users/brianfelix/Bots/reservekit/src/app/dashboard/settings/page.tsx`
  - `/Users/brianfelix/Bots/reservekit/platform-admin/src/app/dashboard/restaurants/[id]/page.tsx`
  - `/Users/brianfelix/Bots/reservekit/src/app/reserve/[slug]/ReserveWidgetClient.tsx`
- `Low` — Next.js middleware deprecation warning on root/marketing builds (`middleware.ts` -> `proxy.ts`)
- `Low` — Runtime logging remains in production paths (18 root, 16 marketing, 2 platform-admin)

## Detailed Findings

### 1. Dead Code & Unused Files
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/src/app/api/checkout/route.ts:4` — Legacy checkout route appears stale relative to active marketing checkout flow; no in-repo UI path in root app currently references it.
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/src/app/purchase/success/page.tsx:1` — Companion legacy success page appears tied to stale root checkout route.
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/src/app/api/webhooks/stripe/route.ts:14` — Root webhook handler only logs completed checkout and does not activate licenses/provision entities.
- [ ] `Low` `/Users/brianfelix/Bots/reservekit/src/lib/permissions.ts:122` — `PATH_PERMISSIONS` map exists but is not centrally enforced.
- [ ] `Low` `/Users/brianfelix/Bots/reservekit/src/lib/permissions.ts:138` — `API_PERMISSIONS` map exists but is not centrally enforced.
- [ ] `Low` Candidate unused dependency: `nodemailer` in root `package.json` has no import usage in app code.
- [ ] `Low` Candidate unused dev deps flagged by `depcheck` in all projects (`@tailwindcss/postcss`, `tailwindcss`, `@types/react-dom`, etc.); verify before removal (tool has false positives).

### 2. Consistency Issues
- [ ] `Critical` `/Users/brianfelix/Bots/reservekit/src/app/api/settings/route.ts:45` — Settings writes are free-form (no key whitelist), inconsistent with constrained settings handling patterns elsewhere.
- [ ] `High` `/Users/brianfelix/Bots/reservekit/src/app/dashboard/setup/page.tsx:248` vs `/Users/brianfelix/Bots/reservekit/src/lib/send-notification.ts:53` — `replyToEmail` written in setup, while email sender reads `emailReplyTo`.
- [ ] `High` `/Users/brianfelix/Bots/reservekit/src/app/dashboard/settings/page.tsx:1289` vs `/Users/brianfelix/Bots/reservekit/src/lib/staff-notifications.ts:21` — UI uses both `emailStaffNotification` and `staffNotificationEmail`; back-end readers are mixed.
- [ ] `High` `/Users/brianfelix/Bots/reservekit/src/lib/settings.ts:182` — Deposit keys use compatibility fallback (`depositEnabled`/`depositsEnabled`, `depositMinPartySize`/`depositMinParty`), indicating unresolved schema drift.
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/src/lib/features.ts:9` vs `/Users/brianfelix/Bots/reservekit/src/lib/license.ts:19` — Feature naming mixes `floorplan` and `floor_plan` style keys across code paths.
- [ ] `High` `/Users/brianfelix/Bots/reservekit/src/lib/notifications.ts:18` and related files — Mixed use of host-derived URL utility and static env URL generation remains inconsistent.

### 3. Missing Features / Incomplete Implementations
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/api/support-ticket/route.ts:7` — API is log-only placeholder, no persistence or ticket backend.
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/api/demo-request/route.ts:7` — API is log-only placeholder.
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/portal/support/page.tsx:5` — Support history is hardcoded mock data.
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/src/lib/pos/toast.ts:16` — Toast adapter is intentionally stubbed; status should remain explicitly “Coming Soon”.
- [ ] `Low` `/Users/brianfelix/Bots/reservekit/src/app/api/spoton/test/route.ts:26` — Diagnostic route exists but has no clear UI entrypoint in current settings panel.
- [ ] `Info` `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/pricing/page.tsx:199` — Pricing “Get Started” flow is wired to Stripe checkout (not demo redirect). This path is functional.

### 4. Security Concerns
- [ ] `Critical` `/Users/brianfelix/Bots/reservekit/src/app/api/settings/route.ts:16` — Any authenticated user can read full settings payload; includes sensitive integration state.
- [ ] `Critical` `/Users/brianfelix/Bots/reservekit/src/app/api/settings/route.ts:28` — Only two Stripe keys are masked; keys like `stripeRefreshToken`, `spotonApiKey`, and `pos_credentials_*` can leak in responses.
- [ ] `Critical` `/Users/brianfelix/Bots/reservekit/src/app/api/settings/route.ts:45` — Arbitrary key upserts allow unauthorized mutation of hidden/internal setting namespace.
- [ ] `Critical` `/Users/brianfelix/Bots/reservekit/src/lib/auth.ts:7` — `JWT_SECRET` fallback (`dev-secret-change-me`) is unsafe if env is missing.
- [ ] `Critical` `/Users/brianfelix/Bots/reservekit/src/lib/auth.ts:9` — Default admin password fallback (`admin123`) is unsafe.
- [ ] `Critical` `/Users/brianfelix/Bots/reservekit/src/lib/auth.ts:24` — Auto-bootstrap admin creation can create privileged account with fallback credentials.
- [ ] `High` `/Users/brianfelix/Bots/reservekit/src/app/api/payments/create-intent/route.ts:14` — Public route accepts reservation ID only; no signed token/challenge bound to reservation owner.
- [ ] `High` `/Users/brianfelix/Bots/reservekit/src/app/api/stripe/connect/route.ts:11` and `/Users/brianfelix/Bots/reservekit/src/app/api/stripe/disconnect/route.ts:9` — Billing-level actions are not permission-gated.
- [ ] `High` `/Users/brianfelix/Bots/reservekit/src/app/api/pos/sync/route.ts:110` and `/Users/brianfelix/Bots/reservekit/src/app/api/spoton/sync/route.ts:215` — Integration writes are auth-only, not permission-gated.
- [ ] `High` `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/api/webhooks/stripe/route.ts:35` — Signature verification bypasses completely if `STRIPE_WEBHOOK_SECRET` is unset.
- [ ] `High` `/Users/brianfelix/Bots/reservekit/src/app/api/reservations/lookup/route.ts:8` and `/Users/brianfelix/Bots/reservekit/src/app/api/reservations/self-service/route.ts:22` — No explicit rate limiting on guest-facing reservation lookup/modify endpoints.

### 5. UI/UX Issues
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/portal/support/page.tsx:5` — “Past tickets” table is mock-only and may mislead users.
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/portal/domain/page.tsx:62` — Current URL section can show wrong slug if user name/email differs from restaurant slug.
- [ ] `Low` `/Users/brianfelix/Bots/reservekit/src/app/dashboard/settings/page.tsx:1989` — Large single-file settings page impacts readability and maintainability.
- [ ] `Low` `/Users/brianfelix/Bots/reservekit/platform-admin/src/app/dashboard/restaurants/[id]/page.tsx:1841` — Restaurant detail page remains very large despite tab refactor; high regression surface area.
- [ ] `Low` `/Users/brianfelix/Bots/reservekit/src/app/reserve/[slug]/ReserveWidgetClient.tsx:1244` — Large client component can be difficult to reason about and test.

### 6. Database / Schema Issues
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/prisma/schema.prisma:39` — `Reservation` has no composite indexes for high-frequency filters (`date`, `status`, `time`, `tableId`).
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/prisma/schema.prisma:141` — `WaitlistEntry` has no index on `status`/`position` despite queue-style queries.
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/prisma/schema.prisma:98` + `/Users/brianfelix/Bots/reservekit/src/app/api/settings/route.ts:45` — Key-value `Setting` model without whitelist/schema enforcement invites key sprawl.
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/platform-admin/src/lib/overview.ts:64` — Revenue aggregation can fall back to static plan prices, diverging from actual charged amount.

### 7. Build & Performance
- [ ] `Low` Root build warning: Next.js deprecates `middleware.ts` convention (`proxy.ts` recommended).
- [ ] `Low` Marketing build warning: same middleware deprecation warning.
- [ ] `Low` `/Users/brianfelix/Bots/reservekit/src/app/api/reservations/self-service/route.ts:80` — Multiple sequential `setting.findUnique` calls can be batched.
- [ ] `Low` `/Users/brianfelix/Bots/reservekit/src/app/api/cron/reminders/route.ts:29` — Reminder settings are queried sequentially and then transformed each run; can be grouped.
- [ ] `Low` Runtime logging volume is non-trivial in production paths (root 18 call sites, marketing 16, platform-admin 2).

### 8. Configuration & Environment
- [ ] `High` Root `.env.example` is missing multiple required vars used by code (`APP_URL`, `CRON_SECRET`, `MASTER_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`, Stripe keys, POS runtime keys, etc.).
- [ ] `Medium` Root `.env.example` has ambiguous/legacy entries (`RESTAURANT_SLUG`) not referenced by app code.
- [ ] `Medium` Marketing `.env.example` includes `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` but current source does not read it.
- [ ] `Medium` Platform-admin `.env.example` includes `APP_URL`, but current source does not use it.
- [ ] `Medium` Platform-admin `.env.example` omits runtime vars used in code (`COOKIE_SECURE`, `PLATFORM_EMAIL_FROM`, `NODE_ENV`).

### 9. Multi-tenant Concerns
- [ ] `High` `/Users/brianfelix/Bots/reservekit/src/lib/notifications.ts:18` and related files — absolute links may point to wrong domain when `APP_URL` is shared/static.
- [ ] `High` `/Users/brianfelix/Bots/reservekit/src/app/api/checkout/route.ts:26` — success/cancel URLs are built from static env URL instead of request host.
- [ ] `Medium` Hardcoded tenant defaults in public pages/templates can leak reef-specific assumptions:
  - `/Users/brianfelix/Bots/reservekit/src/app/page.tsx:210`
  - `/Users/brianfelix/Bots/reservekit/src/app/menu/page.tsx:85`
  - `/Users/brianfelix/Bots/reservekit/src/components/landing/hero.tsx:35`
  - `/Users/brianfelix/Bots/reservekit/src/lib/email-templates.ts:284`
- [ ] `Medium` `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/portal/domain/page.tsx:63` — tenant slug is inferred from user metadata instead of authoritative restaurant data.

### 10. Marketing Site & Platform Admin
- [ ] `Info` Pricing checkout flow on marketing site is wired correctly to Stripe checkout session creation:
  - `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/pricing/page.tsx:199`
  - `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/api/checkout/route.ts:112`
- [ ] `High` Marketing Stripe webhook can skip signature validation if secret missing: `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/api/webhooks/stripe/route.ts:35`
- [ ] `Medium` Platform-admin login is prefilled with default-like credentials in UI state:
  - `/Users/brianfelix/Bots/reservekit/platform-admin/src/app/login/page.tsx:8`
  - `/Users/brianfelix/Bots/reservekit/platform-admin/src/app/login/page.tsx:9`
- [ ] `Medium` Platform-admin revenue fallback may show synthetic revenue for records without `oneTimeRevenue`:
  - `/Users/brianfelix/Bots/reservekit/platform-admin/src/lib/platform.ts:5`
  - `/Users/brianfelix/Bots/reservekit/platform-admin/src/lib/overview.ts:64`
- [ ] `Medium` Marketing portal depends on `PLATFORM_WEBHOOK_SECRET` for customer info hydration; missing secret silently degrades portal detail data (`user` still works):
  - `/Users/brianfelix/Bots/reservekit/marketing-site/src/app/api/auth/me/route.ts:10`

## Environment Variables Reference

### Root App (`/Users/brianfelix/Bots/reservekit`)
| Variable | Used in | Purpose |
|---|---|---|
| `DATABASE_URL` | `src/lib/db.ts`, `src/lib/uploads.ts` | SQLite DB path/runtime connection |
| `JWT_SECRET` | `src/lib/auth.ts`, auth routes | Main app session signing/verification |
| `MASTER_ADMIN_EMAIL` | `src/lib/auth.ts` | Bootstrap superadmin identity |
| `DEFAULT_ADMIN_PASSWORD` | `src/lib/auth.ts` | Bootstrap superadmin password |
| `ADMIN_JWT_SECRET` | `src/app/api/auth/admin-login/route.ts` | Cross-app admin login token verification |
| `ADMIN_API_URL` | `src/lib/license.ts` | Platform-admin license validation endpoint |
| `APP_URL` | Notifications, reminders, checkout, auth emails | Absolute URL fallback for links |
| `NEXT_PUBLIC_APP_URL` | `src/lib/app-url.ts` fallback | Public URL fallback |
| `NODE_ENV` | auth routes/cookies | Production behavior toggles |
| `CRON_SECRET` | `src/app/api/cron/reminders/route.ts` | Cron endpoint auth |
| `RESTAURANT_UPLOAD_ROOT` | `src/lib/uploads.ts` | Upload root path |
| `STRIPE_SECRET_KEY` | `src/lib/stripe.ts`, Stripe routes | Stripe server API key |
| `STRIPE_PUBLISHABLE_KEY` | `src/lib/stripe.ts` | Server fallback publishable key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client payment components, stripe util fallback | Client publishable key |
| `STRIPE_WEBHOOK_SECRET` | `src/lib/stripe.ts` | Stripe webhook signature secret |
| `STRIPE_CONNECT_CLIENT_ID` | `src/app/api/stripe/connect/route.ts` | Stripe Connect OAuth client ID |
| `SQUARE_APP_ID` / `SQUARE_APP_SECRET` | `src/lib/pos/square.ts` | Square OAuth + API access |
| `TOAST_CLIENT_ID` / `TOAST_CLIENT_SECRET` | `src/lib/pos/toast.ts` | Toast adapter availability |
| `CLOVER_APP_ID` / `CLOVER_APP_SECRET` | `src/lib/pos/clover.ts` | Clover OAuth + API access |
| `RESEND_API_KEY` | `src/lib/email.ts` (dynamic access) | Outbound email delivery |
| `SENDER_DOMAIN` | `src/lib/email.ts` (dynamic access) | From-domain for outgoing email |
| `RESTAURANT_NAME` | `src/lib/email.ts` (dynamic access) | Default from-name |

### Marketing Site (`/Users/brianfelix/Bots/reservekit/marketing-site`)
| Variable | Used in | Purpose |
|---|---|---|
| `JWT_SECRET` | `src/lib/customer-auth.ts` | Portal auth token signing |
| `COOKIE_SECURE` | `src/lib/customer-auth.ts` | Cookie security override |
| `NODE_ENV` | `src/lib/customer-auth.ts` | Production security behavior |
| `NEXT_PUBLIC_APP_URL` | `src/lib/stripe.ts` | Base URL for checkout redirects |
| `ADMIN_API_URL` | auth + webhook forwarding | Platform-admin endpoint base |
| `PLATFORM_WEBHOOK_SECRET` | auth bridge + webhook bridge | Service-to-service shared secret |
| `STRIPE_SECRET_KEY` | checkout + webhook routes | Stripe server API key |
| `STRIPE_WEBHOOK_SECRET` | webhook route | Signature verification secret |
| `RESEND_API_KEY` | domain-request notifications | Outbound support notifications |
| `STRIPE_PRICE_CORE` | `src/lib/stripe.ts` | Stripe price ID |
| `STRIPE_PRICE_SERVICE_PRO` | `src/lib/stripe.ts` | Stripe price ID |
| `STRIPE_PRICE_FULL_SUITE` | `src/lib/stripe.ts` | Stripe price ID |
| `STRIPE_PRICE_HOSTING_MONTHLY` | `src/lib/stripe.ts` | Stripe price ID |
| `STRIPE_PRICE_HOSTING_ANNUAL` | `src/lib/stripe.ts` | Stripe price ID |
| `STRIPE_PRICE_SMS` | `src/lib/stripe.ts` | Stripe price ID |
| `STRIPE_PRICE_FLOOR_PLAN` | `src/lib/stripe.ts` | Stripe price ID |
| `STRIPE_PRICE_REPORTING` | `src/lib/stripe.ts` | Stripe price ID |
| `STRIPE_PRICE_GUEST_HISTORY` | `src/lib/stripe.ts` | Stripe price ID |
| `STRIPE_PRICE_EVENT_TICKETING` | `src/lib/stripe.ts` | Stripe price ID |

### Platform Admin (`/Users/brianfelix/Bots/reservekit/platform-admin`)
| Variable | Used in | Purpose |
|---|---|---|
| `DATABASE_URL` | `src/lib/db.ts` | Platform-admin DB connection |
| `JWT_SECRET` | `src/lib/auth.ts` | Platform admin session signing |
| `COOKIE_SECURE` | `src/lib/auth.ts` | Cookie security override |
| `NODE_ENV` | `src/lib/auth.ts`, `src/lib/db.ts` | Production behavior toggles |
| `RESTAURANT_DB_ROOT` | `src/lib/restaurant-db.ts`, `src/lib/platform.ts` | Restaurant SQLite base path |
| `PLATFORM_WEBHOOK_SECRET` | customer auth/info + Stripe webhook receiver | Inter-service auth secret |
| `RESEND_API_KEY` | `src/lib/email-sequences.ts` | Email sequence send API key |
| `PLATFORM_EMAIL_FROM` | `src/lib/email-sequences.ts` | From address override |
| `CRON_SECRET` | `src/app/api/cron/email-sequences/route.ts` | Cron endpoint auth |

## Settings Keys Reference

### Restaurant identity / branding
- `restaurantName` — primary display name. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/settings.ts`, `/Users/brianfelix/Bots/reservekit/src/app/page.tsx`, `/Users/brianfelix/Bots/reservekit/platform-admin/src/app/api/restaurants/[id]/settings/route.ts`
- `slug` — reserve URL and canonical paths. Refs: `/Users/brianfelix/Bots/reservekit/src/app/page.tsx`, `/Users/brianfelix/Bots/reservekit/src/app/sitemap.ts`
- `tagline`, `description` — landing/meta copy. Refs: `/Users/brianfelix/Bots/reservekit/src/app/page.tsx`
- `accentColor`, `logoUrl`, `heroImageUrl`, `faviconUrl` — branding assets/colors. Refs: `/Users/brianfelix/Bots/reservekit/src/app/layout.tsx`, `/Users/brianfelix/Bots/reservekit/src/app/page.tsx`
- `phone`, `address`, `contactEmail` — contact metadata. Refs: `/Users/brianfelix/Bots/reservekit/src/app/page.tsx`, `/Users/brianfelix/Bots/reservekit/src/lib/send-notification.ts`
- `landing_sections` — landing builder serialized section config. Refs: `/Users/brianfelix/Bots/reservekit/src/components/landing-builder.tsx`, `/Users/brianfelix/Bots/reservekit/src/app/page.tsx`

### Reservation rules / capacity
- `timezone` — local timezone logic. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/timezone.ts`, `/Users/brianfelix/Bots/reservekit/src/lib/settings.ts`
- `openTime`, `closeTime`, `slotInterval`, `lastSeatingBufferMin`, `maxCoversPerSlot`, `maxPartySize`, `diningDurations`, `weeklySchedule` — availability/scheduling defaults. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/settings.ts`, `/Users/brianfelix/Bots/reservekit/src/app/dashboard/schedule/page.tsx`
- `bookingLeadHours`, `defaultPartySizes`, `reservationApprovalMode`, `cancellationPolicy`, `selfServiceCutoffHours` — reservation policy UI/flow keys. Refs: `/Users/brianfelix/Bots/reservekit/src/app/dashboard/settings/page.tsx`, `/Users/brianfelix/Bots/reservekit/src/app/api/reservations/self-service/route.ts`

### Deposits / payments
- `depositEnabled`, `depositsEnabled` — deposit toggle (legacy/new). Refs: `/Users/brianfelix/Bots/reservekit/src/lib/settings.ts`, `/Users/brianfelix/Bots/reservekit/src/app/dashboard/settings/page.tsx`
- `depositType`, `depositAmount`, `depositMinParty`, `depositMinPartySize`, `depositMessage`, `specialDepositRules` — deposit behavior and overrides. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/settings.ts`, `/Users/brianfelix/Bots/reservekit/src/app/dashboard/schedule/page.tsx`
- `noshowChargeEnabled`, `noshowChargeAmount` — no-show charge controls. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/settings.ts`, `/Users/brianfelix/Bots/reservekit/src/app/api/reservations/[id]/action/route.ts`
- `stripeSecretKey`, `stripePublishableKey`, `stripeWebhookSecret`, `stripeAccountId`, `stripeRefreshToken`, `stripe_oauth_state` — Stripe credentials + OAuth state. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/stripe.ts`, `/Users/brianfelix/Bots/reservekit/src/app/api/stripe/callback/route.ts`

### Email/notification settings
- `emailEnabled`, `emailSendConfirmations`, `emailSendReminders`, `emailSendWaitlist` — global notification toggles. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/send-notification.ts`, `/Users/brianfelix/Bots/reservekit/src/app/dashboard/settings/page.tsx`
- `emailReminderTiming`, `reminderLeadHours` — reminder timing (legacy/new). Refs: `/Users/brianfelix/Bots/reservekit/src/app/api/cron/reminders/route.ts`
- `emailReplyTo`, `replyToEmail` — reply-to address (legacy/new). Refs: `/Users/brianfelix/Bots/reservekit/src/lib/send-notification.ts`, `/Users/brianfelix/Bots/reservekit/src/app/dashboard/setup/page.tsx`
- `emailStaffNotification`, `staffNotificationEmail` — staff alert inbox (legacy/new). Refs: `/Users/brianfelix/Bots/reservekit/src/app/dashboard/settings/page.tsx`, `/Users/brianfelix/Bots/reservekit/src/lib/staff-notifications.ts`
- `staffNotificationsEnabled`, `largePartyThreshold` — staff alert gating. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/staff-notifications.ts`

### SMS / comms providers
- `twilioSid`, `twilioToken`, `twilioPhone` — Twilio config. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/sms.ts`, `/Users/brianfelix/Bots/reservekit/src/app/dashboard/settings/page.tsx`

### Loyalty / express dining
- `loyaltyOptInEnabled`, `loyaltyProgramName`, `loyaltyOptInMessage`, `loyaltyOptInLabel` — loyalty consent content. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/settings.ts`, `/Users/brianfelix/Bots/reservekit/src/app/reserve/[slug]/ReserveWidgetClient.tsx`
- `loyalty_phone_*` — per-phone loyalty records (excluded from `/api/settings` response by prefix). Refs: `/Users/brianfelix/Bots/reservekit/src/app/api/settings/route.ts`
- `expressDiningEnabled`, `expressDiningMode`, `expressDiningPayment`, `expressDiningCutoffHours`, `expressDiningMessage` — express dining behavior. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/settings.ts`, `/Users/brianfelix/Bots/reservekit/src/lib/preorder.ts`

### License / feature flags
- `license_key`, `license_status`, `license_plan`, `license_valid`, `license_last_check` — synced license state. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/features.ts`, `/Users/brianfelix/Bots/reservekit/src/lib/license.ts`
- `feature_sms`, `feature_floorplan`, `feature_reporting`, `feature_guest_history`, `feature_event_ticketing` — module flags. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/license.ts`, `/Users/brianfelix/Bots/reservekit/src/app/dashboard/settings/page.tsx`
- `license_<module>` (dynamic keys) — legacy module key pattern consumed by `isModuleActive`. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/license.ts:116`

### POS / SpotOn settings
- `spotonApiKey`, `spotonLocationId`, `spotonEnvironment`, `spotonUseMock`, `spotonLastSync`, `spotonLastOpenChecks` — SpotOn integration config/state. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/spoton.ts`, `/Users/brianfelix/Bots/reservekit/src/app/api/spoton/sync/route.ts`
- `spoton_table_*` — SpotOn table mapping namespace. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/spoton.ts`, `/Users/brianfelix/Bots/reservekit/src/app/api/spoton/mapping/route.ts`
- `pos_status_*` — live POS table status namespace. Refs: `/Users/brianfelix/Bots/reservekit/src/app/api/spoton/sync/route.ts`
- `pos_connected_provider`, `pos_sync_provider`, `pos_last_sync`, `pos_sync_error`, `pos_location_name`, `pos_menu_items`, `pos_tables`, `pos_business_hours` — generic POS sync state. Refs: `/Users/brianfelix/Bots/reservekit/src/app/api/pos/sync/route.ts`
- `pos_credentials_square`, `pos_credentials_toast`, `pos_credentials_clover` — serialized provider credentials. Refs: `/Users/brianfelix/Bots/reservekit/src/app/api/pos/sync/route.ts`, `/Users/brianfelix/Bots/reservekit/src/app/api/pos/callback/[provider]/route.ts`

### Menu/settings storage
- `menu_files` — serialized uploaded menu file manifest. Refs: `/Users/brianfelix/Bots/reservekit/src/lib/menu-files.ts`

### Setup wizard keys
- `setupWizardStep`, `setupWizardCompleted`, `setupWizardCompletedAt` — onboarding progress flags. Refs: `/Users/brianfelix/Bots/reservekit/src/app/dashboard/setup/page.tsx`, `/Users/brianfelix/Bots/reservekit/src/app/dashboard/DashboardNav.tsx`

### Platform-admin restaurant setting keys (written to each restaurant DB)
- Whitelisted in `/Users/brianfelix/Bots/reservekit/platform-admin/src/app/api/restaurants/[id]/settings/route.ts`:
  - `restaurantName`, `contactEmail`, `replyToEmail`, `staffNotificationEmail`, `staffNotificationsEnabled`, `timezone`, `accentColor`, `slug`, `phone`, `address`, `emailEnabled`, `emailSendConfirmations`, `emailSendReminders`, `emailReminderTiming`, `largePartyThreshold`, `tagline`, `description`, `heroImageUrl`, `logoUrl`, `faviconUrl`

