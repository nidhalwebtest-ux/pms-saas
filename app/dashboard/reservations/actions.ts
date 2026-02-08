"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { normalizeReservationDates, calculatePeriod } from "@/utils/date-math";

const prisma = new PrismaClient();

export async function createReservation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. Extract Data
  const tenantId = formData.get("tenantId") as string;
  const unitId = formData.get("unitId") as string;

  // Raw dates from form (usually midnight)
  const rawStartDate = new Date(formData.get("startDate") as string);
  const rawEndDate = new Date(formData.get("endDate") as string);

  const unitPrice = parseFloat(formData.get("amount") as string);
  const frequency = formData.get("frequency") as "DAILY" | "MONTHLY" | "YEARLY";

  // 2. NORMALIZE DATES (The Magic Fix)
  // This transforms "Feb 1" to "Feb 1, 2:00 PM" and "Feb 3" to "Feb 3, 12:00 PM"
  const { checkIn, checkOut } = normalizeReservationDates(
    rawStartDate,
    rawEndDate,
  );

  // 3. Validation
  if (checkOut <= checkIn) {
    throw new Error("End date must be after start date");
  }

  // 4. Calculate Total Price (Server Side Security)
  const duration = calculatePeriod(rawStartDate, rawEndDate, frequency);
  const totalPrice = unitPrice * duration.quantity;

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
    throw new Error(
      `Unit is already booked for these dates (Collision with Reservation ID: ${overlapping.id})`,
    );
  }

  // 6. Create Reservation
  await prisma.reservation.create({
    data: {
      tenantId,
      unitId,
      startDate: checkIn, // Save the normalized 2 PM date
      endDate: checkOut, // Save the normalized 12 PM date
      amount: unitPrice, // The rate (per night/month)
      totalPrice: totalPrice, // The full contract value
      frequency,
      status: "CONFIRMED",
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard/reservations");
}

export async function updateReservationStatus(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = formData.get("id") as string;
  const newStatus = formData.get("status") as any; // "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED"

  // Security Check
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { unit: { include: { property: true } } },
  });

  if (reservation?.unit.property.organizationId !== dbUser?.organizationId) {
    throw new Error("Unauthorized");
  }

  // Update Status
  await prisma.reservation.update({
    where: { id },
    data: { status: newStatus },
  });

  revalidatePath(`/dashboard/reservations/${id}`);
  redirect(`/dashboard/reservations/${id}`);
}

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
    return { success: true, tenant: newTenant };
  } catch (error) {
    console.error("Error creating tenant:", error);
    return { error: "Failed to create tenant" };
  }
}
