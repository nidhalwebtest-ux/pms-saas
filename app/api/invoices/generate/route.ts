import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { generateInvoicesForReservation } from "@/lib/invoice-engine";

function ser(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      v != null && typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function"
        ? Number(v)
        : v,
    ),
  );
}

// ── POST /api/invoices/generate ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  let body: { reservationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { reservationId } = body;
  if (!reservationId) {
    return NextResponse.json({ error: "reservationId is required" }, { status: 400 });
  }

  // Verify reservation belongs to this org
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, tenant: { organizationId: orgUser.organizationId } },
    select: { id: true },
  });
  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  try {
    const result = await generateInvoicesForReservation(
      reservationId,
      orgUser.organizationId,
      orgUser.userId,
    );
    return NextResponse.json(ser(result), { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/invoices/generate]", err);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
