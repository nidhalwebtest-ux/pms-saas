import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getUnitPriceForRange } from "@/lib/pricing";
import { roundOMR, calculateNights, countCalendarMonths } from "@/lib/reservation-engine";
import { nextInvoiceNumber } from "@/lib/invoice-engine";

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, organizationId: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

interface ExtendBody {
  newCheckOutDate: string;
  unitExtensions: Array<{ unitId: string; extend: boolean }>;
  /** Custom rate overrides keyed by unitId — user-entered in the modal */
  customRates?: Record<string, number>;
  payment?: { amount: number; method: string; reference?: string };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("reservations", "CREATE");
  if (__denied) return __denied;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: ExtendBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { newCheckOutDate, unitExtensions, customRates = {}, payment } = body;
  if (!newCheckOutDate || !unitExtensions || !Array.isArray(unitExtensions)) {
    return NextResponse.json({ error: "newCheckOutDate and unitExtensions are required" }, { status: 400 });
  }

  // NOTE: isMovedOut: { not: true } matches both false AND null (legacy records)
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant: { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: {
        where: { isMovedOut: { not: true } },
        include: { unit: { select: { id: true, name: true, propertyId: true } } },
      },
    },
  });

  if (!r || r.tenant.organizationId !== actor.organizationId) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const originalEndDate = new Date(r.endDate);
  originalEndDate.setHours(0, 0, 0, 0);
  const newCheckOut = new Date(newCheckOutDate);
  newCheckOut.setHours(0, 0, 0, 0);

  if (newCheckOut <= originalEndDate) {
    return NextResponse.json(
      { error: "New checkout date must be after current checkout date" },
      { status: 400 },
    );
  }

  const extensionMap = new Map<string, boolean>();
  for (const ue of unitExtensions) extensionMap.set(ue.unitId, ue.extend);

  // Verify availability + compute pricing outside the transaction
  const extendedUnitPricings = new Map<string, {
    additionalNights:   number;
    additionalSubtotal: number;
    quantity:           number;
    unitPrice:          number;
    unitName:           string;
    isMonthly:          boolean;
  }>();

  for (const ru of r.reservationUnits) {
    const shouldExtend = extensionMap.get(ru.unitId) ?? false;
    if (!shouldExtend) continue;

    const extensionStart = ru.effectiveCheckOut ? new Date(ru.effectiveCheckOut) : new Date(r.endDate);
    extensionStart.setHours(0, 0, 0, 0);

    // Re-check availability
    const conflict = await prisma.reservation.findFirst({
      where: {
        id:     { not: id },
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
        OR: [
          {
            unitId:    ru.unitId,
            startDate: { lt: newCheckOut },
            endDate:   { gt: extensionStart },
          },
          {
            reservationUnits: {
              some: { unitId: ru.unitId, isMovedOut: { not: true } },
            },
            startDate: { lt: newCheckOut },
            endDate:   { gt: extensionStart },
          },
        ],
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: `Unit ${ru.unit.name} is not available for the requested extension period` },
        { status: 409 },
      );
    }

    // Determine extension rate (custom > DB price > existing reservation rate).
    // Monthly reservations bill in calendar-month chunks: customRate is treated
    // as the monthly rate and the extension is counted in calendar months, not
    // nights. Without this branch a "+1 month" extension would charge
    // monthlyRate × ~30 nights and inflate the invoice 30×.
    const isMonthly = ru.rateType === "monthly" || ru.rateType === "MONTHLY";
    const customRate = customRates[ru.unitId] ? Number(customRates[ru.unitId]) : null;

    let additionalSubtotal: number;
    let additionalNights:   number;
    let quantity:           number;  // months (monthly) or nights (daily) — for the invoice line
    let unitPrice:          number;  // per-month or per-night rate — for the invoice line

    if (isMonthly) {
      const months = countCalendarMonths(extensionStart, newCheckOut);
      additionalNights = calculateNights(extensionStart, newCheckOut);
      const monthlyRate = customRate !== null && customRate > 0
        ? customRate
        : roundOMR(Number(ru.rateAmount));
      additionalSubtotal = roundOMR(monthlyRate * months);
      quantity  = months;
      unitPrice = monthlyRate;
    } else {
      const extensionNights = calculateNights(extensionStart, newCheckOut);
      additionalNights = extensionNights;
      if (customRate !== null && customRate > 0) {
        additionalSubtotal = roundOMR(customRate * extensionNights);
      } else {
        const pricing = await getUnitPriceForRange(ru.unitId, extensionStart, newCheckOut);
        if (pricing.totalAmount > 0) {
          additionalSubtotal = roundOMR(pricing.totalAmount);
        } else {
          // Fall back to the rate already on this reservation unit
          const fallbackRate = roundOMR(Number(ru.rateAmount));
          additionalSubtotal = roundOMR(fallbackRate * extensionNights);
        }
      }
      quantity  = extensionNights;
      unitPrice = extensionNights > 0 ? roundOMR(additionalSubtotal / extensionNights) : additionalSubtotal;
    }

    extendedUnitPricings.set(ru.unitId, {
      additionalNights, additionalSubtotal, quantity, unitPrice,
      unitName: ru.unit.name, isMonthly,
    });
  }

  let newGrandTotal = 0;
  let additionalCharges = 0;

  await prisma.$transaction(
    async (tx) => {
      // Units NOT being extended: pin their effectiveCheckOut to the original end date
      for (const ru of r.reservationUnits) {
        if (!(extensionMap.get(ru.unitId) ?? false)) {
          await tx.reservationUnit.update({
            where: { id: ru.id },
            data:  { effectiveCheckOut: originalEndDate },
          });
        }
      }

      // Units being extended: update nights + subtotal
      for (const ru of r.reservationUnits) {
        if (!(extensionMap.get(ru.unitId) ?? false)) continue;
        const ext = extendedUnitPricings.get(ru.unitId);
        if (!ext) continue;

        const newNights   = ru.nights + ext.additionalNights;
        const newSubtotal = roundOMR(Number(ru.subtotal) + ext.additionalSubtotal);
        additionalCharges = roundOMR(additionalCharges + ext.additionalSubtotal);

        await tx.reservationUnit.update({
          where: { id: ru.id },
          data:  { nights: newNights, subtotal: newSubtotal },
        });
      }

      // Recalculate reservation totals from updated RUs
      const allActiveRUs = await tx.reservationUnit.findMany({
        where:  { reservationId: id, isMovedOut: { not: true } },
        select: { subtotal: true },
      });
      const newTotalAmount  = roundOMR(allActiveRUs.reduce((s, ru) => s + Number(ru.subtotal), 0));
      const discountAmount  = roundOMR(Number(r.discountAmount));
      const newGrand        = roundOMR(newTotalAmount - discountAmount);
      const totalNights     = calculateNights(new Date(r.startDate), newCheckOut);
      newGrandTotal         = newGrand;

      let newAmountPaid = roundOMR(Number(r.amountPaid));
      let extensionPaymentId: string | null = null;
      let extensionPayAmt = 0;
      if (payment && Number(payment.amount) > 0) {
        const payAmt = roundOMR(Number(payment.amount));
        const createdPayment = await tx.payment.create({
          data: {
            amount: payAmt, method: payment.method as any,
            reference: payment.reference ?? null,
            tenantId: r.tenantId, reservationId: id,
          },
        });
        extensionPaymentId = createdPayment.id;
        extensionPayAmt = payAmt;
        newAmountPaid = roundOMR(newAmountPaid + payAmt);
        await tx.reservationActivity.create({
          data: {
            reservationId: id, organizationId: actor.organizationId!,
            action: "PAYMENT_RECORDED",
            description: `Payment of ${payAmt.toFixed(3)} OMR recorded at stay extension (${payment.method})`,
            performedById: actor.id,
            metadata: { amount: payAmt, method: payment.method, atExtension: true },
          },
        });
      }

      await tx.reservation.update({
        where: { id },
        data: {
          endDate: newCheckOut, totalAmount: newTotalAmount,
          grandTotal: newGrand, amountPaid: newAmountPaid, totalNights,
        },
      });

      // Bill the extension. The base invoice generation is idempotent and won't
      // pick up the extra nights/months, so when this reservation already has
      // issued invoices we create a dedicated ADDITIONAL invoice for the
      // extension period. (If no invoice exists yet, the normal "Generate
      // Invoices" later covers the full extended stay.)
      const existingInvoiceCount = await tx.invoice.count({
        where: { reservationId: id, status: { notIn: ["CANCELLED", "VOID"] } },
      });
      if (existingInvoiceCount > 0 && additionalCharges > 0) {
        const extInvoiceNumber = await nextInvoiceNumber(actor.organizationId!, tx);
        const lineItemsData: any[] = [];
        let extSubtotal = 0;
        let sortOrder = 0;
        for (const ru of r.reservationUnits) {
          const ext = extendedUnitPricings.get(ru.unitId);
          if (!ext) continue;
          extSubtotal = roundOMR(extSubtotal + ext.additionalSubtotal);
          lineItemsData.push({
            organizationId: actor.organizationId!,
            description: `${ext.unitName} — extension (${originalEndDate.toISOString().slice(0, 10)} – ${newCheckOut.toISOString().slice(0, 10)})`,
            category: "ROOM_CHARGE",
            unitId: ru.unitId,
            quantity: ext.quantity,
            unitPrice: ext.unitPrice,
            lineTotal: ext.additionalSubtotal,
            rateType: ext.isMonthly ? "MONTHLY" : "DAILY",
            sortOrder: sortOrder++,
          });
        }

        // Apply any payment collected at extension to this invoice (capped at total).
        const allocate = extensionPaymentId ? Math.min(extensionPayAmt, extSubtotal) : 0;
        const extStatus = allocate <= 0
          ? "PENDING"
          : roundOMR(extSubtotal - allocate) <= 0 ? "PAID" : "PARTIALLY_PAID";

        const extInvoice = await tx.invoice.create({
          data: {
            organizationId: actor.organizationId!,
            invoiceNumber:  extInvoiceNumber,
            reservationId:  id,
            tenantId:       r.tenantId,
            propertyId:     r.reservationUnits[0]?.unit.propertyId ?? null,
            periodStart:    originalEndDate,
            periodEnd:      newCheckOut,
            invoiceType:    "ADDITIONAL",
            subtotal:       extSubtotal,
            discountAmount: 0,
            taxAmount:      0,
            totalAmount:    extSubtotal,
            amountPaid:     allocate,
            balanceDue:     roundOMR(extSubtotal - allocate),
            status:         extStatus,
            issueDate:      new Date(),
            dueDate:        originalEndDate,
            createdById:    actor.id,
            lineItems:      { createMany: { data: lineItemsData } },
          },
        });

        if (extensionPaymentId && allocate > 0) {
          await tx.paymentAllocation.create({
            data: {
              paymentId:      extensionPaymentId,
              invoiceId:      extInvoice.id,
              organizationId: actor.organizationId!,
              amount:         allocate,
            },
          });
        }
      }

      await tx.reservationActivity.create({
        data: {
          reservationId: id, organizationId: actor.organizationId!,
          action: "EXTENDED",
          description: `Stay extended from ${originalEndDate.toISOString().slice(0, 10)} to ${newCheckOut.toISOString().slice(0, 10)}. Additional charges: ${additionalCharges.toFixed(3)} OMR.`,
          performedById: actor.id,
          metadata: {
            originalEndDate: originalEndDate.toISOString(),
            newEndDate:      newCheckOut.toISOString(),
            additionalCharges,
            extendedUnits:   Array.from(extendedUnitPricings.keys()),
          },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  return NextResponse.json({ success: true, newEndDate: newCheckOut.toISOString(), newGrandTotal, additionalCharges });
}
