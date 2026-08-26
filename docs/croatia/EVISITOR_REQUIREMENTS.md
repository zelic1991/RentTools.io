# Croatia: eVisitor and registration boundary

STATUS: RESEARCH / NOT LEGAL ADVICE
VERIFIED_AT: 2026-08-26
SCOPE: Current public requirements relevant to product architecture
CONTACT_SENT: NO

## Verified current facts

- Croatia's eVisitor is the official online system for tourist registration and
  deregistration and for tourist-tax administration.
- The official system supports commercial accommodation providers, including
  private lessors, and also has a separate category for non-commercial holiday
  homes/apartments.
- The Ministry of Tourism and Sport states that a registration number for
  short-term-rental listings is expected to become mandatory at the beginning
  of 2027. The exact date and final implementation depend on the new law.
- The Ministry states that the registration number is not currently required
  for online advertising as of the cited notice.

## Architecture consequences

1. RentTools should model eVisitor as an external authority, not as an
   internal substitute for the official system.
2. An initial Croatia workflow should support owner-controlled export,
   controlled manual entry, and an auditable status such as
   `NOT_CONNECTED`, `OWNER_CONFIRMED`, or `EXTERNAL_SYSTEM_REQUIRED`.
3. No direct eVisitor API integration should be claimed until an official,
   permitted interface and authentication model are verified.
4. Registration-number fields should be designed as future-compatible metadata,
   with an explicit status and source date; they must not be fabricated.
5. Guest identity data requires strict minimization, access control, retention,
   export, and deletion handling.

## Unknowns and stop conditions

- The exact 2027 legal implementation and technical interface are not fixed by
  this document.
- The product must not automatically submit guest data to eVisitor without
  confirmed authority, consent/role basis, and an approved integration path.
- This document does not replace advice from the relevant Croatian authority or
  a qualified legal adviser.

## Sources

- [Croatian Ministry: eVisitor](https://mints.gov.hr/e-usluge/sustav-za-prijavu-i-odjavu-gostiju/21663)
- [Official eVisitor login and account categories](https://www.evisitor.hr/eVisitor/en-US/Account/Login)
- [Ministry notice on the 2027 registration number](https://mints.gov.hr/vijesti/vazna-informacija-izdavanje-registracijskog-broja/24298)
