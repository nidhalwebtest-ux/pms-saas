import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ROLE_BADGE, type Role } from "@/lib/permissions";
import AcceptForm from "./AcceptForm";
import { BuildingOffice2Icon, ClockIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t       = await getTranslations("auth.invite");
  const tBrand  = await getTranslations("auth.brand");
  const tRoles  = await getTranslations("settings.roles");

  const invite = await prisma.invitation.findUnique({
    where:   { token },
    include: {
      organization: { select: { name: true, logo: true } },
      invitedBy:    { select: { firstName: true, email: true } },
    },
  });

  if (!invite) notFound();

  // Determine state
  const expired   = invite.expiresAt < new Date();
  const used      = !!invite.usedAt;
  const cancelled = !!invite.cancelledAt;
  const invalid   = expired || used || cancelled;

  const inviterName = invite.invitedBy.firstName ?? invite.invitedBy.email.split("@")[0];
  const role        = invite.role as Role;

  // Compute time-left label
  const diff = invite.expiresAt.getTime() - Date.now();
  const timeLeftLabel =
    diff <= 0
      ? t("expired")
      : (() => {
          const h = Math.floor(diff / 3_600_000);
          const m = Math.floor((diff % 3_600_000) / 60_000);
          return h > 0
            ? t("hoursRemaining", { hours: h, minutes: m })
            : t("minutesRemaining", { minutes: m });
        })();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      {/* Background orbs */}
      <div className="pointer-events-none absolute top-1/4 start-1/4 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 end-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />

      <div
        className="w-full max-w-md"
        style={{ animation: "heroFadeUp 0.5s cubic-bezier(.4,0,.2,1) both" }}
      >
        {/* Branding */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/40">
            <BuildingOffice2Icon className="h-7 w-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">{tBrand("name")}</h1>
            <p className="text-sm text-slate-400">{tBrand("tagline")}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/80 backdrop-blur-sm p-8 shadow-2xl ring-1 ring-white/5">

          {/* Org + invite meta */}
          <div className="mb-6 rounded-xl bg-slate-800/60 px-4 py-4 space-y-2">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{t("from")}</p>
            <p className="text-base font-bold text-white">{invite.organization.name}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">{t("roleLabel")}</span>
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ROLE_BADGE[role]}`}>
                  {tRoles(role)}
                </span>
              </div>
              <span className="text-xs text-slate-500">{t("invitedBy", { name: inviterName })}</span>
            </div>
          </div>

          {/* Invalid state */}
          {invalid ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-red-800 bg-red-900/30 px-4 py-4">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
                <div>
                  <p className="text-sm font-semibold text-red-300">
                    {used      ? t("invalidUsedTitle")
                    : cancelled ? t("invalidCancelledTitle")
                    :             t("invalidExpiredTitle")}
                  </p>
                  <p className="mt-0.5 text-xs text-red-400">
                    {used      ? t("invalidUsedBody")
                    : cancelled ? t("invalidCancelledBody")
                    :             t("invalidExpiredBody")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Expiry badge */}
              <div className="mb-5 flex items-center gap-1.5 text-xs text-amber-400">
                <ClockIcon className="h-3.5 w-3.5 flex-shrink-0" />
                {timeLeftLabel}
              </div>

              <h2 className="mb-1 text-lg font-bold text-white">{t("createTitle")}</h2>
              <p className="mb-6 text-sm text-slate-400">
                {t.rich("createDesc", {
                  org: invite.organization.name,
                  b: (chunks) => <span className="text-slate-200 font-medium">{chunks}</span>,
                })}
              </p>

              <AcceptForm token={token} email={invite.email} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
