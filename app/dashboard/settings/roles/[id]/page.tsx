import { notFound, redirect } from "next/navigation";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { normalizeMatrix } from "@/lib/rbac";
import RoleEditor from "../RoleEditor";

export const dynamic = "force-dynamic";

export default async function RoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [k: string]: string | undefined }>;
}) {
  let actor;
  try { actor = await requireOrgUser(); } catch { redirect("/login"); }

  const { id } = await params;
  const sp = await searchParams;

  const role = await prisma.role.findUnique({
    where: { id },
    select: {
      id: true, name: true, key: true, isSystem: true, description: true,
      permissions: true, organizationId: true, _count: { select: { users: true } },
    },
  });
  if (!role || role.organizationId !== actor.organizationId) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <RoleEditor
        role={{
          id: role.id,
          name: role.name,
          key: role.key,
          isSystem: role.isSystem,
          description: role.description ?? "",
          members: role._count.users,
          permissions: normalizeMatrix(role.permissions),
        }}
        startDuplicate={sp.duplicate === "1"}
      />
    </div>
  );
}
