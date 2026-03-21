import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { can, type Role } from "@/lib/permissions";
import { sendInvitation } from "./actions";
import MemberRow from "./MemberRow";
import InvitationRow from "./InvitationRow";
import InviteForm from "./InviteForm";
import {
  UsersIcon,
  PaperAirplaneIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-gray-900/5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{count}</p>
    </div>
  );
}

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true, role: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const callerRole = (dbUser.role ?? "STAFF") as Role;
  if (!can(callerRole, "manageTeam")) redirect("/dashboard?error=unauthorized");

  const [members, pendingInvitations] = await Promise.all([
    prisma.user.findMany({
      where:   { organizationId: dbUser.organizationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: {
        organizationId: dbUser.organizationId,
        usedAt:         null,
        cancelledAt:    null,
        expiresAt:      { gt: new Date() },
      },
      include: { invitedBy: { select: { firstName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const counts = {
    total:         members.length,
    admins:        members.filter((m) => m.role === "OWNER" || m.role === "MANAGER").length,
    receptionists: members.filter((m) => m.role === "STAFF").length,
    accountants:   members.filter((m) => m.role === "ACCOUNTANT").length,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Invite staff and manage their access levels.
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
          <UsersIcon className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Staff"  count={counts.total}         color="text-gray-900" />
        <StatCard label="Admin"        count={counts.admins}        color="text-blue-600" />
        <StatCard label="Receptionist" count={counts.receptionists} color="text-green-600" />
        <StatCard label="Accountant"   count={counts.accountants}   color="text-amber-600" />
      </div>

      {/* Invite form */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <PaperAirplaneIcon className="h-5 w-5 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Invite Team Member</h2>
        </div>
        <div className="p-6">
          <InviteForm
            action={sendInvitation}
            canAssignAdmin={callerRole === "OWNER"}
          />
        </div>
      </div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
          <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900">
              Pending Invitations
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                {pendingInvitations.length}
              </span>
            </h2>
          </div>
          <ul role="list" className="divide-y divide-gray-100">
            {pendingInvitations.map((invite) => (
              <InvitationRow key={invite.id} invite={invite} />
            ))}
          </ul>
        </div>
      )}

      {/* Role permissions reference */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Role Permissions</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            {
              role:  "Admin",
              color: "bg-blue-100 text-blue-700",
              perms: ["All properties & units", "All tenants & reservations", "All payments & expenses", "Team management"],
            },
            {
              role:  "Receptionist",
              color: "bg-green-100 text-green-700",
              perms: ["View properties", "Manage tenants", "Manage reservations", "Record payments"],
            },
            {
              role:  "Accountant",
              color: "bg-amber-100 text-amber-700",
              perms: ["View dashboard", "Record payments", "Manage expenses", "Cannot access tenants or reservations"],
            },
          ].map((r) => (
            <div key={r.role} className="flex items-start gap-4 px-6 py-4">
              <span className={`mt-0.5 flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${r.color}`}>
                {r.role}
              </span>
              <ul className="flex flex-wrap gap-x-6 gap-y-1">
                {r.perms.map((p) => (
                  <li key={p} className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-gray-400 flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Active staff */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Staff Accounts
            <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
              {members.length}
            </span>
          </h2>
          {callerRole === "OWNER" && (
            <p className="text-xs text-gray-500">Click ✏ to change a member&apos;s role</p>
          )}
        </div>
        <ul role="list" className="divide-y divide-gray-100">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              currentUserId={user.id}
              callerRole={callerRole}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
