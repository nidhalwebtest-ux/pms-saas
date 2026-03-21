import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Header from "@/components/dashboard/Header";
import Navigation from "@/components/dashboard/Navigation";
import InactivityGuard from "@/components/dashboard/InactivityGuard";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/permissions";

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true, role: true, firstName: true },
  });

  if (!dbUser?.organizationId) redirect("/onboarding");

  const role = (dbUser.role ?? "STAFF") as Role;

  return (
    <div className="min-h-screen bg-gray-50">
      <InactivityGuard />
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 z-10 relative">
        <Header userEmail={user.email} userName={dbUser.firstName} role={role} />
        <Navigation role={role} />
      </div>

      <main className="py-10">
        <div className="px-4 sm:px-6 lg:px-8">{children}</div>
      </main>

      {modal}
    </div>
  );
}
