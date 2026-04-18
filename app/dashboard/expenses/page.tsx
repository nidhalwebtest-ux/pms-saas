import { redirect } from "next/navigation";
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

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; propertyId?: string; categoryId?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true, role: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const sp = await searchParams;

  // Default tab by role
  let initialStatus = sp.status ?? "";
  if (!sp.status) {
    if (dbUser.role === "STAFF") initialStatus = "ALL";
    else if (dbUser.role === "MANAGER" || dbUser.role === "OWNER") initialStatus = "PENDING";
    else if (dbUser.role === "ACCOUNTANT") initialStatus = "PROCESSED";
    else initialStatus = "ALL";
  }

  const [properties, categories] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId: dbUser.organizationId, isArchived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.expenseCat.findMany({
      where: { organizationId: dbUser.organizationId },
      select: { id: true, name: true, icon: true, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const canSubmit  = ["OWNER", "STAFF"].includes(dbUser.role);
  const canManage  = ["OWNER", "MANAGER"].includes(dbUser.role);

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
        initialPropertyId={sp.propertyId ?? ""}
        initialCategoryId={sp.categoryId ?? ""}
        properties={properties}
        categories={categories}
      />
    </div>
  );
}
