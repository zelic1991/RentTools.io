# Multi-tenant prework

STATUS: DRAFT
VERIFIED_AT: 2026-08-26
SCOPE: Public technical architecture planning only
CONTACT_SENT: NO

## Evidence from the current product

The public product documentation describes multiple properties per account,
co-host access, cleaner-scoped views, property-scoped iCal feeds, one-time
guest form links, and owner-scoped data access. These statements are product
documentation evidence; they are not a proof that every boundary is enforced
in every runtime path.

## Proposed ownership model

Use an explicit tenant boundary instead of treating a user as the tenant:

```text
Account/Tenant
  ├── Memberships (owner, manager, cleaner)
  ├── Properties
  │     ├── Reservations
  │     ├── Calendar sources and outputs
  │     └── Operational assignments
  └── Tenant audit events
```

Every property, reservation, feed, guest form, message template, report, and
file reference must carry an authoritative tenant/property relationship. A
request must derive its tenant from the authenticated membership or a narrowly
scoped capability token; client-supplied tenant IDs are never sufficient.

## Role boundaries

- Owner: tenant-wide administration and export/deletion authority.
- Manager: only the tenants and properties explicitly granted.
- Cleaner: only assigned operational data; no guest documents or financial
  reporting by default.
- Guest: one reservation-scoped, expiring form capability.
- Public iCal: blocks-only output; never guest names or contact data.

## Required architectural checks before claiming multi-tenancy

1. Server-side authorization on every read, write, export, and file access.
2. No unscoped ORM query or fallback-to-first-tenant path.
3. Background jobs carry tenant/property context explicitly.
4. Cache keys, rate limits, logs, and error telemetry cannot cross tenants.
5. Capability links are expiring, revocable where practical, and minimal.
6. Tests cover cross-tenant IDs, revoked memberships, deleted properties,
   background jobs, iCal feeds, and exports.

## Unknowns

- The complete runtime authorization matrix is not established by README-level
  documentation alone.
- Storage isolation, cache isolation, and background-job context require a
  code-level audit before being treated as verified.
- No commercial or customer-specific requirements belong in this public file.

## Sources

- [`README.md`](../../README.md)
- [`package.json`](../../package.json)
