import { NextRequest } from "next/server";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { getTranslations, getLocale } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { verifyShareFromRequest } from "@/lib/share-token";
import { returnStatusKey } from "@/components/ui";
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
  renderLabeledBox,
  renderTable,
  renderTotalsBox,
  renderPdfFooter,
  type StatusTone,
  type PdfTableRow,
} from "@/lib/pdf/shell";

// Headless Chromium needs the Node runtime (not edge); allow time for cold-start launch.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Access via a signed public share link (?t=) OR an authenticated session.
  const share = verifyShareFromRequest(req, "return", id);
  let organizationId: string;
  if (share) {
    organizationId = share.org;
  } else {
    try { organizationId = (await requireOrgUser()).organizationId; }
    catch { return new Response("Unauthorized", { status: 401 }); }
  }

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

  if (!ret || ret.organizationId !== organizationId) {
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

  const statusTone: Record<string, StatusTone> = {
    refunded: "success", refundPending: "warning", active: "neutral", cancelled: "neutral",
  };

  const itemRows: PdfTableRow[] = ret.lineItems.map((li) => ({
    cells: [
      `<strong>${escHtml(li.description)}</strong>`,
      `<span class="ltr-numbers">${Number(li.quantity).toFixed(0)}</span>`,
      `<span class="ltr-numbers">${Number(li.unitPrice).toFixed(3)} OMR</span>`,
      `<span class="ltr-numbers" style="font-weight:700">${Number(li.lineTotal).toFixed(3)} OMR</span>`,
    ],
  }));
  const itemsTable = ret.lineItems.length > 0
    ? renderTable({
        columns: [
          { header: tDet("description"), width: "55%", align: "start" },
          { header: tDet("qty"), width: "10%" },
          { header: tDet("unitPrice"), width: "17%" },
          { header: tDet("lineTotal"), width: "18%" },
        ],
        rows: itemRows,
      })
    : `<table class="pdf-table"><tbody><tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:18px">${escHtml(tDet("noLineItems"))}</td></tr></tbody></table>`;

  const refundProcessedBy = ret.refundProcessedBy
    ? `${ret.refundProcessedBy.firstName ?? ""} ${ret.refundProcessedBy.lastName ?? ""}`.trim()
    : "";

  const billToBox = `
    ${renderSectionLabel(tP("billTo"))}
    <div class="tenant-name">${escHtml(tenant.firstName)} ${escHtml(tenant.lastName)}</div>
    ${tenant.fullNameArabic ? `<div style="font-size:13px;color:#6b7280;margin-bottom:4px">${escHtml(tenant.fullNameArabic)}</div>` : ""}
    ${renderField({ label: "", value: tenant.phone, ltrNumbers: true })}
    ${tenant.email ? renderField({ label: "", value: tenant.email }) : ""}
  `;

  const reservationBox = `
    ${renderSectionLabel(tDet("reservation"))}
    ${reservation?.reservationNumber ? renderField({ label: "", value: reservation.reservationNumber, ltrNumbers: true }) : ""}
    ${reservation ? renderField({ label: tDet("period"), value: `${fmtDate(reservation.startDate)} – ${fmtDate(reservation.endDate)}`, ltrNumbers: true }) : ""}
    ${reservation && reservation.reservationUnits.length > 0 ? renderField({ label: tDet("unitLabel"), value: reservation.reservationUnits.map((ru) => ru.unit.name).join(", ") }) : ""}
  `;

  const detailBox = renderLabeledBox({
    variant: "boxed",
    fields: [
      { label: tDet("type"), value: typeLabel },
      { label: tDet("period"), value: `${fmtDate(ret.returnFrom)} – ${fmtDate(ret.returnTo)}`, ltrNumbers: true },
      { label: tDet("quantity"), value: qtyLabel, ltrNumbers: true },
      { label: tDet("reason"), value: ret.reason },
      ...(ret.notes ? [{ label: tDet("notes"), value: ret.notes }] : []),
    ],
  });

  const totalsBox = renderTotalsBox({
    rows: [
      { label: tDet("returnTotal"), value: `${returnAmount.toFixed(3)} OMR`, tone: "grand", ltrNumbers: true },
      ret.refundRequired
        ? { label: ret.refundStatus === "COMPLETED" ? tDet("refunded") : tDet("refundDue"), value: `${refundAmount.toFixed(3)} OMR`, tone: ret.refundStatus === "COMPLETED" ? "positive" as const : "warning" as const, ltrNumbers: true }
        : { label: tDet("refund"), value: tDet("noRefund"), tone: "muted" as const },
    ],
  });

  const refundInfoSection = ret.refundRequired
    ? `
    ${renderSectionLabel(tDet("refundInfo"))}
    ${renderLabeledBox({
      variant: "boxed",
      fields: [
        { label: tDet("refundStatus"), value: statusLabel },
        { label: tDet("refundAmount"), value: `${refundAmount.toFixed(3)} OMR`, ltrNumbers: true },
        ...(ret.refundMethod ? [{ label: tDet("refundMethod"), value: ret.refundMethod.toLowerCase().replace("_", " ") }] : []),
        ...(ret.refundReference ? [{ label: tDet("refundReference"), value: ret.refundReference, ltrNumbers: true }] : []),
        ...(ret.refundDate ? [{ label: tDet("refundDate"), value: fmtDate(ret.refundDate), ltrNumbers: true }] : []),
        ...(refundProcessedBy ? [{ label: tDet("refundProcessedBy"), value: refundProcessedBy }] : []),
      ],
    })}`
    : "";

  const header = renderPdfHeader({
    brand,
    orgName: org?.name ?? "",
    orgAddressLines: [
      org?.address ?? "",
      org?.city ? `${org.city}${org.area ? `, ${org.area}` : ""}` : "",
      org?.phone ?? "",
    ].filter(Boolean),
    docTitle: tP("heading"),
    metaRows: [
      { label: tP("creditNoteNo"), value: ret.returnNumber, ltrNumbers: true },
      { label: tP("issueDate"), value: fmtDate(ret.createdAt), ltrNumbers: true },
      { label: tP("status"), value: statusLabel },
      ...(ret.invoice ? [{ label: tP("appliedInvoice"), value: ret.invoice.invoiceNumber, ltrNumbers: true }] : []),
    ],
  });

  const footer = renderPdfFooter({
    primaryLine: footerLine(brand, isAr, tP("thankYou")),
    metaLine: `${escHtml(tP("computerGenerated"))} · <span>${escHtml(org?.name ?? "")}</span>`,
  });

  const body = `
  ${header}
  ${renderStatusBar({ label: statusLabel, tone: statusTone[badgeKey] ?? "neutral" })}
  <div class="body">
    ${renderTwoCol(billToBox, reservationBox)}
    <div style="margin-bottom:24px">${detailBox}</div>
    ${renderSectionLabel(tDet("lineItems"))}
    <div style="margin-bottom:24px">${itemsTable}</div>
    ${totalsBox}
    ${refundInfoSection}
  </div>
  ${footer}`;

  const html = renderPdfDocument({
    lang: locale,
    dir,
    brand,
    pageMargin: "0",
    title: tP("title", { number: ret.returnNumber }),
    body,
  });

  const pdf = await htmlToPdf(html, { preferCSSPageSize: true });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="credit-note-${ret.returnNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
