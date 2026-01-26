import { createOrganization } from "./actions";

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Setup your Organization
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Give your business a name to get started.
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form action={createOrganization} className="space-y-6">
          <div>
            <label
              htmlFor="companyName"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Company / Business Name
            </label>
            <div className="mt-2">
              <input
                id="companyName"
                name="companyName"
                type="text"
                required
                placeholder="e.g. Salalah Properties LLC"
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Create Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
