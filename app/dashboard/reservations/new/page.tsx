import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/FormComponents";
import BookingEngine from "@/components/dashboard/BookingEngine";
import Link from "next/link";

export default async function NewReservationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const properties = await prisma.property.findMany({
    where:   { organizationId: dbUser.organizationId, isArchived: false, isActive: true },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Need at least one property + one tenant
  const tenantCount = await prisma.tenant.count({
    where: { organizationId: dbUser.organizationId },
  });

  if (properties.length === 0 || tenantCount === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4 px-4">
        <div className="text-4xl">🏗️</div>
        <h3 className="text-lg font-bold text-gray-900">Setup Required</h3>
        <p className="text-gray-500">
          You need at least one <strong>active property</strong> and one <strong>tenant</strong> before
          creating a reservation.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link href="/dashboard/properties/new" className="text-sm text-blue-600 hover:underline font-medium">
            + Add Property
          </Link>
          <Link href="/dashboard/tenants/new" className="text-sm text-blue-600 hover:underline font-medium">
            + Add Tenant
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="New Reservation"
        description="Book a unit for a tenant or guest."
        listHref="/dashboard/reservations"
      />
      <BookingEngine properties={properties} />
    </div>
  );
}
