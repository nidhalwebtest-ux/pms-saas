import { NextRequest } from "next/server";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { getTranslations, getLocale } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { returnStatusKey } from "@/components/ui";
import { htmlToPdf } from "@/lib/pdf/render";
import { pdfFontFaceCss, PDF_FONT_STACK } from "@/lib/pdf/fonts";
import { getPdfBranding, brandRootCss, logoHtml, footerLine } from "@/lib/pdf/branding";

// Headless Chromium needs the Node runtime (not edge); allow time for cold-start launch.
export const runtime = "nodejs";
export const maxDuration = 60;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgUser: Awaited<ReturnType<typeof requireOrgUser>>;
  try {
    orgUser = await requireOrgUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const ret = await prisma.return.findUnique({
    where: { id },
    include: {
      tenant: true,
      reservation: { include: { reservationUnits: { include: { unit: true } } } },
      invoice: { select: { id: true, invoiceNumber: true } },
      lineItems: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { firstName: true, lastName: true } },
      refundProcessedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!ret || ret.organizationId !== orgUser.organizationId) {
    return new Response("Return not found", { status: 404 });
  }

  // Return has no `organization` relation — fetch org branding separately.
  const org = await prisma.organization.findUnique({
    where: { id: ret.organizationId },
    select: { name: true, address: true, city: true, area: true, phone: true },
  });
  const brand = await getPdfBranding(ret.organizationId);

  // ── i18n ──────────────────────────────────────────────────────────────────
  const locale  = await getLocale();
  const isAr    = locale === "ar";
  const dfLoc   = isAr ? arLocale : enLocale;
  const tP      = await getTranslations("returns.print");
  const tDet    = await getTranslations("returns.detail");
  const tStatus = await getTranslations("returns.statuses");
  const tType   = await getTranslations("returns.types");

  const fmtDate = (d: Date | string) => format(new Date(d), "d MMM yyyy", { locale: dfLoc });

  const tenant = ret.tenant;
  const reservation = ret.reservation;

  const returnAmount = Number(ret.returnAmount);
  const refundAmount = Number(ret.refundAmount);
  const badgeKey = returnStatusKey(ret.status, ret.refundStatus); // active | refundPending | refunded | cancelled
  const statusLabel = tStatus(badgeKey);
  const typeLabel = tType(ret.returnType === "MONTHLY" ? "monthly" : "daily");
  const qtyLabel = ret.returnType === "MONTHLY"
    ? tDet("months", { n: ret.returnDays })
    : tDet("nights", { n: ret.returnDays });

  const dir = isAr ? "rtl" : "ltr";
  const endAlign = isAr ? "left" : "right";

  const itemRows = ret.lineItems.map((li) => `
    <tr>
      <td><strong>${esc(li.description)}</strong></td>
      <td class="ltr-numbers">${Number(li.quantity).toFixed(0)}</td>
      <td class="ltr-numbers">${Number(li.unitPrice).toFixed(3)} OMR</td>
      <td class="ltr-numbers" style="font-weight:700">${Number(li.lineTotal).toFixed(3)} OMR</td>
    </tr>`).join("") || `<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:18px">${esc(tDet("noLineItems"))}</td></tr>`;

  const refundProcessedBy = ret.refundProcessedBy
    ? `${ret.refundProcessedBy.firstName ?? ""} ${ret.refundProcessedBy.lastName ?? ""}`.trim()
    : "";

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<title>${esc(tP("title", { number: ret.returnNumber }))}</title>
<style>
  ${pdfFontFaceCss()}
  ${brandRootCss(brand)}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${PDF_FONT_STACK}; font-size: 13px; color: #1f2937; background: #fff; direction: ${dir}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ltr-numbers { direction: ltr; unicode-bidi: embed; display: inline-block; }
  .page { max-width: 100%; background: #fff; }

  .header { background: linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%); color: #fff; padding: 32px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand-logo { background:#fff; padding:6px 10px; border-radius:8px; margin-bottom:12px; display:inline-block; }
  .header h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
  .org-name { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .org-detail { font-size: 12px; opacity: 0.85; line-height: 1.6; }
  .meta { text-align: ${endAlign}; }
  .meta table { border-collapse: collapse; }
  .meta td { padding: 2px 0; font-size: 12px; }
  .meta td:first-child { opacity: 0.8; padding-${isAr ? "left" : "right"}: 16px; text-align: ${isAr ? "right" : "left"}; }
  .meta td:last-child { font-weight: 600; text-align: ${endAlign}; }

  .status-bar { display: flex; align-items: center; gap: 12px; padding: 10px 40px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .status-bar.refunded { background: #f0fdf4; color: #16a34a; border-bottom: 2px solid #bbf7d0; }
  .status-bar.refundPending { background: #fffbeb; color: #d97706; border-bottom: 2px solid #fde68a; }
  .status-bar.active { background: #f9fafb; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  .status-bar.cancelled { background: #fef2f2; color: #9ca3af; border-bottom: 2px solid #fecaca; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; display: inline-block; }

  .body { padding: 32px 40px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #f3f4f6; }
  .info-row { display: flex; gap: 8px; margin-bottom: 4px; font-size: 12.5px; }
  .info-row .lbl { color: #6b7280; min-width: 90px; }
  .info-row .val { font-weight: 500; color: #111827; }
  .tenant-name { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 4px; }

  table.items { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 24px; }
  table.items thead tr { background: #f3f4f6; }
  table.items thead th { padding: 8px 12px; text-align: ${isAr ? "right" : "left"}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
  table.items thead th:not(:first-child) { text-align: ${endAlign}; }
  table.items tbody td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
  table.items tbody td:not(:first-child) { text-align: ${endAlign}; }

  .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .totals-box { min-width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6; }
  .totals-row.grand { font-size: 15px; font-weight: 800; color: var(--brand-dark); padding: 8px 0 6px; border-top: 2px solid #e5e7eb; border-bottom: none; margin-top: 2px; }
  .totals-row.refund { font-weight: 700; padding-top: 6px; border-bottom: none; }
  .totals-row.refund.due { color: #d97706; }
  .totals-row.refund.done { color: #16a34a; }
  .totals-row.refund.none { color: #6b7280; }

  .detail-box { background: #fafafa; border: 1px solid #f3f4f6; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; font-size: 12.5px; }
  .detail-box .row { display: flex; gap: 8px; margin-bottom: 4px; }
  .detail-box .row:last-child { margin-bottom: 0; }
  .detail-box .lbl { color: #6b7280; min-width: 90px; }

  .footer { text-align: center; padding: 20px 40px 28px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 12px; }
  .footer .thank-you { font-size: 13px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }

  @page { size: ${brand.paperSize}; margin: 0; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      ${logoHtml(brand) ? `<div class="brand-logo">${logoHtml(brand)}</div>` : ""}
      <div class="org-name">${esc(org?.name)}</div>
      ${org?.address ? `<div class="org-detail">${esc(org?.address)}</div>` : ""}
      ${org?.city ? `<div class="org-detail">${esc(org?.city)}${org?.area ? `, ${esc(org?.area)}` : ""}</div>` : ""}
      ${org?.phone ? `<div class="org-detail ltr-numbers">${esc(org?.phone)}</div>` : ""}
      <div style="margin-top:16px"><h1>${esc(tP("heading"))}</h1></div>
    </div>
    <div class="meta">
      <table><tbody>
        <tr><td>${esc(tP("creditNoteNo"))}:</td><td class="ltr-numbers">${esc(ret.returnNumber)}</td></tr>
        <tr><td>${esc(tP("issueDate"))}:</td><td class="ltr-numbers">${fmtDate(ret.createdAt)}</td></tr>
        <tr><td>${esc(tP("status"))}:</td><td>${esc(statusLabel)}</td></tr>
        ${ret.invoice ? `<tr><td>${esc(tP("appliedInvoice"))}:</td><td class="ltr-numbers">${esc(ret.invoice.invoiceNumber)}</td></tr>` : ""}
      </tbody></table>
    </div>
  </div>

  <div class="status-bar ${badgeKey}"><span class="status-dot"></span>${esc(statusLabel)}</div>

  <div class="body">
    <div class="two-col">
      <div>
        <div class="section-label">${esc(tP("billTo"))}</div>
        <div class="tenant-name">${esc(tenant.firstName)} ${esc(tenant.lastName)}</div>
        ${tenant.fullNameArabic ? `<div style="font-size:13px;color:#6b7280;margin-bottom:4px">${esc(tenant.fullNameArabic)}</div>` : ""}
        <div class="info-row"><span class="val ltr-numbers">${esc(tenant.phone)}</span></div>
        ${tenant.email ? `<div class="info-row"><span class="val">${esc(tenant.email)}</span></div>` : ""}
      </div>
      <div>
        <div class="section-label">${esc(tDet("reservation"))}</div>
        ${reservation?.reservationNumber ? `<div class="info-row"><span class="val ltr-numbers" style="font-family:monospace">${esc(reservation.reservationNumber)}</span></div>` : ""}
        ${reservation ? `<div class="info-row"><span class="lbl">${esc(tDet("period"))}:</span><span class="val ltr-numbers">${fmtDate(reservation.startDate)} – ${fmtDate(reservation.endDate)}</span></div>` : ""}
        ${reservation && reservation.reservationUnits.length > 0 ? `<div class="info-row"><span class="lbl">${esc(tDet("unitLabel"))}:</span><span class="val">${esc(reservation.reservationUnits.map((ru) => ru.unit.name).join(", "))}</span></div>` : ""}
      </div>
    </div>

    <div class="detail-box">
      <div class="row"><span class="lbl">${esc(tDet("type"))}:</span><span>${esc(typeLabel)}</span></div>
      <div class="row"><span class="lbl">${esc(tDet("period"))}:</span><span class="ltr-numbers">${fmtDate(ret.returnFrom)} – ${fmtDate(ret.returnTo)}</span></div>
      <div class="row"><span class="lbl">${esc(tDet("quantity"))}:</span><span class="ltr-numbers">${esc(qtyLabel)}</span></div>
      <div class="row"><span class="lbl">${esc(tDet("reason"))}</span><span>${esc(ret.reason)}</span></div>
      ${ret.notes ? `<div class="row"><span class="lbl">${esc(tDet("notes"))}</span><span>${esc(ret.notes)}</span></div>` : ""}
    </div>

    <div class="section-label">${esc(tDet("lineItems"))}</div>
    <table class="items">
      <thead><tr>
        <th style="width:55%">${esc(tDet("description"))}</th>
        <th style="width:10%">${esc(tDet("qty"))}</th>
        <th style="width:17%">${esc(tDet("unitPrice"))}</th>
        <th style="width:18%">${esc(tDet("lineTotal"))}</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row grand"><span>${esc(tDet("returnTotal"))}</span><span class="ltr-numbers">${returnAmount.toFixed(3)} OMR</span></div>
        ${ret.refundRequired
          ? `<div class="totals-row refund ${ret.refundStatus === "COMPLETED" ? "done" : "due"}"><span>${esc(ret.refundStatus === "COMPLETED" ? tDet("refunded") : tDet("refundDue"))}</span><span class="ltr-numbers">${refundAmount.toFixed(3)} OMR</span></div>`
          : `<div class="totals-row refund none"><span>${esc(tDet("refund"))}</span><span>${esc(tDet("noRefund"))}</span></div>`}
      </div>
    </div>

    ${ret.refundRequired ? `
    <div class="section-label">${esc(tDet("refundInfo"))}</div>
    <div class="detail-box">
      <div class="row"><span class="lbl">${esc(tDet("refundStatus"))}:</span><span>${esc(statusLabel)}</span></div>
      <div class="row"><span class="lbl">${esc(tDet("refundAmount"))}:</span><span class="ltr-numbers">${refundAmount.toFixed(3)} OMR</span></div>
      ${ret.refundMethod ? `<div class="row"><span class="lbl">${esc(tDet("refundMethod"))}:</span><span style="text-transform:capitalize">${esc(ret.refundMethod.toLowerCase().replace("_", " "))}</span></div>` : ""}
      ${ret.refundReference ? `<div class="row"><span class="lbl">${esc(tDet("refundReference"))}:</span><span class="ltr-numbers">${esc(ret.refundReference)}</span></div>` : ""}
      ${ret.refundDate ? `<div class="row"><span class="lbl">${esc(tDet("refundDate"))}:</span><span class="ltr-numbers">${fmtDate(ret.refundDate)}</span></div>` : ""}
      ${refundProcessedBy ? `<div class="row"><span class="lbl">${esc(tDet("refundProcessedBy"))}:</span><span>${esc(refundProcessedBy)}</span></div>` : ""}
    </div>` : ""}
  </div>

  <div class="footer">
    <div class="thank-you">${esc(footerLine(brand, isAr, tP("thankYou")))}</div>
    <div style="font-size:11px;color:#d1d5db">${esc(tP("computerGenerated"))} · <span>${esc(org?.name)}</span></div>
  </div>
</div>
</body>
</html>`;

  const pdf = await htmlToPdf(html, { preferCSSPageSize: true });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="credit-note-${ret.returnNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
