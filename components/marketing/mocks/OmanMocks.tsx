/* ============================================================================
 *  Built-for-Oman section mini-mocks. 120 px tall cards.
 * ========================================================================= */

/* ── Arabic UI snippet ─────────────────────────────────────────────────── */
export function ArabicUIMini() {
  return (
    <div dir="rtl" className="h-full bg-white p-2.5 font-arabic">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-gray-900">الحجوزات</p>
        <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[8px] font-semibold text-white">+ جديد</span>
      </div>
      <div className="mt-1.5 flex gap-1">
        <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[8px] font-semibold text-white">الكل</span>
        <span className="rounded-md border border-gray-200 px-1.5 py-0.5 text-[8px] text-gray-600">داخل الفندق</span>
        <span className="rounded-md border border-gray-200 px-1.5 py-0.5 text-[8px] text-gray-600">تجاوز</span>
      </div>
      <div className="mt-1.5 space-y-1">
        <Row name="ريم الهنائي"  unit="المرسى · 304" status="✓" tone="bg-success-50 text-success-700" />
        <Row name="سالم الخليلي" unit="الحفة · 102"  status="!" tone="bg-warning-50 text-warning-700" />
        <Row name="أحمد البلوشي" unit="المرسى · 211" status="X" tone="bg-error-50 text-error-500" />
      </div>
    </div>
  );
}
function Row({ name, unit, status, tone }: { name: string; unit: string; status: string; tone: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-gray-100 bg-white px-1.5 py-1">
      <div className="min-w-0">
        <p className="truncate text-[9px] font-medium text-gray-800">{name}</p>
        <p className="text-[8px] text-gray-400">{unit}</p>
      </div>
      <span className={`grid h-4 w-4 place-items-center rounded-full text-[8px] font-bold ${tone}`}>{status}</span>
    </div>
  );
}

/* ── OMR invoice snippet ───────────────────────────────────────────────── */
export function OMRInvoiceMini() {
  return (
    <div className="h-full bg-white p-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-wide text-gray-500">Invoice · BNY-04812</span>
        <span className="rounded-full bg-success-50 px-1.5 py-0.5 text-[8px] font-semibold text-success-700">Paid</span>
      </div>
      <div className="mt-2 space-y-1 text-[9px]">
        <Line label="Marina · 304 · 6n" amount="195.000" />
        <Line label="Cleaning · 3 visits" amount="24.000" />
        <Line label="Airport pickup" amount="12.000" />
      </div>
      <div className="mt-2 border-t border-dashed border-gray-200 pt-1.5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[9px] text-gray-500 uppercase">Total</span>
          <span className="font-mono text-[14px] font-semibold text-gray-900 tabular-nums">
            <span className="text-[10px] font-normal text-gray-500">OMR </span>242.<span className="text-[10px] text-gray-500">550</span>
          </span>
        </div>
        <p className="font-mono text-[8px] uppercase tracking-[0.06em] text-gray-400">VAT 5% · Khareef rate applied</p>
      </div>
    </div>
  );
}
function Line({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-700">{label}</span>
      <span className="font-mono text-gray-500 tabular-nums">{amount}</span>
    </div>
  );
}

/* ── Khareef calendar snippet ──────────────────────────────────────────── */
export function KhareefCalendarMini() {
  // 90-day strip; Jun15 – Sep15 highlighted.
  const days = Array.from({ length: 90 });
  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-1.5 bg-gradient-to-b from-khareef-50/60 to-white p-2.5">
      <p className="text-[9px] font-semibold text-khareef-700">Khareef season · 92 days</p>
      <div className="grid grid-cols-30 gap-px" style={{ gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}>
        {days.map((_, i) => {
          const inKhareef = i >= 15 && i <= 75;
          const peak = i >= 30 && i <= 60;
          return (
            <span
              key={i}
              className={[
                "h-2 rounded-[1px]",
                peak ? "bg-khareef-500" : inKhareef ? "bg-khareef-200" : "bg-gray-200",
              ].join(" ")}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between font-mono text-[8px] text-gray-500 tabular-nums">
        <span>Jun 1</span>
        <span className="rounded-full bg-khareef-500 px-1.5 py-px text-white">Peak · Jul 15</span>
        <span>Sep 30</span>
      </div>
    </div>
  );
}
