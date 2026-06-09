import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function roundOMR(n: number) { return Math.round(n * 1000) / 1000; }

/** Generate next sequential expense number: EXP-YYYY-NNNNN */
async function nextExpenseNumber(orgId: string, tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear().toString();
  const prefix = `EXP-${year}-`;

  const last = await tx.expense.findFirst({
    where: { organizationId: orgId, expenseNumber: { startsWith: prefix } },
    orderBy: { expenseNumber: "desc" },
    select: { expenseNumber: true },
  });

  let seq = 1;
  if (last?.expenseNumber) {
    const parts = last.expenseNumber.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

/**
 * GET /api/expenses — list with filters and role-based visibility.
 */
export async function GET(req: NextRequest) {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const sp = req.nextUrl.searchParams;
  const status      = sp.get("status") || "";
  const propertyId  = sp.get("propertyId") || "";
  const categoryId  = sp.get("categoryId") || "";
  const search      = sp.get("search") || "";
  const dateFrom    = sp.get("dateFrom") || "";
  const dateTo      = sp.get("dateTo") || "";
  const page        = parseInt(sp.get("page") || "1", 10);
  const limit       = Math.min(parseInt(sp.get("limit") || "100", 10), 200);

  const where: Prisma.ExpenseWhereInput = {
    organizationId: orgUser.organizationId,
  };

  // Role-based: STAFF sees only own expenses
  if (orgUser.role === "STAFF") {
    where.submittedById = orgUser.userId;
  }

  if (status) where.status = status as any;
  if (propertyId) where.propertyId = propertyId;
  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { expenseNumber: { contains: search, mode: "insensitive" } },
    ];
  }
  if (dateFrom || dateTo) {
    where.submittedAt = {};
    if (dateFrom) where.submittedAt.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      where.submittedAt.lte = to;
    }
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, nameAr: true, icon: true } },
        property: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        processedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.expense.count({ where }),
  ]);

  // Status counts (for filter tabs) — unfiltered by status but scoped by role + other filters
  const countWhere = { ...where };
  delete countWhere.status;
  const counts = await prisma.expense.groupBy({
    by: ["status"],
    where: countWhere,
    _count: { id: true },
    _sum: { amount: true },
  });

  const statusCounts: Record<string, { count: number; total: number }> = {};
  let allCount = 0;
  let allTotal = 0;
  for (const c of counts) {
    statusCounts[c.status] = { count: c._count.id, total: roundOMR(Number(c._sum.amount ?? 0)) };
    allCount += c._count.id;
    allTotal += Number(c._sum.amount ?? 0);
  }
  statusCounts.ALL = { count: allCount, total: roundOMR(allTotal) };

  const serialized = expenses.map((e) => ({
    ...e,
    amount: Number(e.amount),
  }));

  return NextResponse.json({
    success: true,
    expenses: serialized,
    total,
    page,
    limit,
    statusCounts,
  });
}

/**
 * POST /api/expenses — submit a new expense.
 */
export async function POST(req: NextRequest) {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  // Only OWNER and STAFF can submit
  if (!["OWNER", "STAFF"].includes(orgUser.role ?? "")) {
    return NextResponse.json({ error: "Only receptionists can submit expenses" }, { status: 403 });
  }

  const body = await req.json();
  const { categoryId, description, amount, propertyId, receiptImage, receiptImage2, notes } = body;

  // Validate required fields
  if (!categoryId) return NextResponse.json({ error: "Category is required" }, { status: 400 });
  if (!description?.trim()) return NextResponse.json({ error: "Description is required" }, { status: 400 });
  if (!amount || Number(amount) <= 0) return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  if (!propertyId) return NextResponse.json({ error: "Building is required" }, { status: 400 });
  // Receipt image is optional (the upload flow is being reworked — see
  // docs/operations/supabase-storage-rls.md). Accept submissions without one.

  // Verify property belongs to org
  const prop = await prisma.property.findUnique({ where: { id: propertyId }, select: { organizationId: true } });
  if (!prop || prop.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Invalid building" }, { status: 400 });
  }

  // Verify category belongs to org and is active
  const cat = await prisma.expenseCat.findUnique({ where: { id: categoryId } });
  if (!cat || cat.organizationId !== orgUser.organizationId || !cat.isActive) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const expense = await prisma.$transaction(async (tx) => {
    const expenseNumber = await nextExpenseNumber(orgUser.organizationId, tx);

    return tx.expense.create({
      data: {
        organizationId: orgUser.organizationId,
        expenseNumber,
        categoryId,
        description: description.trim(),
        amount: roundOMR(Number(amount)),
        propertyId,
        receiptImage: receiptImage || null,
        receiptImage2: receiptImage2 || null,
        notes: notes?.trim() || null,
        submittedById: orgUser.userId,
        submittedAt: new Date(),
        status: "PENDING",
      },
      include: {
        category: { select: { name: true, icon: true } },
        property: { select: { name: true } },
      },
    });
  });

  return NextResponse.json({
    success: true,
    expense: { ...expense, amount: Number(expense.amount) },
  });
}
