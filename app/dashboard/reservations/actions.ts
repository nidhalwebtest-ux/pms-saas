"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

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
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const amount = formData.get("amount") as string; // Financial snapshot
  const frequency = formData.get("frequency") as any; // MONTHLY, DAILY

  // 2. Validation: End date must be after start date
  if (endDate <= startDate) {
    // In a real app, we would return an error object.
    // For MVP, we throw (which shows a generic error) or redirect with error param.
    throw new Error("End date must be after start date");
  }

  // 3. CRITICAL: Availability Check (Prevent Double Booking)
  // We look for any existing reservation for this UNIT that OVERLAPS with requested dates
  const overlapping = await prisma.reservation.findFirst({
    where: {
      unitId: unitId,
      status: { not: "CANCELLED" }, // Cancelled bookings don't count
      OR: [
        {
          // Existing start is inside new range
          startDate: { gte: startDate, lte: endDate },
        },
        {
          // Existing end is inside new range
          endDate: { gte: startDate, lte: endDate },
        },
        {
          // Existing range fully covers new range
          startDate: { lte: startDate },
          endDate: { gte: endDate },
        },
      ],
    },
  });

  if (overlapping) {
    throw new Error(
      `Unit is already booked for these dates (Collision with Reservation ID: ${overlapping.id})`,
    );
  }

  // 4. Create Reservation
  await prisma.reservation.create({
    data: {
      tenantId,
      unitId,
      startDate,
      endDate,
      amount,
      frequency,
      status: "CONFIRMED",
    },
  });

  revalidatePath("/dashboard"); // Refresh everything
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
