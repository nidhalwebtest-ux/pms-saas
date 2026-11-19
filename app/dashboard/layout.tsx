import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getAuthUser, getSessionUser } from "@/lib/current-user";
import Header from "@/components/dashboard/Header";
import Navigation from "@/components/dashboard/Navigation";
import InactivityGuard from "@/components/dashboard/InactivityGuard";
import NavigationProgress from "@/components/ui/NavigationProgress";
import AvailabilityCalendarButton from "@/components/dashboard/AvailabilityCalendarButton";
import AdminPanelButton from "@/components/dashboard/AdminPanelButton";
import { DemoBanner } from "@/components/dashboard/DemoBanner";
import { DemoWhatsAppButton } from "@/components/dashboard/DemoWhatsAppButton";
import { TourOverlay } from "@/components/dashboard/tour/TourOverlay";
import { AutoStartTour } from "@/components/dashboard/tour/AutoStartTour";
import { getSuperAdmin } from "@/lib/super-admin";
import { prisma } from "@/lib/prisma";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getAccessiblePropertyIds } from "@/lib/property-scope";
import { type Role } from "@/lib/permissions";
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
  const authUser = await getAuthUser();
  if (!authUser) redirect("/login");

  const dbUser = await getSessionUser();
  if (!dbUser?.organizationId) redirect("/onboarding");

  const role = (dbUser.role ?? "STAFF") as Role;
  const currency = dbUser.organization?.currency ?? "OMR";
  const isDemo = dbUser.organization?.isDemo ?? false;
  const demoContactWhatsapp = dbUser.organization?.demoContactWhatsapp ?? null;

  // Effective nav visibility: operational tabs AND setup entities (Settings
  // sub-pages + the `settings` aggregate) all derive from the permission matrix.
  const access = resolvePermissions(role, dbUser.assignedRole);
  const navAccess = navAccessFor(access);

  const organizationId = dbUser.organizationId;

  // Everything below is independent — run it in ONE parallel batch instead of
  // 3–4 sequential DB round trips on every dashboard navigation.
  //  - building scope: null = unrestricted (all org); owner is always unrestricted
  //  - properties: non-archived, for the header scope selector. Filtered by the
  //    user's accessible buildings via the relation, so it doesn't have to wait
  //    for the assignment lookup (no assignments = unrestricted → all org).
  //  - pending website booking-request count for the nav badge (only when visible)
  const [isSuperAdmin, accessible, properties, rawSelectedPropertyId, websiteRequestCount] =
    await Promise.all([
      getSuperAdmin().then(Boolean),
      access.isOwner ? Promise.resolve(null) : getAccessiblePropertyIds(dbUser.id, organizationId),
      prisma.property.findMany({
        where: {
          organizationId,
          isArchived: false,
          ...(access.isOwner
            ? {}
            : {
                // restricted user → only assigned buildings; unrestricted (no
                // assignments at all) → every building in the org
                OR: [
                  { assignments: { some: { userId: dbUser.id } } },
                  { organization: { users: { some: { id: dbUser.id, assignedProperties: { none: {} } } } } },
                ],
              }),
        },
        select:  { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      getSelectedPropertyId(),
      navAccess.websiteRequests
        ? prisma.websiteBookingRequest.count({
            where: {
              organizationId,
              status: "PENDING",
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          })
        : Promise.resolve(0),
    ]);

  // Ignore a selected building the user can no longer access (falls back to "All").
  const selectedPropertyId =
    accessible && rawSelectedPropertyId && !accessible.includes(rawSelectedPropertyId)
      ? ""
      : rawSelectedPropertyId;

  return (
    // The root layout only ships the small public message subset; the dashboard
    // needs the full dictionary. A server-rendered NextIntlClientProvider with no
    // `messages` prop inherits ALL messages from i18n/request.ts (next-intl v4).
    // Lives here (not root) so a soft navigation login → dashboard still gets it.
    <NextIntlClientProvider>
    <OrgProvider value={{ currency, isDemo, demoContactWhatsapp }}>
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

        {isDemo && <DemoBanner />}

        <div className="bg-navbar-bg shadow-navbar z-10 relative">
          <Header
            userEmail={authUser.email}
            userName={dbUser.firstName}
            role={role}
            roleName={dbUser.assignedRole?.name ?? null}
            isCustomRole={!!dbUser.assignedRole && !dbUser.assignedRole.key}
            properties={properties}
            selectedPropertyId={selectedPropertyId}
          />
          <Navigation role={role} navAccess={navAccess} websiteRequestCount={websiteRequestCount} />
        </div>

        <main className="pb-6 pt-4 sm:pb-10 sm:pt-6">
          <div className="px-3 sm:px-6 lg:px-8">{children}</div>
        </main>

        {modal}

        <AvailabilityCalendarButton
          properties={properties}
          defaultPropertyId={selectedPropertyId ?? properties[0]?.id}
        />

        {isSuperAdmin && <AdminPanelButton />}

        {isDemo && <DemoWhatsAppButton />}

        {isDemo && <AutoStartTour />}
        {isDemo && <TourOverlay />}
      </div>
     </PermissionsProvider>
    </OrgProvider>
    </NextIntlClientProvider>
  );
}
