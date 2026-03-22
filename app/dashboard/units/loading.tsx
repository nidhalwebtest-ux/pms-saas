function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 last:border-0">
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-36 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
      </div>
      <div className="hidden sm:flex items-center gap-6">
        <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-12 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
        <div className="h-5 w-20 rounded-full bg-gray-100 animate-pulse" />
      </div>
    </div>
  );
}

export default function UnitsLoading() {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gray-100 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 rounded bg-gray-100 animate-pulse" />
            <div className="h-3 w-56 rounded bg-gray-100 animate-pulse" />
          </div>
        </div>
        <div className="h-9 w-24 rounded-lg bg-gray-100 animate-pulse" />
      </div>

      {/* Filters skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <div className="h-8 w-8 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
          <div className="h-9 flex-1 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-9 w-40 rounded-lg bg-gray-100 animate-pulse" />
        </div>
        <div className="flex gap-2 px-4 py-2.5 bg-gray-50/50">
          {[40, 70, 80, 75, 130].map((w, i) => (
            <div key={i} className="h-7 rounded-full bg-gray-100 animate-pulse" style={{ width: w }} />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 flex gap-6">
          {[80, 100, 50, 70, 80, 90].map((w, i) => (
            <div key={i} className="h-3 rounded bg-gray-200 animate-pulse" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}
