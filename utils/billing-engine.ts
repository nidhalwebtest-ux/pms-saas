import { addMonths, addYears, addDays, startOfDay, format } from "date-fns";

interface Installment {
  dueDate: Date;
  amount: number;
  description: string;
}

export function generateInstallments(
  startDate: Date,
  endDate: Date,
  totalAmount: number,
  frequency: "MONTHLY" | "YEARLY" | "DAILY",
): Installment[] {
  const installments: Installment[] = [];
  let currentDate = startOfDay(startDate);
  const end = startOfDay(endDate);

  // 1. DAILY (Hotel Mode) - Usually 1 single invoice for the total
  if (frequency === "DAILY") {
    installments.push({
      dueDate: currentDate, // Due on check-in
      amount: totalAmount,
      description: `Full Payment (Daily Stay)`,
    });
    return installments;
  }

  // 2. MONTHLY / YEARLY (Lease Mode)
  let periodCount = 0;

  // We need to determine "Rent per Period"
  // If total is 1200 for 1 year, monthly is 100.
  // Note: accurate logic requires knowing the Rate Per Month, not just Total.
  // For MVP, assuming 'totalAmount' is the Monthly Rate if frequency is Monthly.
  // Let's assume the passed 'totalAmount' is the UNIT PRICE (e.g. 150 OMR/month).

  while (currentDate < end) {
    periodCount++;

    installments.push({
      dueDate: currentDate,
      amount: totalAmount, // This is the Monthly Rent
      description: `Rent for Period ${format(currentDate, "MMM yyyy")}`,
    });

    // Advance Date
    if (frequency === "MONTHLY") {
      currentDate = addMonths(currentDate, 1);
    } else if (frequency === "YEARLY") {
      currentDate = addYears(currentDate, 1);
    }
  }

  return installments;
}
