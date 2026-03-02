import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import ExpenseForm from "@/components/dashboard/ExpenseForm";
import { PageHeader } from "@/components/ui/FormComponents";
import { prisma } from "@/lib/prisma";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const properties = await prisma.property.findMany({
    where: { organizationId: dbUser?.organizationId! },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { property: true },
  });

  if (!expense || expense.property.organizationId !== dbUser?.organizationId) {
    notFound();
  }

  // Serialize the Decimal amount
  const serializedExpense = {
    ...expense,
    amount: Number(expense.amount),
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title="Edit Expense"
        description="Update amount, classification, or description."
        listHref="/dashboard/expenses"
      />
      <ExpenseForm properties={properties} initialData={serializedExpense} />
    </div>
  );
}
