import { redirect } from "next/navigation";
import { assertView } from "@/lib/access";
import { getEffectivePropertyIds } from "@/lib/property-scope";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  ArrowTrendingDownIcon,
  Cog6ToothIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import ExpensesListClient from "./ExpensesListClient";
import type { ExpenseRow } from "./columns";

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

export default async function ExpensesPage() {
  const access = await assertView("expenses");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true, role: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");
  const orgId = dbUser.organizationId;

  // Default tab by role
  let initialStatus = "ALL";
  if (dbUser.role === "STAFF") initialStatus = "ALL";
  else if (dbUser.role === "MANAGER" || dbUser.role === "OWNER") initialStatus = "PENDING";
  else if (dbUser.role === "ACCOUNTANT") initialStatus = "PROCESSED";

  // Building scope: sidebar-selected building clamped to the user's accessible
  // set (null = unrestricted). Mirrors the old /api/expenses behaviour.
  const propIds = await getEffectivePropertyIds(await getSelectedPropertyId());

  // The building filter dropdown is restricted to the user's accessible
  // buildings (propIds === null means unrestricted → all org buildings).
  const where = {
    organizationId: orgId,
    ...(dbUser.role === "STAFF" ? { submittedById: user.id } : {}),
    ...(propIds ? { propertyId: { in: propIds } } : {}),
  };

  const [raw, properties, categories] = await Promise.all([
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
      take: 5000,
    }),
    prisma.property.findMany({
      where: {
        organizationId: orgId,
        isArchived: false,
        ...(propIds ? { id: { in: propIds } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.expenseCat.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, icon: true, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const expenses: ExpenseRow[] = raw.map((e) => ({
    id:              e.id,
    expenseNumber:   e.expenseNumber,
    description:     e.description,
    amount:          Number(e.amount),
    status:          e.status as ExpenseRow["status"],
    receiptImage:    e.receiptImage ?? "",
    receiptImage2:   e.receiptImage2,
    notes:           e.notes,
    rejectionReason: e.rejectionReason,
    paymentMethod:   e.paymentMethod,
    bankReference:   e.bankReference,
    submittedAt:     e.submittedAt.toISOString(),
    reviewedAt:      iso(e.reviewedAt),
    processedAt:     iso(e.processedAt),
    category:        e.category,
    property:        e.property,
    submittedBy:     e.submittedBy,
    reviewedBy:      e.reviewedBy,
    processedBy:     e.processedBy,
  }));

  const canSubmit  = access.canCreate("expenses") && ["OWNER", "STAFF"].includes(dbUser.role);
  const canManage  = access.can("expenses", "EDIT") && ["OWNER", "MANAGER"].includes(dbUser.role);

  const t = await getTranslations("expenses");

  return (
    <div className="max-w-7xl mx-auto">
      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-100 rounded-xl">
            <ArrowTrendingDownIcon className="h-6 w-6 text-red-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <Link
              href="/dashboard/settings/expense-categories"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Cog6ToothIcon className="h-4 w-4" />
              {t("categoriesBtn")}
            </Link>
          )}
          {canSubmit && (
            <Link
              href="/dashboard/expenses/new"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              {t("submitExpense")}
            </Link>
          )}
        </div>
      </div>

      <ExpensesListClient
        role={dbUser.role}
        userId={user.id}
        initialStatus={initialStatus}
        expenses={expenses}
        properties={properties}
        categories={categories}
      />
    </div>
  );
}
