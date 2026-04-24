import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Header from "@/components/dashboard/Header";
import Navigation from "@/components/dashboard/Navigation";
import InactivityGuard from "@/components/dashboard/InactivityGuard";
import NavigationProgress from "@/components/ui/NavigationProgress";
import AvailabilityCalendarButton from "@/components/dashboard/AvailabilityCalendarButton";
import { prisma } from "@/lib/prisma";
import { getSelectedPropertyId } from "@/lib/selected-property";
import type { Role } from "@/lib/permissions";
import { OrgProvider } from "@/lib/org-context";

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal:    React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: {
      organizationId: true,
      role: true,
      firstName: true,
      organization: { select: { currency: true } },
    },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const role = (dbUser.role ?? "STAFF") as Role;
  const currency = dbUser.organization?.currency ?? "OMR";

  // Fetch non-archived properties for the header scope selector
  const [properties, selectedPropertyId] = await Promise.all([
    prisma.property.findMany({
      where:   { organizationId: dbUser.organizationId, isArchived: false },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getSelectedPropertyId(),
  ]);

  return (
    <OrgProvider value={{ currency }}>
      <div className="min-h-screen bg-gray-50">
        {/* Global navigation progress bar */}
        <NavigationProgress />

        <InactivityGuard />

        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 z-10 relative">
          <Header
            userEmail={user.email}
            userName={dbUser.firstName}
            role={role}
            properties={properties}
            selectedPropertyId={selectedPropertyId}
          />
          <Navigation role={role} />
        </div>

        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>

        {modal}

        <AvailabilityCalendarButton
          properties={properties}
          defaultPropertyId={selectedPropertyId ?? properties[0]?.id}
        />
      </div>
    </OrgProvider>
  );
}
