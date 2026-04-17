import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

/**
 * PATCH /api/me/language — set the user's UI language.
 *
 * Body: { locale: "en" | "ar" }
 *
 * Always sets the cookie (works pre-auth too). If the user is authenticated,
 * also persists `User.preferredLanguage` so the choice survives across devices.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { locale } = body;

  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });

  // Persist on the user record if logged in
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { preferredLanguage: locale },
      }).catch(() => {});
    }
  } catch {
    /* not logged in or no user row yet — cookie is enough */
  }

  return NextResponse.json({ success: true, locale });
}
