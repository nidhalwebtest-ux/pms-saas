export default function UnitDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="h-3 w-20 rounded bg-gray-200" />
        <div className="h-3 w-2 rounded bg-gray-200" />
        <div className="h-3 w-28 rounded bg-gray-200" />
        <div className="h-3 w-2 rounded bg-gray-200" />
        <div className="h-3 w-16 rounded bg-gray-200" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gray-200" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-gray-200" />
            <div className="h-3 w-56 rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 rounded-lg bg-gray-200" />
          <div className="h-9 w-36 rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Details card */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 h-4 w-24 rounded bg-gray-200" />
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-2.5 w-12 rounded bg-gray-200" />
                  <div className="h-4 w-20 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>

          {/* Notes skeleton */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 h-4 w-28 rounded bg-gray-200" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-7 w-7 rounded-full bg-gray-200" />
                  <div className="flex-1 rounded-xl bg-gray-100 p-3 space-y-2">
                    <div className="h-3 w-24 rounded bg-gray-200" />
                    <div className="h-3 w-full rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing skeleton */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 h-4 w-20 rounded bg-gray-200" />
          <div className="rounded-xl bg-blue-50 p-4 space-y-3">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg bg-white p-2 space-y-1">
                  <div className="h-2.5 w-10 rounded bg-gray-200" />
                  <div className="h-4 w-16 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
