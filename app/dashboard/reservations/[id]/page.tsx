import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import ReservationDetail from "./ReservationDetail";

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  const org = dbUser?.organizationId
    ? await prisma.organization.findUnique({
        where:  { id: dbUser.organizationId },
        select: { allowEarlyCheckIn: true, overpaymentPolicy: true },
      })
    : null;

  const { id } = await params;
  return (
    <ReservationDetail
      id={id}
      allowEarlyCheckIn={org?.allowEarlyCheckIn ?? false}
      overpaymentPolicy={org?.overpaymentPolicy ?? "WARN"}
    />
  );
}
