import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Header from "@/components/dashboard/Header";
import Navigation from "@/components/dashboard/Navigation";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
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
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 z-10 relative">
        <Header userEmail={user.email} />
        <Navigation />
      </div>

      {/* Main Content Area - Full Width */}
      <main className="py-10">
        <div className="px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
      {/* Render the modal slot */}
      {modal}
    </div>
  );
}
