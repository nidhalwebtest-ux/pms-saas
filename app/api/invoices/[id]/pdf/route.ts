import { NextRequest } from "next/server";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { getTranslations, getLocale } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { verifyShareFromRequest } from "@/lib/share-token";
import { htmlToPdf } from "@/lib/pdf/render";
import { getPdfBranding, footerLine } from "@/lib/pdf/branding";
import { escHtml } from "@/lib/pdf/html";
import {
  renderPdfDocument,
  renderPdfHeader,
  renderStatusBar,
  renderTwoCol,
  renderSectionLabel,
  renderField,
  renderTable,
  renderTotalsBox,
  renderInkStamp,
  renderPdfFooter,
  type StatusTone,
  type PdfTableRow,
} from "@/lib/pdf/shell";

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

  const statusBarKey =
    isPaid ? "paid" :
    isOverdue ? "overdue" :
    invoice.status === "PARTIALLY_PAID" ? "partial" :
    invoice.status === "ISSUED" ? "issued" :
    invoice.status === "DRAFT" ? "draft" :
    invoice.status === "CANCELLED" ? "cancelled" : "issued";

  const statusTone: Record<string, StatusTone> = {
    paid: "success", overdue: "danger", issued: "info", draft: "neutral", partial: "warning", cancelled: "neutral",
  };

  const dir = isAr ? "rtl" : "ltr";

  // ── Line item rows ──────────────────────────────────────────────────────────
  const itemRows: PdfTableRow[] = invoice.lineItems.flatMap((item) => {
    const breakdown = item.priceBreakdown as PriceSegment[] | null;
    const nameCell = `<strong>${item.unit ? `${escHtml(item.unit.name)} — ` : ""}${escHtml(item.description)}</strong>${item.seasonalPriceName ? `<span style="color:#6366f1;font-size:11px;display:block">${escHtml(item.seasonalPriceName)}</span>` : ""}`;
    const main: PdfTableRow = {
      cells: [
        nameCell,
        `<span class="ltr-numbers">${breakdown ? "—" : Number(item.quantity).toFixed(0)}</span>`,
        `<span class="ltr-numbers">${breakdown ? "—" : `${Number(item.unitPrice).toFixed(3)} OMR`}</span>`,
        `<span class="ltr-numbers" style="font-weight:700">${Number(item.lineTotal).toFixed(3)} OMR</span>`,
      ],
    };
    const segs: PdfTableRow[] = breakdown
      ? breakdown.map((seg) => ({
          variant: "sub" as const,
          cells: [
            escHtml(seg.label),
            `<span class="ltr-numbers">${seg.days ?? seg.nights ?? "—"}</span>`,
            `<span class="ltr-numbers">${seg.rate !== undefined ? `${Number(seg.rate).toFixed(3)} OMR` : "—"}</span>`,
            `<span class="ltr-numbers">${Number(seg.subtotal).toFixed(3)} OMR</span>`,
          ],
        }))
      : [];
    return [main, ...segs];
  });

  const paymentRows: PdfTableRow[] = invoice.allocations.map((alloc) => ({
    cells: [
      `<span class="ltr-numbers">${fmtDate(alloc.payment.date)}</span>`,
      `${escHtml(methodLabel(alloc.payment.method))}${alloc.payment.isRefund ? escHtml(tPrint("refundSuffix")) : ""}`,
      `<span class="ltr-numbers">${escHtml(alloc.payment.reference || "—")}</span>`,
      `<span class="ltr-numbers" style="font-weight:600;color:${alloc.payment.isRefund ? "#dc2626" : "#16a34a"}">${alloc.payment.isRefund ? "−" : ""}${Number(alloc.amount).toFixed(3)} OMR</span>`,
    ],
  }));

  // ── Body sections ───────────────────────────────────────────────────────────
  const billToBox = `
    ${renderSectionLabel(tPrint("billTo"))}
    <div class="tenant-name">${escHtml(tenant.firstName)} ${escHtml(tenant.lastName)}</div>
    ${tenant.fullNameArabic ? `<div style="font-size:13px;color:#6b7280;margin-bottom:4px">${escHtml(tenant.fullNameArabic)}</div>` : ""}
    ${renderField({ label: "", value: tenant.phone, ltrNumbers: true })}
    ${tenant.email ? renderField({ label: "", value: tenant.email }) : ""}
    ${tenant.idType && tenant.idNumber ? renderField({ label: tenant.idType.replace("_", " "), value: tenant.idNumber, ltrNumbers: true }) : ""}
    ${tenant.nationality ? renderField({ label: tPrint("nationality"), value: tenant.nationality }) : ""}
  `;

  const reservationBox = `
    ${renderSectionLabel(tPrint("reservation"))}
    ${reservation.reservationNumber ? renderField({ label: tPrint("refNo"), value: reservation.reservationNumber, ltrNumbers: true }) : ""}
    ${renderField({ label: tPrint("checkIn"), value: fmtDate(reservation.startDate), ltrNumbers: true })}
    ${renderField({ label: tPrint("checkOut"), value: fmtDate(reservation.endDate), ltrNumbers: true })}
    ${renderField({ label: tPrint("duration"), value: tPrint("nights", { count: nights }) })}
    ${reservation.reservationUnits.length > 0 ? renderField({ label: tPrint("units"), value: reservation.reservationUnits.map((ru) => ru.unit.name).join(", ") }) : ""}
    ${invoice.invoiceType === "MONTHLY" && invoice.monthNumber ? renderField({ label: tPrint("month"), value: String(invoice.monthNumber), ltrNumbers: true }) : ""}
  `;

  const itemsTable = renderTable({
    columns: [
      { header: tPrint("description"), width: "50%", align: "start" },
      { header: tPrint("qty"), width: "10%" },
      { header: tPrint("rate"), width: "20%" },
      { header: tPrint("amount"), width: "20%" },
    ],
    rows: itemRows,
  });

  const totalsBox = renderTotalsBox({
    rows: [
      { label: tPrint("subtotal"), value: `${subtotal.toFixed(3)} OMR`, ltrNumbers: true },
      ...(discount > 0 ? [{ label: tPrint("discount"), value: `−${discount.toFixed(3)} OMR`, tone: "positive" as const, ltrNumbers: true }] : []),
      ...(tax > 0 ? [{ label: tPrint("tax"), value: `${tax.toFixed(3)} OMR`, ltrNumbers: true }] : []),
      { label: tPrint("total"), value: `${totalAmount.toFixed(3)} OMR`, tone: "grand", ltrNumbers: true },
      ...(amountPaid > 0 ? [{ label: tPrint("totalPaid"), value: `−${amountPaid.toFixed(3)} OMR`, tone: "positive" as const, ltrNumbers: true }] : []),
      { label: tPrint("balanceDue"), value: `${balanceDue.toFixed(3)} OMR`, tone: balanceDue <= 0 ? "positive" : "negative", ltrNumbers: true },
    ],
  });

  const stampRow = isPaid
    ? `<div style="text-align:${isAr ? "left" : "right"};margin-top:8px">${renderInkStamp({ text: tPrint("paidStamp"), tone: "success" })}</div>`
    : isOverdue
      ? `<div style="text-align:${isAr ? "left" : "right"};margin-top:8px">${renderInkStamp({ text: tPrint("overdueStamp"), tone: "danger" })}</div>`
      : "";

  const paymentsSection = brand.showPaymentHistory && invoice.allocations.length > 0
    ? `
    <div class="payments-section">
      ${renderSectionLabel(tPrint("paymentHistory"))}
      ${renderTable({
        columns: [
          { header: tPrint("paymentDate"), align: "start" },
          { header: tPrint("paymentMethod"), align: "start" },
          { header: tPrint("paymentReference") },
          { header: tPrint("paymentAmount") },
        ],
        rows: paymentRows,
      })}
    </div>`
    : "";

  const notesSection = brand.showNotes && invoice.notes
    ? `<div class="notes-section"><strong>${escHtml(tPrint("notesLabel"))}:</strong> ${escHtml(invoice.notes)}</div>`
    : "";

  const header = renderPdfHeader({
    brand,
    orgName: org.name,
    orgAddressLines: [
      org.address ?? "",
      org.city ? `${org.city}${org.area ? `, ${org.area}` : ""}` : "",
      org.phone ?? "",
    ].filter(Boolean),
    docTitle: tPrint("invoiceHeading"),
    metaRows: [
      { label: tPrint("invoiceMeta.invoiceNo"), value: invoice.invoiceNumber, ltrNumbers: true },
      { label: tPrint("invoiceMeta.issueDate"), value: fmtDate(invoice.issueDate), ltrNumbers: true },
      { label: tPrint("invoiceMeta.dueDate"), value: fmtDate(invoice.dueDate), ltrNumbers: true },
      { label: tPrint("invoiceMeta.status"), value: statusLabel },
      ...(invoice.property ? [{ label: tPrint("invoiceMeta.property"), value: invoice.property.name }] : []),
    ],
  });

  const footer = renderPdfFooter({
    primaryLine: footerLine(brand, isAr, tPrint("thankYou")),
    metaLine: `<span>${escHtml(org.name)}</span>${org.city ? ` · <span>${escHtml(org.city)}</span>` : ""}${org.phone ? ` · <span class="ltr-numbers">${escHtml(org.phone)}</span>` : ""}`,
  });

  const body = `
  ${header}
  ${renderStatusBar({ label: tPrint(`statusBar.${statusBarKey}`), tone: statusTone[statusBarKey] })}
  <div class="body">
    ${renderTwoCol(billToBox, reservationBox)}
    <div class="items-section">
      ${renderSectionLabel(tPrint("charges"))}
      ${itemsTable}
    </div>
    ${totalsBox}
    ${stampRow}
    ${paymentsSection}
    ${notesSection}
  </div>
  ${footer}`;

  const html = renderPdfDocument({
    lang: locale,
    dir,
    brand,
    pageMargin: "0",
    title: tPrint("title", { number: invoice.invoiceNumber }),
    body,
  });

  const pdf = await htmlToPdf(html, { preferCSSPageSize: true });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
