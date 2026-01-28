"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function createPayment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. Extract Data
  const reservationId = formData.get("reservationId") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const date = new Date(formData.get("date") as string);
  const method = formData.get("method") as any;
  const reference = formData.get("reference") as string;
  const notes = formData.get("notes") as string;

  // 2. Security Check (Verify User's Org owns this Reservation)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { unit: { include: { property: true } } },
  });

  if (reservation?.unit.property.organizationId !== dbUser?.organizationId) {
    throw new Error("Unauthorized");
  }

  // 3. Create Payment
  await prisma.payment.create({
    data: {
      amount,
      date,
      method,
      reference,
      notes,
      reservationId,
    },
  });

  // 4. Redirect back to the Reservation Details
  revalidatePath(`/dashboard/reservations/${reservationId}`);
  redirect(`/dashboard/reservations/${reservationId}`);
}
