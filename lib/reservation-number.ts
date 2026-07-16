import { Prisma } from "@prisma/client";

/**
 * Next per-organization sequential reservation number using the org's configured
 * format (prefix / padding / yearly reset). MUST run inside a Serializable
 * $transaction; the @@unique([organizationId, reservationNumber]) is the backstop.
 *
 * Mirrors the generator in app/api/reservations/route.ts so website-request
 * confirmation produces numbers in the same sequence/format.
 */
export async function generateReservationNumber(
  orgId: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const org = await tx.organization.findUnique({
    where: { id: orgId },
    select: {
      reservationNumberPrefix: true,
      reservationNumberPadding: true,
      reservationNumberResetYearly: true,
    },
  });

  const base = (org?.reservationNumberPrefix ?? "RES").trim() || "RES";
  const padding = Math.min(Math.max(org?.reservationNumberPadding ?? 5, 1), 10);
  const reset = org?.reservationNumberResetYearly ?? true;
  const prefix = reset ? `${base}-${new Date().getFullYear()}-` : `${base}-`;

  const last = await tx.reservation.findFirst({
    where: { organizationId: orgId, reservationNumber: { startsWith: prefix } },
    orderBy: { reservationNumber: "desc" },
    select: { reservationNumber: true },
  });

  let seq = 1;
  if (last?.reservationNumber) {
    const parts = last.reservationNumber.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}${String(seq).padStart(padding, "0")}`;
}
