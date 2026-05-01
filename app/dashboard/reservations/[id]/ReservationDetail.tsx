"use client";

import { useEffect, useState, useCallback } from "react";
import ExtendStayModal from "@/components/reservations/ExtendStayModal";
import MoveUnitModal from "@/components/reservations/MoveUnitModal";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { format as fmtDateFns } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import {
  ArrowLeftIcon,
  PrinterIcon,
  PencilSquareIcon,
  XMarkIcon,
  CheckIcon,
  PhoneIcon,
  EnvelopeIcon,
  IdentificationIcon,
  CalendarDaysIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChatBubbleLeftEllipsisIcon,
  UserIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import { StarIcon, ShieldExclamationIcon } from "@heroicons/react/24/solid";

// ── Types ──────────────────────────────────────────────────────────────────────

type UnitRow = {
  id: string; name: string; floor: number; unitType: string;
  propertyId: string; propertyName: string;
  rateType: string; rateAmount: string; rateSource: string;
  seasonalPriceName: string | null; nights: number; subtotal: string;
  isMovedOut?: boolean;
  movedToUnitId?: string | null;
  movedToUnitName?: string | null;
  moveDate?: string | null;
  moveReason?: string | null;
};

type PaymentRow = {
  id: string; amount: string; date: string; method: string;
  reference: string | null; notes: string | null; invoiceNumber: string | null;
};

type ChargeRow = {
  id: string; description: string; amount: string;
  category: string; createdAt: string; createdByName: string | null;
};

type ActivityRow = {
  id: string; action: string; description: string;
  performedByName: string | null; createdAt: string; metadata: unknown;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  monthNumber: number | null;
  status: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
};

type ReturnLineItem = {
  id: string; description: string; quantity: number;
  unitPrice: string; lineTotal: string;
};

type ReturnRow = {
  id: string;
  returnNumber: string;
  returnFrom: string;
  returnTo: string;
  returnDays: number;
  returnType: string;
  returnAmount: string;
  refundRequired: boolean;
  refundAmount: string;
  refundStatus: string;       // NOT_REQUIRED | PENDING | COMPLETED
  refundMethod: string | null;
  refundReference: string | null;
  refundDate: string | null;
  reason: string;
  notes: string | null;
  invoiceNumber: string | null;
  createdAt: string;
  lineItems: ReturnLineItem[];
};

type ReservationData = {
  id: string;
  reservationNumber: string | null;
  status: string;
  displayStatus: string;
  displayStatusBadgeClass: string;
  displayStatusPriority: number;
  displayStatusUrgent: boolean;
  displayStatusPulse: boolean;
  startDate: string;
  endDate: string;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  totalNights: number;
  rateType: string;
  source: string;
  notes: string | null;
  cancelledReason: string | null;
  cancelledAt: string | null;
  refundPending: boolean;
  totalAmount: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  amountPaid: string;
  balanceDue: string;
  chargesTotal: string;
  tenant: {
    id: string; firstName: string; lastName: string; fullNameArabic: string | null;
    phone: string; whatsappNumber: string | null; email: string | null;
    nationality: string | null; classification: string | null; tenantType: string | null;
    corporateName: string | null; idType: string | null; idNumber: string | null;
    idExpiryDate: string | null; specialRequests: string | null; internalNotes: string | null;
    totalStays: number; totalSpent: string; firstStayDate: string | null;
  };
  units: UnitRow[];
  payments: PaymentRow[];
  charges: ChargeRow[];
  activities: ActivityRow[];
  invoicesGenerated: boolean;
  invoices: InvoiceRow[];
  returns: ReturnRow[];
  createdByName: string | null;
  createdAt: string;
};

type ModalType = "check-in" | "check-out" | "cancel" | "payment" | "charge" | "note" | "extend-stay" | "move-unit" | "generate-invoices" | "return" | null;

// ── Formatters ─────────────────────────────────────────────────────────────────

function isToday(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function diffDays(a: string, b: string) {
  const ms = new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

function useDateFnsLocale() {
  const locale = useLocale();
  return locale === "ar" ? arLocale : enLocale;
}

function useFmtDate() {
  const dl = useDateFnsLocale();
  return (iso: string, opts?: { day?: string; month?: string; year?: string; weekday?: string }) => {
    if (!opts) return fmtDateFns(new Date(iso), "d MMM yyyy", { locale: dl });
    let pattern = "";
    if (opts.weekday === "long") pattern += "EEEE, ";
    if (opts.day === "numeric") pattern += "d ";
    if (opts.month === "short") pattern += "MMM ";
    else if (opts.month === "long") pattern += "MMMM ";
    if (opts.year === "numeric") pattern += "yyyy";
    return fmtDateFns(new Date(iso), pattern.trim(), { locale: dl });
  };
}

function useFmtDateFull() {
  const dl = useDateFnsLocale();
  return (iso: string) =>
    fmtDateFns(new Date(iso), "EEEE, d MMMM yyyy", { locale: dl });
}

function useFmtTime() {
  const dl = useDateFnsLocale();
  return (iso: string) => fmtDateFns(new Date(iso), "HH:mm", { locale: dl });
}

function useFmtMethod() {
  const t = useTranslations("reservations.detail.paymentMethods");
  return (m: string) => {
    try {
      return t(m as "CASH" | "CARD" | "BANK_TRANSFER" | "CHEQUE" | "OTHER");
    } catch {
      return m;
    }
  };
}

function useFmtSource() {
  const t = useTranslations("reservations.detail.sourcesMap");
  return (s: string) => {
    try {
      return t(s as "walk_in" | "phone" | "whatsapp" | "website" | "agent" | "online");
    } catch {
      return s;
    }
  };
}

function useFmtUnitType() {
  const t = useTranslations("reservations.detail.unitTypes");
  return (k: string) => {
    try {
      return t(k as "STUDIO" | "ONE_BR" | "TWO_BR" | "THREE_BR" | "FOUR_BR" | "SUITE" | "PENTHOUSE" | "VILLA");
    } catch {
      return k;
    }
  };
}

// ── Small UI helpers ───────────────────────────────────────────────────────────

function ClassBadge({ c }: { c: string | null }) {
  const t = useTranslations("reservations.detail.guest");
  if (c === "vip")
    return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full"><StarIcon className="h-3 w-3" /> {t("vip")}</span>;
  if (c === "blacklisted")
    return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><ShieldExclamationIcon className="h-3 w-3" /> {t("blacklisted")}</span>;
  return null;
}

function StatusBadge({ label, badgeClass, pulse }: { label: string; badgeClass: string; pulse: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold ${badgeClass} ${pulse ? "animate-pulse" : ""}`}>
      {label}
    </span>
  );
}

function Collapsible({ title, defaultOpen = true, children }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-800">{title}</span>
        {open ? <ChevronUpIcon className="h-4 w-4 text-gray-400" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 px-5 py-4">{children}</div>}
    </div>
  );
}

// ── Modal wrapper ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Payment form (reused in check-in/check-out modals) ────────────────────────

function PaymentForm({
  balanceDue,
  value,
  onChange,
}: {
  balanceDue: string;
  value: { amount: string; method: string; reference: string };
  onChange: (v: typeof value) => void;
}) {
  const t = useTranslations("reservations.detail.paymentForm");
  const tm = useTranslations("reservations.detail.paymentMethods");
  return (
    <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-medium text-gray-700">{t("title")}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t("amount")}</label>
          <input
            type="number" step="0.001" min="0"
            value={value.amount}
            onChange={(e) => onChange({ ...value, amount: e.target.value })}
            placeholder={balanceDue}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ltr-numbers"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t("method")}</label>
          <select
            value={value.method}
            onChange={(e) => onChange({ ...value, method: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="CASH">{tm("CASH")}</option>
            <option value="CARD">{tm("CARD")}</option>
            <option value="BANK_TRANSFER">{tm("BANK_TRANSFER")}</option>
            <option value="CHEQUE">{tm("CHEQUE")}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t("reference")}</label>
        <input
          type="text" value={value.reference}
          onChange={(e) => onChange({ ...value, reference: e.target.value })}
          placeholder={t("referencePlaceholder")}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

// ── Check-In Modal ─────────────────────────────────────────────────────────────

function CheckInModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const t = useTranslations("reservations.detail.checkInModal");
  const [loading, setLoading] = useState(false);

  const checkInDate = res.startDate;
  const daysUntil = diffDays(new Date().toISOString(), checkInDate);

  async function handleConfirm() {
    setLoading(true);
    const r = await fetch(`/api/reservations/${res.id}/check-in`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
    toast.success(data.message ?? t("successDefault"));
    onSuccess();
  }

  const ref = res.reservationNumber ?? res.id.slice(0, 8);
  const whenText = daysUntil === 1 ? t("tomorrow") : t("inDays", { count: daysUntil });

  return (
    <Modal title={t("title", { ref })} onClose={onClose}>
      <div className="space-y-5">
        {/* Guest */}
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
            {res.tenant.firstName[0]}{res.tenant.lastName[0]}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{res.tenant.firstName} {res.tenant.lastName}</p>
            <p className="text-sm text-gray-500 ltr-numbers">{res.tenant.phone}</p>
          </div>
        </div>

        {/* Date info */}
        {daysUntil > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
            <span>{t("earlyCheckInQuestion", { when: whenText })}</span>
          </div>
        )}

        {/* Units */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">{t("unitsBeingAssigned")}</p>
          <div className="flex flex-wrap gap-2">
            {res.units.map((u) => (
              <span key={u.id} className="inline-flex items-center px-3 py-1 rounded-lg bg-gray-100 text-sm font-medium text-gray-800">
                {u.name} — {u.propertyName}
              </span>
            ))}
          </div>
        </div>

        {res.invoicesGenerated && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <BanknotesIcon className="h-4 w-4 shrink-0" />
            <span>{t("invoicesExist", { count: res.invoices.length })}</span>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? t("checking") : t("confirm")}
        </button>
      </div>
    </Modal>
  );
}

// ── Check-Out Modal ────────────────────────────────────────────────────────────

function CheckOutModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const t = useTranslations("reservations.detail.checkOutModal");
  const td = useTranslations("reservations.detail.returnModal");
  const fmtDate = useFmtDate();
  const today = new Date();
  const todayIso = today.toISOString();
  const extraDays = diffDays(res.endDate, todayIso);   // positive = overstay, negative = early
  const isEarly = extraDays < 0;
  const isOverstay = extraDays > 0;

  // Estimate per-night rate from first unit
  const nightlyRate = res.units.length > 0 ? (Number(res.units[0].subtotal) / Math.max(1, res.units[0].nights)) : 0;
  const estimatedAdjustment = Math.abs(extraDays) * nightlyRate;

  const [adjustToggle, setAdjustToggle] = useState(isOverstay);
  const [payment, setPayment] = useState({ amount: res.balanceDue, method: "CASH", reference: "" });
  const [condition, setCondition] = useState({ inspected: false, keysReturned: false, noDamage: false });
  const [loading, setLoading] = useState(false);

  const adjustmentAmt = adjustToggle ? (isEarly ? -estimatedAdjustment : estimatedAdjustment) : 0;
  const adjustedBalance = Math.max(0, Number(res.balanceDue) + adjustmentAmt).toFixed(3);

  async function handleConfirm() {
    setLoading(true);
    const body: Record<string, unknown> = {
      forceWithBalance: true,
      adjustCharges: adjustToggle,
      additionalAmount: estimatedAdjustment,
      unitCondition: condition,
    };
    if (payment.amount && Number(payment.amount) > 0) {
      body.payment = { amount: Number(payment.amount), method: payment.method, reference: payment.reference || null };
    }
    const r = await fetch(`/api/reservations/${res.id}/check-out`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
    toast.success(data.message ?? t("successDefault"));
    onSuccess();
  }

  const ref = res.reservationNumber ?? res.id.slice(0, 8);

  const conditionEntries: { key: "inspected" | "keysReturned" | "noDamage"; label: string }[] = [
    { key: "inspected",    label: t("inspected") },
    { key: "keysReturned", label: t("keysReturned") },
    { key: "noDamage",     label: t("noDamage") },
  ];

  return (
    <Modal title={t("title", { ref })} onClose={onClose}>
      <div className="space-y-5">
        {/* Stay summary */}
        <div className={`p-4 rounded-xl ${isOverstay ? "bg-red-50 border border-red-200" : isEarly ? "bg-blue-50 border border-blue-200" : "bg-green-50 border border-green-200"}`}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">{t("plannedCheckout")}</p>
              <p className="font-semibold text-gray-900">{fmtDate(res.endDate)}</p>
            </div>
            <div>
              <p className="text-gray-500">{t("today")}</p>
              <p className="font-semibold text-gray-900">{fmtDate(today.toISOString())}</p>
            </div>
          </div>
          {isOverstay && (
            <p className="mt-2 text-sm font-medium text-red-700">{t("overstayWarning", { count: extraDays })}</p>
          )}
          {isEarly && (
            <p className="mt-2 text-sm font-medium text-blue-700">{t("earlyWarning", { count: Math.abs(extraDays) })}</p>
          )}
        </div>

        {/* Adjustment toggle */}
        {(isEarly || isOverstay) && estimatedAdjustment > 0 && (
          <div className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl">
            <input
              type="checkbox" id="adjust" checked={adjustToggle}
              onChange={(e) => {
                setAdjustToggle(e.target.checked);
                setPayment((p) => ({ ...p, amount: Math.max(0, Number(res.balanceDue) + (e.target.checked ? adjustmentAmt : 0)).toFixed(3) }));
              }}
              className="mt-0.5 h-4 w-4 rounded text-blue-600"
            />
            <label htmlFor="adjust" className="text-sm text-gray-700 cursor-pointer">
              {isEarly
                ? t("earlyToggle", { amount: estimatedAdjustment.toFixed(3) })
                : t("overstayToggle", {
                    nights: Math.abs(extraDays),
                    nightsLabel: td("nightsLabel"),
                    rate: nightlyRate.toFixed(3),
                    total: estimatedAdjustment.toFixed(3),
                  })}
            </label>
          </div>
        )}

        {/* Financial summary */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>{t("originalTotal")}</span>
            <span><span className="ltr-numbers">{res.grandTotal}</span> OMR</span>
          </div>
          {adjustToggle && estimatedAdjustment > 0 && (
            <div className={`flex justify-between ${isEarly ? "text-blue-600" : "text-red-600"}`}>
              <span>{isEarly ? t("earlyReduction") : t("overstayCharges")}</span>
              <span><span className="ltr-numbers">{isEarly ? "-" : "+"}{estimatedAdjustment.toFixed(3)}</span> OMR</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600 border-t pt-2">
            <span>{t("alreadyPaid")}</span>
            <span><span className="ltr-numbers">-{res.amountPaid}</span> OMR</span>
          </div>
          <div className={`flex justify-between font-bold text-base pt-1 ${Number(adjustedBalance) > 0 ? "text-red-600" : "text-green-600"}`}>
            <span>{t("balanceDue")}</span>
            <span><span className="ltr-numbers">{adjustedBalance}</span> OMR</span>
          </div>
        </div>

        {/* Payment form */}
        <PaymentForm
          balanceDue={adjustedBalance}
          value={payment}
          onChange={setPayment}
        />

        {/* Condition checklist */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">{t("conditionTitle")}</p>
          {conditionEntries.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={condition[key]}
                onChange={(e) => setCondition((c) => ({ ...c, [key]: e.target.checked }))}
                className="h-4 w-4 rounded text-blue-600"
              />
              {label}
            </label>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={loading}
          className={`w-full py-3 font-semibold rounded-xl transition-colors disabled:opacity-50 text-white ${isOverstay ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? t("processing") : t("confirm")}
        </button>
      </div>
    </Modal>
  );
}

// ── Cancel Modal ───────────────────────────────────────────────────────────────

function CancelModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const t = useTranslations("reservations.detail.cancelModal");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const totalPaid = Number(res.amountPaid);

  async function handleConfirm() {
    if (!reason) { toast.error(t("selectReasonError")); return; }
    setLoading(true);
    const r = await fetch(`/api/reservations/${res.id}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, notes }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
    toast.success(t("successDefault", { ref: res.reservationNumber ?? "" }));
    onSuccess();
  }

  return (
    <Modal title={t("title")} onClose={onClose}>
      <div className="space-y-4">
        <div className="p-4 bg-red-50 rounded-xl text-sm text-red-700 border border-red-200">
          {t("warning")}
        </div>
        {totalPaid > 0 && (
          <div className="p-4 bg-yellow-50 rounded-xl text-sm text-yellow-800 border border-yellow-200">
            {t.rich("refundWarning", {
              amount: res.amountPaid,
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("reasonLabel")}</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
          >
            <option value="">{t("selectReason")}</option>
            <option value="Guest Cancelled">{t("reasons.guestCancelled")}</option>
            <option value="No Show">{t("reasons.noShow")}</option>
            <option value="Overbooking">{t("reasons.overbooking")}</option>
            <option value="Duplicate Booking">{t("reasons.duplicateBooking")}</option>
            <option value="Other">{t("reasons.other")}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {reason === "Other" ? t("notesLabelRequired") : t("notesLabelOptional")}
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
            placeholder={t("notesPlaceholder")}
          />
        </div>
        <button
          onClick={handleConfirm}
          disabled={loading || !reason || (reason === "Other" && !notes.trim())}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? t("cancelling") : t("confirm")}
        </button>
      </div>
    </Modal>
  );
}

// ── Payment Modal ──────────────────────────────────────────────────────────────

function PaymentModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const t = useTranslations("reservations.detail.paymentModal");
  const fmtDate = useFmtDate();
  // Outstanding invoices (not cancelled/paid) sorted by due date
  const outstandingInvoices = res.invoices.filter(
    (inv) => !["CANCELLED", "VOID", "PAID"].includes(inv.status) && Number(inv.balanceDue) > 0,
  );
  const hasInvoices = outstandingInvoices.length > 0;

  // "auto" = system picks oldest-first; "manual" = user selects which invoices
  const [allocationMode, setAllocationMode] = useState<"auto" | "manual">(
    hasInvoices ? "auto" : "auto",
  );
  // In manual mode: { [invoiceId]: allocatedAmount (string) }
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(outstandingInvoices.map((inv) => [inv.id, ""])),
  );
  const [form, setForm] = useState({ amount: res.balanceDue, method: "CASH", reference: "" });
  const [loading, setLoading] = useState(false);

  // In auto mode: compute how the payment would be distributed (oldest-first)
  const autoAllocations = (() => {
    let remaining = Number(form.amount) || 0;
    return outstandingInvoices.map((inv) => {
      const due    = Number(inv.balanceDue);
      const alloc  = Math.min(remaining, due);
      remaining    = Math.max(0, remaining - alloc);
      return { invoiceId: inv.id, amount: alloc, invoiceNumber: inv.invoiceNumber, due };
    });
  })();

  const manualTotal = Object.values(manualAmounts).reduce(
    (s, v) => s + (Number(v) || 0), 0,
  );

  async function handleSubmit() {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error(t("invalidAmount")); return; }

    if (allocationMode === "manual" && hasInvoices) {
      if (manualTotal <= 0) { toast.error(t("allocateAtLeastOne")); return; }
      if (Math.abs(manualTotal - amt) > 0.001) {
        toast.error(t("mismatch", { allocated: manualTotal.toFixed(3), amount: amt.toFixed(3) }));
        return;
      }
    }

    setLoading(true);

    // Build invoice allocations payload
    let invoiceAllocations: { invoiceId: string; amount: number }[] | undefined;
    if (hasInvoices) {
      if (allocationMode === "manual") {
        invoiceAllocations = Object.entries(manualAmounts)
          .filter(([, v]) => Number(v) > 0)
          .map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) }));
      }
      // auto mode → omit invoiceAllocations, engine handles it oldest-first
    }

    const r = await fetch(`/api/reservations/${res.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount:             amt,
        method:             form.method,
        reference:          form.reference || null,
        invoiceAllocations,
      }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
    toast.success(t("success"));
    onSuccess();
  }

  const fmtInvStatus = (s: string) => {
    if (s === "PARTIALLY_PAID" || s === "PARTIAL") return t("invStatus.partial");
    if (s === "PENDING" || s === "DRAFT" || s === "DUE" || s === "ISSUED") return t("invStatus.pending");
    return s;
  };
  const isOverdue = (inv: InvoiceRow) =>
    new Date(inv.dueDate) < new Date() && !["PAID", "CANCELLED", "VOID"].includes(inv.status);

  return (
    <Modal title={t("title")} onClose={onClose}>
      <div className="space-y-4">
        {/* Amount + method */}
        <PaymentForm balanceDue={res.balanceDue} value={form} onChange={setForm} />

        {/* Invoice allocation section */}
        {hasInvoices && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">{t("applyToInvoices")}</span>
              <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
                <button
                  onClick={() => setAllocationMode("auto")}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${allocationMode === "auto" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {t("auto")}
                </button>
                <button
                  onClick={() => setAllocationMode("manual")}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${allocationMode === "manual" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {t("manual")}
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {outstandingInvoices.map((inv) => {
                const autoAlloc = autoAllocations.find((a) => a.invoiceId === inv.id);
                return (
                  <div key={inv.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-600 ltr-numbers">{inv.invoiceNumber}</span>
                        {isOverdue(inv) && (
                          <span className="text-xs text-red-600 font-medium">{t("overdue")}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {fmtDate(inv.periodStart, { day: "numeric", month: "short" })}
                        {" – "}
                        {fmtDate(inv.periodEnd, { day: "numeric", month: "short" })}
                        {" · "}
                        <span className={Number(inv.amountPaid) > 0 ? "text-yellow-600" : ""}>
                          {fmtInvStatus(inv.status)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-400 mb-1">
                        {t("due", { amount: Number(inv.balanceDue).toFixed(3) })}
                      </div>
                      {allocationMode === "auto" ? (
                        <span className={`text-xs font-semibold ${(autoAlloc?.amount ?? 0) > 0 ? "text-blue-600" : "text-gray-300"}`}>
                          {(autoAlloc?.amount ?? 0) > 0
                            ? `− ${(autoAlloc!.amount).toFixed(3)} OMR`
                            : "—"}
                        </span>
                      ) : (
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max={Number(inv.balanceDue)}
                          value={manualAmounts[inv.id] ?? ""}
                          onChange={(e) =>
                            setManualAmounts((m) => ({ ...m, [inv.id]: e.target.value }))
                          }
                          placeholder="0.000"
                          className="w-24 text-end rounded-md border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 ltr-numbers"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {allocationMode === "manual" && (
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs">
                <span className="text-gray-500">{t("totalAllocated")}</span>
                <span className={`font-semibold ${Math.abs(manualTotal - Number(form.amount)) > 0.001 ? "text-red-600" : "text-green-600"}`}>
                  <span className="ltr-numbers">{manualTotal.toFixed(3)}</span> OMR
                  {Math.abs(manualTotal - Number(form.amount)) > 0.001 && (
                    <span className="text-red-500 ms-1">
                      {t("mustEqual", { amount: Number(form.amount).toFixed(3) })}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? t("recording") : t("confirm")}
        </button>
      </div>
    </Modal>
  );
}

// ── Charge Modal ───────────────────────────────────────────────────────────────

function ChargeModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const t = useTranslations("reservations.detail.chargeModal");
  const [form, setForm] = useState({ description: "", amount: "", category: "other" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!form.description.trim() || !form.amount || Number(form.amount) <= 0) {
      toast.error(t("validation")); return;
    }
    setLoading(true);
    const r = await fetch(`/api/reservations/${res.id}/charges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: form.description.trim(), amount: Number(form.amount), category: form.category }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
    toast.success(t("success"));
    onSuccess();
  }

  return (
    <Modal title={t("title")} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("description")}</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={t("descriptionPlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("amount")}</label>
            <input
              type="number" step="0.001" min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 ltr-numbers"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("category")}</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="other">{t("categories.other")}</option>
              <option value="cleaning">{t("categories.cleaning")}</option>
              <option value="damage">{t("categories.damage")}</option>
              <option value="minibar">{t("categories.minibar")}</option>
              <option value="service">{t("categories.service")}</option>
              <option value="parking">{t("categories.parking")}</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? t("adding") : t("confirm")}
        </button>
      </div>
    </Modal>
  );
}

// ── Note Modal ─────────────────────────────────────────────────────────────────

function NoteModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const t = useTranslations("reservations.detail.noteModal");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) { toast.error(t("empty")); return; }
    setLoading(true);
    const r = await fetch(`/api/reservations/${res.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
    toast.success(t("success"));
    onSuccess();
  }

  return (
    <Modal title={t("title")} onClose={onClose}>
      <div className="space-y-4">
        <textarea
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("placeholder")}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? t("saving") : t("confirm")}
        </button>
      </div>
    </Modal>
  );
}

// ── Generate Invoices Modal ────────────────────────────────────────────────────

function GenerateInvoicesModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const t = useTranslations("reservations.detail.generateInvoicesModal");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const r = await fetch(`/api/reservations/${res.id}/generate-invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
    toast.success(data.message ?? t("successFallback", { count: data.invoiceCount ?? 0 }));
    onSuccess();
  }

  const isMonthly = res.rateType === "monthly";
  const months = Math.round(res.totalNights / 30);

  return (
    <Modal title={t("title")} onClose={onClose}>
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-800 border border-blue-200">
          {t("body")}
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm text-gray-700">
          <div className="flex justify-between">
            <span>{t("grandTotal")}</span>
            <span className="font-semibold ltr-numbers">{res.grandTotal} OMR</span>
          </div>
          <div className="flex justify-between">
            <span>{t("rateType")}</span>
            <span>{isMonthly ? t("monthly") : t("daily")}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("duration")}</span>
            <span className="ltr-numbers">
              {isMonthly
                ? t("durationMonths", { count: months })
                : t("durationNights", { count: res.totalNights })}
            </span>
          </div>
        </div>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? t("generating") : t("confirm")}
        </button>
      </div>
    </Modal>
  );
}

// ── Invoice Pay Modal ──────────────────────────────────────────────────────────

function InvoicePayModal({ res, invoice, onSuccess, onClose }: {
  res: ReservationData;
  invoice: InvoiceRow;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("reservations.detail.invoicePayModal");
  const tStatus = useTranslations("reservations.detail.paymentModal.invStatus");
  const [form, setForm] = useState({
    amount: Number(invoice.balanceDue).toFixed(3),
    method: "CASH",
    reference: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error(t("invalidAmount")); return; }
    setLoading(true);
    const r = await fetch(`/api/reservations/${res.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount:  amt,
        method:  form.method,
        reference: form.reference || null,
        invoiceAllocations: [{ invoiceId: invoice.id, amount: amt }],
      }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
    toast.success(t("success"));
    onSuccess();
  }

  const invoiceStatusClass = (s: string) => {
    if (s === "PAID") return "bg-green-100 text-green-700";
    if (s === "PARTIALLY_PAID" || s === "PARTIAL") return "bg-yellow-100 text-yellow-700";
    if (s === "CANCELLED" || s === "VOID") return "bg-gray-100 text-gray-400";
    return "bg-orange-100 text-orange-700";
  };

  function statusLabel(s: string) {
    if (s === "PARTIALLY_PAID" || s === "PARTIAL") return tStatus("partial");
    if (s === "PENDING") return tStatus("pending");
    return s.replace("_", " ");
  }

  return (
    <Modal title={t("title", { invoice: invoice.invoiceNumber })} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">{t("invoice")}</span>
            <span className="font-mono font-semibold ltr-numbers">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">{t("status")}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${invoiceStatusClass(invoice.status)}`}>
              {statusLabel(invoice.status)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">{t("total")}</span>
            <span className="ltr-numbers">{Number(invoice.totalAmount).toFixed(3)} OMR</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">{t("alreadyPaid")}</span>
            <span className="text-green-600 ltr-numbers">{Number(invoice.amountPaid).toFixed(3)} OMR</span>
          </div>
          <div className="flex items-center justify-between font-bold border-t pt-2">
            <span>{t("balanceDue")}</span>
            <span className="text-red-600 ltr-numbers">{Number(invoice.balanceDue).toFixed(3)} OMR</span>
          </div>
        </div>

        <PaymentForm balanceDue={invoice.balanceDue} value={form} onChange={setForm} />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? t("recording") : t("confirm")}
        </button>
      </div>
    </Modal>
  );
}

// ── Return Modal ───────────────────────────────────────────────────────────────

const RETURN_REASONS: { key: string; value: string }[] = [
  { key: "earlyDeparture",   value: "Early departure" },
  { key: "familyEmergency",  value: "Family emergency" },
  { key: "travelChange",     value: "Travel change" },
  { key: "dissatisfied",     value: "Dissatisfied with unit" },
  { key: "foundAlternative", value: "Found alternative accommodation" },
  { key: "workReason",       value: "Work / business reason" },
  { key: "other",            value: "Other" },
];

function ReturnModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const t = useTranslations("reservations.detail.returnModal");
  const fmtDate = useFmtDate();
  const isMonthly = res.rateType === "monthly" || res.rateType === "MONTHLY";

  // Default new checkout = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [newCheckout, setNewCheckout] = useState(
    tomorrow.toISOString().slice(0, 10),
  );
  const [reason, setReason]   = useState("");
  const [notes, setNotes]     = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill the rate from the reservation's first unit so the receptionist
  // sees the same nightly rate the booking was created with. They can override
  // before confirming and the API uses that value for the entire return.
  const reservationRate = res.units[0]?.rateAmount
    ? Number(res.units[0].rateAmount)
    : 0;
  const [rateOverride, setRateOverride] = useState<string>(
    reservationRate > 0 ? reservationRate.toFixed(3) : "",
  );

  // Preview state
  type Preview = {
    returnFrom: string; returnTo: string; returnDays: number; returnType: string;
    returnAmount: string;
    lineItems: { id: string; description: string; quantity: number; unitPrice: string; lineTotal: string }[];
    affectedInvoices: {
      id: string; invoiceNumber: string; status: string; totalAmount: string;
      amountPaid: string; balanceDue: string; returnAmount: string; refundNeeded: string;
    }[];
    refundRequired: boolean; refundAmount: string;
    invoicesToCancel: string[];
  };
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch preview whenever newCheckout or rate override changes
  useEffect(() => {
    if (!newCheckout) return;
    const ctrl = new AbortController();
    setPreviewLoading(true);
    setPreviewError(null);
    const overrideNum = Number(rateOverride);
    const qs = new URLSearchParams({ newCheckoutDate: newCheckout });
    if (!isMonthly && rateOverride && overrideNum >= 0) {
      qs.set("rateOverride", String(overrideNum));
    }
    fetch(
      `/api/reservations/${res.id}/return?${qs.toString()}`,
      { signal: ctrl.signal },
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setPreviewError(data.error); setPreview(null); }
        else setPreview(data.preview);
      })
      .catch((e) => { if (e.name !== "AbortError") setPreviewError(t("calcFailed")); })
      .finally(() => setPreviewLoading(false));
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newCheckout, res.id, rateOverride, isMonthly]);

  async function handleConfirm() {
    if (!reason) { toast.error(t("reasonRequired")); return; }
    if (!preview) { toast.error(t("noPreview")); return; }
    setLoading(true);
    const overrideNum = Number(rateOverride);
    const r = await fetch(`/api/reservations/${res.id}/return`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        newCheckoutDate: newCheckout,
        reason,
        notes: notes || undefined,
        rateOverride: !isMonthly && rateOverride && overrideNum >= 0 ? overrideNum : undefined,
      }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
    toast.success(t("successDefault", { number: data.return?.returnNumber ?? "" }));
    onSuccess();
  }

  const ref = res.reservationNumber ?? res.id.slice(0, 8);
  const title = isMonthly ? t("titleMonthly", { ref }) : t("titleDaily", { ref });

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-5">
        {/* Current stay summary */}
        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>{t("checkIn")}</span>
            <span className="font-medium text-gray-900">{fmtDate(res.startDate)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>{t("currentCheckout")}</span>
            <span className="font-medium text-gray-900">{fmtDate(res.endDate)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>{t("rateType")}</span>
            <span className="font-medium text-gray-900">
              {isMonthly ? t("monthly") : t("dailyWithNights", { count: res.totalNights })}
            </span>
          </div>
        </div>

        {/* New checkout date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("newCheckoutDate")} <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={newCheckout}
            min={new Date().toISOString().slice(0, 10)}
            max={new Date(res.endDate).toISOString().slice(0, 10)}
            onChange={(e) => setNewCheckout(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
          />
          {isMonthly && (
            <p className="mt-1 text-xs text-gray-500">
              {t("monthlyHint")}
            </p>
          )}
        </div>

        {/* Nightly rate (daily reservations only) */}
        {!isMonthly && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("rateLabel")}
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step="0.001"
                value={rateOverride}
                onChange={(e) => setRateOverride(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pe-12 text-sm focus:ring-2 focus:ring-purple-500 ltr-numbers"
              />
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                OMR
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t("rateHint", { rate: reservationRate.toFixed(3) })}
            </p>
          </div>
        )}

        {/* Preview */}
        {previewLoading && (
          <div className="text-sm text-gray-400 text-center py-2">{t("calculating")}</div>
        )}
        {previewError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {previewError}
          </div>
        )}
        {preview && !previewError && (
          <div className="space-y-3">
            {/* Return period */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm">
              <p className="font-semibold text-purple-800 mb-2">
                {t("returningHeader", {
                  from:  fmtDate(preview.returnFrom),
                  to:    fmtDate(preview.returnTo),
                  count: preview.returnDays,
                  unit:  preview.returnType === "MONTHLY" ? t("monthsLabel") : t("nightsLabel"),
                })}
              </p>
              <div className="space-y-1">
                {preview.lineItems.map((li, i) => (
                  <div key={i} className="flex justify-between text-gray-700">
                    <span>{li.description}</span>
                    <span className="font-medium ltr-numbers">{li.lineTotal} OMR</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-purple-800 border-t border-purple-200 pt-1 mt-1">
                  <span>{t("totalReturn")}</span>
                  <span className="ltr-numbers">{preview.returnAmount} OMR</span>
                </div>
              </div>
            </div>

            {/* Invoice impact */}
            {preview.affectedInvoices.length > 0 && (
              <div className="text-sm space-y-2">
                <p className="font-medium text-gray-700">{t("invoiceImpact")}</p>
                {preview.affectedInvoices.map((inv: Preview["affectedInvoices"][0]) => (
                  <div key={inv.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-1">
                    <div className="flex justify-between font-medium">
                      <span className="ltr-numbers">{inv.invoiceNumber}</span>
                      <span className={`px-1.5 py-0.5 rounded-full ${
                        inv.status === "PAID" ? "bg-green-100 text-green-700" :
                        inv.status === "PARTIALLY_PAID" ? "bg-yellow-100 text-yellow-700" :
                        "bg-orange-100 text-orange-700"
                      }`}>{inv.status}</span>
                    </div>
                    {(inv.status === "PENDING" || inv.status === "DRAFT") && Number(inv.returnAmount) > 0 && (
                      <p className="text-green-700">{t("reductionMsg", { amount: inv.returnAmount })}</p>
                    )}
                    {inv.status === "PAID" && (
                      <p className="text-orange-700">{t("paidRefundMsg", { amount: Number(inv.returnAmount).toFixed(3) })}</p>
                    )}
                    {preview.invoicesToCancel.includes(inv.id) && (
                      <p className="text-red-700 font-medium">{t("cancelMsg")}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Refund notice */}
            {preview.refundRequired ? (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">
                <ExclamationTriangleIcon className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {t.rich("refundRequiredMsg", {
                    amount: preview.refundAmount,
                    b: (chunks) => <strong>{chunks}</strong>,
                  })}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                <CheckIcon className="h-4 w-4 shrink-0" />
                <span>{t("noRefundMsg")}</span>
              </div>
            )}
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("reasonLabel")} <span className="text-red-500">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
          >
            <option value="">{t("selectReason")}</option>
            {RETURN_REASONS.map((r) => (
              <option key={r.key} value={r.value}>{t(`reasons.${r.key}` as never)}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("notesLabel")}</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          {t("warning")}
        </div>

        <button
          onClick={handleConfirm}
          disabled={loading || !preview || !!previewError || !reason}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? t("processing") : t("confirm")}
        </button>
      </div>
    </Modal>
  );
}

// ── Process Refund Modal ───────────────────────────────────────────────────────

function ProcessRefundModal({ ret, onSuccess, onClose }: {
  ret: ReturnRow; onSuccess: () => void; onClose: () => void;
}) {
  const t = useTranslations("reservations.detail.refundModal");
  const [form, setForm] = useState({
    amount:    ret.refundAmount,
    method:    "CASH",
    reference: "",
    notes:     "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error(t("invalidAmount")); return; }
    setLoading(true);
    const r = await fetch(`/api/returns/${ret.id}/refund`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        amount:    amt,
        method:    form.method,
        reference: form.reference || undefined,
        notes:     form.notes || undefined,
      }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
    toast.success(t("success"));
    onSuccess();
  }

  function methodLabel(m: "CASH" | "CARD" | "BANK_TRANSFER") {
    if (m === "CASH") return t("cash");
    if (m === "CARD") return t("cardReversal");
    return t("bankTransfer");
  }

  return (
    <Modal title={t("title", { ref: ret.returnNumber })} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">{t("return")}</span>
            <span className="font-mono font-semibold ltr-numbers">{ret.returnNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{t("returnAmount")}</span>
            <span className="ltr-numbers">{ret.returnAmount} OMR</span>
          </div>
          <div className="flex justify-between font-bold border-t border-orange-200 pt-1 mt-1">
            <span>{t("refundRequired")}</span>
            <span className="text-orange-700 ltr-numbers">{ret.refundAmount} OMR</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("amountLabel")} <span className="text-red-500">*</span>
          </label>
          <input
            type="number" step="0.001" min="0.001"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 ltr-numbers"
          />
          <p className="text-xs text-gray-400 mt-1">{t("amountHint")}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("methodLabel")} <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(["CASH", "CARD", "BANK_TRANSFER"] as const).map((m) => (
              <label
                key={m}
                className={`flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  form.method === m
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio" name="refund-method" value={m}
                  checked={form.method === m}
                  onChange={() => setForm((f) => ({ ...f, method: m }))}
                  className="sr-only"
                />
                {methodLabel(m)}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("referenceLabel")}</label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder={t("referencePlaceholder")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("notesLabel")}</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t("notesPlaceholder")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? t("processing") : t("confirm")}
        </button>
      </div>
    </Modal>
  );
}

// ── Action Buttons ─────────────────────────────────────────────────────────────

function ActionButtons({ ds, onAction, reservationId, rateType }: {
  ds: string;
  onAction: (a: ModalType) => void;
  reservationId: string;
  rateType: string;
}) {
  const t = useTranslations("reservations.detail.actions");
  const openPrint = () => window.open(`/api/reservations/${reservationId}/pdf`, "_blank");

  switch (ds) {
    case "Upcoming":
      return (
        <>
          <Link href={`/dashboard/reservations/${reservationId}/edit`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PencilSquareIcon className="h-4 w-4" /> {t("edit")}
          </Link>
          <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PrinterIcon className="h-4 w-4" /> {t("print")}
          </button>
          <button onClick={() => onAction("cancel")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 bg-white text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            <XMarkIcon className="h-4 w-4" /> {t("cancel")}
          </button>
        </>
      );
    case "Arriving Today":
    case "Overdue Arrival":
      return (
        <>
          <button onClick={() => onAction("check-in")} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors shadow-sm">
            <CheckIcon className="h-4 w-4" /> {t("checkIn")}
          </button>
          {ds === "Overdue Arrival" && (
            <button onClick={() => onAction("cancel")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
              {t("noShow")}
            </button>
          )}
          <Link href={`/dashboard/reservations/${reservationId}/edit`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PencilSquareIcon className="h-4 w-4" /> {t("edit")}
          </Link>
          <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PrinterIcon className="h-4 w-4" /> {t("print")}
          </button>
          <button onClick={() => onAction("cancel")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 bg-white text-sm font-medium text-red-600 hover:bg-red-50">
            <XMarkIcon className="h-4 w-4" /> {t("cancel")}
          </button>
        </>
      );
    case "In House":
    case "Due Checkout":
      return (
        <>
          <button
            onClick={() => onAction("check-out")}
            className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors shadow-sm ${
              ds === "Due Checkout" ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {t("checkOut")}
          </button>
          <button onClick={() => onAction("return")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-purple-300 bg-white text-sm font-medium text-purple-700 hover:bg-purple-50 transition-colors">
            {rateType === "monthly" ? t("returnMonths") : t("returnDays")}
          </button>
          <button onClick={() => onAction("extend-stay")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-300 bg-white text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
            {t("extendStay")}
          </button>
          <button onClick={() => onAction("move-unit")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            {t("moveUnit")}
          </button>
          <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PrinterIcon className="h-4 w-4" /> {t("print")}
          </button>
        </>
      );
    case "Overstay":
      return (
        <>
          <button
            onClick={() => onAction("check-out")}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors shadow-sm bg-red-600 hover:bg-red-700 animate-pulse"
          >
            {t("checkOut")}
          </button>
          <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PrinterIcon className="h-4 w-4" /> {t("print")}
          </button>
        </>
      );
    case "Checked Out":
      return (
        <>
          <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PrinterIcon className="h-4 w-4" /> {t("print")}
          </button>
        </>
      );
    default:
      return (
        <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <PrinterIcon className="h-4 w-4" /> {t("print")}
        </button>
      );
  }
}

// ── Activity Icon ──────────────────────────────────────────────────────────────

function ActivityIcon({ action }: { action: string }) {
  const map: Record<string, { icon: React.ReactNode; color: string }> = {
    CHECKED_IN:       { icon: <CheckIcon className="h-3.5 w-3.5" />, color: "bg-green-500" },
    CHECKED_OUT:      { icon: <ArrowLeftIcon className="h-3.5 w-3.5 rotate-180" />, color: "bg-blue-500" },
    CANCELLED:        { icon: <XMarkIcon className="h-3.5 w-3.5" />, color: "bg-red-500" },
    NO_SHOW:          { icon: <UserIcon className="h-3.5 w-3.5" />, color: "bg-gray-500" },
    PAYMENT_RECORDED: { icon: <BanknotesIcon className="h-3.5 w-3.5" />, color: "bg-emerald-500" },
    CHARGE_ADDED:     { icon: <PlusIcon className="h-3.5 w-3.5" />, color: "bg-orange-500" },
    NOTE_ADDED:       { icon: <ChatBubbleLeftEllipsisIcon className="h-3.5 w-3.5" />, color: "bg-purple-500" },
    CREATED:          { icon: <CalendarDaysIcon className="h-3.5 w-3.5" />, color: "bg-sky-500" },
  };
  const entry = map[action] ?? { icon: <ClockIcon className="h-3.5 w-3.5" />, color: "bg-gray-400" };
  return (
    <div className={`flex-shrink-0 w-6 h-6 rounded-full ${entry.color} flex items-center justify-center text-white`}>
      {entry.icon}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ReservationDetail({ id }: { id: string }) {
  const t           = useTranslations("reservations.detail");
  const tGuest      = useTranslations("reservations.detail.guest");
  const tStay       = useTranslations("reservations.detail.stay");
  const tInvoices   = useTranslations("reservations.detail.invoicesSection");
  const tPricing    = useTranslations("reservations.detail.pricingBreakdown");
  const tFinancial  = useTranslations("reservations.detail.financial");
  const tReturns    = useTranslations("reservations.detail.returnsSection");
  const tActivity   = useTranslations("reservations.detail.activitySection");
  const tBanners    = useTranslations("reservations.detail.banners");
  const fmtDate     = useFmtDate();
  const fmtDateFull = useFmtDateFull();
  const fmtTime     = useFmtTime();
  const fmtMethod   = useFmtMethod();
  const fmtSource   = useFmtSource();
  const fmtUnitType = useFmtUnitType();

  const [res, setRes] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [activeInvoice, setActiveInvoice] = useState<InvoiceRow | null>(null);
  const [activeReturn, setActiveReturn] = useState<ReturnRow | null>(null);

  const loadData = useCallback(async () => {
    const r = await fetch(`/api/reservations/${id}`);
    if (!r.ok) { setLoading(false); return; }
    const data = await r.json();
    setRes(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  function afterAction() {
    setActiveModal(null);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-400">
          <CalendarDaysIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!res) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">{t("notFound")}</p>
          <Link href="/dashboard/reservations" className="text-blue-600 hover:underline text-sm mt-2 block">
            {t("backLink")}
          </Link>
        </div>
      </div>
    );
  }

  // Use invoice balances as the source of truth when invoices exist
  const invoiceBalanceDue = res.invoices.length > 0
    ? res.invoices
        .filter((inv) => !["CANCELLED", "VOID"].includes(inv.status))
        .reduce((s, inv) => s + Number(inv.balanceDue), 0)
    : Number(res.balanceDue);
  const balanceDue = Math.round(invoiceBalanceDue * 1000) / 1000;
  const isPaid = balanceDue <= 0 && res.invoices.some((inv) => ["PAID"].includes(inv.status));
  const isOverpaid = balanceDue < 0;
  const today = new Date().toISOString();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── TOP BAR ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 gap-4 flex-wrap">
            {/* Left: back + reservation number + status */}
            <div className="flex items-center gap-4">
              <Link href="/dashboard/reservations" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className={`text-xl font-bold font-mono ${res.status === "CANCELLED" ? "line-through text-gray-400" : "text-gray-900"}`}>
                    {res.reservationNumber ?? res.id.slice(0, 8).toUpperCase()}
                  </h1>
                  <StatusBadge
                    label={res.displayStatus}
                    badgeClass={res.displayStatusBadgeClass}
                    pulse={res.displayStatusPulse}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {res.createdByName
                    ? t("createdBy", { date: fmtDate(res.createdAt), name: res.createdByName })
                    : t("createdOn", { date: fmtDate(res.createdAt) })}
                </p>
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <ActionButtons ds={res.displayStatus} onAction={setActiveModal} reservationId={res.id} rateType={res.rateType} />
            </div>
          </div>
        </div>
      </div>

      {/* ── URGENT ALERT BANNER ── */}
      {(res.displayStatus === "Overstay" || res.displayStatus === "Due Checkout") && (
        <div className={`${res.displayStatus === "Overstay" ? "bg-red-600" : "bg-orange-500"} text-white text-center py-2 text-sm font-medium`}>
          {res.displayStatus === "Overstay"
            ? tBanners("overstay", { count: Math.abs(diffDays(today, res.endDate)) })
            : tBanners("dueCheckoutToday")}
        </div>
      )}

      {/* ── REFUND PENDING BANNER ── */}
      {res.status === "CANCELLED" && res.refundPending && (
        <div className="bg-yellow-500 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <BanknotesIcon className="h-5 w-5 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">{tBanners("refundLabel")} </span>
              <span>
                {tBanners.rich("refundBody", {
                  amount: res.amountPaid,
                  b: (chunks) => <strong>{chunks}</strong>,
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ═══ LEFT COLUMN (2/3) ═══ */}
          <div className="lg:col-span-2 space-y-6">

            {/* Section 1: Guest Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white ${
                    res.tenant.classification === "vip" ? "bg-yellow-500" :
                    res.tenant.classification === "blacklisted" ? "bg-red-500" : "bg-blue-600"
                  }`}>
                    {res.tenant.firstName[0]}{res.tenant.lastName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900">
                        {res.tenant.firstName} {res.tenant.lastName}
                      </h2>
                      <ClassBadge c={res.tenant.classification} />
                    </div>
                    {res.tenant.fullNameArabic && (
                      <p className="text-sm text-gray-500 font-arabic" dir="rtl">{res.tenant.fullNameArabic}</p>
                    )}
                    {res.tenant.nationality && (
                      <p className="text-xs text-gray-400 mt-0.5">{res.tenant.nationality}</p>
                    )}
                  </div>
                </div>
                <Link href={`/dashboard/tenants/${res.tenant.id}`}
                  className="text-xs text-blue-600 hover:underline shrink-0">
                  {tGuest("viewProfile")}
                </Link>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <a href={`tel:${res.tenant.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors">
                  <PhoneIcon className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="ltr-numbers">{res.tenant.phone}</span>
                </a>
                {res.tenant.whatsappNumber && (
                  <a href={`https://wa.me/${res.tenant.whatsappNumber.replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-green-600 hover:underline">
                    <span className="text-base">📱</span> {tGuest("whatsapp")}
                  </a>
                )}
                {res.tenant.email && (
                  <a href={`mailto:${res.tenant.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600">
                    <EnvelopeIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="ltr-numbers">{res.tenant.email}</span>
                  </a>
                )}
                {res.tenant.idNumber && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <IdentificationIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-400">{res.tenant.idType ?? "ID"}: </span>
                    <span className="ltr-numbers">{res.tenant.idNumber}</span>
                    {res.tenant.idExpiryDate && new Date(res.tenant.idExpiryDate) < new Date() && (
                      <span className="text-xs text-red-600 font-medium ms-1">{tGuest("idExpired")}</span>
                    )}
                  </div>
                )}
              </div>

              {/* CRM stats */}
              <div className="flex items-center gap-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                <span>{tGuest("nthStay", { n: res.tenant.totalStays })}</span>
                <span className="ltr-numbers">{tGuest("totalSpent", { amount: Number(res.tenant.totalSpent).toFixed(3) })}</span>
                {res.tenant.firstStayDate && (
                  <span>{tGuest("firstVisit", { date: fmtDate(res.tenant.firstStayDate, { month: "short", year: "numeric" }) })}</span>
                )}
                {res.tenant.corporateName && (
                  <span className="font-medium text-gray-700">🏢 {res.tenant.corporateName}</span>
                )}
              </div>

              {/* Special requests + internal notes */}
              {res.tenant.specialRequests && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <span className="font-medium">{tGuest("specialRequests")} </span>{res.tenant.specialRequests}
                </div>
              )}
              {res.tenant.internalNotes && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <span className="font-medium">{tGuest("staffNotes")} </span>{res.tenant.internalNotes}
                </div>
              )}
            </div>

            {/* Section 2: Stay Details */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 mb-4">{tStay("title")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Dates */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{tStay("checkIn")}</p>
                    <p className="text-sm font-semibold text-gray-900">{fmtDateFull(res.startDate)}</p>
                    {res.actualCheckIn && (
                      <p className="text-xs text-green-600 mt-0.5">
                        {tStay("checkedInAt", { time: fmtTime(res.actualCheckIn) })}
                      </p>
                    )}
                    {!res.actualCheckIn && isToday(res.startDate) && (
                      <p className="text-xs text-orange-600 font-medium mt-0.5">{tStay("today")}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{tStay("checkOut")}</p>
                    <p className={`text-sm font-semibold ${!res.actualCheckOut && diffDays(today, res.endDate) > 0 ? "text-red-600" : "text-gray-900"}`}>
                      {fmtDateFull(res.endDate)}
                    </p>
                    {res.actualCheckOut && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        {tStay("checkedOutAt", { time: fmtTime(res.actualCheckOut) })}
                      </p>
                    )}
                    {!res.actualCheckOut && res.displayStatus === "Overstay" && (
                      <p className="text-xs text-red-600 font-medium mt-0.5">
                        {tStay("overdueBy", { count: Math.abs(diffDays(today, res.endDate)) })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 ltr-numbers">
                      {res.rateType === "monthly"
                        ? t("generateInvoicesModal.durationMonths", { count: Math.round(res.totalNights / 30) })
                        : t("generateInvoicesModal.durationNights", { count: res.totalNights })}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {res.rateType === "monthly" ? tStay("monthlyRate") : tStay("dailyRate")}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {fmtSource(res.source)}
                    </span>
                  </div>
                </div>

                {/* Units */}
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{tStay("units")}</p>
                  <div className="space-y-2">
                    {res.units.map((u) => (
                      <div
                        key={u.id}
                        className={`p-3 rounded-lg border ${
                          u.isMovedOut
                            ? "bg-amber-50 border-amber-200"
                            : "bg-gray-50 border-gray-100"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className={`font-semibold text-sm ${u.isMovedOut ? "text-amber-800" : "text-gray-900"}`}>
                              {u.name}
                              {u.isMovedOut && (
                                <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                  {tStay("movedOutBadge")}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {u.propertyName} — {tStay("floor", { n: u.floor })} — {fmtUnitType(u.unitType)}
                            </p>
                            {u.isMovedOut && u.movedToUnitName && (
                              <p className="mt-1 text-xs text-amber-700">
                                {tStay("movedTo", { unit: u.movedToUnitName })}
                                {u.moveDate && (
                                  <span className="text-amber-600 ms-1 ltr-numbers">
                                    · {new Date(u.moveDate).toISOString().slice(0, 10)}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          <p className="text-xs font-medium text-gray-700 shrink-0 ms-2 ltr-numbers">
                            {Number(u.subtotal).toFixed(3)} OMR
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          <span className="ltr-numbers">{Number(u.rateAmount).toFixed(3)} OMR</span>/{u.rateType === "monthly" ? tStay("perMonth") : tStay("perNight")}
                          {u.seasonalPriceName && <span className="text-orange-600 ms-1">({u.seasonalPriceName})</span>}
                          {u.rateSource === "manual_override" && <span className="text-purple-600 ms-1">({tStay("manualRate")})</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reservation notes */}
              {res.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{tStay("notes")}</p>
                  <p className="text-sm text-gray-700">{res.notes}</p>
                </div>
              )}

              {/* Cancellation info */}
              {res.status === "CANCELLED" && res.cancelledReason && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-1">{tStay("cancellationReason")}</p>
                  <p className="text-sm text-gray-700">{res.cancelledReason}</p>
                  {res.cancelledAt && (
                    <p className="text-xs text-gray-400 mt-0.5">{tStay("cancelledOn", { date: fmtDate(res.cancelledAt) })}</p>
                  )}
                </div>
              )}
            </div>

            {/* Section 3b: Related Invoices */}
            <Collapsible
              title={tInvoices("title", { count: res.invoices.filter((i) => i.status !== "CANCELLED" && i.status !== "VOID").length })}
              defaultOpen={true}
            >
              {!res.invoicesGenerated ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400 text-center py-2">{tInvoices("noneGenerated")}</p>
                  {["PENDING", "CONFIRMED", "CHECKED_IN"].includes(res.status) && (
                    <button
                      onClick={() => setActiveModal("generate-invoices")}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      {tInvoices("generateButton")}
                    </button>
                  )}
                </div>
              ) : res.invoices.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">{tInvoices("noneFound")}</p>
              ) : (
                <div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100">
                        <th className="text-start pb-2 font-medium">{tInvoices("table.invoice")}</th>
                        <th className="text-start pb-2 font-medium">{tInvoices("table.period")}</th>
                        <th className="text-end pb-2 font-medium">{tInvoices("table.total")}</th>
                        <th className="text-end pb-2 font-medium">{tInvoices("table.due")}</th>
                        <th className="text-center pb-2 font-medium">{tInvoices("table.status")}</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {res.invoices.map((inv) => {
                        const isCancelled = inv.status === "CANCELLED" || inv.status === "VOID";
                        const isPaid      = inv.status === "PAID";
                        const isPartial   = inv.status === "PARTIALLY_PAID" || inv.status === "PARTIAL";
                        const isOverdue   = !isPaid && !isCancelled && new Date(inv.dueDate) < new Date();
                        const statusClass = isPaid
                          ? "bg-green-100 text-green-700"
                          : isPartial
                          ? "bg-yellow-100 text-yellow-700"
                          : isCancelled
                          ? "bg-gray-100 text-gray-400"
                          : isOverdue
                          ? "bg-red-100 text-red-700"
                          : "bg-orange-100 text-orange-700";
                        const statusLabel = isPaid
                          ? tInvoices("statuses.paid")
                          : isPartial
                          ? tInvoices("statuses.partial")
                          : isCancelled
                          ? tInvoices("statuses.cancelled")
                          : isOverdue
                          ? tInvoices("statuses.overdue")
                          : tInvoices("statuses.pending");

                        return (
                          <tr key={inv.id} className={isCancelled ? "opacity-40" : ""}>
                            <td className="py-2 font-mono text-xs text-gray-700 pe-2 ltr-numbers">
                              <Link href={`/dashboard/invoices/${inv.id}`} className="hover:text-blue-600 hover:underline">
                                {inv.invoiceNumber}
                              </Link>
                            </td>
                            <td className="py-2 text-xs text-gray-500 pe-2 ltr-numbers">
                              {fmtDate(inv.periodStart, { day: "numeric", month: "short" })}
                              {" — "}
                              {fmtDate(inv.periodEnd, { day: "numeric", month: "short" })}
                            </td>
                            <td className="py-2 text-end font-medium text-gray-800 pe-2 ltr-numbers">
                              {Number(inv.totalAmount).toFixed(3)}
                            </td>
                            <td className={`py-2 text-end text-xs pe-2 ltr-numbers ${isOverdue && !isCancelled ? "text-red-600 font-medium" : "text-gray-400"}`}>
                              {fmtDate(inv.dueDate, { day: "numeric", month: "short" })}
                            </td>
                            <td className="py-2 text-center">
                              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="py-2 text-end ps-1">
                              {!isPaid && !isCancelled && (
                                <button
                                  onClick={() => setActiveInvoice(inv)}
                                  className="text-xs text-blue-600 hover:underline font-medium"
                                >
                                  {tInvoices("pay")}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm font-medium text-gray-700">
                    <span>{tInvoices("totalOutstanding")}</span>
                    <span className="text-red-600 ltr-numbers">
                      {res.invoices
                        .filter((i) => i.status !== "CANCELLED" && i.status !== "VOID")
                        .reduce((s, i) => s + Number(i.balanceDue), 0)
                        .toFixed(3)} OMR
                    </span>
                  </div>
                </div>
              )}
            </Collapsible>

            {/* Section 4: Pricing Breakdown */}
            <Collapsible title={tPricing("title")} defaultOpen={false}>
              {res.units.length === 0 ? (
                <p className="text-sm text-gray-400">{tPricing("none")}</p>
              ) : (
                <div className="space-y-4">
                  {res.units.map((u) => (
                    <div key={u.id}>
                      <p className="font-medium text-sm text-gray-800 mb-2">{u.name} — {u.propertyName}</p>
                      <div className="flex justify-between text-sm text-gray-700 ps-4">
                        <span>
                          <span className="ltr-numbers">
                            {u.rateType === "monthly"
                              ? t("generateInvoicesModal.durationMonths", { count: u.nights })
                              : t("generateInvoicesModal.durationNights", { count: u.nights })}
                            {" × "}
                            {Number(u.rateAmount).toFixed(3)} OMR
                          </span>
                          {u.seasonalPriceName && <span className="text-orange-600 ms-1">({u.seasonalPriceName})</span>}
                        </span>
                        <span className="font-medium ltr-numbers">{Number(u.subtotal).toFixed(3)} OMR</span>
                      </div>
                    </div>
                  ))}
                  {res.charges.length > 0 && (
                    <div className="pt-3 border-t border-gray-100 space-y-1">
                      <p className="font-medium text-sm text-gray-800 mb-2">{tPricing("extraCharges")}</p>
                      {res.charges.map((c) => (
                        <div key={c.id} className="flex justify-between text-sm text-gray-700 ps-4">
                          <span>{c.description}</span>
                          <span className="font-medium text-orange-600 ltr-numbers">+{Number(c.amount).toFixed(3)} OMR</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {Number(res.discountAmount) > 0 && (
                    <div className="flex justify-between text-sm text-gray-700 pt-2 border-t border-dashed">
                      <span>{tPricing("discount")}</span>
                      <span className="font-medium text-green-600 ltr-numbers">-{Number(res.discountAmount).toFixed(3)} OMR</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200">
                    <span>{tPricing("grandTotal")}</span>
                    <span className="ltr-numbers">{Number(res.grandTotal).toFixed(3)} OMR</span>
                  </div>
                </div>
              )}
            </Collapsible>

          </div>

          {/* ═══ RIGHT COLUMN (1/3) ═══ */}
          <div className="space-y-6">

            {/* Section 3: Financial Summary */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">{tFinancial("title")}</h3>
              </div>
              <div className="p-5 space-y-3">
                {/* Charges breakdown */}
                {res.units.map((u) => (
                  <div key={u.id} className="flex justify-between text-sm text-gray-700">
                    <span className="text-gray-500">
                      {u.name}: <span className="ltr-numbers">{u.nights} × {Number(u.rateAmount).toFixed(3)}</span>
                    </span>
                    <span className="ltr-numbers">{Number(u.subtotal).toFixed(3)}</span>
                  </div>
                ))}
                {res.charges.map((c) => (
                  <div key={c.id} className="flex justify-between text-sm text-gray-700">
                    <span className="text-orange-500">{c.description}</span>
                    <span className="text-orange-600 ltr-numbers">+{Number(c.amount).toFixed(3)}</span>
                  </div>
                ))}
                {Number(res.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{tFinancial("discount")}</span>
                    <span className="text-green-600 ltr-numbers">-{Number(res.discountAmount).toFixed(3)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
                  <span>{tFinancial("grandTotal")}</span>
                  <span className="ltr-numbers">{Number(res.grandTotal).toFixed(3)} OMR</span>
                </div>

                {/* Payments */}
                {res.payments.length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{tFinancial("payments")}</p>
                    {res.payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm text-gray-700 mb-1">
                        <span className="text-gray-500">
                          <span className="ltr-numbers">{fmtDate(p.date)}</span> — {fmtMethod(p.method)}
                          {p.reference && <span className="text-gray-400 ms-1 ltr-numbers">({p.reference})</span>}
                        </span>
                        <span className="ltr-numbers">{Number(p.amount).toFixed(3)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-medium text-gray-700 pt-1 border-t border-dashed mt-2">
                      <span>{tFinancial("totalPaid")}</span>
                      <span className="ltr-numbers">{Number(res.amountPaid).toFixed(3)}</span>
                    </div>
                  </div>
                )}

                {/* Balance */}
                <div className={`mt-3 p-4 rounded-xl text-center ${
                  isPaid ? "bg-green-50 border border-green-200" :
                  isOverpaid ? "bg-blue-50 border border-blue-200" :
                  "bg-red-50 border border-red-200"
                }`}>
                  {isPaid ? (
                    <p className="font-bold text-green-700 flex items-center justify-center gap-2">
                      <CheckIcon className="h-5 w-5" /> {tFinancial("fullyPaid")}
                    </p>
                  ) : isOverpaid ? (
                    <p className="font-bold text-blue-700 ltr-numbers">{tFinancial("credit", { amount: Math.abs(balanceDue).toFixed(3) })}</p>
                  ) : (
                    <>
                      <p className="text-xs text-red-500 font-medium mb-0.5">{tFinancial("balanceDueLabel")}</p>
                      <p className="text-2xl font-bold text-red-600 ltr-numbers">{balanceDue.toFixed(3)} OMR</p>
                    </>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 pt-1">
                  {!isPaid && (
                    <button
                      onClick={() => setActiveModal("payment")}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      {tFinancial("recordPayment")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4b: Returns */}
            {res.returns.length > 0 && (
              <Collapsible title={tReturns("title", { count: res.returns.length })} defaultOpen={true}>
                <div className="space-y-4">
                  {res.returns.map((ret) => (
                    <div key={ret.id} className="border border-purple-200 rounded-xl bg-purple-50 p-4 space-y-3">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <span className="font-mono font-bold text-purple-800 text-sm ltr-numbers">{ret.returnNumber}</span>
                          <span className="ms-2 text-sm text-gray-600 ltr-numbers">
                            {fmtDate(ret.returnFrom)} → {fmtDate(ret.returnTo)}
                            {" "}({ret.returnDays} {ret.returnType === "MONTHLY" ? t("returnModal.monthsLabel") : t("returnModal.nightsLabel")})
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-purple-800 ltr-numbers">
                          {tReturns("returned", { amount: ret.returnAmount })}
                        </span>
                      </div>

                      {/* Reason */}
                      <p className="text-xs text-gray-500">{tReturns("reason")} <span className="text-gray-700">{ret.reason}</span></p>

                      {/* Line items */}
                      {ret.lineItems.length > 0 && (
                        <div className="text-xs space-y-0.5 text-gray-600 bg-white rounded-lg p-2 border border-purple-100">
                          {ret.lineItems.map((li) => (
                            <div key={li.id} className="flex justify-between">
                              <span>{li.description}</span>
                              <span className="font-medium ltr-numbers">{li.lineTotal} OMR</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Refund status */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        {ret.refundStatus === "NOT_REQUIRED" && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                            <CheckIcon className="h-3 w-3" /> {tReturns("noRefund")}
                          </span>
                        )}
                        {ret.refundStatus === "PENDING" && (
                          <>
                            <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded-full ltr-numbers">
                              <ExclamationTriangleIcon className="h-3 w-3" /> {tReturns("refundPending", { amount: ret.refundAmount })}
                            </span>
                            <button
                              onClick={() => setActiveReturn(ret)}
                              className="text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                            >
                              {tReturns("processRefund")}
                            </button>
                          </>
                        )}
                        {ret.refundStatus === "COMPLETED" && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                            <CheckIcon className="h-3 w-3" />
                            <span className="ltr-numbers">{tReturns("refundCompleted", { amount: ret.refundAmount })}</span>
                            {ret.refundMethod && ` (${fmtMethod(ret.refundMethod)})`}
                            {ret.refundDate && <span className="ltr-numbers">{`, ${fmtDate(ret.refundDate)}`}</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Collapsible>
            )}

            {/* Section 5: Activity Timeline */}
            <Collapsible title={tActivity("title", { count: res.activities.length })} defaultOpen={true}>
              {res.activities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">{tActivity("none")}</p>
              ) : (
                <div className="space-y-3">
                  {res.activities.map((a) => (
                    <div key={a.id} className="flex items-start gap-3">
                      <ActivityIcon action={a.action} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-snug">{a.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          <span className="ltr-numbers">{fmtDate(a.createdAt)} {fmtTime(a.createdAt)}</span>
                          {a.performedByName && <span className="ms-1">— {a.performedByName}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setActiveModal("note")}
                className="mt-4 w-full py-2 border border-dashed border-gray-300 hover:border-gray-400 text-sm text-gray-500 hover:text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <PlusIcon className="h-4 w-4" /> {tActivity("addNote")}
              </button>
            </Collapsible>

          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {activeModal === "check-in"  && <CheckInModal  res={res} onSuccess={afterAction} onClose={() => setActiveModal(null)} />}
      {activeModal === "check-out" && <CheckOutModal res={res} onSuccess={afterAction} onClose={() => setActiveModal(null)} />}
      {activeModal === "cancel"    && <CancelModal   res={res} onSuccess={afterAction} onClose={() => setActiveModal(null)} />}
      {activeModal === "payment"   && <PaymentModal  res={res} onSuccess={afterAction} onClose={() => setActiveModal(null)} />}
      {activeModal === "charge"    && <ChargeModal   res={res} onSuccess={afterAction} onClose={() => setActiveModal(null)} />}
      {activeModal === "note"      && <NoteModal     res={res} onSuccess={afterAction} onClose={() => setActiveModal(null)} />}
      {activeModal === "extend-stay" && (
        <ExtendStayModal
          reservationId={res.id}
          currentCheckOut={res.endDate}
          rateType={res.rateType}
          onClose={() => setActiveModal(null)}
          onSuccess={afterAction}
        />
      )}
      {activeModal === "move-unit" && (
        <MoveUnitModal
          reservationId={res.id}
          reservationUnits={res.units.map((u) => ({
            id: u.id,
            unitId: u.id,
            unitName: u.name,
            floor: u.floor,
            unitType: u.unitType,
            rateAmount: Number(u.rateAmount),
          }))}
          checkOutDate={res.endDate}
          rateType={res.rateType}
          onClose={() => setActiveModal(null)}
          onSuccess={afterAction}
        />
      )}
      {activeModal === "generate-invoices" && (
        <GenerateInvoicesModal
          res={res}
          onSuccess={afterAction}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "return" && (
        <ReturnModal
          res={res}
          onSuccess={afterAction}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeInvoice && (
        <InvoicePayModal
          res={res}
          invoice={activeInvoice}
          onSuccess={() => { setActiveInvoice(null); loadData(); }}
          onClose={() => setActiveInvoice(null)}
        />
      )}
      {activeReturn && (
        <ProcessRefundModal
          ret={activeReturn}
          onSuccess={() => { setActiveReturn(null); loadData(); }}
          onClose={() => setActiveReturn(null)}
        />
      )}
    </div>
  );
}
