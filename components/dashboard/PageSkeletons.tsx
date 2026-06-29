/**
 * Shared loading skeletons used by route-level loading.tsx files so navigation
 * shows an instant placeholder instead of a frozen previous page.
 */

function Bar({ w, h = 12, rounded = "rounded" }: { w: number | string; h?: number; rounded?: string }) {
  return <div className={`${rounded} bg-gray-100 animate-pulse`} style={{ width: w, height: h }} />;
}

function ListRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 last:border-0">
      <div className="flex-1 space-y-1.5">
        <Bar w={150} h={14} />
        <Bar w={96} h={12} />
      </div>
      <div className="hidden sm:flex items-center gap-6">
        <Bar w={96} />
        <Bar w={48} />
        <Bar w={64} />
        <Bar w={80} />
        <Bar w={80} h={20} rounded="rounded-full" />
      </div>
    </div>
  );
}

/** Header + filter bar + table — for list pages (reservations, invoices, tenants). */
export function ListPageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gray-100 animate-pulse" />
          <div className="space-y-1.5">
            <Bar w={140} h={16} />
            <Bar w={224} h={12} />
          </div>
        </div>
        <div className="h-9 w-24 rounded-lg bg-gray-100 animate-pulse" />
      </div>

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

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 flex gap-6">
          {[80, 100, 50, 70, 80, 90].map((w, i) => (
            <div key={i} className="h-3 rounded bg-gray-200 animate-pulse" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => <ListRow key={i} />)}
      </div>
    </div>
  );
}

/** Header + KPI cards + 2-column body — for record detail pages (tenant detail). */
export function DetailPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto py-8 animate-in fade-in duration-200">
      <div className="flex items-center gap-4 border-b border-gray-200 pb-6 mb-6">
        <div className="h-16 w-16 rounded-full bg-gray-100 animate-pulse" />
        <div className="space-y-2">
          <Bar w={200} h={22} />
          <Bar w={150} h={14} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-4 border-s-4 border-gray-200 space-y-2">
            <Bar w={80} h={10} />
            <Bar w={110} h={22} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white shadow-sm rounded-lg p-4 space-y-3">
              <Bar w={120} h={14} />
              {Array.from({ length: 4 }).map((_, j) => <Bar key={j} w="100%" h={12} />)}
            </div>
          ))}
        </div>
        <div className="lg:col-span-2">
          <div className="bg-white shadow-sm rounded-lg p-5 space-y-3">
            <Bar w={180} h={16} />
            {Array.from({ length: 6 }).map((_, i) => <Bar key={i} w="100%" h={36} rounded="rounded-lg" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
