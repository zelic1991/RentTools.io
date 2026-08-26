# Zelic RentTools V1 Production Freeze

Freeze date: 2026-08-26
Freeze head: `10d0dd5a0491f5c74da3ed28f65a205181a1a903`

```text
PRODUCT_STATUS = PRODUCTION_READY
OWN_OPERATION = READY
NEW_FEATURE_DEVELOPMENT = FROZEN
```

This document records the accepted RentTools V1 baseline for Zelic Family Vir. The freeze applies to RentTools V1 code and its operating rules. Known external portal defects remain separate operational or support topics and are not RentTools runtime defects.

## Accepted production state

### RentTools

- Production is running on the freeze head.
- `/api/health` passes and reports a healthy database.
- SQLite integrity and foreign-key checks pass.
- `CalendarLink.bufferBefore` and `CalendarLink.bufferAfter` default to `0`/`0`; existing stored values remain authoritative.
- The application service and nginx pass their runtime checks.
- Port 3000 is bound to loopback only.
- Local database backup and encrypted offsite backup pass.
- The restore procedure has been proven.
- Airbnb and Booking input feeds pass.
- Desktop, mobile, dashboard, calendar, cleaning, guests and pre-check-in pass.
- Reports are functional.

### Canonical operating data

Confirmed reservations:

| Source | Stay |
| --- | --- |
| Direct Poland | 2027-05-16 to 2027-05-28 |
| Booking | 2027-06-30 to 2027-07-04 |
| Direct Zagreb | 2027-08-07 to 2027-08-17 |

Availability blocks:

| Source | Block |
| --- | --- |
| Airbnb | 2026-08-24 to 2026-09-11 |
| Winter | 2026-10-16 to 2027-05-01 |

All ranges use checkout-exclusive semantics: the end date is the checkout date and is not a blocked night. The accepted internal reconciliation has `MISSING = 0` and `DUPLICATES = 0`.

## Booking manual-hold operating procedure

Manual Booking holds follow one canonical process:

1. Block the period in Booking first.
2. Block the same period manually in RentTools.
3. RentTools distributes that availability block to connected destination calendars.
4. If the request is not confirmed, reopen both Booking and RentTools.
5. Use an operational reminder so a temporary hold is reviewed and not forgotten.

Booking remains configured to export **Nur gebuchte Daten** (booked dates only). RentTools V1 does not automatically import Booking manual blocks. A controlled feed comparison showed that Booking iCal does not distinguish confirmed reservations from manual closures reliably enough for safe automatic classification. This deliberate non-automation is part of the V1 freeze.

### Current Booking hold

- Hold: 2027-07-18 to 2027-08-06
- Blocked nights: 2027-07-18 through 2027-08-05
- 2027-08-06: free checkout date
- Review reminder: 2026-09-05

The reminder is not a `Reservation`, `CalendarEvent` or iCal event. The reminder function itself does not create a `DateOverride`; it is an operational task only. The availability hold in RentTools is stored separately as an explicit manual block, in accordance with the operating procedure above.

## External channels

- **Airbnb:** calendar operation passes.
- **Booking:** the Poland stay is blocked correctly and checkout semantics are correct.
- **Laganini:** calendar passes.
- **Ubytovani:** a known external portal/access remainder is still open. RentTools must not be distorted to compensate for it.

Known Booking metadata remainders are a publicly incorrect address and distance text. They are Booking/support topics, not RentTools code blockers.

## Website

`zelicfamilyvir.com` is functional. Desktop, mobile, navigation, images and form validation pass; seven languages are available. No new design round is planned. Live RentTools availability is not currently required to be the website's availability SSOT.

## Deliberately deferred from V1

- automatic Booking manual-block import
- full tenant architecture
- automatic eVisitor submission
- payments
- dynamic pricing
- Nuki integration
- Airbnb Partner API
- Booking Connectivity API
- marketplace functionality
- complex accounting
- repository-wide lint cleanup
- cosmetic `/health` alias

## Freeze rule

Reopen V1 code work only for:

- **P1:** double-booking risk, data loss, security/authentication bypass or broken production operation.
- **P2:** a real operational workflow failure, feed/sync error, role/permission error or backup/restore failure.

Do not reopen V1 for cosmetic requests, theoretical architecture improvements or new features without real user need. New product work must come from actual owner operation, real customer feedback or the first external-owner operation.

## Target state

```text
ZELIC_RENTTOOLS_V1_PRODUCTION_FREEZE

FREEZE_HEAD = 10d0dd5a0491f5c74da3ed28f65a205181a1a903
PRODUCT_STATUS = PRODUCTION_READY
OWN_OPERATION = READY
NEW_FEATURE_DEVELOPMENT = FROZEN
```

Next phase:

- use the system;
- observe real operating data;
- resolve external portal remainders separately;
- onboard the first external owners;
- derive V1.1 only from real problems and feedback.

## Next product goal: shared messages inbox

The next product goal is a property-scoped messages inbox for Owner and
Manager operations. This is a planned follow-up, not part of the frozen V1
baseline.

The smallest useful scope is:

- a `Conversation` and `Message` model with Owner/Property isolation;
- an inbox for authorized Owner and Manager users;
- optional links from a conversation to a Property, Reservation and Guest;
- Website and e-mail inquiries as the first inbound source;
- open, read, answered and closed states;
- an audit trail for reads and replies;
- continued reuse of the existing `MessageTemplate` model.

Airbnb and Booking messaging APIs, automatic external replies, CRM features
and marketing automation remain out of scope until the required account or
partner capabilities are verified.

## Evidence boundaries

This freeze does not claim that:

- Ubytovani is fully green;
- the Booking address or distance text has been corrected;
- production logout/re-login has been fully proven;
- repository-wide ESLint is green.

These known boundaries do not block the accepted Zelic RentTools V1 production baseline.
