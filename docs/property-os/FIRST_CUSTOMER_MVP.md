# First-customer local MVP

STATUS: `FIRST_CUSTOMER_LOCAL_READY`

This scope replaces the broad Property OS build order. It does not remove the
long-term architecture notes; it limits the current implementation to what is
needed to operate one to three external owners safely.

## Required outcome

`FIRST_CUSTOMER_LOCAL_READY` means that three synthetic owners can be created
locally, each can own multiple properties/units, managers and cleaners can be
assigned without cross-owner access, and the existing Zelic workflows continue
to work.

The current authority model is explicitly
`TEMPORARY_FIRST_CUSTOMER_AUTHORITY_MODEL`: one `User` owner identity is one
security boundary. It is acceptable only while an Owner does not need multiple
users or team administration. A first-class Tenant model is mandatory before
that requirement is admitted; the temporary model must not silently become the
long-term architecture.

## Priority A

1. Close the existing cross-owner and security paths:
   - server-enforced read-only impersonation;
   - reservation/OCR ownership;
   - owner-scoped cleaner migration and APIs;
   - platform-only global sync controls and explicit cron secret;
   - safe stored iCal fetch destinations.
2. Reuse the existing authority graph for the first customer:
   - `User` is the Owner account;
   - each `Property` is one independently rentable unit/apartment;
   - `PropertyManager` and owner-scoped cleaner assignments are memberships
     with property-level scope.
   A separate `Tenant`/`Unit` model is deliberately deferred until a real
   customer needs a building containing several independently managed units.
   Adding those tables without rewiring every Reservation/iCal/Guest path would
   create a second, bypassable source of truth rather than safe tenancy.
3. Give a manager one scoped view of assigned houses/units, arrivals,
   departures, calendars, reservations and open turnovers.
4. Add a minimal persistent cleaner workflow:
   `PLANNED -> ASSIGNED -> IN_PROGRESS -> READY | ISSUE`.
5. Give an owner a scoped calendar, reservations, owner-use blocks and a simple
   revenue summary based only on stored, auditable amounts.
6. Preserve Airbnb/Booking iCal, manual/direct reservations, checkout-exclusive
   same-day turnover, buffers, pre-check-in, backups and Zelic Mobile.

## Guest pre-check-in and eVisitor boundary

This is part of Priority A.

Required state flow:

```text
PENDING
  -> GUEST_COMPLETE
  -> OWNER_REVIEW
  -> OWNER_APPROVED
  -> EVISITOR_READY
  -> EVISITOR_CONFIRMED_MANUAL
```

Requirements:

- preserve the multi-traveller guest form and current encryption;
- validate all fields required by the existing eVisitor payload builder;
- Owner or authorized Manager performs the review;
- provide a safe eVisitor-ready summary/copy surface;
- manual confirmation records actor, time and reservation scope in AuditEvent;
- no production eVisitor credentials or autonomous submission;
- the existing official-style test adapter may be connected locally only if it
  remains synthetic and cannot produce `PRODUCTION_SUBMITTED`.

## Priority B

Only after Priority A is green:

- generalize Zelic Mobile to explicit property/unit switching;
- read-only pricing overview;
- simple cleaner photo evidence;
- simple owner reports.

## Explicitly deferred

- production eVisitor submission;
- Airbnb Partner API and Booking Connectivity API;
- smart locks;
- dynamic pricing;
- real payments;
- public multi-property marketplace;
- complex commission/net-rate engine;
- broad maintenance/vendor suite;
- enterprise SaaS features.

## Admission gates

The data-model work may start only after the security prerequisite tests are
green. `FIRST_CUSTOMER_LOCAL_READY` may be reported only when:

- two-tenant/cross-owner negative tests pass;
- manager and cleaner revocation takes effect server-side;
- no implicit fallback tenant/property selects authority;
- synthetic three-owner E2E passes;
- pre-check-in to manual eVisitor confirmation passes;
- all integrations remain local/read-only/sandbox as required;
- existing Zelic calendar and same-day behavior remain green;
- no production data, secret, deployment, DNS or portal is touched.

## Verification result

The local implementation passed the admission gates on 2026-08-26:

- synthetic three-owner/six-Property authority and revocation test: PASS;
- full suite: 640 tests in 90 files: PASS;
- canonical pre-check-in through manual eVisitor confirmation: PASS;
- session revocation, suspend/unsuspend and impersonation authority: PASS;
- atomic durable reservation identity including concurrent retry: PASS;
- fresh and repeated SQLite schema push: PASS;
- TypeScript and production build: PASS;
- dependency audit: 0 vulnerabilities;
- real guest data, deployment, DNS and portal changes: none.

This is a local-ready result only. Release review, deployed browser acceptance,
backup-copy migration and restore proof remain production admission gates.
