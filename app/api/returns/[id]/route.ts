import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const ret = await prisma.return.findUnique({
    where: { id },
    include: {
      lineItems:  true,
      invoice:    { select: { id: true, invoiceNumber: true } },
      reservation: {
        select: {
          id: true, reservationNumber: true, startDate: true, endDate: true,
        },
      },
      tenant: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      createdBy:  { select: { firstName: true, lastName: true } },
      refundProcessedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!ret || ret.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Return not found" }, { status: 404 });

  return NextResponse.json({ return: serializeReturn(ret) });
}

function serializeReturn(ret: any) {
  return {
    id:              ret.id,
    returnNumber:    ret.returnNumber,
    returnFrom:      ret.returnFrom,
    returnTo:        ret.returnTo,
    returnDays:      ret.returnDays,
    returnType:      ret.returnType,
    returnAmount:    Number(ret.returnAmount).toFixed(3),
    refundRequired:  ret.refundRequired,
    refundAmount:    Number(ret.refundAmount).toFixed(3),
    refundStatus:    ret.refundStatus,
    refundMethod:    ret.refundMethod,
    refundReference: ret.refundReference,
    refundDate:      ret.refundDate,
    reason:          ret.reason,
    notes:           ret.notes,
    status:          ret.status,
    invoiceNumber:   ret.invoice?.invoiceNumber ?? null,
    reservation:     ret.reservation
      ? {
          id:                ret.reservation.id,
          reservationNumber: ret.reservation.reservationNumber,
          startDate:         ret.reservation.startDate,
          endDate:           ret.reservation.endDate,
        }
      : null,
    tenant: ret.tenant
      ? {
          id:        ret.tenant.id,
          firstName: ret.tenant.firstName,
          lastName:  ret.tenant.lastName,
          phone:     ret.tenant.phone,
        }
      : null,
    createdByName: ret.createdBy
      ? `${ret.createdBy.firstName ?? ""} ${ret.createdBy.lastName ?? ""}`.trim()
      : null,
    refundProcessedByName: ret.refundProcessedBy
      ? `${ret.refundProcessedBy.firstName ?? ""} ${ret.refundProcessedBy.lastName ?? ""}`.trim()
      : null,
    createdAt: ret.createdAt,
    lineItems: ret.lineItems.map((li: any) => ({
      id:          li.id,
      description: li.description,
      quantity:    Number(li.quantity),
      unitPrice:   Number(li.unitPrice).toFixed(3),
      lineTotal:   Number(li.lineTotal).toFixed(3),
    })),
  };
}
