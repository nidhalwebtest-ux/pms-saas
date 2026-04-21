import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getDisplayStatus, type StoredStatus } from "@/lib/reservation-status";
import { DISPLAY_STATUS_KEY, getPdfLocaleContext } from "@/lib/pdf-i18n";

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, organizationId: true, organization: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.redirect("/login");

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

  if (!r || r.tenant.organizationId !== actor.organizationId) {
    return new Response("Reservation not found", { status: 404 });
  }

  const org = actor.organization;
  const ds  = getDisplayStatus(r.status as StoredStatus, r.startDate, r.endDate);

  // ── i18n ──────────────────────────────────────────────────────────────────
  const { locale, otherLocale, dir, fmtFull, fmtLong } = await getPdfLocaleContext();
  const t       = await getTranslations({ locale, namespace: "pdfs.reservation" });
  const tOther  = await getTranslations({ locale: otherLocale, namespace: "pdfs.reservation" });
  const tCommon = await getTranslations({ locale, namespace: "pdfs.common" });
  const tStatus = await getTranslations({ locale, namespace: "reservations.statuses" });
  const tUnitTypes = await getTranslations({ locale, namespace: "reservations.detail.unitTypes" });

  const isRtl = dir === "rtl";
  const secondaryDir = isRtl ? "ltr" : "rtl";

  // ── Merge units (legacy + junction table) ─────────────────────────────────
  const seen = new Set<string>();
  const units: {
    name: string; unitType: string; propertyName: string;
    rateAmount: string; nights: number; subtotal: string;
    rateType: string; seasonalPriceName: string | null;
  }[] = [];

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

  const grandTotal   = Number(r.grandTotal ?? r.totalPrice ?? 0);
  const amountPaid   = Number(r.amountPaid ?? 0);
  const balanceDue   = Math.max(0, grandTotal - amountPaid);
  const isPaid       = balanceDue === 0;

  const fmtUnitType = (type: string) =>
    tUnitTypes.has(type) ? tUnitTypes(type) : type;

  const today = fmtLong(new Date());
  const orgName = org?.name ?? t("defaultOrgName");

  const statusKey = DISPLAY_STATUS_KEY[ds.label];
  const statusLabel = tStatus.has(statusKey) ? tStatus(statusKey) : ds.label;

  const statusColor =
    r.status === "CHECKED_IN" || r.status === "CONFIRMED" ? "#15803d" :
    r.status === "COMPLETED"  ? "#1d4ed8" :
    r.status === "CANCELLED"  ? "#dc2626" : "#374151";

  const durationLabel = r.rateType === "monthly"
    ? t("duration.months", { count: Math.round(r.totalNights / 30) })
    : t("duration.nights", { count: r.totalNights });

  const rateTypeLabel = r.rateType === "monthly"
    ? t("rateTypes.monthly")
    : t("rateTypes.daily");

  const nightsOrMonthsHeader = r.rateType === "monthly"
    ? t("table.months")
    : t("table.nights");

  // ── Unit rows HTML ─────────────────────────────────────────────────────────
  const unitRows = units.map((u) => `
    <tr>
      <td style="padding:8px 10px;font-weight:600;border-bottom:1px solid #f3f4f6">${u.name}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6">${u.propertyName}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6">${fmtUnitType(u.unitType)}</td>
      <td style="padding:8px 10px;text-align:${isRtl ? "left" : "right"};border-bottom:1px solid #f3f4f6">
        ${Number(u.rateAmount).toFixed(3)}${u.seasonalPriceName ? `<br/><span style="font-size:10px;color:#d97706">${u.seasonalPriceName}</span>` : ""}
      </td>
      <td style="padding:8px 10px;text-align:${isRtl ? "left" : "right"};border-bottom:1px solid #f3f4f6">${u.nights}</td>
      <td style="padding:8px 10px;text-align:${isRtl ? "left" : "right"};font-weight:600;border-bottom:1px solid #f3f4f6">${Number(u.subtotal).toFixed(3)}</td>
    </tr>`).join("");

  // ── Payment rows HTML ──────────────────────────────────────────────────────
  const tMethods = await getTranslations({ locale, namespace: "payments.methods" });
  const fmtMethod = (m: string) => (tMethods.has(m) ? tMethods(m) : m);

  const paymentRows = r.payments.map((p) => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#374151">
      <span>${fmtLong(p.date)} — ${fmtMethod(p.method)}${p.reference ? ` <span style="color:#9ca3af">(${p.reference})</span>` : ""}</span>
      <span>${Number(p.amount).toFixed(3)}</span>
    </div>`).join("");

  // ── Charge rows HTML ───────────────────────────────────────────────────────
  const chargeRows = r.charges.length > 0 ? r.charges.map((c) => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#374151">
      <span style="color:#d97706">${c.description}</span>
      <span>+${Number(c.amount).toFixed(3)}</span>
    </div>`).join("") : "";

  // ── Section header helper ─────────────────────────────────────────────────
  const sectionHeader = (key: string) => `
    <div class="section-header">
      <span>${t(key)}</span>
      <span class="sec">${tOther(key)}</span>
    </div>`;

  // ── Full HTML ──────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width"/>
  <title>${t("title")} ${r.reservationNumber ?? r.id.slice(0, 8)} — ${org?.name ?? ""}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size:12px; color:#1a1a1a; background:#fff; }
    .page { max-width:800px; margin:0 auto; padding:40px; }

    /* Header */
    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:24px; border-bottom:3px solid #1d4ed8; margin-bottom:28px; }
    .org-logo-area { flex:1; }
    .org-name { font-size:22px; font-weight:800; color:#1d4ed8; letter-spacing:-0.3px; }
    .org-sub  { font-size:11px; color:#6b7280; margin-top:6px; line-height:1.8; }
    .res-info-area { text-align:${isRtl ? "left" : "right"}; }
    .doc-title-primary  { font-size:16px; font-weight:700; color:#1d4ed8; }
    .doc-title-secondary  { font-size:13px; color:#6b7280; margin-top:2px; font-family: 'Segoe UI', Tahoma, sans-serif; direction:${secondaryDir}; }
    .res-number    { font-size:20px; font-weight:800; font-family:monospace; color:#111827; margin-top:10px; direction:ltr; }
    .print-date    { font-size:11px; color:#9ca3af; margin-top:3px; }
    .status-pill   { display:inline-block; margin-top:8px; padding:4px 14px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:0.04em; background:${statusColor}1a; color:${statusColor}; border:1px solid ${statusColor}4d; }

    /* Section */
    .section { margin-bottom:24px; }
    .section-header { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#6b7280; margin-bottom:10px; padding-bottom:5px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center; }
    .section-header .sec { font-size:11px; color:#9ca3af; text-transform:none; letter-spacing:0; direction:${secondaryDir}; }

    /* Grid */
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    .four-col { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
    .field-label { font-size:10px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:3px; }
    .field-value { font-size:12px; color:#111827; font-weight:600; line-height:1.4; }
    .field-sub   { font-size:11px; color:#6b7280; margin-top:1px; }

    /* Table */
    table { width:100%; border-collapse:collapse; }
    thead tr { background:#f9fafb; }
    th { text-align:${isRtl ? "right" : "left"}; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280; padding:8px 10px; border-bottom:2px solid #e5e7eb; }
    th.numeric { text-align:${isRtl ? "left" : "right"}; }

    /* Financial */
    .fin-row { display:flex; justify-content:space-between; padding:5px 0; font-size:12px; color:#374151; }
    .fin-row.subtotal { border-top:1px solid #e5e7eb; padding-top:8px; margin-top:4px; font-weight:600; }
    .fin-row.grand    { font-size:14px; font-weight:800; color:#111827; border-top:2px solid #111827; padding-top:8px; margin-top:8px; }
    .balance-box { margin-top:16px; padding:16px 20px; border-radius:10px; text-align:${isRtl ? "left" : "right"}; background:${isPaid ? "#f0fdf4" : "#fef2f2"}; border:2px solid ${isPaid ? "#86efac" : "#fca5a5"}; }
    .balance-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:${isPaid ? "#15803d" : "#dc2626"}; }
    .balance-amount { font-size:22px; font-weight:800; color:${isPaid ? "#15803d" : "#dc2626"}; margin-top:4px; direction:ltr; }

    /* Signature */
    .sig-grid { display:grid; grid-template-columns:1fr 1fr; gap:60px; margin-top:40px; padding-top:24px; border-top:1px solid #e5e7eb; }
    .sig-line  { border-top:1px solid #9ca3af; margin-top:36px; padding-top:6px; font-size:11px; color:#6b7280; }

    /* Footer */
    .footer { margin-top:28px; padding-top:18px; border-top:2px solid #e5e7eb; text-align:center; }
    .footer-primary { font-size:13px; font-weight:600; color:#374151; }
    .footer-secondary { font-size:12px; color:#6b7280; margin-top:4px; direction:${secondaryDir}; font-family: 'Segoe UI', Tahoma, sans-serif; }

    /* Numeric isolation in RTL */
    .ltr-num { direction:ltr; unicode-bidi:embed; display:inline-block; }

    /* Print */
    @page { size:A4; margin:15mm; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .page { padding:0; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ═══ HEADER ═══ -->
  <div class="header">
    <div class="org-logo-area">
      <div class="org-name">${orgName}</div>
      <div class="org-sub">
        ${org?.address ? `<div>${org.address}${org?.city ? `, ${org.city}` : ""}</div>` : ""}
        ${org?.phone ? `<div>${tCommon("tel")}: <span class="ltr-num">${org.phone}</span></div>` : ""}
      </div>
    </div>
    <div class="res-info-area">
      <div class="doc-title-primary">${t("title")}</div>
      <div class="doc-title-secondary">${tOther("title")}</div>
      <div class="res-number">${r.reservationNumber ?? r.id.slice(0, 8).toUpperCase()}</div>
      <div class="print-date">${t("printedOn", { date: today })}</div>
      <span class="status-pill">${statusLabel}</span>
    </div>
  </div>

  <!-- ═══ GUEST INFORMATION ═══ -->
  <div class="section">
    ${sectionHeader("sections.guestInfo")}
    <div class="four-col">
      <div>
        <div class="field-label">${t("fields.fullName")}</div>
        <div class="field-value">${r.tenant.firstName} ${r.tenant.lastName}</div>
        ${r.tenant.fullNameArabic ? `<div class="field-sub" style="direction:rtl">${r.tenant.fullNameArabic}</div>` : ""}
      </div>
      <div>
        <div class="field-label">${t("fields.phone")}</div>
        <div class="field-value"><span class="ltr-num">${r.tenant.phone}</span></div>
        ${r.tenant.whatsappNumber ? `<div class="field-sub">${t("whatsapp", { number: r.tenant.whatsappNumber })}</div>` : ""}
      </div>
      <div>
        <div class="field-label">${t("fields.idDocument")}</div>
        <div class="field-value">${r.tenant.idType?.toUpperCase() ?? "ID"}: ${r.tenant.idNumber ?? tCommon("dash")}</div>
      </div>
      <div>
        <div class="field-label">${t("fields.nationality")}</div>
        <div class="field-value">${r.tenant.nationality ?? tCommon("dash")}</div>
      </div>
    </div>
  </div>

  <!-- ═══ STAY DETAILS ═══ -->
  <div class="section">
    ${sectionHeader("sections.stayDetails")}
    <div class="four-col">
      <div style="grid-column:span 1">
        <div class="field-label">${t("fields.checkIn")}</div>
        <div class="field-value">${fmtFull(r.startDate)}</div>
        ${r.actualCheckIn ? `<div class="field-sub" style="color:#15803d">${t("actual", { date: fmtFull(r.actualCheckIn) })}</div>` : ""}
      </div>
      <div style="grid-column:span 1">
        <div class="field-label">${t("fields.checkOut")}</div>
        <div class="field-value">${fmtFull(r.endDate)}</div>
        ${r.actualCheckOut ? `<div class="field-sub" style="color:#1d4ed8">${t("actual", { date: fmtFull(r.actualCheckOut) })}</div>` : ""}
      </div>
      <div>
        <div class="field-label">${t("fields.duration")}</div>
        <div class="field-value">${durationLabel}</div>
      </div>
      <div>
        <div class="field-label">${t("fields.rateType")}</div>
        <div class="field-value">${rateTypeLabel}</div>
      </div>
    </div>
  </div>

  <!-- ═══ UNITS ═══ -->
  <div class="section">
    ${sectionHeader("sections.units")}
    <table>
      <thead>
        <tr>
          <th>${t("table.unit")}</th>
          <th>${t("table.property")}</th>
          <th>${t("table.type")}</th>
          <th class="numeric">${t("table.rate")}</th>
          <th class="numeric">${nightsOrMonthsHeader}</th>
          <th class="numeric">${t("table.subtotal")}</th>
        </tr>
      </thead>
      <tbody>${unitRows}</tbody>
    </table>
  </div>

  <!-- ═══ FINANCIAL SUMMARY ═══ -->
  <div class="section">
    ${sectionHeader("sections.financialSummary")}
    <div style="max-width:360px;margin-${isRtl ? "right" : "left"}:auto">
      ${units.map((u) => `
        <div class="fin-row">
          <span style="color:#6b7280">${u.name}: <span class="ltr-num">${u.nights} × ${Number(u.rateAmount).toFixed(3)}</span></span>
          <span class="ltr-num">${Number(u.subtotal).toFixed(3)}</span>
        </div>`).join("")}
      ${chargeRows ? `
        <div style="font-size:10px;color:#d97706;text-transform:uppercase;letter-spacing:0.06em;margin-top:8px;margin-bottom:4px">${t("extraCharges")}</div>
        ${chargeRows}` : ""}
      ${Number(r.discountAmount) > 0 ? `
        <div class="fin-row">
          <span>${t("discount")}</span>
          <span style="color:#16a34a" class="ltr-num">-${Number(r.discountAmount).toFixed(3)}</span>
        </div>` : ""}
      <div class="fin-row grand">
        <span>${t("grandTotal")}</span>
        <span class="ltr-num">${t("grandTotalAmount", { amount: grandTotal.toFixed(3) })}</span>
      </div>
      ${r.payments.length > 0 ? `
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-top:16px;margin-bottom:6px">${t("paymentsReceived")}</div>
        ${paymentRows}
        <div class="fin-row" style="border-top:1px dashed #e5e7eb;padding-top:6px;margin-top:4px;font-weight:600">
          <span>${t("totalPaid")}</span>
          <span class="ltr-num">${t("totalPaidAmount", { amount: amountPaid.toFixed(3) })}</span>
        </div>` : ""}
      <div class="balance-box">
        ${isPaid
          ? `<div class="balance-label">${t("fullyPaid")}</div><div class="balance-amount">${t("grandTotalAmount", { amount: "0.000" })}</div>`
          : `<div class="balance-label">${t("balanceDue")}</div><div class="balance-amount">${t("grandTotalAmount", { amount: balanceDue.toFixed(3) })}</div>`}
      </div>
    </div>
  </div>

  ${r.notes ? `
  <!-- ═══ NOTES ═══ -->
  <div class="section">
    ${sectionHeader("sections.notes")}
    <p style="font-size:12px;color:#374151;line-height:1.6">${r.notes}</p>
  </div>` : ""}

  <!-- ═══ SIGNATURES ═══ -->
  <div class="sig-grid">
    <div><div class="sig-line">${t("signatures.authorizedBy")} ________________________</div></div>
    <div><div class="sig-line">${t("signatures.guestSignature")} ________________________</div></div>
  </div>

  <!-- ═══ FOOTER ═══ -->
  <div class="footer">
    <div class="footer-primary">${t("footer.thankYou", { name: org?.name ?? t("defaultPropertyDescription") })}</div>
    <div class="footer-secondary">${tOther("footer.thankYou", { name: org?.name ?? tOther("defaultPropertyDescription") })}</div>
  </div>

</div>
<script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
