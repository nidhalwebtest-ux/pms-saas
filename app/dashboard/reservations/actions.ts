"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { generateInstallments } from "@/utils/billing-engine";
import {
  requireOrgUser,
  assertReservationOwnership,
} from "@/lib/tenant";

import { prisma } from "@/lib/prisma";

export type ActionResponse = {
  error?: string;
  success?: boolean;
  data?: any;
  id?: string;
};
// NOTE: The original `createReservation` server action was removed. All booking
// creation now goes through POST /api/reservations (see app/api/reservations/
// route.ts + components/dashboard/BookingEngine.tsx), which performs the
// availability re-check inside a Serializable transaction. The old action did a
// non-atomic check-then-insert with a loose status filter and was a
// double-booking race; its only consumer (ReservationForm.tsx) was unused.

// ---------------------------------------------------------
// CONFIRM RESERVATION (Generate Contract & Invoices)
// ---------------------------------------------------------
export async function confirmReservation(formData: FormData) {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch (e: any) { return e; }

  const reservationId = formData.get("reservationId") as string;

  // Verify reservation belongs to the caller's org
  try {
    await assertReservationOwnership(reservationId, orgUser.organizationId);
  } catch (e: any) { return e; }

  // 1. Fetch the Reservation
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { unit: true }, // Need unit info?
  });

  if (!reservation) {
    return { error: "Reservation not found" };
  }
  if (reservation.status !== "PENDING") {
    return { error: "Reservation is already processed" };
  }

  // 2. Generate Installments (The Logic we removed from Create)
  const installments = generateInstallments(
    reservation.startDate,
    reservation.endDate,
    Number(reservation.amount),
    reservation.frequency,
  );

  // 3. Update Status to CONFIRMED
  try {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { status: "CONFIRMED" },
    });
  } catch (error) {
    console.error("Confirmation Error:", error);
    return { error: "Failed to confirm reservation. Please try again." };
  }

  revalidatePath(`/dashboard/reservations/${reservationId}`);
  return { success: true };
}
// ---------------------------------------------------------
// 3. UPDATE STATUS (Check In, Cancel, Complete)
// ---------------------------------------------------------
export async function updateReservationStatus(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = formData.get("id") as string;
  const newStatus = formData.get("status") as any; // "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED"

  // Security Check
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { tenant: { select: { organizationId: true } } },
  });

  if (reservation?.tenant.organizationId !== dbUser?.organizationId) {
    return { error: "Unauthorized access to this reservation" };
  }

  // Update Status
  try {
    await prisma.reservation.update({
      where: { id },
      data: { status: newStatus },
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    return { error: `Failed to update status to ${newStatus}` };
  }

  revalidatePath(`/dashboard/reservations/${id}`);
  return { success: true };
}

// ---------------------------------------------------------
// 4. CREATE QUICK TENANT (For Modals)
// ---------------------------------------------------------
export async function createQuickTenant(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const phone = formData.get("phone") as string;
  const email = formData.get("email") as string;
  const nationalId = formData.get("nationalId") as string;
  const nationality = formData.get("nationality") as string;

  if (!firstName || !lastName || !phone) {
    return { error: "First Name, Last Name, and Phone are required." };
  }

  try {
    const newTenant = await prisma.tenant.create({
      data: {
        firstName,
        lastName,
        phone,
        email,
        nationalId,
        nationality,
        organizationId: dbUser?.organizationId!,
      },
    });

    revalidatePath("/dashboard/reservations/new");
    return { success: true, data: newTenant };
  } catch (error) {
    console.error("Error creating tenant:", error);
    return {
      error: "Failed to create tenant. Phone number might be duplicate.",
    };
  }
}
