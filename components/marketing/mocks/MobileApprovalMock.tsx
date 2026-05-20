import { Check, X, Camera, Building2 } from "lucide-react";

/* ============================================================================
 *  Mobile approval mock — phone frame with an expense approval card. The
 *  manager taps approve or reject from anywhere.
 * ========================================================================= */

export function MobileApprovalMock() {
  return (
    <div className="grid place-items-center bg-gradient-to-br from-gray-50 to-brand-50 p-8">
      <PhoneFrame>
        <ExpenseCard />
        <RecentList />
      </PhoneFrame>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[230px] overflow-hidden rounded-[28px] border-[8px] border-gray-900 bg-gray-50 shadow-2xl">
      <span className="absolute inset-x-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-gray-900" />
      <div className="px-3 pt-8 pb-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[9px] text-gray-500 tabular-nums">9:41</p>
          <span className="text-[9px] font-medium text-gray-700">Approvals</span>
          <span className="font-mono text-[9px] text-gray-500">100%</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function ExpenseCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-warning-50 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-warning-700">
          Pending
        </span>
        <span className="font-mono text-[8.5px] text-gray-400 tabular-nums">EXP-0421</span>
      </div>

      <p className="mt-2 text-[11px] font-semibold text-gray-900">Cleaning supplies</p>
      <p className="font-mono text-[9px] text-gray-500">Salalah Plaza · Marina building</p>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
        <div>
          <p className="text-gray-500">Category</p>
          <p className="font-medium text-gray-700">Maintenance</p>
        </div>
        <div className="text-end">
          <p className="text-gray-500">Amount</p>
          <p className="font-mono font-semibold text-gray-900 tabular-nums">42.500 OMR</p>
        </div>
      </div>

      {/* Receipt thumbnail */}
      <div className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-2 py-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gray-200">
          <Camera className="h-3.5 w-3.5 text-gray-500" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-medium text-gray-700">receipt-0421.jpg</p>
          <p className="text-[8px] text-gray-400">Tap to view</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <button className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-gray-200 bg-white py-1.5 text-[9.5px] font-semibold text-gray-700">
          <X className="h-3 w-3" strokeWidth={2.5} />
          Reject
        </button>
        <button className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-success-500 py-1.5 text-[9.5px] font-semibold text-white shadow-sm">
          <Check className="h-3 w-3" strokeWidth={2.5} />
          Approve
        </button>
      </div>
    </div>
  );
}

const RECENT = [
  { who: "Reem · Receptionist",    amt: "12.500", tone: "bg-success-50 text-success-700", label: "Approved" },
  { who: "Salim · Maintenance",    amt: "85.000", tone: "bg-error-50 text-error-500",     label: "Rejected" },
  { who: "Jamil · Receptionist",   amt: "18.000", tone: "bg-success-50 text-success-700", label: "Approved" },
];

function RecentList() {
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-2">
      <p className="px-1 py-0.5 font-mono text-[8.5px] uppercase tracking-wide text-gray-500">Today</p>
      <ul className="mt-1 divide-y divide-gray-100">
        {RECENT.map((r) => (
          <li key={r.who} className="flex items-center gap-2 py-1.5">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-gray-100">
              <Building2 className="h-3 w-3 text-gray-500" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] text-gray-700">{r.who}</p>
              <p className="font-mono text-[8.5px] text-gray-500 tabular-nums">{r.amt} OMR</p>
            </div>
            <span className={`rounded-full px-1.5 py-px text-[7.5px] font-semibold ${r.tone}`}>
              {r.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
