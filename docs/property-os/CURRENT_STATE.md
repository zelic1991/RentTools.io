# Property OS current state

MISSION: `FIRST_CUSTOMER_MVP`

STATUS: `FIRST_CUSTOMER_LOCAL_READY`

VERIFIED_AT: 2026-08-26

BASE_HEAD: `62ba90c2e23b9ae6ea2c21ae56b746ad06692c4d`

WORKTREE: committed local implementation on
`feat/property-os-tenant-foundation-v1`

SCOPE: Local code, synthetic SQLite data, tests and production build only. No
real guest record, production database, live secret, portal, DNS or deployment
was created or changed.

## Combined verification

| Check | Result | Evidence |
| --- | --- | --- |
| Full test suite | PASS | 86 files, 612 tests |
| Three-owner authority integration | PASS | three owners, six Properties, cross-owner Manager/Cleaner assignments and immediate revocation |
| TypeScript | PASS | `npx tsc --noEmit` |
| Production build | PASS | Next.js 16 build, 90 routes |
| Dependency audit | PASS | `npm audit --audit-level=high`: 0 vulnerabilities |
| Fresh SQLite migration | PASS | combined schema created and inspected |
| Migration rerun | PASS | second `db:push` idempotent |
| Diff integrity | PASS | `git diff --check` |
| Changed-file ESLint | PASS WITH LEGACY EXCLUSIONS | 0 errors, 5 warnings after disabling the three already-present React compiler rule families |
| Repository-wide ESLint | LEGACY RED | 53 errors, 23 warnings across existing Admin/Dashboard/UI code |

The build still emits upstream/legacy warnings: Sentry's `disableLogger`
option is deprecated, Next.js is deprecating the `middleware` filename in
favour of `proxy`, and Turbopack reports broad NFT tracing through
`next.config.ts`/Prisma. None failed this local MVP build, but they should be
resolved before treating deployment size and framework upgrades as proven.

## First-customer model

AUTHORITY_MODEL: `TEMPORARY_FIRST_CUSTOMER_AUTHORITY_MODEL`

- `User` with the existing owner role is the Owner.
- One `Property` is one independently rentable apartment/unit.
- An Owner may own multiple Properties.
- `PropertyManager` grants daily operations only on assigned Properties.
- `CleanerAssignment` plus owner-scoped Cleaner profiles grants cleaning-only
  access on assigned Properties.
- A separate Tenant/Building/Unit hierarchy is deliberately deferred. Adding
  it without rewiring Reservation, iCal, Guest and Feed authority would create
  a second source of truth.
- This is a bounded transition model, not the long-term tenancy architecture.
  Each external Owner identity is exactly one security boundary. Before one
  Owner needs multiple users, teams or delegated account administration, a
  first-class Tenant boundary must be introduced and every authority path must
  be rewired to it before that customer is admitted.

## Implemented for the MVP

### Isolation and authority

- Unsafe requests are denied centrally during support impersonation.
- Current role/suspension state is refreshed from the database on each session
  read.
- OCR/extraction verifies reservation ownership before AI or Guest writes.
- Manager invite claims and public guest submissions use conditional atomic
  claims.
- Guest parent links are limited to the same reservation and reject cycles.
- Cleaner profiles, assignments, task reads and operational writes are
  owner/property/assignee scoped.
- Global cron/schedule controls are superadmin-only and require an explicit
  cron secret.
- Stored iCal fetches require HTTPS and defend redirects, private addresses,
  DNS rebinding, timeouts and oversized responses.
- Global user/settings enumeration is superadmin-only.
- JWTs are bound to the current database `sessionVersion`. Password reset,
  password change, suspension, self logout-all and admin revocation invalidate
  stale sessions. Unsuspending an account cannot revive an old token.
- Support impersonation validates both the target account and the originating
  superadmin, including current role, suspension and session version.

### Calendar and feed continuity

