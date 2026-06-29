import { NextRequest } from "next/server";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { getTranslations, getLocale } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { verifyShareFromRequest } from "@/lib/share-token";
import { htmlToPdf } from "@/lib/pdf/render";
import { pdfFontFaceCss, PDF_FONT_STACK } from "@/lib/pdf/fonts";
import { getPdfBranding, brandRootCss, logoHtml, footerLine } from "@/lib/pdf/branding";

// Headless Chromium needs the Node runtime (not edge); allow time for cold-start launch.
export const runtime = "nodejs";
export const maxDuration = 60;

interface PriceSegment {
  days?: number;
  nights?: number;
  label: string;
  rate?: number;
  subtotal: number;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Access via a signed public share link (?t=) OR an authenticated session.
  const share = verifyShareFromRequest(req, "invoice", id);
  let organizationId: string;
  if (share) {
    organizationId = share.org;
  } else {
    try { organizationId = (await requireOrgUser()).organizationId; }
    catch { return new Response("Unauthorized", { status: 401 }); }
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      tenant: true,
      reservation: { include: { reservationUnits: { include: { unit: true } } } },
      property: true,
      lineItems: { include: { unit: true }, orderBy: { sortOrder: "asc" } },
      allocations: {
        include: {
          payment: { select: { id: true, date: true, method: true, reference: true, amount: true, isRefund: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      organization: true,
    },
  });

  if (!invoice || invoice.organizationId !== organizationId) {
    return new Response("Invoice not found", { status: 404 });
  }

  const brand = await getPdfBranding(invoice.organizationId);

  // ── i18n ──────────────────────────────────────────────────────────────────
  const locale  = await getLocale();
  const isAr    = locale === "ar";
  const dfLoc   = isAr ? arLocale : enLocale;
  const tPrint  = await getTranslations("invoices.print");
  const tStatus = await getTranslations("invoices.statuses");
  const tMethod = await getTranslations("invoices.paymentMethods");

  const fmtDate = (d: Date | string) => format(new Date(d), "d MMM yyyy", { locale: dfLoc });
  const tryT = (fn: (k: string) => string, key: string, fallback?: string): string => {
    try { return fn(key); } catch { return fallback ?? key; }
  };
  const methodLabel = (m: string) => tryT(tMethod, m, m.toLowerCase().replace("_", " "));

  const org = invoice.organization;
  const tenant = invoice.tenant;
  const reservation = invoice.reservation;

  const totalAmount = Number(invoice.totalAmount);
  const amountPaid  = Number(invoice.amountPaid);
  const balanceDue  = Number(invoice.balanceDue);
  const subtotal    = Number(invoice.subtotal);
  const discount    = Number(invoice.discountAmount);
  const tax         = Number(invoice.taxAmount);

  const isPaid = invoice.status === "PAID" || balanceDue <= 0;
  const isOverdue =
    (invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") &&
    new Date(invoice.dueDate) < new Date();

  const nights = Math.round(
    (new Date(reservation.endDate).getTime() - new Date(reservation.startDate).getTime()) / 86_400_000,
  );

  const statusKey: Record<string, string> = {
    DRAFT: "draft", ISSUED: "issued", PARTIALLY_PAID: "partiallyPaid", PAID: "paid", CANCELLED: "cancelled",
  };
  const statusLabel = tryT(tStatus, statusKey[invoice.status] ?? invoice.status, invoice.status);

  const statusBar =
    isPaid ? "paid" :
    isOverdue ? "overdue" :
    invoice.status === "PARTIALLY_PAID" ? "partial" :
    invoice.status === "ISSUED" ? "issued" :
    invoice.status === "DRAFT" ? "draft" :
    invoice.status === "CANCELLED" ? "cancelled" : "issued";

  const dir = isAr ? "rtl" : "ltr";
  const endAlign = isAr ? "left" : "right";

  // ── Line item rows ──────────────────────────────────────────────────────────
  const itemRows = invoice.lineItems.map((item) => {
    const breakdown = item.priceBreakdown as PriceSegment[] | null;
    const main = `
      <tr>
        <td><strong>${item.unit ? `${esc(item.unit.name)} — ` : ""}${esc(item.description)}</strong>
          ${item.seasonalPriceName ? `<span style="color:#6366f1;font-size:11px;display:block">${esc(item.seasonalPriceName)}</span>` : ""}
        </td>
        <td class="ltr-numbers">${breakdown ? "—" : Number(item.quantity).toFixed(0)}</td>
        <td class="ltr-numbers">${breakdown ? "—" : `${Number(item.unitPrice).toFixed(3)} OMR`}</td>
        <td class="ltr-numbers" style="font-weight:700">${Number(item.lineTotal).toFixed(3)} OMR</td>
      </tr>`;
    const segs = breakdown ? breakdown.map((seg) => `
      <tr class="segment">
        <td>${esc(seg.label)}</td>
        <td class="ltr-numbers">${seg.days ?? seg.nights ?? "—"}</td>
        <td class="ltr-numbers">${seg.rate !== undefined ? `${Number(seg.rate).toFixed(3)} OMR` : "—"}</td>
        <td class="ltr-numbers">${Number(seg.subtotal).toFixed(3)} OMR</td>
      </tr>`).join("") : "";
    return main + segs;
  }).join("");

  const paymentRows = invoice.allocations.map((alloc) => `
    <tr class="${alloc.payment.isRefund ? "refund" : ""}">
      <td class="ltr-numbers">${fmtDate(alloc.payment.date)}</td>
      <td>${esc(methodLabel(alloc.payment.method))}${alloc.payment.isRefund ? esc(tPrint("refundSuffix")) : ""}</td>
      <td class="ltr-numbers">${esc(alloc.payment.reference || "—")}</td>
      <td class="ltr-numbers">${alloc.payment.isRefund ? "−" : ""}${Number(alloc.amount).toFixed(3)} OMR</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<title>${esc(tPrint("title", { number: invoice.invoiceNumber }))}</title>
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
  .org-detail { font-size: 12px; opacity: 0.82; line-height: 1.6; }
  .inv-meta { text-align: ${endAlign}; }
  .inv-meta table { border-collapse: collapse; }
  .inv-meta td { padding: 2px 0; font-size: 12px; }
  .inv-meta td:first-child { opacity: 0.75; padding-${isAr ? "left" : "right"}: 16px; text-align: ${isAr ? "right" : "left"}; }
  .inv-meta td:last-child { font-weight: 600; text-align: ${endAlign}; }

  .status-bar { display: flex; align-items: center; gap: 12px; padding: 10px 40px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .status-bar.paid { background: #f0fdf4; color: #16a34a; border-bottom: 2px solid #bbf7d0; }
  .status-bar.overdue { background: #fef2f2; color: #dc2626; border-bottom: 2px solid #fecaca; }
  .status-bar.issued { background: #eff6ff; color: #2563eb; border-bottom: 2px solid #bfdbfe; }
  .status-bar.draft { background: #f9fafb; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  .status-bar.partial { background: #fffbeb; color: #d97706; border-bottom: 2px solid #fde68a; }
  .status-bar.cancelled { background: #fef2f2; color: #9ca3af; border-bottom: 2px solid #fecaca; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; display: inline-block; }

  .body { padding: 32px 40px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
  .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #f3f4f6; }
  .info-row { display: flex; gap: 8px; margin-bottom: 4px; font-size: 12.5px; }
  .info-row .lbl { color: #6b7280; min-width: 80px; }
  .info-row .val { font-weight: 500; color: #111827; }
  .tenant-name { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 4px; }

  table.items, table.payments { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.items thead tr, table.payments thead th { background: #f3f4f6; }
  table.items thead th { padding: 8px 12px; text-align: ${isAr ? "right" : "left"}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
  table.items thead th:not(:first-child) { text-align: ${endAlign}; }
  table.items tbody td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
  table.items tbody td:not(:first-child) { text-align: ${endAlign}; }
  table.items tbody tr.segment td { padding: 5px 12px 5px 28px; font-size: 11.5px; color: #6b7280; background: #fafafa; }
  table.items tbody tr.segment td:first-child::before { content: "└ "; color: #d1d5db; }
  .items-section, .payments-section { margin-bottom: 28px; }

  .totals { display: flex; justify-content: flex-end; margin-bottom: 28px; }
  .totals-box { min-width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6; }
  .totals-row.grand { font-size: 15px; font-weight: 800; color: #111827; padding: 8px 0 6px; border-top: 2px solid #e5e7eb; border-bottom: none; margin-top: 2px; }
  .totals-row.balance { font-size: 14px; font-weight: 700; color: #dc2626; padding-top: 6px; border-bottom: none; }
  .totals-row.balance.zero { color: #16a34a; }
  .totals-row .discount { color: #16a34a; }

  table.payments thead th { padding: 7px 12px; text-align: ${isAr ? "right" : "left"}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
  table.payments thead th:last-child { text-align: ${endAlign}; }
  table.payments tbody td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
  table.payments tbody td:last-child { text-align: ${endAlign}; font-weight: 600; color: #16a34a; }
  table.payments tbody tr.refund td:last-child { color: #dc2626; }

  .paid-stamp, .overdue-stamp { display: inline-block; border: 3px solid #16a34a; border-radius: 8px; color: #16a34a; font-size: 22px; font-weight: 900; letter-spacing: 4px; padding: 4px 18px; transform: rotate(-3deg); opacity: 0.85; margin-top: 4px; }
  .overdue-stamp { border-color: #dc2626; color: #dc2626; }

  .notes-section { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #92400e; margin-bottom: 24px; }
  .notes-section strong { color: #78350f; }

  .footer { text-align: center; padding: 20px 40px 28px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 12px; }
  .footer .thank-you { font-size: 14px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }

  @page { size: ${brand.paperSize}; margin: 0; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      ${logoHtml(brand) ? `<div class="brand-logo">${logoHtml(brand)}</div>` : ""}
      <div class="org-name">${esc(org.name)}</div>
      ${org.address ? `<div class="org-detail">${esc(org.address)}</div>` : ""}
      ${org.city ? `<div class="org-detail">${esc(org.city)}${org.area ? `, ${esc(org.area)}` : ""}</div>` : ""}
      ${org.phone ? `<div class="org-detail ltr-numbers">${esc(org.phone)}</div>` : ""}
      <div style="margin-top:16px"><h1>${esc(tPrint("invoiceHeading"))}</h1></div>
    </div>
    <div class="inv-meta">
      <table><tbody>
        <tr><td>${esc(tPrint("invoiceMeta.invoiceNo"))}:</td><td class="ltr-numbers">${esc(invoice.invoiceNumber)}</td></tr>
        <tr><td>${esc(tPrint("invoiceMeta.issueDate"))}:</td><td class="ltr-numbers">${fmtDate(invoice.issueDate)}</td></tr>
        <tr><td>${esc(tPrint("invoiceMeta.dueDate"))}:</td><td class="ltr-numbers">${fmtDate(invoice.dueDate)}</td></tr>
        <tr><td>${esc(tPrint("invoiceMeta.status"))}:</td><td>${esc(statusLabel)}</td></tr>
        ${invoice.property ? `<tr><td>${esc(tPrint("invoiceMeta.property"))}:</td><td>${esc(invoice.property.name)}</td></tr>` : ""}
      </tbody></table>
    </div>
  </div>

  <div class="status-bar ${statusBar}"><span class="status-dot"></span>${esc(tPrint(`statusBar.${statusBar}`))}</div>

  <div class="body">
    <div class="two-col">
      <div>
        <div class="section-label">${esc(tPrint("billTo"))}</div>
        <div class="tenant-name">${esc(tenant.firstName)} ${esc(tenant.lastName)}</div>
        ${tenant.fullNameArabic ? `<div style="font-size:13px;color:#6b7280;margin-bottom:4px">${esc(tenant.fullNameArabic)}</div>` : ""}
        <div class="info-row"><span class="val ltr-numbers">${esc(tenant.phone)}</span></div>
        ${tenant.email ? `<div class="info-row"><span class="val">${esc(tenant.email)}</span></div>` : ""}
        ${tenant.idType && tenant.idNumber ? `<div class="info-row" style="margin-top:6px"><span class="lbl" style="text-transform:capitalize">${esc(tenant.idType.replace("_", " "))}:</span><span class="val ltr-numbers">${esc(tenant.idNumber)}</span></div>` : ""}
        ${tenant.nationality ? `<div class="info-row"><span class="lbl">${esc(tPrint("nationality"))}:</span><span class="val">${esc(tenant.nationality)}</span></div>` : ""}
      </div>
      <div>
        <div class="section-label">${esc(tPrint("reservation"))}</div>
        ${reservation.reservationNumber ? `<div class="info-row"><span class="lbl">${esc(tPrint("refNo"))}:</span><span class="val ltr-numbers" style="font-family:monospace">${esc(reservation.reservationNumber)}</span></div>` : ""}
        <div class="info-row"><span class="lbl">${esc(tPrint("checkIn"))}:</span><span class="val ltr-numbers">${fmtDate(reservation.startDate)}</span></div>
        <div class="info-row"><span class="lbl">${esc(tPrint("checkOut"))}:</span><span class="val ltr-numbers">${fmtDate(reservation.endDate)}</span></div>
        <div class="info-row"><span class="lbl">${esc(tPrint("duration"))}:</span><span class="val">${esc(tPrint("nights", { count: nights }))}</span></div>
        ${reservation.reservationUnits.length > 0 ? `<div class="info-row" style="margin-top:6px"><span class="lbl">${esc(tPrint("units"))}:</span><span class="val">${esc(reservation.reservationUnits.map((ru) => ru.unit.name).join(", "))}</span></div>` : ""}
        ${invoice.invoiceType === "MONTHLY" && invoice.monthNumber ? `<div class="info-row"><span class="lbl">${esc(tPrint("month"))}:</span><span class="val ltr-numbers">${invoice.monthNumber}</span></div>` : ""}
      </div>
    </div>

    <div class="items-section">
      <div class="section-label">${esc(tPrint("charges"))}</div>
      <table class="items">
        <thead><tr>
          <th style="width:50%">${esc(tPrint("description"))}</th>
          <th style="width:10%">${esc(tPrint("qty"))}</th>
          <th style="width:20%">${esc(tPrint("rate"))}</th>
          <th style="width:20%">${esc(tPrint("amount"))}</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row"><span>${esc(tPrint("subtotal"))}</span><span class="ltr-numbers">${subtotal.toFixed(3)} OMR</span></div>
        ${discount > 0 ? `<div class="totals-row"><span>${esc(tPrint("discount"))}</span><span class="discount ltr-numbers">−${discount.toFixed(3)} OMR</span></div>` : ""}
        ${tax > 0 ? `<div class="totals-row"><span>${esc(tPrint("tax"))}</span><span class="ltr-numbers">${tax.toFixed(3)} OMR</span></div>` : ""}
        <div class="totals-row grand"><span>${esc(tPrint("total"))}</span><span class="ltr-numbers">${totalAmount.toFixed(3)} OMR</span></div>
        ${amountPaid > 0 ? `<div class="totals-row" style="color:#16a34a"><span>${esc(tPrint("totalPaid"))}</span><span class="ltr-numbers">−${amountPaid.toFixed(3)} OMR</span></div>` : ""}
        <div class="totals-row balance ${balanceDue <= 0 ? "zero" : ""}"><span>${esc(tPrint("balanceDue"))}</span><span class="ltr-numbers">${balanceDue.toFixed(3)} OMR</span></div>
        ${isPaid ? `<div style="text-align:${endAlign};margin-top:8px"><span class="paid-stamp">${esc(tPrint("paidStamp"))}</span></div>` : ""}
        ${isOverdue ? `<div style="text-align:${endAlign};margin-top:8px"><span class="overdue-stamp">${esc(tPrint("overdueStamp"))}</span></div>` : ""}
      </div>
    </div>

    ${brand.showPaymentHistory && invoice.allocations.length > 0 ? `
    <div class="payments-section">
      <div class="section-label">${esc(tPrint("paymentHistory"))}</div>
      <table class="payments">
        <thead><tr>
          <th>${esc(tPrint("paymentDate"))}</th>
          <th>${esc(tPrint("paymentMethod"))}</th>
          <th>${esc(tPrint("paymentReference"))}</th>
          <th>${esc(tPrint("paymentAmount"))}</th>
        </tr></thead>
        <tbody>${paymentRows}</tbody>
      </table>
    </div>` : ""}

    ${brand.showNotes && invoice.notes ? `<div class="notes-section"><strong>${esc(tPrint("notesLabel"))}:</strong> ${esc(invoice.notes)}</div>` : ""}
  </div>

  <div class="footer">
    <div class="thank-you">${esc(footerLine(brand, isAr, tPrint("thankYou")))}</div>
    <div style="font-size:11px;color:#d1d5db">
      <span>${esc(org.name)}</span>${org.city ? ` · <span>${esc(org.city)}</span>` : ""}${org.phone ? ` · <span class="ltr-numbers">${esc(org.phone)}</span>` : ""}
    </div>
  </div>
</div>
</body>
</html>`;

  const pdf = await htmlToPdf(html, { preferCSSPageSize: true });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
