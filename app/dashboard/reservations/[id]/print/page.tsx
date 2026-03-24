import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getDisplayStatus, type StoredStatus } from "@/lib/reservation-status";

export default async function ReservationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant: true,
      unit: { include: { property: { select: { id: true, name: true } } } },
      reservationUnits: {
        include: {
          unit: { include: { property: { select: { id: true, name: true } } } },
        },
      },
      payments: { orderBy: { date: "asc" } },
      charges: true,
    },
  });

  if (!r) notFound();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true, organization: true },
  });

  if (r.tenant.organizationId !== dbUser?.organizationId) notFound();

  const org = dbUser?.organization;
  const ds = getDisplayStatus(r.status as StoredStatus, r.startDate, r.endDate);

  // Merge units
  const seen = new Set<string>();
  const units: { name: string; unitType: string; propertyName: string; rateAmount: string; nights: number; subtotal: string; rateType: string; seasonalPriceName: string | null }[] = [];
  if (r.unit) {
    const ru = r.reservationUnits.find((x) => x.unitId === r.unit!.id);
    seen.add(r.unit.id);
    units.push({
      name: r.unit.name, unitType: r.unit.unitType,
      propertyName: r.unit.property.name,
      rateAmount: ru ? ru.rateAmount.toString() : "0",
      nights: ru?.nights ?? r.totalNights,
      subtotal: ru ? ru.subtotal.toString() : Number(r.grandTotal).toFixed(3),
      rateType: ru?.rateType ?? r.rateType,
      seasonalPriceName: ru?.seasonalPriceName ?? null,
    });
  }
  for (const ru of r.reservationUnits) {
    if (!seen.has(ru.unitId)) {
      seen.add(ru.unitId);
      units.push({
        name: ru.unit.name, unitType: ru.unit.unitType,
        propertyName: ru.unit.property.name,
        rateAmount: ru.rateAmount.toString(), nights: ru.nights,
        subtotal: ru.subtotal.toString(), rateType: ru.rateType,
        seasonalPriceName: ru.seasonalPriceName,
      });
    }
  }

  const grandTotal  = Number(r.grandTotal ?? r.totalPrice ?? 0);
  const amountPaid  = Number(r.amountPaid ?? 0);
  const balanceDue  = Math.max(0, grandTotal - amountPaid);
  const chargesTotal = r.charges.reduce((s, c) => s + Number(c.amount), 0);

  function fmtDate(d: Date | string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  function fmtDateShort(d: Date | string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  function fmtMethod(m: string) {
    const map: Record<string, string> = { CASH: "Cash", CARD: "Card", BANK_TRANSFER: "Bank Transfer", CHEQUE: "Cheque" };
    return map[m] ?? m;
  }

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width" />
        <title>Reservation {r.reservationNumber ?? r.id.slice(0, 8)} — {org?.name}</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: white; }
          .page { max-width: 800px; margin: 0 auto; padding: 32px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #1a56db; margin-bottom: 20px; }
          .org-name { font-size: 20px; font-weight: 700; color: #1a56db; }
          .org-details { font-size: 11px; color: #666; margin-top: 4px; line-height: 1.6; }
          .res-info { text-align: right; }
          .res-number { font-size: 18px; font-weight: 700; font-family: monospace; }
          .res-date { font-size: 11px; color: #666; margin-top: 4px; }
          .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-top: 6px; }
          .status-confirmed { background: #dbeafe; color: #1d4ed8; }
          .status-checked_in { background: #dcfce7; color: #15803d; }
          .status-completed { background: #e2e8f0; color: #475569; }
          .status-cancelled { background: #fee2e2; color: #b91c1c; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
          .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .field-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
          .field-value { font-size: 12px; color: #111827; font-weight: 500; margin-top: 1px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          .table th { text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
          .table th.right { text-align: right; }
          .table td { padding: 7px 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px; vertical-align: top; }
          .table td.right { text-align: right; }
          .table tr:last-child td { border-bottom: none; }
          .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; color: #374151; }
          .summary-row.total { font-weight: 700; font-size: 13px; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 4px; }
          .summary-row.balance { font-weight: 700; font-size: 14px; color: ${balanceDue > 0 ? "#dc2626" : "#16a34a"}; }
          .balance-box { border: 2px solid ${balanceDue > 0 ? "#fca5a5" : "#86efac"}; background: ${balanceDue > 0 ? "#fef2f2" : "#f0fdf4"}; border-radius: 8px; padding: 12px 16px; margin-top: 12px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .sig-line { border-top: 1px solid #9ca3af; margin-top: 32px; padding-top: 6px; font-size: 11px; color: #6b7280; }
          .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
          .arabic { direction: rtl; text-align: right; font-size: 11px; color: #6b7280; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            @page { size: A4; margin: 15mm; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          {/* Header */}
          <div className="header">
            <div>
              <div className="org-name">{org?.name ?? "Property Management"}</div>
              <div className="org-details">
                {org?.address && <div>{org.address}</div>}
                {org?.city && <div>{org.city}</div>}
                {org?.phone && <div>Tel: {org.phone}</div>}
              </div>
            </div>
            <div className="res-info">
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a56db" }}>RESERVATION CONFIRMATION</div>
              <div className="arabic">تأكيد الحجز</div>
              <div className="res-number">{r.reservationNumber ?? r.id.slice(0, 8).toUpperCase()}</div>
              <div className="res-date">Printed: {today}</div>
              <div>
                <span className={`status-badge status-${r.status.toLowerCase().replace("_", "-")}`}>
                  {ds.label}
                </span>
              </div>
            </div>
          </div>

          {/* Guest Information */}
          <div className="section">
            <div className="section-title">Guest Information / معلومات الضيف</div>
            <div className="two-col">
              <div>
                <div className="field-label">Full Name</div>
                <div className="field-value">{r.tenant.firstName} {r.tenant.lastName}</div>
                {r.tenant.fullNameArabic && <div className="arabic">{r.tenant.fullNameArabic}</div>}
              </div>
              <div>
                <div className="field-label">Phone</div>
                <div className="field-value">{r.tenant.phone}</div>
              </div>
              <div>
                <div className="field-label">ID</div>
                <div className="field-value">{r.tenant.idType?.toUpperCase() ?? "ID"}: {r.tenant.idNumber ?? "—"}</div>
              </div>
              <div>
                <div className="field-label">Nationality</div>
                <div className="field-value">{r.tenant.nationality ?? "—"}</div>
              </div>
            </div>
          </div>

          {/* Stay Details */}
          <div className="section">
            <div className="section-title">Stay Details / تفاصيل الإقامة</div>
            <div className="two-col">
              <div>
                <div className="field-label">Check-in</div>
                <div className="field-value">{fmtDate(r.startDate)}</div>
                {r.actualCheckIn && <div style={{ fontSize: 10, color: "#16a34a", marginTop: 2 }}>Actual: {fmtDate(r.actualCheckIn)}</div>}
              </div>
              <div>
                <div className="field-label">Check-out</div>
                <div className="field-value">{fmtDate(r.endDate)}</div>
                {r.actualCheckOut && <div style={{ fontSize: 10, color: "#2563eb", marginTop: 2 }}>Actual: {fmtDate(r.actualCheckOut)}</div>}
              </div>
              <div>
                <div className="field-label">Duration</div>
                <div className="field-value">
                  {r.rateType === "monthly"
                    ? `${Math.round(r.totalNights / 30)} month(s)`
                    : `${r.totalNights} night${r.totalNights !== 1 ? "s" : ""}`}
                </div>
              </div>
              <div>
                <div className="field-label">Rate Type</div>
                <div className="field-value">{r.rateType === "monthly" ? "Monthly Rate" : "Daily Rate"}</div>
              </div>
            </div>
          </div>

          {/* Units */}
          <div className="section">
            <div className="section-title">Units / الوحدات</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Property</th>
                  <th>Type</th>
                  <th className="right">Rate</th>
                  <th className="right">{r.rateType === "monthly" ? "Months" : "Nights"}</th>
                  <th className="right">Subtotal (OMR)</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.propertyName}</td>
                    <td>{u.unitType}</td>
                    <td className="right">
                      {Number(u.rateAmount).toFixed(3)}
                      {u.seasonalPriceName && <div style={{ fontSize: 10, color: "#d97706" }}>{u.seasonalPriceName}</div>}
                    </td>
                    <td className="right">{u.nights}</td>
                    <td className="right" style={{ fontWeight: 600 }}>{Number(u.subtotal).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary */}
          <div className="section">
            <div className="section-title">Financial Summary / الملخص المالي</div>
            <div style={{ maxWidth: 320, marginLeft: "auto" }}>
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{Number(r.totalAmount).toFixed(3)} OMR</span>
              </div>
              {chargesTotal > 0 && (
                <div className="summary-row">
                  <span>Extra Charges</span>
                  <span>+{chargesTotal.toFixed(3)} OMR</span>
                </div>
              )}
              {Number(r.discountAmount) > 0 && (
                <div className="summary-row">
                  <span>Discount</span>
                  <span style={{ color: "#16a34a" }}>-{Number(r.discountAmount).toFixed(3)} OMR</span>
                </div>
              )}
              <div className="summary-row total">
                <span>Grand Total</span>
                <span>{grandTotal.toFixed(3)} OMR</span>
              </div>

              {r.payments.length > 0 && (
                <>
                  <div style={{ marginTop: 12, marginBottom: 4, fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payments</div>
                  {r.payments.map((p) => (
                    <div className="summary-row" key={p.id}>
                      <span>{fmtDateShort(p.date)} — {fmtMethod(p.method)}{p.reference ? ` (${p.reference})` : ""}</span>
                      <span>{Number(p.amount).toFixed(3)}</span>
                    </div>
                  ))}
                  <div className="summary-row" style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 6, marginTop: 4, fontWeight: 600 }}>
                    <span>Total Paid</span>
                    <span>{amountPaid.toFixed(3)} OMR</span>
                  </div>
                </>
              )}

              <div className="balance-box">
                <div style={{ fontSize: 11, color: balanceDue > 0 ? "#dc2626" : "#16a34a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {balanceDue > 0 ? "Balance Due" : "✓ Fully Paid"}
                </div>
                {balanceDue > 0 && (
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626", marginTop: 2 }}>
                    {balanceDue.toFixed(3)} OMR
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {r.notes && (
            <div className="section">
              <div className="section-title">Notes / ملاحظات</div>
              <p style={{ fontSize: 12, color: "#374151" }}>{r.notes}</p>
            </div>
          )}

          {/* Signatures */}
          <div className="signatures">
            <div>
              <div className="sig-line">Authorized by: ___________________________</div>
            </div>
            <div>
              <div className="sig-line">Guest Signature: ___________________________</div>
            </div>
          </div>

          {/* Footer */}
          <div className="footer">
            <div>Thank you for choosing {org?.name ?? "our property"}</div>
            <div className="arabic">شكراً لاختياركم {org?.name ?? "عقارنا"}</div>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: "window.onload = function() { window.print(); }" }} />
      </body>
    </html>
  );
}
