"use client";

import { useEffect, useState, useCallback } from "react";
import ExtendStayModal from "@/components/reservations/ExtendStayModal";
import MoveUnitModal from "@/components/reservations/MoveUnitModal";
import Link from "next/link";
import { toast } from "sonner";
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
  BuildingOfficeIcon,
  CreditCardIcon,
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
  createdByName: string | null;
  createdAt: string;
};

type ModalType = "check-in" | "check-out" | "cancel" | "payment" | "charge" | "note" | "extend-stay" | "move-unit" | null;

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString("en-GB", opts ?? { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtMethod(m: string) {
  const map: Record<string, string> = {
    CASH: "Cash", CARD: "Card", BANK_TRANSFER: "Bank Transfer", CHEQUE: "Cheque", OTHER: "Other",
  };
  return map[m] ?? m;
}

function fmtSource(s: string) {
  const map: Record<string, string> = {
    walk_in: "Walk-in", phone: "Phone", whatsapp: "WhatsApp",
    website: "Website", agent: "Agent", online: "Online",
  };
  return map[s] ?? s;
}

function fmtUnitType(t: string) {
  const map: Record<string, string> = {
    STUDIO: "Studio", ONE_BR: "1 BR", TWO_BR: "2 BR", THREE_BR: "3 BR",
    FOUR_BR: "4 BR", SUITE: "Suite", PENTHOUSE: "Penthouse", VILLA: "Villa",
  };
  return map[t] ?? t;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function diffDays(a: string, b: string) {
  const ms = new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

// ── Small UI helpers ───────────────────────────────────────────────────────────

function ClassBadge({ c }: { c: string | null }) {
  if (c === "vip")
    return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full"><StarIcon className="h-3 w-3" /> VIP</span>;
  if (c === "blacklisted")
    return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><ShieldExclamationIcon className="h-3 w-3" /> Blacklisted</span>;
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
  return (
    <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-medium text-gray-700">Collect Payment (optional)</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount (OMR)</label>
          <input
            type="number" step="0.001" min="0"
            value={value.amount}
            onChange={(e) => onChange({ ...value, amount: e.target.value })}
            placeholder={balanceDue}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
          <select
            value={value.method}
            onChange={(e) => onChange({ ...value, method: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Reference (optional)</label>
        <input
          type="text" value={value.reference}
          onChange={(e) => onChange({ ...value, reference: e.target.value })}
          placeholder="Receipt #, transaction ID..."
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
  const [payment, setPayment] = useState({ amount: "", method: "CASH", reference: "" });
  const [loading, setLoading] = useState(false);

  const checkInDate = res.startDate;
  const daysUntil = diffDays(new Date().toISOString(), checkInDate);

  async function handleConfirm() {
    setLoading(true);
    const body: Record<string, unknown> = {};
    if (payment.amount && Number(payment.amount) > 0) {
      body.payment = { amount: Number(payment.amount), method: payment.method, reference: payment.reference || null };
    }
    const r = await fetch(`/api/reservations/${res.id}/check-in`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? "Check-in failed"); return; }
    toast.success(data.message ?? "Checked in successfully");
    onSuccess();
  }

  return (
    <Modal title={`Check In — ${res.reservationNumber ?? res.id.slice(0, 8)}`} onClose={onClose}>
      <div className="space-y-5">
        {/* Guest */}
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
            {res.tenant.firstName[0]}{res.tenant.lastName[0]}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{res.tenant.firstName} {res.tenant.lastName}</p>
            <p className="text-sm text-gray-500">{res.tenant.phone}</p>
          </div>
        </div>

        {/* Date info */}
        {daysUntil > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
            <span>Check-in date is {daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`}. Check in early?</span>
          </div>
        )}

        {/* Units */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Units being assigned:</p>
          <div className="flex flex-wrap gap-2">
            {res.units.map((u) => (
              <span key={u.id} className="inline-flex items-center px-3 py-1 rounded-lg bg-gray-100 text-sm font-medium text-gray-800">
                {u.name} — {u.propertyName}
              </span>
            ))}
          </div>
        </div>

        {/* Payment */}
        <PaymentForm
          balanceDue={res.balanceDue}
          value={payment}
          onChange={setPayment}
        />

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? "Checking In…" : "✓ Confirm Check In"}
        </button>
      </div>
    </Modal>
  );
}

// ── Check-Out Modal ────────────────────────────────────────────────────────────

function CheckOutModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
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
    if (!r.ok) { toast.error(data.error ?? "Check-out failed"); return; }
    toast.success(data.message ?? "Checked out successfully");
    onSuccess();
  }

  return (
    <Modal title={`Check Out — ${res.reservationNumber ?? res.id.slice(0, 8)}`} onClose={onClose}>
      <div className="space-y-5">
        {/* Stay summary */}
        <div className={`p-4 rounded-xl ${isOverstay ? "bg-red-50 border border-red-200" : isEarly ? "bg-blue-50 border border-blue-200" : "bg-green-50 border border-green-200"}`}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Planned checkout</p>
              <p className="font-semibold text-gray-900">{fmtDate(res.endDate)}</p>
            </div>
            <div>
              <p className="text-gray-500">Today</p>
              <p className="font-semibold text-gray-900">{fmtDate(today.toISOString())}</p>
            </div>
          </div>
          {isOverstay && (
            <p className="mt-2 text-sm font-medium text-red-700">⚠ Guest has stayed {extraDays} extra night{extraDays > 1 ? "s" : ""} past planned checkout</p>
          )}
          {isEarly && (
            <p className="mt-2 text-sm font-medium text-blue-700">Checking out {Math.abs(extraDays)} day{Math.abs(extraDays) > 1 ? "s" : ""} early</p>
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
                ? `Recalculate charges for actual stay? (reduce by ${estimatedAdjustment.toFixed(3)} OMR)`
                : `Add overstay charges? (${Math.abs(extraDays)} night${Math.abs(extraDays) > 1 ? "s" : ""} × ${nightlyRate.toFixed(3)} OMR = ${estimatedAdjustment.toFixed(3)} OMR)`}
            </label>
          </div>
        )}

        {/* Financial summary */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Original Total</span>
            <span>{res.grandTotal} OMR</span>
          </div>
          {adjustToggle && estimatedAdjustment > 0 && (
            <div className={`flex justify-between ${isEarly ? "text-blue-600" : "text-red-600"}`}>
              <span>{isEarly ? "Early Checkout Reduction" : "Overstay Charges"}</span>
              <span>{isEarly ? "-" : "+"}{estimatedAdjustment.toFixed(3)} OMR</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600 border-t pt-2">
            <span>Already Paid</span>
            <span>-{res.amountPaid} OMR</span>
          </div>
          <div className={`flex justify-between font-bold text-base pt-1 ${Number(adjustedBalance) > 0 ? "text-red-600" : "text-green-600"}`}>
            <span>Balance Due</span>
            <span>{adjustedBalance} OMR</span>
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
          <p className="text-sm font-medium text-gray-600">Unit Condition (optional)</p>
          {(["inspected", "keysReturned", "noDamage"] as const).map((key) => {
            const labels: Record<string, string> = {
              inspected: "Unit inspected", keysReturned: "Keys returned", noDamage: "No damage observed",
            };
            return (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={condition[key]}
                  onChange={(e) => setCondition((c) => ({ ...c, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded text-blue-600"
                />
                {labels[key]}
              </label>
            );
          })}
        </div>

        <button
          onClick={handleConfirm}
          disabled={loading}
          className={`w-full py-3 font-semibold rounded-xl transition-colors disabled:opacity-50 text-white ${isOverstay ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? "Processing…" : "Complete Check Out"}
        </button>
      </div>
    </Modal>
  );
}

// ── Cancel Modal ───────────────────────────────────────────────────────────────

function CancelModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const totalPaid = Number(res.amountPaid);

  async function handleConfirm() {
    if (!reason) { toast.error("Please select a cancellation reason"); return; }
    setLoading(true);
    const r = await fetch(`/api/reservations/${res.id}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, notes }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? "Cancel failed"); return; }
    toast.success(`Reservation ${res.reservationNumber ?? ""} cancelled`);
    onSuccess();
  }

  return (
    <Modal title="Cancel Reservation" onClose={onClose}>
      <div className="space-y-4">
        <div className="p-4 bg-red-50 rounded-xl text-sm text-red-700 border border-red-200">
          This action cannot be undone. The reservation will be permanently cancelled.
        </div>
        {totalPaid > 0 && (
          <div className="p-4 bg-yellow-50 rounded-xl text-sm text-yellow-800 border border-yellow-200">
            ⚠ Guest has paid <strong>{res.amountPaid} OMR</strong>. A refund may be required.
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
          >
            <option value="">Select reason…</option>
            <option value="Guest Cancelled">Guest Cancelled</option>
            <option value="No Show">No Show</option>
            <option value="Overbooking">Overbooking</option>
            <option value="Duplicate Booking">Duplicate Booking</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes {reason === "Other" ? "*" : "(optional)"}</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
            placeholder="Additional details…"
          />
        </div>
        <button
          onClick={handleConfirm}
          disabled={loading || !reason || (reason === "Other" && !notes.trim())}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? "Cancelling…" : "Confirm Cancellation"}
        </button>
      </div>
    </Modal>
  );
}

// ── Payment Modal ──────────────────────────────────────────────────────────────

function PaymentModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({ amount: res.balanceDue, method: "CASH", reference: "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setLoading(true);
    const r = await fetch(`/api/reservations/${res.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(form.amount), method: form.method, reference: form.reference || null }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? "Payment failed"); return; }
    toast.success("Payment recorded");
    onSuccess();
  }

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Balance due: <span className="font-bold text-red-600">{res.balanceDue} OMR</span>
        </div>
        <PaymentForm balanceDue={res.balanceDue} value={form} onChange={setForm} />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? "Recording…" : "Record Payment"}
        </button>
      </div>
    </Modal>
  );
}

// ── Charge Modal ───────────────────────────────────────────────────────────────

function ChargeModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({ description: "", amount: "", category: "other" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!form.description.trim() || !form.amount || Number(form.amount) <= 0) {
      toast.error("Description and amount are required"); return;
    }
    setLoading(true);
    const r = await fetch(`/api/reservations/${res.id}/charges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: form.description.trim(), amount: Number(form.amount), category: form.category }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? "Failed to add charge"); return; }
    toast.success("Charge added");
    onSuccess();
  }

  return (
    <Modal title="Add Extra Charge" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Cleaning fee, minibar, damage repair…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (OMR) *</label>
            <input
              type="number" step="0.001" min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="other">Other</option>
              <option value="cleaning">Cleaning</option>
              <option value="damage">Damage</option>
              <option value="minibar">Minibar</option>
              <option value="service">Room Service</option>
              <option value="parking">Parking</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add Charge"}
        </button>
      </div>
    </Modal>
  );
}

// ── Note Modal ─────────────────────────────────────────────────────────────────

function NoteModal({ res, onSuccess, onClose }: {
  res: ReservationData; onSuccess: () => void; onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) { toast.error("Note cannot be empty"); return; }
    setLoading(true);
    const r = await fetch(`/api/reservations/${res.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast.error(data.error ?? "Failed to add note"); return; }
    toast.success("Note added");
    onSuccess();
  }

  return (
    <Modal title="Add Note" onClose={onClose}>
      <div className="space-y-4">
        <textarea
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note about this reservation…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save Note"}
        </button>
      </div>
    </Modal>
  );
}

// ── Action Buttons ─────────────────────────────────────────────────────────────

function ActionButtons({ ds, onAction, reservationId }: {
  ds: string;
  onAction: (a: ModalType) => void;
  reservationId: string;
}) {
  const openPrint = () => window.open(`/api/reservations/${reservationId}/pdf`, "_blank");

  switch (ds) {
    case "Upcoming":
      return (
        <>
          <Link href="edit" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PencilSquareIcon className="h-4 w-4" /> Edit
          </Link>
          <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PrinterIcon className="h-4 w-4" /> Print
          </button>
          <button onClick={() => onAction("cancel")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 bg-white text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            <XMarkIcon className="h-4 w-4" /> Cancel
          </button>
        </>
      );
    case "Arriving Today":
    case "Overdue Arrival":
      return (
        <>
          <button onClick={() => onAction("check-in")} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors shadow-sm">
            <CheckIcon className="h-4 w-4" /> Check In
          </button>
          {ds === "Overdue Arrival" && (
            <button onClick={() => onAction("cancel")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
              No Show
            </button>
          )}
          <Link href="edit" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PencilSquareIcon className="h-4 w-4" /> Edit
          </Link>
          <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PrinterIcon className="h-4 w-4" /> Print
          </button>
          <button onClick={() => onAction("cancel")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 bg-white text-sm font-medium text-red-600 hover:bg-red-50">
            <XMarkIcon className="h-4 w-4" /> Cancel
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
            Check Out
          </button>
          <button onClick={() => onAction("extend-stay")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-300 bg-white text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
            Extend Stay
          </button>
          <button onClick={() => onAction("move-unit")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Move Unit
          </button>
          <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PrinterIcon className="h-4 w-4" /> Print
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
            Check Out
          </button>
          <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PrinterIcon className="h-4 w-4" /> Print
          </button>
        </>
      );
    case "Checked Out":
      return (
        <>
          <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <PrinterIcon className="h-4 w-4" /> Print
          </button>
        </>
      );
    default:
      return (
        <button onClick={openPrint} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <PrinterIcon className="h-4 w-4" /> Print
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
  const [res, setRes] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

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
          <p>Loading reservation…</p>
        </div>
      </div>
    );
  }

  if (!res) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Reservation not found</p>
          <Link href="/dashboard/reservations" className="text-blue-600 hover:underline text-sm mt-2 block">
            ← Back to reservations
          </Link>
        </div>
      </div>
    );
  }

  const balanceDue = Number(res.balanceDue);
  const isPaid = balanceDue === 0;
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
                  Created {fmtDate(res.createdAt)}{res.createdByName ? ` by ${res.createdByName}` : ""}
                </p>
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <ActionButtons ds={res.displayStatus} onAction={setActiveModal} reservationId={res.id} />
            </div>
          </div>
        </div>
      </div>

      {/* ── URGENT ALERT BANNER ── */}
      {(res.displayStatus === "Overstay" || res.displayStatus === "Due Checkout") && (
        <div className={`${res.displayStatus === "Overstay" ? "bg-red-600" : "bg-orange-500"} text-white text-center py-2 text-sm font-medium`}>
          {res.displayStatus === "Overstay"
            ? `⚠ OVERSTAY — Guest should have checked out ${Math.abs(diffDays(today, res.endDate))} day(s) ago`
            : "⏰ CHECKOUT DUE TODAY — Guest must check out today"}
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
                  View Full Profile →
                </Link>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <a href={`tel:${res.tenant.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors">
                  <PhoneIcon className="h-4 w-4 text-gray-400 shrink-0" />
                  {res.tenant.phone}
                </a>
                {res.tenant.whatsappNumber && (
                  <a href={`https://wa.me/${res.tenant.whatsappNumber.replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-green-600 hover:underline">
                    <span className="text-base">📱</span> WhatsApp
                  </a>
                )}
                {res.tenant.email && (
                  <a href={`mailto:${res.tenant.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600">
                    <EnvelopeIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    {res.tenant.email}
                  </a>
                )}
                {res.tenant.idNumber && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <IdentificationIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-400">{res.tenant.idType ?? "ID"}: </span>
                    {res.tenant.idNumber}
                    {res.tenant.idExpiryDate && new Date(res.tenant.idExpiryDate) < new Date() && (
                      <span className="text-xs text-red-600 font-medium ml-1">⚠ Expired</span>
                    )}
                  </div>
                )}
              </div>

              {/* CRM stats */}
              <div className="flex items-center gap-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                <span>{res.tenant.totalStays}th stay</span>
                <span>Total spent: {Number(res.tenant.totalSpent).toFixed(3)} OMR</span>
                {res.tenant.firstStayDate && (
                  <span>First visit: {fmtDate(res.tenant.firstStayDate, { month: "short", year: "numeric" })}</span>
                )}
                {res.tenant.corporateName && (
                  <span className="font-medium text-gray-700">🏢 {res.tenant.corporateName}</span>
                )}
              </div>

              {/* Special requests + internal notes */}
              {res.tenant.specialRequests && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <span className="font-medium">Special Requests: </span>{res.tenant.specialRequests}
                </div>
              )}
              {res.tenant.internalNotes && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <span className="font-medium">Staff Notes: </span>{res.tenant.internalNotes}
                </div>
              )}
            </div>

            {/* Section 2: Stay Details */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Stay Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Dates */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Check-in</p>
                    <p className="text-sm font-semibold text-gray-900">{fmtDateFull(res.startDate)}</p>
                    {res.actualCheckIn && (
                      <p className="text-xs text-green-600 mt-0.5">
                        ✓ Checked in at {fmtTime(res.actualCheckIn)}
                      </p>
                    )}
                    {!res.actualCheckIn && isToday(res.startDate) && (
                      <p className="text-xs text-orange-600 font-medium mt-0.5">Today</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Check-out</p>
                    <p className={`text-sm font-semibold ${!res.actualCheckOut && diffDays(today, res.endDate) > 0 ? "text-red-600" : "text-gray-900"}`}>
                      {fmtDateFull(res.endDate)}
                    </p>
                    {res.actualCheckOut && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        ✓ Checked out at {fmtTime(res.actualCheckOut)}
                      </p>
                    )}
                    {!res.actualCheckOut && res.displayStatus === "Overstay" && (
                      <p className="text-xs text-red-600 font-medium mt-0.5">
                        ⚠ Checkout was due {Math.abs(diffDays(today, res.endDate))} day(s) ago
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {res.rateType === "monthly"
                        ? `${Math.round(res.totalNights / 30)} month(s)`
                        : `${res.totalNights} night${res.totalNights !== 1 ? "s" : ""}`}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {res.rateType === "monthly" ? "Monthly Rate" : "Daily Rate"}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {fmtSource(res.source)}
                    </span>
                  </div>
                </div>

                {/* Units */}
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Units</p>
                  <div className="space-y-2">
                    {res.units.map((u) => (
                      <div key={u.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{u.name}</p>
                            <p className="text-xs text-gray-500">{u.propertyName} — Floor {u.floor} — {fmtUnitType(u.unitType)}</p>
                          </div>
                          <p className="text-xs font-medium text-gray-700 shrink-0 ml-2">
                            {Number(u.subtotal).toFixed(3)} OMR
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {Number(u.rateAmount).toFixed(3)} OMR/{u.rateType === "monthly" ? "month" : "night"}
                          {u.seasonalPriceName && <span className="text-orange-600 ml-1">({u.seasonalPriceName})</span>}
                          {u.rateSource === "manual_override" && <span className="text-purple-600 ml-1">(Manual rate)</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reservation notes */}
              {res.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{res.notes}</p>
                </div>
              )}

              {/* Cancellation info */}
              {res.status === "CANCELLED" && res.cancelledReason && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-1">Cancellation Reason</p>
                  <p className="text-sm text-gray-700">{res.cancelledReason}</p>
                  {res.cancelledAt && (
                    <p className="text-xs text-gray-400 mt-0.5">Cancelled on {fmtDate(res.cancelledAt)}</p>
                  )}
                </div>
              )}
            </div>

            {/* Section 4: Pricing Breakdown */}
            <Collapsible title="Pricing Breakdown" defaultOpen={false}>
              {res.units.length === 0 ? (
                <p className="text-sm text-gray-400">No unit pricing data.</p>
              ) : (
                <div className="space-y-4">
                  {res.units.map((u) => (
                    <div key={u.id}>
                      <p className="font-medium text-sm text-gray-800 mb-2">{u.name} — {u.propertyName}</p>
                      <div className="flex justify-between text-sm text-gray-700 pl-4">
                        <span>
                          {u.nights} {u.rateType === "monthly" ? "month(s)" : "night(s)"} × {Number(u.rateAmount).toFixed(3)} OMR
                          {u.seasonalPriceName && <span className="text-orange-600 ml-1">({u.seasonalPriceName})</span>}
                        </span>
                        <span className="font-medium">{Number(u.subtotal).toFixed(3)} OMR</span>
                      </div>
                    </div>
                  ))}
                  {res.charges.length > 0 && (
                    <div className="pt-3 border-t border-gray-100 space-y-1">
                      <p className="font-medium text-sm text-gray-800 mb-2">Extra Charges</p>
                      {res.charges.map((c) => (
                        <div key={c.id} className="flex justify-between text-sm text-gray-700 pl-4">
                          <span>{c.description}</span>
                          <span className="font-medium text-orange-600">+{Number(c.amount).toFixed(3)} OMR</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {Number(res.discountAmount) > 0 && (
                    <div className="flex justify-between text-sm text-gray-700 pt-2 border-t border-dashed">
                      <span>Discount</span>
                      <span className="font-medium text-green-600">-{Number(res.discountAmount).toFixed(3)} OMR</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200">
                    <span>Grand Total</span>
                    <span>{Number(res.grandTotal).toFixed(3)} OMR</span>
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
                <h3 className="font-semibold text-gray-800">Financial Summary</h3>
              </div>
              <div className="p-5 space-y-3">
                {/* Charges breakdown */}
                {res.units.map((u) => (
                  <div key={u.id} className="flex justify-between text-sm text-gray-700">
                    <span className="text-gray-500">{u.name}: {u.nights} × {Number(u.rateAmount).toFixed(3)}</span>
                    <span>{Number(u.subtotal).toFixed(3)}</span>
                  </div>
                ))}
                {res.charges.map((c) => (
                  <div key={c.id} className="flex justify-between text-sm text-gray-700">
                    <span className="text-orange-500">{c.description}</span>
                    <span className="text-orange-600">+{Number(c.amount).toFixed(3)}</span>
                  </div>
                ))}
                {Number(res.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-green-600">-{Number(res.discountAmount).toFixed(3)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Grand Total</span>
                  <span>{Number(res.grandTotal).toFixed(3)} OMR</span>
                </div>

                {/* Payments */}
                {res.payments.length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Payments</p>
                    {res.payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm text-gray-700 mb-1">
                        <span className="text-gray-500">
                          {fmtDate(p.date)} — {fmtMethod(p.method)}
                          {p.reference && <span className="text-gray-400 ml-1">({p.reference})</span>}
                        </span>
                        <span>{Number(p.amount).toFixed(3)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-medium text-gray-700 pt-1 border-t border-dashed mt-2">
                      <span>Total Paid</span>
                      <span>{Number(res.amountPaid).toFixed(3)}</span>
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
                      <CheckIcon className="h-5 w-5" /> FULLY PAID
                    </p>
                  ) : isOverpaid ? (
                    <p className="font-bold text-blue-700">CREDIT: {Math.abs(balanceDue).toFixed(3)} OMR</p>
                  ) : (
                    <>
                      <p className="text-xs text-red-500 font-medium mb-0.5">BALANCE DUE</p>
                      <p className="text-2xl font-bold text-red-600">{balanceDue.toFixed(3)} OMR</p>
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
                      Record Payment
                    </button>
                  )}
                  <button
                    onClick={() => setActiveModal("charge")}
                    className="w-full py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <PlusIcon className="h-4 w-4" /> Add Charge
                  </button>
                </div>
              </div>
            </div>

            {/* Section 5: Activity Timeline */}
            <Collapsible title={`Activity (${res.activities.length})`} defaultOpen={true}>
              {res.activities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {res.activities.map((a) => (
                    <div key={a.id} className="flex items-start gap-3">
                      <ActivityIcon action={a.action} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-snug">{a.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {fmtDate(a.createdAt)} {fmtTime(a.createdAt)}
                          {a.performedByName && <span className="ml-1">— {a.performedByName}</span>}
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
                <PlusIcon className="h-4 w-4" /> Add Note
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
          onClose={() => setActiveModal(null)}
          onSuccess={afterAction}
        />
      )}
    </div>
  );
}
