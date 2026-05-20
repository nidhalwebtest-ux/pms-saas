/* ============================================================================
 *  Marketing mocks — placeholder UI screenshots that live inside section
 *  cards. Each mock renders a labeled box matching the container's
 *  dimensions; real markup gets dropped in piece-by-piece as the design
 *  hand-off lands. Kept in one file so a single search points at every
 *  placeholder when the time comes.
 * ========================================================================= */

import type { ReactNode } from "react";

function MockSurface({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={`${label} (placeholder)`}
      className={[
        "relative grid h-full w-full place-items-center bg-gradient-to-br from-gray-50 to-gray-100",
        "font-mono text-[10.5px] uppercase tracking-[0.08em] text-gray-400",
        className,
      ].join(" ")}
    >
      {children ?? (
        <span className="rounded-full border border-dashed border-gray-300 bg-white/70 px-3 py-1.5">
          {label}
        </span>
      )}
    </div>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────────── */
export function HeroDashboardMock() {
  return <MockSurface label="Hero dashboard mock" className="aspect-[16/10]" />;
}

/* ── Solution section ─────────────────────────────────────────────────── */
export function CalendarMini() {
  return <MockSurface label="Availability calendar" />;
}
export function KhareefPricingMini() {
  return <MockSurface label="Khareef pricing" />;
}
export function MultiDeviceMini() {
  return <MockSurface label="Multi-device" />;
}

/* ── Feature blocks ───────────────────────────────────────────────────── */
export function ReservationMock() {
  return <MockSurface label="Reservation workflow" className="aspect-[16/10]" />;
}
export function InvoiceMock() {
  return <MockSurface label="Invoice + payments" className="aspect-[16/10]" />;
}
export function Manager360Mock() {
  return <MockSurface label="Manager 360°" className="aspect-[16/10]" />;
}
export function MobileApprovalMock() {
  return <MockSurface label="Mobile approval" className="aspect-[16/10]" />;
}

/* ── Built for Oman section ───────────────────────────────────────────── */
export function ArabicUIMini() {
  return <MockSurface label="Arabic UI" />;
}
export function OMRInvoiceMini() {
  return <MockSurface label="OMR invoice" />;
}
export function KhareefCalendarMini() {
  return <MockSurface label="Khareef calendar" />;
}
