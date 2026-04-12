import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

function ser(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      v != null && typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function"
        ? Number(v)
        : v,
    ),
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      tenant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullNameArabic: true,
          phone: true,
          idType: true,
          idNumber: true,
          nationalId: true,
          organizationId: true,
        },
      },
      allocations: {
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              periodStart: true,
              periodEnd: true,
              reservationId: true,
              totalAmount: true,
              amountPaid: true,
              balanceDue: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      receivedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.tenant.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json({ payment: ser(payment) });
}
