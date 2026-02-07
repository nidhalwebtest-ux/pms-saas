import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import {
  BuildingOfficeIcon,
  HomeIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import {
  ListHeader,
  ListTable,
  ListTh,
  ListTd,
  ListEmptyState,
} from "@/components/ui/ListComponents";

const prisma = new PrismaClient();

export default async function PropertiesPage() {
  // 1. Fetch Data
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Get the Org ID first
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Fetch Properties for this Organization
  const properties = await prisma.property.findMany({
    where: {
      organizationId: dbUser?.organizationId!,
    },
    include: {
      _count: {
        select: { units: true }, // Get the number of units/rooms automatically
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (properties.length === 0) {
    return (
      <ListEmptyState
        title="No properties found"
        description="Get started by creating your first property."
        actionLabel="New Property"
        actionHref="/dashboard/properties/new"
      />
    );
  }

  return (
    <div>
      <ListHeader
        title="Properties"
        description="Manage your buildings, hotels, and compounds."
        searchPlaceholder="Search properties..."
        primaryAction={{
          label: "New Property",
          href: "/dashboard/properties/new",
        }}
      />

      <ListTable>
        <thead className="bg-gray-50">
          <tr>
            <ListTh>Property Name</ListTh>
            <ListTh>Type</ListTh>
            <ListTh>Location</ListTh>
            <ListTh>Units</ListTh>
            <ListTh className="relative">
              <span className="sr-only">Actions</span>
            </ListTh>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {properties.map((property) => (
            <tr
              key={property.id}
              className="hover:bg-gray-50 transition-colors"
            >
              <ListTd>
                <Link
                  href={`/dashboard/properties/${property.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {property.name}
                </Link>
              </ListTd>
              <ListTd>
                <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                  {property.type}
                </span>
              </ListTd>
              <ListTd className="text-gray-500">
                {property.city}, {property.governorate}
              </ListTd>
              <ListTd className="text-gray-500">
                {property._count.units} units
              </ListTd>
              <ListTd className="text-right">
                <Link
                  href={`/dashboard/properties/${property.id}`}
                  className="text-blue-600 hover:text-blue-900 text-xs font-semibold"
                >
                  View
                </Link>
                <span className="text-gray-300 mx-2">|</span>
                <Link
                  href={`/dashboard/properties/${property.id}/edit`}
                  className="text-gray-600 hover:text-gray-900 text-xs"
                >
                  Edit
                </Link>
              </ListTd>
            </tr>
          ))}
        </tbody>
      </ListTable>
    </div>
  );
}
