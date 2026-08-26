# Property OS reuse map

VERIFIED_AT: 2026-08-26

EXACT_HEAD: `88ff2aacbba4a2125c4d63ad6d090518b2ec37cb`

Decision order: `REUSE RENTTOOLS > REUSE OSS > EXTEND > REFACTOR > NEW BUILD`.

| Feature | Classification | Existing implementation / tests | What remains | Wave |
| --- | --- | --- | --- | --- |
| Property/reservation/iCal core | `EXISTING_AND_REUSABLE` | Prisma entities, APIs, linked-source identity, conflicts, feed and checkout tests | Uniform property authority and reservation lifecycle | 1, 2, 5 |
| Property policy helpers | `EXTENDED_LOCAL_GREEN` | Central owner/manager/cleaner policy plus three-owner isolation/revocation test | Continue routing new endpoints through the same helpers | 1 |
| Auth/password/Google/JWT | `EXISTING_NEEDS_REFACTOR` | `auth.ts`, login and account flows | Session freshness/revocation and global impersonation mutation gate | 0, 1, 17 |
| Tenant/Membership/Unit | `DEFERRED_FOR_FIRST_CUSTOMER` | Existing Owner + Property + scoped assignment graph already supports multiple owners/apartments | Add only for a proven building/unit hierarchy, with atomic rewiring of every authority path | 1 |
| Desktop property switcher/portfolio | `EXISTING_AND_REUSABLE` | Top bar, switcher, global cleaning/reports | Property/status/source filters | 2 |
| Mobile shell/PWA | `EXISTING_NEEDS_REFACTOR` | Installable shell, mobile calendar/guests/portals and tests | Generic brand, explicit property/unit switch, closed mobile flows | 2, 19 |
| Guest pre-check-in | `EXTENDED_LOCAL_GREEN` | Hash/expiry/revoke/encryption, atomic submit, canonical status/audit and protected manual handoff | Deployed acceptance; never infer production submit authority | 1, 10, 12 |
| eVisitor builder/test client | `MANUAL_BOUNDARY_LOCAL_GREEN` | Validated encrypted payload, protected handoff, manual confirmation audit | Production adapter/credentials remain explicitly deferred | 10 |
| Cleaning computation | `EXISTING_NEEDS_REFACTOR` | Turnover/buffer/conflict calculations and assignments | Shared stay core and persistent CleaningJob workflow | 3 |
| CleaningRecord | `MVP_WORKFLOW_LOCAL_GREEN` | Persistent PLANNED/ASSIGNED/IN_PROGRESS/READY/ISSUE workflow and mobile actions | Photos/checklists/quality review are Priority B/later | 3 |
| Pricing SSOT | `MISSING` | Only `minNights` | Complete audited money/rate/season/fee model | 4 |
| Occupancy/channel reports | `EXISTING_NEEDS_REFACTOR` | Recharts, periods, linked-stay dedupe, CSV | Tenant policy, available-night truth and server aggregates | 1, 14 |
| Stored gross revenue summary | `MVP_LOCAL_GREEN` | Optional integer cents/currency, API validation, owner edit and explicit-known totals | Not ADR, pricing, payments, commission or accounting | 4, 6, 14 |
| iCal parser/generator | `EXISTING_NEEDS_REFACTOR` | Parser, generator and tests | Recurrence, timezone, cancellation and hostile input | 0B, 9, 17 |
| Calendar sync | `EXTENDED_LOCAL_GREEN` | Scoped execution plus HTTPS/redirect/DNS-rebinding/private-address/size guard | Stable-UID updates and persistent multi-process job lease remain | 1, 9, 17 |
| Sync serialization | `EXISTING_NEEDS_REFACTOR` | In-process FIFO gate and tests | Persistent lease, idempotency and multi-process safety | 1, 15 |
| Anonymous outbound feeds | `SECURE_DEFAULT_FOR_NEW_RECORDS` | PII-free summaries, hashed UIDs, random slug+token for Property and Draft, claim-stable URL | Legacy null-token Properties require explicit migration before admission | 1, 9, 17 |
| Channel adapter contract | `MISSING` | iCal transport is directly coupled to Prisma | Capability interface, IcalAdapter and mock OTA adapters | 9 |
| Maintenance/issues | `MISSING` | No operational implementation found | Model, roles, uploads and workflow | 13 |
| Local SQLite backup/restore | `EXISTING_AND_REUSABLE` | Integrity check, tiering, restore drill | Tenant lifecycle, file/orphan coverage, isolated restore evidence | 16 |
| Offsite OCB backup | `EXISTING_AND_REUSABLE` | Authenticated format, queue and CI manipulation matrix | Remote rollback ledger is a separate Owner decision | 16 |
| Sentry/health/Recharts | `EXISTING_AND_REUSABLE` | Existing dependencies and runtime surfaces | Tenant-aware redaction/metrics only where needed | 14, 15 |
| OSS candidate evaluation | `PREWORK_ONLY` | `docs/research/OPEN_SOURCE_FEATURE_MINING.md` | Concrete version/license/security/fit decisions | 0B |

## Rules for subsequent work

- Do not introduce a parallel calendar, reservation, guest, cleaner or mobile
  architecture.
- Do not trust a client-supplied tenant/property/unit ID without deriving and
  checking membership server-side.
- Do not build a fifth stay-normalization implementation. Consolidate the four
  existing variants behind one tested core.
- Do not treat architecture documents, README claims or unused helpers as
  runtime proof.
- Any external dependency must first appear in the Welle 0B candidate matrix
  with version/commit, license, maintenance, security, PII/tenant impact and an
  exit strategy.
