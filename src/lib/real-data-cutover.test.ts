import { describe, expect, it } from "vitest";
import {
  buildRealDataCutoverPlan,
  type AuthorityReservation,
  type CurrentReservation,
} from "./real-data-cutover";
import { buildDirectReservationExternalKey } from "./reservation-external-key";

const directKey = buildDirectReservationExternalKey({
  propertyId: 1,
  checkIn: "2027-05-16",
  checkOut: "2027-05-28",
  ownerSource: { kind: "owner-chat", recordedOn: "2026-08-25", sequence: 1 },
});

const direct: AuthorityReservation = {
  source: "direct",
  externalKey: directKey,
  propertyId: 1,
  checkIn: "2027-05-16",
  checkOut: "2027-05-28",
  status: "confirmed",
  evidenceSource: "owner-confirmed chat",
};

describe("real data cutover planner", () => {
  it("fails closed on ambiguous or impossible dates", () => {
    expect(() =>
      buildRealDataCutoverPlan([{ ...direct, checkIn: "05/16/2027" }], [], {
        durableDirectExternalKeyStorage: true,
      }),
    ).toThrow(/YYYY-MM-DD/);
    expect(() =>
      buildRealDataCutoverPlan([{ ...direct, checkIn: "2027-02-30" }], [], {
        durableDirectExternalKeyStorage: true,
      }),
    ).toThrow(/real calendar day/);
  });

  it("uses checkout-exclusive overlap rules and allows same-day turnover", () => {
    const next: AuthorityReservation = {
      ...direct,
      externalKey: buildDirectReservationExternalKey({
        propertyId: 1,
        checkIn: "2027-05-28",
        checkOut: "2027-06-02",
        ownerSource: { kind: "owner-chat", recordedOn: "2026-08-25", sequence: 2 },
      }),
      checkIn: "2027-05-28",
      checkOut: "2027-06-02",
    };
    const plan = buildRealDataCutoverPlan([direct, next], [], {
      durableDirectExternalKeyStorage: true,
    });
    expect(plan.summary.wouldConflict).toBe(0);
    expect(plan.summary.wouldCreate).toBe(2);
  });

  it("does not auto-import overlapping confirmed reservations", () => {
    const overlapping: AuthorityReservation = {
      ...direct,
      source: "booking",
      externalKey: "BOOKING:EXAMPLE-1",
      checkIn: "2027-05-20",
      checkOut: "2027-05-24",
    };
    const plan = buildRealDataCutoverPlan([direct, overlapping], [], {
      durableDirectExternalKeyStorage: true,
    });
    expect(plan.summary.wouldConflict).toBe(2);
    expect(plan.rows.every((row) => row.proposedAction === "MANUAL_REVIEW")).toBe(true);
  });

  it("is idempotent when the stable external key is durably stored", () => {
    const first = buildRealDataCutoverPlan([direct], [], {
      durableDirectExternalKeyStorage: true,
    });
    expect(first.rows[0].proposedAction).toBe("CREATE");

    const afterFirstApply: CurrentReservation[] = [
      {
        id: 99,
        propertyId: 1,
        platform: "direct",
        checkIn: direct.checkIn,
        checkOut: direct.checkOut,
        externalKey: direct.externalKey,
      },
    ];
    const second = buildRealDataCutoverPlan([direct], afterFirstApply, {
      durableDirectExternalKeyStorage: true,
    });
    expect(second.rows[0].proposedAction).toBe("KEEP");
    expect(second.summary.wouldCreate).toBe(0);
  });

  it("scopes duplicate identity by property and platform", () => {
    const booking: AuthorityReservation = {
      ...direct,
      source: "booking",
      externalKey: "BOOKING:SHARED-RESERVATION-ID",
    };
    const sameKeyOtherProperty: AuthorityReservation = {
      ...booking,
      propertyId: 2,
      checkIn: "2027-06-01",
      checkOut: "2027-06-02",
    };
    const plan = buildRealDataCutoverPlan([booking, sameKeyOtherProperty], [], {
      durableDirectExternalKeyStorage: true,
    });
    expect(plan.summary.wouldCreate).toBe(2);
    expect(plan.summary.wouldConflict).toBe(0);
  });

  it("blocks Direct creation when durable external-key storage is absent", () => {
    const plan = buildRealDataCutoverPlan([direct], [], {
      durableDirectExternalKeyStorage: false,
    });
    expect(plan.rows[0].proposedAction).toBe("MANUAL_REVIEW");
    expect(plan.rows[0].reason).toMatch(/no durable Direct external-key field/);
  });

  it("rejects guest PII in a migration manifest", () => {
    const withPii = { ...direct, passportNumber: "forbidden" } as AuthorityReservation;
    expect(() =>
      buildRealDataCutoverPlan([withPii], [], { durableDirectExternalKeyStorage: true }),
    ).toThrow(/Guest PII field is forbidden/);
  });

  it("classifies blocks and owner stays as availability evidence", () => {
    const plan = buildRealDataCutoverPlan(
      [
        {
          ...direct,
          source: "airbnb",
          externalKey: "AIRBNB:BLOCK-1",
          status: "blocked",
        },
        {
          ...direct,
          externalKey: buildDirectReservationExternalKey({
            propertyId: 1,
            checkIn: direct.checkIn,
            checkOut: direct.checkOut,
            ownerSource: { kind: "owner-chat", recordedOn: "2026-08-25", sequence: 3 },
          }),
          status: "owner-stay",
        },
      ],
      [],
      { durableDirectExternalKeyStorage: false },
    );
    expect(plan.summary.realConfirmedUnique).toBe(0);
    expect(plan.rows.every((row) => row.proposedAction === "MANUAL_REVIEW")).toBe(true);
  });
});
