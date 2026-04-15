import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { processRefund } from "@/lib/return-engine";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { amount, method, reference, notes } = body;

  if (!amount || Number(amount) <= 0)
    return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
  if (!method)
    return NextResponse.json({ error: "Payment method is required" }, { status: 400 });

  try {
    const updated = await processRefund({
      returnId:  id,
      orgId:     actor.organizationId!,
      userId:    actor.id,
      amount:    Number(amount),
      method,
      reference: reference ?? undefined,
      notes:     notes ?? undefined,
    });

    return NextResponse.json({
      success: true,
      return: {
        id:              updated.id,
        returnNumber:    updated.returnNumber,
        refundStatus:    updated.refundStatus,
        refundAmount:    Number(updated.refundAmount).toFixed(3),
        refundMethod:    updated.refundMethod,
        refundReference: updated.refundReference,
        refundDate:      updated.refundDate,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Refund processing failed";
    console.error("[POST /api/returns/[id]/refund]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
