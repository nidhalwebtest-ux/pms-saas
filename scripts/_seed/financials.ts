/* ============================================================================
 *  Phase E — Payments + Returns + Expenses + Maintenance
 *
 *  - Pays every PAID-status invoice in full; 12 invoices get only a partial
 *    payment so PARTIALLY_PAID status flows through. 3 monthly reservations
 *    get overdue invoices (15-45 days late).
 *  - Records 12 returns: 8 daily + 4 monthly (the monthly ones cancel any
 *    future invoices on the same reservation).
 *  - 50 expenses with the spec status distribution.
 *  - 2 units flagged Unit.status = MAINTENANCE for current maintenance.
 * ========================================================================= */

import { prisma } from "@/lib/prisma";
import { addDays, TODAY } from "./dates";
import { pick, weighted, randInt, sample } from "./rand";
import { REJECT_REASONS } from "./omani-names";
import type { SetupResult } from "./setup";
import type { TenantsResult } from "./tenants";
import type { ReservationsResult } from "./reservations";

export interface FinancialsResult {
  invoices:      number;
  payments:      number;
  returns:       number;
  expenses:      number;
  totalInvoiced: number;
  totalPaid:     number;
  outstanding:   number;
}

const PAYMENT_METHOD_WEIGHTS: ReadonlyArray<readonly ["CASH" | "BANK_TRANSFER" | "CARD" | "CHEQUE", number]> = [
  ["CASH",          60],
  ["BANK_TRANSFER", 25],
  ["CARD",          10],
  ["CHEQUE",         5],
];

const EXPENSE_STATUS_DISTRIBUTION = {
  PROCESSED: 15,
  APPROVED:  12,
  PENDING:   10,
  REJECTED:   8,
  // 5 resubmitted-after-rejection — modelled as PENDING with a note in description.
  RESUBMIT:   5,
};

const EXPENSE_DESCRIPTIONS = [
  "Bulk cleaning supplies — Carrefour Salalah",
  "Plumbing repair — bathroom leak",
  "Air conditioning service",
  "Generator diesel refill",
  "Internet bill — Omantel monthly",
  "Pest control — quarterly visit",
  "Front desk printer toner",
  "Lobby flower arrangement",
  "Pool chemicals + maintenance",
  "Elevator inspection — annual",
  "Parking lot lights replacement",
  "Linen + towel laundering",
  "Security camera repair",
  "Carpet shampooing",
  "Window cleaning — exterior",
];

