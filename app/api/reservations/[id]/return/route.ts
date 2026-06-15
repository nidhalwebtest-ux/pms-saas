import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  previewDailyReturn,
  previewMonthlyReturn,
  executeDailyReturn,
  executeMonthlyReturn,
} from "@/lib/return-engine";

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { id: true, organizationId: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

/** GET — preview a return (calculate amounts without committing) */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const newCheckoutDate = searchParams.get("newCheckoutDate");
  const rateOverrideRaw = searchParams.get("rateOverride");
  const rateOverride    = rateOverrideRaw && Number.isFinite(Number(rateOverrideRaw))
    ? Number(rateOverrideRaw)
    : undefined;

  if (!newCheckoutDate)
    return NextResponse.json({ error: "newCheckoutDate is required" }, { status: 400 });

  const res = await prisma.reservation.findUnique({
    where:  { id },
    select: { rateType: true, tenant: { select: { organizationId: true } } },
  });
  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

  const isMonthly = res.rateType === "monthly" || res.rateType === "MONTHLY";

  try {
    const preview = isMonthly
      ? await previewMonthlyReturn({
          reservationId:   id,
          orgId:           actor.organizationId!,
          newCheckoutDate: new Date(newCheckoutDate),
        })
      : await previewDailyReturn({
          reservationId:   id,
          orgId:           actor.organizationId!,
          newCheckoutDate: new Date(newCheckoutDate),
          rateOverride,
        });

    return NextResponse.json({ preview });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Preview failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** POST — execute the return (creates return record + checks out reservation) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("returns", "CREATE");
  if (__denied) return __denied;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { newCheckoutDate, reason, notes, rateOverride } = body;
  const rateOverrideNum = rateOverride !== undefined && Number.isFinite(Number(rateOverride))
    ? Number(rateOverride)
    : undefined;

  if (!newCheckoutDate)
    return NextResponse.json({ error: "newCheckoutDate is required" }, { status: 400 });
  if (!reason)
    return NextResponse.json({ error: "reason is required" }, { status: 400 });

  const res = await prisma.reservation.findUnique({
    where:  { id },
    select: {
      rateType: true,
      status:   true,
      tenant: { select: { organizationId: true } },
    },
  });
  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

  if (res.status !== "CHECKED_IN")
    return NextResponse.json(
      { error: "Returns can only be processed for checked-in reservations" },
      { status: 409 },
    );

  const isMonthly = res.rateType === "monthly" || res.rateType === "MONTHLY";

  try {
    const ret = isMonthly
      ? await executeMonthlyReturn({
          reservationId:   id,
          orgId:           actor.organizationId!,
          userId:          actor.id,
          newCheckoutDate: new Date(newCheckoutDate),
          reason,
          notes,
        })
      : await executeDailyReturn({
          reservationId:   id,
          orgId:           actor.organizationId!,
          userId:          actor.id,
          newCheckoutDate: new Date(newCheckoutDate),
          reason,
          notes,
          rateOverride: rateOverrideNum,
        });

    return NextResponse.json({
      success:       true,
      return:        serializeReturn(ret),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Return processing failed";
    console.error("[POST /api/reservations/[id]/return]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

function serializeReturn(ret: any) {
  return {
    id:             ret.id,
    returnNumber:   ret.returnNumber,
    returnFrom:     ret.returnFrom,
    returnTo:       ret.returnTo,
    returnDays:     ret.returnDays,
    returnType:     ret.returnType,
    returnAmount:   Number(ret.returnAmount).toFixed(3),
    refundRequired: ret.refundRequired,
    refundAmount:   Number(ret.refundAmount).toFixed(3),
    refundStatus:   ret.refundStatus,
    reason:         ret.reason,
    notes:          ret.notes,
    lineItems:      (ret.lineItems ?? []).map((li: any) => ({
      id:          li.id,
      description: li.description,
      quantity:    Number(li.quantity),
      unitPrice:   Number(li.unitPrice).toFixed(3),
      lineTotal:   Number(li.lineTotal).toFixed(3),
    })),
  };
}
