import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Header from "@/components/dashboard/Header";
import Navigation from "@/components/dashboard/Navigation";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Verify User is Authenticated on the Server
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // CHECK: Does this user have an Organization?
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  // If no Org, force them to Onboarding
  if (!dbUser?.organizationId) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* We separate Header and Navigation to keep code clean.
        This creates that "NetSuite" style stacked top section.
      */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 z-10 relative">
        <Header userEmail={user.email} />
        <Navigation />
      </div>

      {/* Main Content Area - Full Width */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
