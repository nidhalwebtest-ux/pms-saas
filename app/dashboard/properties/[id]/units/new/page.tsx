import Link from "next/link";
import { createUnit } from "../../actions";

export default async function NewUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // In Next.js 15, params is a Promise
  const { id } = await params;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Add New Unit / Room
        </h2>
        <p className="text-sm text-gray-500">
          Add a rentable unit to this property.
        </p>
      </div>

      <form
        action={createUnit}
        className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2"
      >
        {/* Hidden Field to pass the Property ID */}
        <input type="hidden" name="propertyId" value={id} />

        <div className="px-4 py-6 sm:p-8">
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
            {/* Unit Name */}
            <div className="sm:col-span-3">
              <label
                htmlFor="name"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Unit Name / Number
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  placeholder="e.g. Room 101, Apt 4B"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            {/* Price */}
            <div className="sm:col-span-3">
              <label
                htmlFor="basePrice"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Base Price (OMR)
              </label>
              <div className="mt-2">
                <input
                  type="number"
                  step="0.01"
                  name="basePrice"
                  id="basePrice"
                  required
                  placeholder="0.00"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            {/* Details Row */}
            <div className="sm:col-span-2">
              <label
                htmlFor="floor"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Floor
              </label>
              <div className="mt-2">
                <input
                  type="number"
                  name="floor"
                  id="floor"
                  defaultValue="1"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="bedrooms"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Bedrooms
              </label>
              <div className="mt-2">
                <input
                  type="number"
                  name="bedrooms"
                  id="bedrooms"
                  defaultValue="1"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="bathrooms"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Bathrooms
              </label>
              <div className="mt-2">
                <input
                  type="number"
                  name="bathrooms"
                  id="bathrooms"
                  defaultValue="1"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8">
          <Link
            href={`/dashboard/properties/${id}`}
            className="text-sm font-semibold leading-6 text-gray-900"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Save Unit
          </button>
        </div>
      </form>
    </div>
  );
}
