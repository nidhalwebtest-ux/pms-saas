import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  PageHeader,
  FormCard,
  FormInput,
  FormSelect,
  FormActions,
} from "@/components/ui/FormComponents";
import { addTeamMember } from "./actions";

const prisma = new PrismaClient();

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Fetch only active members (We removed invitations)
  const members = await prisma.user.findMany({
    where: { organizationId: dbUser?.organizationId! },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto py-8">
      <PageHeader
        title="Team Management"
        description="Create accounts for your staff members."
      />

      {/* --- 1. Add User Form --- */}
      <div className="mb-12">
        <form action={addTeamMember}>
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6">
            <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4">
              Add New Employee
            </h3>

            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
              {/* Name & Role */}
              <div className="col-span-1">
                <label className="block text-sm font-medium leading-6 text-gray-900">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  required
                  className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-medium leading-6 text-gray-900">
                  System Role
                </label>
                <select
                  name="role"
                  className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  <option value="STAFF">Receptionist (Limited)</option>
                  <option value="MANAGER">Manager (Full Access)</option>
                </select>
              </div>

              {/* Credentials */}
              <div className="col-span-1">
                <label className="block text-sm font-medium leading-6 text-gray-900">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="off"
                  className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-medium leading-6 text-gray-900">
                  Assign Password
                </label>
                <input
                  type="text"
                  name="password"
                  required
                  minLength={6}
                  placeholder="min 6 chars"
                  className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                Create Account
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* --- 2. Members List --- */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden mb-8">
        <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
          <h3 className="text-base font-semibold leading-6 text-gray-900">
            Active Staff Accounts
          </h3>
        </div>
        <ul role="list" className="divide-y divide-gray-200">
          {members.map((member) => (
            <li
              key={member.id}
              className="px-4 py-4 sm:px-6 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  {member.firstName ? member.firstName[0].toUpperCase() : "U"}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {member.firstName}
                    <span className="text-gray-400 font-normal ml-2">
                      ({member.email})
                    </span>
                    {member.id === user.id && (
                      <span className="ml-2 text-blue-600 text-xs bg-blue-50 px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{member.role}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
