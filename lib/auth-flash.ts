import { cookies } from "next/headers";

const FLASH_COOKIE = "auth_flash";
const TTL_SECONDS = 30;

export type AuthFlash = {
  /** Translation key under auth.login.serverErrors (or similar). */
  error?: string;
  /** Non-blocking warning translation key (e.g. email_send_failed). */
  warn?: string;
  /** Lockout end timestamp in unix ms — drives the countdown banner. */
  lockoutUntil?: number;
};

export async function setAuthFlash(payload: AuthFlash): Promise<void> {
  const store = await cookies();
  store.set(FLASH_COOKIE, JSON.stringify(payload), {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TTL_SECONDS,
  });
}

/**
 * Read the flash payload. The cookie auto-expires after {@link TTL_SECONDS}
 * so refreshing the page within that window will show the message again —
 * acceptable for short-lived auth feedback.
 */
export async function readAuthFlash(): Promise<AuthFlash | null> {
  const store = await cookies();
  const raw = store.get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthFlash;
  } catch {
    return null;
  }
}
