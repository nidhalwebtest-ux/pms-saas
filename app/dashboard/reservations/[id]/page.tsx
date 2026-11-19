import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertView } from "@/lib/access";
import ReservationDetail from "./ReservationDetail";
import { getAuthUser } from "@/lib/current-user";

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await assertView("reservations");
  const user = await getAuthUser();
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