export async function runFinancials(
  setup: SetupResult,
  _tenants: TenantsResult,
  reservationsResult: ReservationsResult,
): Promise<FinancialsResult> {
  console.log("⚙︎  Phase E — payments + returns + expenses + maintenance");

  const alNoor = setup.orgs.find((o) => o.name === "Al Noor Property Management")!;
  const accountant = setup.users.find((u) => u.role === "ACCOUNTANT" && u.organizationId === alNoor.id)!;
  const owner      = setup.users.find((u) => u.role === "OWNER"      && u.organizationId === alNoor.id)!;
  const manager    = setup.users.find((u) => u.role === "MANAGER"    && u.organizationId === alNoor.id)!;
  const reception  = setup.users.find((u) => u.role === "STAFF"      && u.organizationId === alNoor.id)!;

  /* ── E.1 — Payments ────────────────────────────────────────────────── */

  // Pull every non-cancelled invoice on Al Noor with reservation + tenant.
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: alNoor.id,
      status: { notIn: ["CANCELLED", "VOID"] },
    },
    include: {
      reservation: { select: { status: true, startDate: true, endDate: true } },
    },
    orderBy: { issueDate: "asc" },
  });

  let paymentCount = 0;
  let nextPaymentSeq = 1;

  // Pick 12 invoices that will only get partial payments (status: PARTIALLY_PAID).
  // Pick 3 monthly invoices that will be skipped entirely (overdue 15-45 days).
  const monthlyInvoices = invoices.filter((inv) => inv.invoiceType === "MONTHLY");
  const partialTargets  = new Set(sample(invoices, Math.min(12, invoices.length)).map((i) => i.id));
  const overdueTargets  = new Set(sample(monthlyInvoices, Math.min(3, monthlyInvoices.length)).map((i) => i.id));

  for (const inv of invoices) {
    // Decide if this invoice gets paid at all
    const resStatus = inv.reservation?.status;

    // Historical completed → always fully paid.
    // Future / pending without partial flag → leave unpaid (PENDING).
    // Partial-target → 30-60% paid.
    // Overdue-target → 0% paid AND dueDate set in the past.
    const isHistorical = resStatus === "COMPLETED";
    const isPartial    = partialTargets.has(inv.id);
    const isOverdue    = overdueTargets.has(inv.id);

    if (isOverdue) {
      // Push due date 15-45 days into the past.
      await prisma.invoice.update({
        where: { id: inv.id },
        data:  { dueDate: addDays(TODAY, -randInt(15, 45)) },
      });
      continue;
    }

    let payAmount = 0;
    if (isHistorical) {
      payAmount = Number(inv.totalAmount);
    } else if (isPartial) {
      const pct = randInt(30, 60) / 100;
      payAmount = round3(Number(inv.totalAmount) * pct);
    } else {
      // Pending / future — skip
      continue;
    }

    if (payAmount <= 0) continue;

    const method = weighted(PAYMENT_METHOD_WEIGHTS);
    const paymentNumber = `PAY-${inv.issueDate.getFullYear()}-${String(nextPaymentSeq++).padStart(5, "0")}`;

    const paymentDate = isHistorical
      ? addDays(inv.issueDate, randInt(0, 5))
      : addDays(inv.issueDate, randInt(0, 10));

    const payment = await prisma.payment.create({
      data: {
        paymentNumber,
        organizationId: alNoor.id,
        amount:         payAmount,
        date:           paymentDate,
        method,
        reference:      method === "BANK_TRANSFER"
          ? `TRF-${String(100000 + paymentCount).padStart(6, "0")}`
          : method === "CHEQUE"
          ? `CHQ-${String(2000 + paymentCount).padStart(4, "0")}`
          : null,
        notes:          isPartial ? "Partial payment — balance pending" : null,
        isRefund:       false,
        receivedById:   reception.id,
        tenantId:       inv.tenantId,
        reservationId:  inv.reservationId,
      },
    });

    await prisma.paymentAllocation.create({
      data: {
        paymentId:      payment.id,
        invoiceId:      inv.id,
        organizationId: alNoor.id,
        amount:         payAmount,
      },
    });

    // Update the invoice's amountPaid + status.
    const newAmountPaid = round3(Number(inv.amountPaid) + payAmount);
    const total = Number(inv.totalAmount);
    let newStatus: typeof inv.status = inv.status;
    if (newAmountPaid >= total - 0.001) newStatus = "PAID";
    else if (newAmountPaid > 0)         newStatus = "PARTIALLY_PAID";

    await prisma.invoice.update({
      where: { id: inv.id },
      data:  {
        amountPaid: newAmountPaid,
        balanceDue: round3(total - newAmountPaid),
        status:     newStatus,
        paidDate:   newStatus === "PAID" ? paymentDate : null,
      },
    });

    // Reservation activity for the payment.
    await prisma.reservationActivity.create({
      data: {
        reservationId:  inv.reservationId,
        organizationId: alNoor.id,
        action:         "PAYMENT_RECORDED",
        description:    `Payment ${paymentNumber} · ${payAmount.toFixed(3)} OMR · ${method}`,
        performedById:  reception.id,
        metadata:       { paymentId: payment.id, amount: payAmount, method },
      },
    });

    paymentCount++;
  }

  // Update reservation.amountPaid for each reservation
  const reservationGroups = await prisma.invoice.groupBy({
    by: ["reservationId"],
    where: {
      organizationId: alNoor.id,
      status: { notIn: ["CANCELLED", "VOID"] },
    },
    _sum: { amountPaid: true, totalAmount: true },
  });
  for (const g of reservationGroups) {
    await prisma.reservation.update({
      where: { id: g.reservationId },
      data:  {
        amountPaid:  Number(g._sum.amountPaid ?? 0),
        totalAmount: Number(g._sum.totalAmount ?? 0),
        grandTotal:  Number(g._sum.totalAmount ?? 0),
      },
    });
  }

  console.log(`   • ${paymentCount} payments`);

  /* ── E.2 — Returns ─────────────────────────────────────────────────── */

  // 8 daily returns + 4 monthly returns. Use completed reservations as the
  // pool; daily for daily returns, monthly for monthly returns.
  const completedDaily = reservationsResult.reservations.filter(
    (r) => r.rateType === "daily" && r.status === "COMPLETED",
  );
  const completedMonthly = reservationsResult.reservations.filter(
    (r) => r.rateType === "monthly" && r.status === "COMPLETED",
  );

  let returnCount = 0;
  let nextReturnSeq = 1;

  // 8 daily returns
  for (const res of sample(completedDaily, 8)) {
    const inv = await prisma.invoice.findFirst({
      where: { reservationId: res.id, organizationId: alNoor.id, status: { notIn: ["CANCELLED", "VOID"] } },
    });
    if (!inv) continue;

    const returnAmount = round3(Number(inv.totalAmount) * (randInt(20, 50) / 100));
    const refundStatus = randInt(0, 2) === 0 ? "NOT_REQUIRED" : (randInt(0, 1) === 0 ? "PENDING" : "COMPLETED");
    const ret = await prisma.return.create({
      data: {
        returnNumber:   `RET-${res.endDate.getFullYear()}-${String(nextReturnSeq++).padStart(5, "0")}`,
        organizationId: alNoor.id,
        reservationId:  res.id,
        tenantId:       res.tenantId,
        invoiceId:      inv.id,
        returnFrom:     res.startDate,
        returnTo:       res.endDate,
        returnDays:     1,
        returnType:     "DAILY",
        returnAmount,
        refundRequired: refundStatus !== "NOT_REQUIRED",
        refundAmount:   refundStatus === "NOT_REQUIRED" ? 0 : returnAmount,
        refundStatus:   refundStatus as any,
        refundMethod:   refundStatus === "COMPLETED" ? "CASH" : null,
        refundDate:     refundStatus === "COMPLETED" ? addDays(res.endDate, 2) : null,
        refundProcessedById: refundStatus === "COMPLETED" ? accountant.id : null,
        reason:         "Damage deposit refund",
        createdById:    owner.id,
        status:         "active",
      },
    });
    await prisma.returnLineItem.create({
      data: {
        returnId:       ret.id,
        organizationId: alNoor.id,
        description:    "Partial refund",
        quantity:       1,
        unitPrice:      returnAmount,
        lineTotal:      returnAmount,
      },
    });
    await prisma.reservationActivity.create({
      data: {
        reservationId:  res.id,
        organizationId: alNoor.id,
        action:         "RETURN_PROCESSED",
        description:    `Return ${ret.returnNumber} · ${returnAmount.toFixed(3)} OMR`,
        performedById:  owner.id,
      },
    });
    returnCount++;
  }

  // 4 monthly returns — cancel any future invoices on the same reservation
  for (const res of sample(completedMonthly, Math.min(4, completedMonthly.length))) {
    const inv = await prisma.invoice.findFirst({
      where: { reservationId: res.id, organizationId: alNoor.id, status: { notIn: ["CANCELLED", "VOID"] } },
      orderBy: { periodStart: "asc" },
    });
    if (!inv) continue;

    const returnAmount = round3(Number(inv.totalAmount) * 0.5);
    const ret = await prisma.return.create({
      data: {
        returnNumber:   `RET-${res.endDate.getFullYear()}-${String(nextReturnSeq++).padStart(5, "0")}`,
        organizationId: alNoor.id,
        reservationId:  res.id,
        tenantId:       res.tenantId,
        invoiceId:      inv.id,
        returnFrom:     addDays(res.endDate, -45),
        returnTo:       res.endDate,
        returnDays:     45,
        returnType:     "MONTHLY",
        returnAmount,
        refundRequired: true,
        refundAmount:   returnAmount,
        refundStatus:   "COMPLETED",
        refundMethod:   "BANK_TRANSFER",
        refundDate:     addDays(res.endDate, 5),
        refundProcessedById: accountant.id,
        reason:         "Tenant ended monthly stay early",
        createdById:    owner.id,
        status:         "active",
      },
    });
    await prisma.returnLineItem.create({
      data: {
        returnId:       ret.id,
        organizationId: alNoor.id,
        description:    "Early checkout refund — partial month",
        quantity:       1,
        unitPrice:      returnAmount,
        lineTotal:      returnAmount,
      },
    });
    // Cancel any future (period start > end date) invoices
    await prisma.invoice.updateMany({
      where: {
        reservationId: res.id,
        organizationId: alNoor.id,
        status: { notIn: ["CANCELLED", "VOID", "PAID", "PARTIALLY_PAID"] },
        periodStart: { gt: res.endDate },
      },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledReason: "Tenant early checkout" },
    });
    returnCount++;
  }

  console.log(`   • ${returnCount} returns`);

  /* ── E.3 — Expenses ────────────────────────────────────────────────── */

  const categories = await prisma.expenseCat.findMany({
    where: { organizationId: alNoor.id, isActive: true },
  });
  const orgProperties = setup.properties.filter((p) => p.organizationId === alNoor.id);

  let expenseCount = 0;
  let nextExpenseSeq = 1;

  // PROCESSED — 15 (historical)
  for (let i = 0; i < EXPENSE_STATUS_DISTRIBUTION.PROCESSED; i++) {
    const submittedAt = addDays(TODAY, -randInt(90, 365));
    const reviewedAt = addDays(submittedAt, 1);
    const processedAt = addDays(submittedAt, 3);
    await prisma.expense.create({
      data: {
        expenseNumber:    `EXP-${submittedAt.getFullYear()}-${String(nextExpenseSeq++).padStart(5, "0")}`,
        organizationId:   alNoor.id,
        categoryId:       pick(categories).id,
        description:      pick(EXPENSE_DESCRIPTIONS),
        amount:           round3(randInt(5, 500) + Math.random()),
        propertyId:       pick(orgProperties).id,
        status:           "PROCESSED",
        submittedById:    reception.id,
        submittedAt,
        reviewedById:     manager.id,
        reviewedAt,
        processedById:    accountant.id,
        processedAt,
        paymentMethod:    weighted(PAYMENT_METHOD_WEIGHTS),
      },
    });
    expenseCount++;
  }

  // APPROVED — 12 (waiting for accountant)
  for (let i = 0; i < EXPENSE_STATUS_DISTRIBUTION.APPROVED; i++) {
    const submittedAt = addDays(TODAY, -randInt(3, 14));
    await prisma.expense.create({
      data: {
        expenseNumber:    `EXP-${submittedAt.getFullYear()}-${String(nextExpenseSeq++).padStart(5, "0")}`,
        organizationId:   alNoor.id,
        categoryId:       pick(categories).id,
        description:      pick(EXPENSE_DESCRIPTIONS),
        amount:           round3(randInt(5, 500)),
        propertyId:       pick(orgProperties).id,
        status:           "APPROVED",
        submittedById:    reception.id,
        submittedAt,
        reviewedById:     manager.id,
        reviewedAt:       addDays(submittedAt, 1),
      },
    });
    expenseCount++;
  }

  // PENDING — 10 (waiting for manager)
  for (let i = 0; i < EXPENSE_STATUS_DISTRIBUTION.PENDING; i++) {
    const submittedAt = addDays(TODAY, -randInt(0, 5));
    await prisma.expense.create({
      data: {
        expenseNumber:    `EXP-${submittedAt.getFullYear()}-${String(nextExpenseSeq++).padStart(5, "0")}`,
        organizationId:   alNoor.id,
        categoryId:       pick(categories).id,
        description:      pick(EXPENSE_DESCRIPTIONS),
        amount:           round3(randInt(5, 500)),
        propertyId:       pick(orgProperties).id,
        status:           "PENDING",
        submittedById:    reception.id,
        submittedAt,
      },
    });
    expenseCount++;
  }

  // REJECTED — 8
  for (let i = 0; i < EXPENSE_STATUS_DISTRIBUTION.REJECTED; i++) {
    const submittedAt = addDays(TODAY, -randInt(7, 30));
    await prisma.expense.create({
      data: {
        expenseNumber:    `EXP-${submittedAt.getFullYear()}-${String(nextExpenseSeq++).padStart(5, "0")}`,
        organizationId:   alNoor.id,
        categoryId:       pick(categories).id,
        description:      pick(EXPENSE_DESCRIPTIONS),
        amount:           round3(randInt(5, 500)),
        propertyId:       pick(orgProperties).id,
        status:           "REJECTED",
        submittedById:    reception.id,
        submittedAt,
        reviewedById:     manager.id,
        reviewedAt:       addDays(submittedAt, 1),
        rejectionReason:  pick(REJECT_REASONS),
      },
    });
    expenseCount++;
  }

  // RESUBMIT — 5 (PENDING with a note that they were resubmitted)
  for (let i = 0; i < EXPENSE_STATUS_DISTRIBUTION.RESUBMIT; i++) {
    const submittedAt = addDays(TODAY, -randInt(1, 7));
    await prisma.expense.create({
      data: {
        expenseNumber:    `EXP-${submittedAt.getFullYear()}-${String(nextExpenseSeq++).padStart(5, "0")}`,
        organizationId:   alNoor.id,
        categoryId:       pick(categories).id,
        description:      `[resubmitted] ${pick(EXPENSE_DESCRIPTIONS)}`,
        amount:           round3(randInt(5, 500)),
        propertyId:       pick(orgProperties).id,
        status:           "PENDING",
        submittedById:    reception.id,
        submittedAt,
        notes:            "Resubmitted with corrected receipt photo.",
      },
    });
    expenseCount++;
  }

  console.log(`   • ${expenseCount} expenses`);

  /* ── E.4 — Maintenance blocks (2 units → MAINTENANCE) ─────────────── */

  // Pick 2 currently AVAILABLE units in Al Noor and flag them MAINTENANCE.
  const availableUnits = await prisma.unit.findMany({
    where: { property: { organizationId: alNoor.id }, status: "AVAILABLE" },
    take: 2,
  });
  await prisma.unit.updateMany({
    where: { id: { in: availableUnits.map((u) => u.id) } },
    data:  { status: "MAINTENANCE" },
  });
  console.log(`   • 2 units flagged MAINTENANCE`);
  console.log("");

  /* ── Summary numbers ──────────────────────────────────────────────── */

  const finalInvoices = await prisma.invoice.findMany({
    where: { organizationId: alNoor.id, status: { notIn: ["CANCELLED", "VOID"] } },
    select: { totalAmount: true, amountPaid: true },
  });
  const totalInvoiced = finalInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid     = finalInvoices.reduce((s, i) => s + Number(i.amountPaid), 0);

  return {
    invoices:      finalInvoices.length,
    payments:      paymentCount,
    returns:       returnCount,
    expenses:      expenseCount,
    totalInvoiced: round3(totalInvoiced),
    totalPaid:     round3(totalPaid),
    outstanding:   round3(totalInvoiced - totalPaid),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
