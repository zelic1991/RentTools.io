import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  guestFindUnique: vi.fn(),
  guestUpdate: vi.fn(),
  guestDelete: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({ canManageProperty: mocks.canManageProperty }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    guest: {
      findUnique: mocks.guestFindUnique,
      update: mocks.guestUpdate,
      delete: mocks.guestDelete,
    },
  },
}));

import { PATCH } from "./route";

const guestId = 7;
const reservationId = 20;

function request(parentId: unknown) {
  return patchRequest({ parentId });
}

function patchRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/guests/${guestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params() {
  return { params: Promise.resolve({ id: String(guestId) }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 3, role: "user" });
  mocks.canManageProperty.mockResolvedValue(true);
  mocks.guestFindUnique.mockImplementation(async ({ where }) => {
    if (where.id === guestId) {
      return {
        id: guestId,
        reservationId,
        parentId: null,
        reservation: { propertyId: 12 },
      };
    }
    return null;
  });
  mocks.guestUpdate.mockImplementation(async ({ data }) => ({ id: guestId, ...data }));
  mocks.logAudit.mockResolvedValue(undefined);
});

describe("PATCH /api/guests/:id parent authority", () => {
  it("allows clearing parentId", async () => {
    const response = await PATCH(request(null), params());

    expect(response.status).toBe(200);
    expect(mocks.guestUpdate).toHaveBeenCalledWith({
      where: { id: guestId },
      data: { parentId: null },
    });
  });

  it("audits only changed field names and never copies guest values", async () => {
    const response = await PATCH(
      patchRequest({
        fullName: "Ana Horvat",
        passportNumber: "P 123 456",
        visaNumber: "VISA-999",
        dateOfBirth: "1990-05-20",
        expiryDate: "2030-05-20",
        citizenshipCode: "HRV",
        phone: "+43 699 123 456",
        notes: "Allergy and private arrival details",
      }),
      params(),
    );

    expect(response.status).toBe(200);
    expect(mocks.guestUpdate).toHaveBeenCalledWith({
      where: { id: guestId },
      data: expect.objectContaining({
        fullName: "Ana Horvat",
        passportNumber: "P123456",
        visaNumber: "VISA-999",
      }),
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(
      3,
      "update",
      "guest",
      guestId,
      {
        changedFields: [
          "citizenshipCode",
          "dateOfBirth",
          "expiryDate",
          "fullName",
          "notes",
          "passportNumber",
          "phone",
          "visaNumber",
        ],
      },
    );
    const auditPayload = JSON.stringify(mocks.logAudit.mock.calls[0][4]);
    expect(auditPayload).not.toContain("Ana Horvat");
    expect(auditPayload).not.toContain("P123456");
    expect(auditPayload).not.toContain("VISA-999");
    expect(auditPayload).not.toContain("1990-05-20");
    expect(auditPayload).not.toContain("699123456");
    expect(auditPayload).not.toContain("Allergy");
  });

  it("allows a parent from the same reservation", async () => {
    mocks.guestFindUnique.mockImplementation(async ({ where }) => {
      if (where.id === guestId) {
        return { id: guestId, reservationId, reservation: { propertyId: 12 } };
      }
      if (where.id === 8) return { id: 8, reservationId, parentId: null };
      return null;
    });

    const response = await PATCH(request(8), params());

    expect(response.status).toBe(200);
    expect(mocks.guestUpdate).toHaveBeenCalledWith({
      where: { id: guestId },
      data: { parentId: 8 },
    });
  });

  it.each([
    ["arbitrary", 999],
    ["cross-reservation", 8],
    ["self", guestId],
    ["non-integer", 8.5],
  ])("rejects a %s parentId", async (kind, parentId) => {
    if (kind === "cross-reservation") {
      mocks.guestFindUnique.mockImplementation(async ({ where }) => {
        if (where.id === guestId) {
          return { id: guestId, reservationId, reservation: { propertyId: 12 } };
        }
        return { id: 8, reservationId: 21, parentId: null };
      });
    }

    const response = await PATCH(request(parentId), params());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid parentId" });
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
  });

  it("rejects a parent chain that points back to the edited guest", async () => {
    mocks.guestFindUnique.mockImplementation(async ({ where }) => {
      if (where.id === guestId) {
        return { id: guestId, reservationId, reservation: { propertyId: 12 } };
      }
      if (where.id === 8) return { id: 8, reservationId, parentId: 9 };
      if (where.id === 9) return { id: 9, reservationId, parentId: guestId };
      return null;
    });

    const response = await PATCH(request(8), params());

    expect(response.status).toBe(400);
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
  });
});
