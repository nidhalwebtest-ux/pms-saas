"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    redirect("/login?error=invalid_credentials");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (
      error.message.toLowerCase().includes("invalid") ||
      error.message.toLowerCase().includes("credentials") ||
      error.message.toLowerCase().includes("password") ||
      error.status === 400
    ) {
      redirect("/login?error=invalid_credentials");
    }
    redirect("/login?error=server_error");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    redirect("/login?error=invalid_credentials");
  }

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("already registered") || error.status === 422) {
      redirect("/login?error=Could+not+create+user");
    }
    redirect("/login?error=server_error");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}