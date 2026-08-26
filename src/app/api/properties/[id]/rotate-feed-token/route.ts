import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isPropertyOwner } from "@/lib/ownership";
import { mintFeedToken } from "@/lib/feed-identity";

// GET /api/properties/[id]/rotate-feed-token — return current token (or null)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.impersonatorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { id } = await params;
    const numId = parseInt(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    if (!(await isPropertyOwner(numId, session.userId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const property = await prisma.property.findUnique({
      where: { id: numId },
      select: { feedToken: true },
    });
    if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      {
        feedToken: property.feedToken,
        requiresMigration: property.feedToken === null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/properties/[id]/rotate-feed-token — generate a new token and persist
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.impersonatorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { id } = await params;
    const numId = parseInt(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    if (!(await isPropertyOwner(numId, session.userId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const feedToken = mintFeedToken();
    const property = await prisma.property.update({
      where: { id: numId },
      data: { feedToken },
      select: { id: true, feedToken: true },
    });
    await logAudit(session.userId, "update", "property", numId, { feedTokenRotated: true });

    return NextResponse.json(property);
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Protected feeds cannot be downgraded to public. Existing token-null legacy
// rows are migrated only by an explicit owner rotation; this endpoint never
// creates new public exposure.
export async function DELETE() {
  return NextResponse.json(
    { error: "Feed tokens cannot be cleared" },
    { status: 405, headers: { Allow: "GET, POST" } },
  );
}
