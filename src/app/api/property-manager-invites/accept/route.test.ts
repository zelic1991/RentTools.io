import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  inviteFindUnique: vi.fn(),
  inviteUpdateMany: vi.fn(),
  managerFindUnique: vi.fn(),
  managerUpsert: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    propertyManagerInvite: {
      findUnique: mocks.inviteFindUnique,
      updateMany: mocks.inviteUpdateMany,
    },
    propertyManager: {
      findUnique: mocks.managerFindUnique,
      upsert: mocks.managerUpsert,
    },
  },
}));

import { POST } from "./route";

type InviteState = {
  id: number;
  propertyId: number;
  createdById: number;
  acceptedById: number | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  property: { id: number; name: string; userId: number };
};

let invite: InviteState;
let managerIds: Set<number>;

function request() {
  return new NextRequest("http://localhost/api/property-manager-invites/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "single-use-token" }),
  });
}

function installStatefulStore() {
  mocks.inviteFindUnique.mockImplementation(async () => ({ ...invite }));
  mocks.inviteUpdateMany.mockImplementation(async ({ data }) => {
    const claimable =
      invite.acceptedById === null &&
      invite.acceptedAt === null &&
      invite.revokedAt === null &&
      invite.expiresAt > new Date();
    if (!claimable) return { count: 0 };
    invite = { ...invite, ...data };
    return { count: 1 };
  });
  mocks.managerFindUnique.mockImplementation(async ({ where }) => {
    const id = where.managerId_propertyId.managerId;
    return managerIds.has(id) ? { id: id + 100 } : null;
  });
  mocks.managerUpsert.mockImplementation(async ({ where }) => {
    const id = where.managerId_propertyId.managerId;
    managerIds.add(id);
    return { id: id + 100 };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  invite = {
    id: 40,
    propertyId: 12,
    createdById: 1,
    acceptedById: null,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    property: { id: 12, name: "Villa", userId: 1 },
  };
  managerIds = new Set();
  mocks.logAudit.mockResolvedValue(undefined);
  installStatefulStore();
});

describe("POST /api/property-manager-invites/accept", () => {
  it("allows only one of two users racing the same invite to become manager", async () => {
    mocks.getSession
      .mockResolvedValueOnce({ userId: 5, role: "user" })
      .mockResolvedValueOnce({ userId: 6, role: "user" });

    // Hold both initial reads until each caller has observed the same stale,
    // unclaimed invite. This exercises the CAS rather than lucky sequencing.
    let reads = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => { release = resolve; });
    mocks.inviteFindUnique.mockImplementation(async () => {
      if (reads < 2) {
        const snapshot = { ...invite };
        reads += 1;
        if (reads === 2) release();
        await bothRead;
        return snapshot;
      }
      return { ...invite };
    });

    const responses = await Promise.all([POST(request()), POST(request())]);
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([200, 410]);
    expect(invite.acceptedById).not.toBeNull();
    expect(managerIds).toEqual(new Set([invite.acceptedById as number]));
    expect(mocks.inviteUpdateMany).toHaveBeenCalledTimes(2);
    expect(mocks.managerUpsert).toHaveBeenCalledOnce();
    expect(mocks.logAudit).toHaveBeenCalledOnce();
  });

  it("repairs a missing manager row when the recorded accepter retries", async () => {
    invite.acceptedById = 5;
    invite.acceptedAt = new Date();
    mocks.getSession.mockResolvedValue({ userId: 5, role: "user" });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ action: "already_accepted" });
    expect(mocks.inviteUpdateMany).not.toHaveBeenCalled();
    expect(managerIds).toEqual(new Set([5]));
    expect(mocks.logAudit).toHaveBeenCalledWith(
      5,
      "create",
      "manager",
      40,
      { action: "invite_acceptance_recovered", propertyId: 12 },
    );
  });

  it("does not grant a retry to anyone except the recorded accepter", async () => {
    invite.acceptedById = 5;
    invite.acceptedAt = new Date();
    mocks.getSession.mockResolvedValue({ userId: 6, role: "user" });

    const response = await POST(request());

    expect(response.status).toBe(410);
    expect(mocks.managerUpsert).not.toHaveBeenCalled();
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });

  it.each([
    ["revoked", { revokedAt: new Date() }],
    ["expired", { expiresAt: new Date(Date.now() - 1) }],
  ])("fails closed for a %s invite", async (_label, state) => {
    invite = { ...invite, ...state };
    mocks.getSession.mockResolvedValue({ userId: 5, role: "user" });

    const response = await POST(request());

    expect(response.status).toBe(410);
    expect(mocks.inviteUpdateMany).not.toHaveBeenCalled();
    expect(mocks.managerUpsert).not.toHaveBeenCalled();
  });
});
