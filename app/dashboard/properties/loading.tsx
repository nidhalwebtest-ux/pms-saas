function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 last:border-0">
      <div className="h-10 w-14 flex-shrink-0 rounded-md bg-gray-100 animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-48 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-32 rounded bg-gray-100 animate-pulse" />
      </div>
      <div className="hidden md:flex items-center gap-6">
        <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-12 rounded bg-gray-100 animate-pulse" />
        <div className="h-5 w-20 rounded-full bg-gray-100 animate-pulse" />
      </div>
    </div>
  );
}

export default function PropertiesLoading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Filter bar skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <div className="h-8 w-8 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
          <div className="h-9 flex-1 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-7 w-16 rounded-md bg-gray-100 animate-pulse" />
        </div>
        <div className="flex gap-2 px-4 py-2.5 bg-gray-50/50">
          {[80, 90, 80, 90, 100].map((w, i) => (
            <div key={i} className="h-7 rounded-full bg-gray-100 animate-pulse" style={{ width: w }} />
          ))}
        </div>
      </div>

      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex gap-2">
          {[60, 60, 80].map((w, i) => (
            <div key={i} className="h-7 rounded-lg bg-gray-100 animate-pulse" style={{ width: w }} />
          ))}
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-28 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-7 w-20 rounded-lg bg-gray-100 animate-pulse" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 flex gap-6">
          {[60, 120, 80, 60, 60, 60, 80].map((w, i) => (
            <div key={i} className="h-3 rounded bg-gray-200 animate-pulse" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}
