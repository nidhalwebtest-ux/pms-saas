import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/FormComponents";
import ReservationForm from "@/components/dashboard/ReservationForm";

const prisma = new PrismaClient();

export default async function NewReservationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // 1. Fetch Tenants
  const tenants = await prisma.tenant.findMany({
    where: { organizationId: dbUser?.organizationId! },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  // 2. Fetch Properties AND their Units
  const properties = await prisma.property.findMany({
    where: { organizationId: dbUser?.organizationId! },
    select: {
      id: true,
      name: true,
      units: {
        select: { id: true, name: true, basePrice: true },
      },
    },
  });

  // Edge case: No data yet
  if (properties.length === 0 || tenants.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-8 text-center">
        <h3 className="text-lg font-bold text-gray-900">Setup Required</h3>
        <p className="text-gray-500 mb-6">
          You need at least one Property, one Unit, and one Tenant before
          creating a reservation.
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="/dashboard/properties"
            className="text-blue-600 hover:underline"
          >
            Add Property
          </a>
          <a
            href="/dashboard/tenants"
            className="text-blue-600 hover:underline"
          >
            Add Tenant
          </a>
        </div>
      </div>
    );
  }

  // Convert Decimal to Number for Client Component compatibility
  const serializedProperties = properties.map((p) => ({
    ...p,
    units: p.units.map((u) => ({
      ...u,
      basePrice: Number(u.basePrice),
    })),
  }));

  return (
    <div className="max-w-2xl mx-auto py-8">
      <PageHeader
        title="New Reservation"
        description="Create a lease or check-in a guest."
      />

      <ReservationForm properties={serializedProperties} tenants={tenants} />
    </div>
  );
}
