"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { normalizeReservationDates, calculatePeriod } from "@/utils/date-math";
import { generateInstallments } from "@/utils/billing-engine";
import {
  requireOrgUser,
  assertTenantOwnership,
  assertUnitOwnership,
  assertReservationOwnership,
} from "@/lib/tenant";

import { prisma } from "@/lib/prisma";

export type ActionResponse = {
  error?: string;
  success?: boolean;
  data?: any;
  id?: string;
};
// ---------------------------------------------------------
// 1. Create RESERVATION
// ---------------------------------------------------------
export async function createReservation(
  prevState: any,
  formData: FormData,
): Promise<ActionResponse> {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch (e: any) { return e; }

  // 1. Extract Data
  const tenantId = formData.get("tenantId") as string;
  const unitId = formData.get("unitId") as string;

  // Verify tenant and unit belong to the caller's org
  try {
    await assertTenantOwnership(tenantId, orgUser.organizationId);
    await assertUnitOwnership(unitId, orgUser.organizationId);
  } catch (e: any) { return e; }

  // Raw dates from form (usually midnight)
  const rawStartDate = new Date(formData.get("startDate") as string);
  const rawEndDate = new Date(formData.get("endDate") as string);
  const unitPrice = parseFloat(formData.get("amount") as string);
  const frequency = formData.get("frequency") as "DAILY" | "MONTHLY" | "YEARLY";

  const duration = calculatePeriod(rawStartDate, rawEndDate, frequency);
  const totalPrice = duration.quantity * unitPrice;

  // 2. NORMALIZE DATES (The Magic Fix)
  // This transforms "Feb 1" to "Feb 1, 2:00 PM" and "Feb 3" to "Feb 3, 12:00 PM"
  const { checkIn, checkOut } = normalizeReservationDates(
    rawStartDate,
    rawEndDate,
  );

  // 3. Validation
  if (checkOut <= checkIn) {
    return { error: "End date must be after start date" };
  }

  // 5. CRITICAL: Availability Check using NORMALIZED dates
  const overlapping = await prisma.reservation.findFirst({
    where: {
      unitId: unitId,
      status: { not: "CANCELLED" },
      OR: [
        { startDate: { lt: checkOut }, endDate: { gt: checkIn } }, // Optimized overlap logic
      ],
    },
  });

  if (overlapping) {
    return {
      error: `Unit is already booked (Collision with Reservation #${overlapping.id.slice(0, 6)})`,
    };
  }

  //   const installments = generateInstallments(
  //   checkIn,
  //   checkOut,
  //   unitPrice,
  //   frequency,
  // );
  // const totalPrice = installments.reduce((sum, inv) => sum + inv.amount, 0);

  // 6. Create Reservation
  let newReservation;
  try {
    newReservation = await prisma.reservation.create({
      data: {
        tenantId,
        unitId,
        startDate: checkIn, // Save the normalized 2 PM date
        endDate: checkOut, // Save the normalized 12 PM date
        amount: unitPrice, // The rate (per night/month)
        totalPrice: totalPrice, // The full contract value
        frequency,
        status: "PENDING",
        // invoices: {
        //   create: installments.map((inst, index) => ({
        //     invoiceNumber: `INV-${Date.now()}-${index + 1}`, // Simple ID generation
        //     dueDate: inst.dueDate,
        //     amount: inst.amount,
        //     description: inst.description,
        //     status: "PENDING",
        //   })),
        // },
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Database error: Failed to create reservation." };
  }

  revalidatePath("/dashboard");
  // redirect("/dashboard/reservations");
  return { success: true, id: newReservation.id };
}

// ---------------------------------------------------------
// 2. CONFIRM RESERVATION (Generate Contract & Invoices)
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

  // 3. Transaction: Update Status + Create Invoices
  try {
    await prisma.$transaction([
      // A. Create the Invoices
      prisma.invoice.createMany({
        data: installments.map((inst, index) => ({
          reservationId: reservation.id,
          invoiceNumber: `INV-${reservation.id.slice(0, 4)}-${index + 1}`,
          dueDate: inst.dueDate,
          amount: inst.amount,
          description: inst.description,
          status: "PENDING",
        })),
      }),

      // B. Update Reservation Status
      prisma.reservation.update({
        where: { id: reservationId },
        data: { status: "CONFIRMED" },
      }),
    ]);
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