- Existing Airbnb/Booking iCal, direct/manual reservations, conflicts,
  checkout-exclusive dates and same-day turnover remain in the test suite.
- New Properties and onboarding drafts receive cryptographic feed tokens plus
  durable random slugs.
- Draft URLs remain identical after account claim because slug and token are
  transferred together.
- Manager and Cleaner DTOs do not expose feed tokens.
- Legacy Properties with a null token are not silently rotated because that
  could break an already connected portal URL. A non-null token is an explicit
  admission check before a real customer is connected.
- Durable reservation `externalKey` values are scoped by Property and canonical
  platform. Known direct keys are immutable and date-bound; POST/CSV import use
  the database unique index as the atomic authority and return only a fully
  compatible existing row after a concurrent duplicate.

### Guest pre-check-in and manual eVisitor boundary

Canonical status flow:

```text
PENDING
  -> GUEST_COMPLETE
  -> OWNER_REVIEW
  -> OWNER_APPROVED
  -> EVISITOR_READY
  -> EVISITOR_CONFIRMED_MANUAL
```

- Multi-traveller form, encryption and token hashing are reused from the Zelic
  implementation.
- Final guest submit is one-shot and atomic.
- Unknown/corrupt statuses fail closed.
- Owner/authorized Manager review and each handoff transition are scoped,
  compare-and-set and audited with actor/time.
- Full document numbers are decrypted only in a protected no-store handoff
  view at `EVISITOR_READY` or manual-confirmed status.
- Reservation dates, confirmed traveller count and required non-EU border
  fields are revalidated before `EVISITOR_READY`.
- No production eVisitor credential or submit path exists in this MVP.

### Operations

- Existing desktop dashboard already gives a Manager assigned Properties,
  arrivals, departures, calendars and reservations.
- Mobile adds open cleaning tasks across the accessible portfolio.
- Cleaner workflow is persistent and enforced server-side:
  `PLANNED -> ASSIGNED -> IN_PROGRESS -> READY | ISSUE`.
- Cleaning records are operational metadata only; they never write
  availability or create a false cleaning day. Same-day checkout/check-in
  remains valid.
- Owners/Managers can store an optional gross reservation amount in integer
  cents and ISO currency. Reports sum only explicit stored values and count
  unknown amounts separately; nothing is inferred from nights, iCal, rates,
  fees or commissions.
- Existing DateOverrides remain the single owner-use/manual-block mechanism.

## Still required before a real production customer

These are real next gates, not hidden parts of this local-ready claim:

1. Independently review the branch and deploy it through the normal release
   process only after the Draft PR is accepted.
2. Run an authenticated browser acceptance test with synthetic Owner, Manager
   and Cleaner accounts on the deployed candidate.
3. Migrate the real database on a backup copy first; verify every existing
   Property has a protected feed token before changing any connected URL.
4. Verify backup and restore after the migrated schema, including encrypted
   guest payloads. A production restore must rotate `JWT_SECRET` before the app
   is reachable again so older restored session-version values cannot revive a
   previously revoked JWT.
5. Include the intentional one-time login cutover in release acceptance:
   pre-deployment cookies do not contain `sessionVersion` and fail closed, so
   every existing user must authenticate again after deployment.
6. Resolve or explicitly accept the build warnings before a framework or
   packaging upgrade.
7. Reduce the existing repository-wide ESLint backlog. The current MVP changes
   add no new error family in scoped checks, but the repository as a whole is
   not lint-clean and must not be reported as such.

## Deliberately later

- autonomous production eVisitor submission;
- Airbnb Partner API and Booking Connectivity API;
- Nuki/smart locks;
- dynamic pricing, payments and a commission/net-rate engine;
- public multi-property booking marketplace;
- large maintenance/vendor workflow;
- enterprise tenant/billing/entitlement features;
- explicit mobile Property switcher and generic white-label branding.

`FIRST_CUSTOMER_LOCAL_READY = PASS`

`PRODUCTION_READY = NO`
