import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Header from "@/components/dashboard/Header";
import Navigation from "@/components/dashboard/Navigation";
import InactivityGuard from "@/components/dashboard/InactivityGuard";
import NavigationProgress from "@/components/ui/NavigationProgress";
import AvailabilityCalendarButton from "@/components/dashboard/AvailabilityCalendarButton";
import { prisma } from "@/lib/prisma";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getAccessiblePropertyIds } from "@/lib/property-scope";
import { canNav, type Role } from "@/lib/permissions";
import { resolvePermissions, navAccessFor } from "@/lib/rbac";
import { OrgProvider } from "@/lib/org-context";
import { PermissionsProvider } from "@/components/PermissionsProvider";

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
      assignedRole: { select: { key: true, permissions: true } },
      organization: { select: { currency: true } },
    },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const role = (dbUser.role ?? "STAFF") as Role;
  const currency = dbUser.organization?.currency ?? "OMR";

  // Effective nav visibility: operational tabs from the permission matrix,
  // `settings` still gated by the legacy enum role (setup enforcement = Phase 2b).
  const access = resolvePermissions(role, dbUser.assignedRole);
  const navAccess = { ...navAccessFor(access), settings: canNav(role, "settings") };

  // Per-user building scope: null = unrestricted (all org). Owner is always unrestricted.
  const accessible = access.isOwner ? null : await getAccessiblePropertyIds(user.id, dbUser.organizationId);

  // Fetch non-archived properties for the header scope selector, limited to the
  // user's accessible buildings.
  const [properties, rawSelectedPropertyId] = await Promise.all([
    prisma.property.findMany({
      where:   {
        organizationId: dbUser.organizationId,
        isArchived: false,
        ...(accessible ? { id: { in: accessible } } : {}),
      },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getSelectedPropertyId(),
  ]);

  // Ignore a selected building the user can no longer access (falls back to "All").
  const selectedPropertyId =
    accessible && rawSelectedPropertyId && !accessible.includes(rawSelectedPropertyId)
      ? ""
      : rawSelectedPropertyId;

  return (
    <OrgProvider value={{ currency }}>
     <PermissionsProvider perms={access.perms} isOwner={access.isOwner}>
      {/*
       * `overflow-x-hidden` is a defensive guard so a stray overflowing
       * child can never push the viewport wider than the window — that
       * was breaking modal sizing and forcing horizontal scroll on mobile.
       */}
      <div className="min-h-screen bg-gray-100 overflow-x-hidden">
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
          <Navigation role={role} navAccess={navAccess} />
        </div>

        <main className="py-6 sm:py-10">
          <div className="px-3 sm:px-6 lg:px-8">{children}</div>
        </main>

        {modal}

        <AvailabilityCalendarButton
          properties={properties}
          defaultPropertyId={selectedPropertyId ?? properties[0]?.id}
        />
      </div>
     </PermissionsProvider>
    </OrgProvider>
  );
}
