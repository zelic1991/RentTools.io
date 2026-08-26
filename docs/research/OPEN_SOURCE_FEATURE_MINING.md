# Open-source feature mining

STATUS: DRAFT
VERIFIED_AT: 2026-08-26
SCOPE: Public technical inventory and candidate reuse areas
CONTACT_SENT: NO

This document records reusable technical areas visible in the current public
repository. It is not a promise that a dependency is production-ready for a
new workflow.

| Area | Current evidence | Candidate reuse | Validation still required |
| --- | --- | --- | --- |
| Web application | Next.js, React, TypeScript | tenant-aware web UI and server routes | authorization and server-side data boundaries |
| Data layer | Prisma with SQLite/libSQL adapter | property, reservation, and operational records | migrations, indexes, retention, backup/restore |
| Calendar | iCal feeds and combined property output | feed import/export and conflict detection | loop prevention, stale-feed handling, provenance |
| Roles | owner, co-host/manager, cleaner and guest flows documented | least-privilege role model | route-by-route authorization tests |
| Guest forms | one-time reservation-scoped links documented | check-in data collection | expiry, replay protection, PII minimization |
| OCR | Gemini-based passport extraction documented | optional structured extraction | consent, retention, provider boundaries, failure handling |
| Reporting | occupancy, ADR, revenue and CSV export documented | owner reporting | tenant scoping and financial-data access |
| UI primitives | Base UI, Tailwind, class utilities, Lucide, Recharts | consistent accessible operations UI | bundle size, accessibility, mobile behavior |
| Observability | Sentry dependency and health surface documented | operational diagnostics | PII scrubbing and tenant context |

## Rules

- Prefer existing repository capabilities only after reading their actual
  implementation and tests.
- Do not copy provider-specific code or data without checking its license and
  terms.
- Do not introduce a new integration merely because a package is available.
- Keep customer names, contact details, commercial research, and private
  operating notes out of this public document.

## Sources

- [`README.md`](../../README.md)
- [`package.json`](../../package.json)
- [`docs/SECURITY-AUDIT.md`](../SECURITY-AUDIT.md)
