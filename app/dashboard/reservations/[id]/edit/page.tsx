import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/FormComponents";
import BookingEngine from "@/components/dashboard/BookingEngine";
import { calculateNights, countCalendarMonths } from "@/lib/reservation-engine";

// Editing is only allowed before check-in and before invoices exist (QA #30).
const EDITABLE_STATUSES = ["PENDING", "CONFIRMED"];

export default async function EditReservationPage({
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
  if (!dbUser?.organizationId) redirect("/onboarding");

  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where:  { id },
    select: {
      id: true, organizationId: true, status: true, invoicesGenerated: true,
      startDate: true, endDate: true, rateType: true, source: true, notes: true,
      discountAmount: true,
      tenant: {
        select: {
          id: true, firstName: true, lastName: true,
          phone: true, email: true, classification: true, nationality: true,
        },
      },
      reservationUnits: {
        select: {
          unitId: true, rateAmount: true, rateSource: true,
          unit: { select: { propertyId: true } },
        },
      },
    },
  });

  if (!reservation || reservation.organizationId !== dbUser.organizationId)
    redirect("/dashboard/reservations");

  // Guard direct-URL access: bounce non-editable reservations to the detail page.
  if (!EDITABLE_STATUSES.includes(reservation.status) || reservation.invoicesGenerated)
    redirect(`/dashboard/reservations/${id}`);

  const properties = await prisma.property.findMany({
    where:   { organizationId: dbUser.organizationId, isArchived: false, isActive: true },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const rt: "daily" | "monthly" = reservation.rateType === "monthly" ? "monthly" : "daily";
  const period = rt === "daily"
    ? calculateNights(reservation.startDate, reservation.endDate)
    : countCalendarMonths(reservation.startDate, reservation.endDate);

  const defaultSelectedUnitIds = reservation.reservationUnits.map((ru) => ru.unitId);
  // Re-seed only manual overrides; computed (default/seasonal) rates re-derive.
  const defaultCustomRates: Record<string, string> = {};
  for (const ru of reservation.reservationUnits) {
    if (ru.rateSource === "manual_override") {
      defaultCustomRates[ru.unitId] = Number(ru.rateAmount).toString();
    }
  }
  const defaultPropertyId = reservation.reservationUnits[0]?.unit.propertyId;
  const discountNum = Number(reservation.discountAmount);

  const t = await getTranslations("reservations.editPage");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        listHref={`/dashboard/reservations/${id}`}
      />
      <BookingEngine
        properties={properties}
        reservationId={reservation.id}
        defaultTenant={reservation.tenant}
        defaultPropertyId={defaultPropertyId}
        defaultStartDate={reservation.startDate.toISOString().slice(0, 10)}
        defaultEndDate={reservation.endDate.toISOString().slice(0, 10)}
        defaultRateType={rt}
        defaultPeriod={period}
        defaultSelectedUnitIds={defaultSelectedUnitIds}
        defaultCustomRates={defaultCustomRates}
        defaultDiscount={discountNum > 0 ? discountNum.toString() : ""}
        defaultSource={reservation.source ?? "walk_in"}
        defaultNotes={reservation.notes ?? ""}
      />
    </div>
  );
}
