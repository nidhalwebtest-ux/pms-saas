/**
 * Bank-routing rules for payment methods (client-safe, no DB).
 *
 * Non-cash methods settle into a bank account. A bank transfer *must* name the
 * account; card/cheque/online *may* (they also land in a bank, sometimes after
 * a clearing delay). Cash never routes to a bank directly — it reaches one only
 * via a cashier deposit (Phase 4).
 */
export const BANK_METHODS = ["BANK_TRANSFER", "CARD", "CHEQUE", "ONLINE"] as const;

/** True when the method can/should be tied to a specific bank account. */
export function methodNeedsBank(method: string | null | undefined): boolean {
  return !!method && (BANK_METHODS as readonly string[]).includes(method);
}

/** True when a bank account is mandatory (bank transfer). */
export function methodRequiresBank(method: string | null | undefined): boolean {
  return method === "BANK_TRANSFER";
}
