import { FileText, Download, CheckCircle2 } from "lucide-react";

/* ============================================================================
 *  Invoice mock — a sample OMR invoice with line items, payment block, and
 *  status chips. Stylised replica of the actual InvoicePDF, simplified.
 * ========================================================================= */

const LINES = [
  { desc: "Marina · 304 · 6 nights @ Khareef rate", qty: "6n", price: "32.500", total: "195.000" },
  { desc: "Daily cleaning · 3 visits",              qty: "3",  price: "8.000",  total: "24.000" },
  { desc: "Airport pickup",                          qty: "1",  price: "12.000", total: "12.000" },
];

export function InvoiceMock() {
  return (
    <div className="bg-white p-5">
      <div className="flex items-start justify-between border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-500 text-[12px] font-semibold text-white">B</span>
            <div>
              <p className="text-[12px] font-semibold text-gray-900">Salalah Plaza LLC</p>
              <p className="font-mono text-[10px] text-gray-500">VAT: OM 1100023456</p>
            </div>
          </div>
        </div>
        <div className="text-end">
          <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">Invoice</p>
          <p className="font-mono text-[14px] font-semibold text-gray-900 tabular-nums">BNY-04812</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[9.5px] font-semibold text-success-700">
            <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2.5} />
            Paid
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-3 text-[10.5px]">
        <div>
          <p className="text-gray-500">Bill to</p>
          <p className="font-medium text-gray-900">Reem Al-Hinai</p>
          <p className="text-gray-500">+968 9123 4567</p>
        </div>
        <div className="text-end">
          <p className="text-gray-500">Period · Issue</p>
          <p className="font-medium text-gray-900 tabular-nums">15–21 Jun</p>
          <p className="text-gray-500 tabular-nums">21 Jun 2026</p>
        </div>
      </div>

      <table className="w-full text-[10.5px]">
        <thead>
          <tr className="border-y border-gray-200 bg-gray-50 text-start font-mono uppercase tracking-[0.06em] text-gray-500">
            <th className="px-2 py-2 text-start font-normal">Description</th>
            <th className="px-2 py-2 text-end font-normal">Qty</th>
            <th className="px-2 py-2 text-end font-normal">Rate</th>
            <th className="px-2 py-2 text-end font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {LINES.map((l) => (
            <tr key={l.desc} className="border-b border-gray-100">
              <td className="px-2 py-2 text-gray-700">{l.desc}</td>
              <td className="px-2 py-2 text-end font-mono text-gray-500 tabular-nums">{l.qty}</td>
              <td className="px-2 py-2 text-end font-mono text-gray-500 tabular-nums">{l.price}</td>
              <td className="px-2 py-2 text-end font-mono text-gray-900 tabular-nums">{l.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
          <p className="font-mono text-[9px] uppercase tracking-wide text-gray-500">Notes</p>
          <p className="mt-1 text-[10px] text-gray-600">Payment received via bank transfer.</p>
        </div>
        <div className="rounded-md bg-gray-900 px-3 py-2.5 text-white">
          <div className="flex justify-between text-[10px] text-white/70">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">231.000</span>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/70">
            <span>VAT 5%</span>
            <span className="font-mono tabular-nums">11.550</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-white/20 pt-2">
            <span className="text-[10.5px] font-semibold">Total OMR</span>
            <span className="font-mono text-[16px] font-semibold tabular-nums">242.550</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[9.5px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <FileText className="h-3 w-3" strokeWidth={1.75} />
          Generated automatically · Khareef rate applied
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5">
          <Download className="h-2.5 w-2.5" strokeWidth={1.75} />
          PDF
        </span>
      </div>
    </div>
  );
}
