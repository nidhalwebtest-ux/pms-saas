import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

/**
 * Handles two flows:
 *  1. Email verification — Supabase redirects here after user clicks the link.
 *  2. Google OAuth — Supabase redirects here after Google auth completes.
 *
 * Supabase appends ?code=... to this URL. We exchange it for a session,
 * then redirect the user to /dashboard (or wherever `next` points).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Successful auth — send to dashboard (or onboarding for new users)
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong
  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}