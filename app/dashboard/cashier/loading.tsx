export default function CashierLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-200" />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-gray-200" />
            <div className="h-3 w-64 rounded bg-gray-100" />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="h-9 w-40 rounded-lg bg-gray-200" />
          <div className="h-9 w-40 rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="h-3 w-16 rounded bg-gray-100" />
            <div className="mt-2 h-5 w-24 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Daybook table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <div className="h-4 w-32 rounded bg-gray-200" />
        </div>
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div className="h-3 w-40 rounded bg-gray-100" />
              <div className="h-3 w-20 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
