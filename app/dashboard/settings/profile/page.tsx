import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { ROLE_BADGE, type Role } from "@/lib/permissions";
import { ProfileInfoForm, ChangePasswordForm } from "./ProfileForm";
import { UserCircleIcon } from "@heroicons/react/24/outline";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { firstName: true, lastName: true, phone: true, role: true, createdAt: true },
  });

  const tRoles = await getTranslations("settings.roles");

  const role       = (dbUser?.role ?? "STAFF") as Role;
  const initials   = [dbUser?.firstName, dbUser?.lastName]
    .filter(Boolean)
    .map((n) => n![0].toUpperCase())
    .join("") || user.email![0].toUpperCase();
  const displayName = [dbUser?.firstName, dbUser?.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* ── Header card ── */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-6 flex items-center gap-5">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-md shadow-blue-500/30">
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
          <span className={`mt-1.5 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ROLE_BADGE[role]}`}>
            {tRoles(role)}
          </span>
        </div>
        <UserCircleIcon className="ms-auto h-8 w-8 text-gray-300" />
      </div>

      {/* ── Personal info form ── */}
      <ProfileInfoForm
        firstName={dbUser?.firstName}
        lastName={dbUser?.lastName}
        phone={dbUser?.phone}
        email={user.email!}
      />

      {/* ── Change password form ── */}
      <ChangePasswordForm />

    </div>
  );
}
