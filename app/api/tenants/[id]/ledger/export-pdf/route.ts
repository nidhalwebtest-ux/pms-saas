import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getEffectivePropertyIds } from "@/lib/property-scope";
import { verifyShareFromRequest } from "@/lib/share-token";
import { getPdfLocaleContext } from "@/lib/pdf-i18n";
import { htmlToPdf } from "@/lib/pdf/render";
import { getPdfBranding } from "@/lib/pdf/branding";
import { escHtml } from "@/lib/pdf/html";
import {
  renderPdfDocument,
  renderPdfHeader,
  renderSectionLabel,
  renderGrid,
  renderFieldStacked,
  renderLabeledBox,
  renderTable,
  renderPdfFooter,
  buildPageNumberFooterTemplate,
  type PdfTableRow,
} from "@/lib/pdf/shell";

// Headless Chromium needs the Node runtime (not edge); allow time for cold-start launch.
export const runtime = "nodejs";
export const maxDuration = 60;

function roundOMR(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenantId } = await params;

  // Access via a signed public share link (?t=) OR an authenticated session.
  const share = verifyShareFromRequest(req, "ledger", tenantId);
  let organizationId: string;
  if (share) {
    organizationId = share.org;
  } else {
    try { organizationId = (await requireOrgUser()).organizationId; }
    catch { return new Response("Unauthorized", { status: 401 }); }
  }

  const sp = new URL(req.url).searchParams;
  const dateFrom      = sp.get("dateFrom") ?? "";
  const dateTo        = sp.get("dateTo")   ?? "";

  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: {
      organizationId: true, firstName: true, lastName: true, fullNameArabic: true,
      phone: true, email: true, idType: true, idNumber: true,
    },
  });
  if (!tenant || tenant.organizationId !== organizationId)
    return new Response("Tenant not found", { status: 404 });

  const org = await prisma.organization.findUnique({
    where:  { id: organizationId },
    select: { name: true, phone: true, city: true },
  });
  const brand = await getPdfBranding(organizationId);

  // Scope to the selected building (matches the on-screen ledger). Public share
  // links carry the building captured at share time; sessions use the cookie.
  const propIds = share
    ? (share.prop ? [share.prop] : null)
    : await getEffectivePropertyIds(await getSelectedPropertyId());
  const resScope: Prisma.ReservationWhereInput = propIds
    ? {
        OR: [
          { unit: { propertyId: { in: propIds } } },
          { reservationUnits: { some: { unit: { propertyId: { in: propIds } } } } },
        ],
      }
    : {};
  const invoicePropScope: Prisma.InvoiceWhereInput = propIds ? { propertyId: { in: propIds } } : {};
  const txnResScope = propIds ? { reservation: resScope } : {};

  // Date filters
  const dateGte = dateFrom ? new Date(dateFrom) : undefined;
  const dateLte = dateTo   ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)) : undefined;

  const [invoices, payments, refunds, returns] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        tenantId,
        organizationId: organizationId,
        status: { notIn: ["CANCELLED", "VOID", "DRAFT"] },
        ...invoicePropScope,
        ...(dateGte || dateLte ? { issueDate: { ...(dateGte ? { gte: dateGte } : {}), ...(dateLte ? { lte: dateLte } : {}) } } : {}),
      },
      select: {
        id: true, invoiceNumber: true, periodStart: true, periodEnd: true,
        totalAmount: true, issueDate: true, monthNumber: true, status: true,
        reservation: { select: { reservationNumber: true } },
      },
      orderBy: { issueDate: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        organizationId: organizationId,
        isRefund: false,
        ...txnResScope,
        ...(dateGte || dateLte ? { date: { ...(dateGte ? { gte: dateGte } : {}), ...(dateLte ? { lte: dateLte } : {}) } } : {}),
      },
      select: { id: true, paymentNumber: true, amount: true, date: true, method: true, reference: true },
      orderBy: { date: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        organizationId: organizationId,
        isRefund: true,
        ...txnResScope,
        ...(dateGte || dateLte ? { date: { ...(dateGte ? { gte: dateGte } : {}), ...(dateLte ? { lte: dateLte } : {}) } } : {}),
      },
      select: { id: true, paymentNumber: true, amount: true, date: true, method: true, reference: true },
      orderBy: { date: "asc" },
    }),
    prisma.return.findMany({
      where: {
        tenantId,
        organizationId: organizationId,
        status: "active",
        ...txnResScope,
        ...(dateGte || dateLte ? { createdAt: { ...(dateGte ? { gte: dateGte } : {}), ...(dateLte ? { lte: dateLte } : {}) } } : {}),
      },
      select: { id: true, returnNumber: true, returnAmount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // ── i18n ──────────────────────────────────────────────────────────────────
  const { locale, otherLocale, dir, fmtShort } = await getPdfLocaleContext();
  const t        = await getTranslations({ locale, namespace: "pdfs.ledger" });
  const tOther   = await getTranslations({ locale: otherLocale, namespace: "pdfs.ledger" });
  const tCommon  = await getTranslations({ locale, namespace: "pdfs.common" });
  const tMethods = await getTranslations({ locale, namespace: "payments.methods" });

  const fmtMethod = (m: string) => (tMethods.has(m) ? tMethods(m) : m);

  // Build transactions
  type TxRow = {
    date: Date; type: "Invoice" | "Payment" | "Return" | "Refund";
    description: string; reference: string;
    debit: number; credit: number; balance: number;
  };

  const rows: Omit<TxRow, "balance">[] = [];

  for (const inv of invoices) {
    const period = inv.periodStart && inv.periodEnd
      ? ` (${fmtShort(inv.periodStart)} – ${fmtShort(inv.periodEnd)})`
      : "";
    const month  = inv.monthNumber ? ` — ${t("month", { n: inv.monthNumber })}` : "";
    rows.push({
      date:        inv.issueDate,
      type:        "Invoice",
      description: `${inv.invoiceNumber}${month}${period}`,
      reference:   inv.reservation?.reservationNumber ?? inv.invoiceNumber,
      debit:       roundOMR(Number(inv.totalAmount)),
      credit:      0,
    });
  }

  for (const pay of payments) {
    const num = pay.paymentNumber ?? pay.id.slice(0, 8).toUpperCase();
    rows.push({
      date:        pay.date,
      type:        "Payment",
      description: `${num}${pay.reference ? ` — ${pay.reference}` : ""}`,
      reference:   fmtMethod(pay.method),
      debit:       0,
      credit:      roundOMR(Number(pay.amount)),
    });
  }

  for (const ret of returns) {
    rows.push({
      date:        ret.createdAt,
      type:        "Return",
      description: ret.returnNumber,
      reference:   ret.returnNumber,
      debit:       0,
      credit:      roundOMR(Number(ret.returnAmount)),
    });
  }

  for (const ref of refunds) {
    const num = ref.paymentNumber ?? ref.id.slice(0, 8).toUpperCase();
    rows.push({
      date:        ref.date,
      type:        "Refund",
      description: `${num}${ref.reference ? ` — ${ref.reference}` : ""}`,
      reference:   fmtMethod(ref.method),
      debit:       roundOMR(Number(ref.amount)),
      credit:      0,
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Running balance (AR view): debit increases, credit decreases.
  let balance = 0;
  const finalRows: TxRow[] = rows.map((row) => {
    balance = roundOMR(balance + row.debit - row.credit);
    return { ...row, balance };
  });

  // Summaries
  const totalCharged  = roundOMR(invoices.reduce((s, i) => s + Number(i.totalAmount), 0));
  const totalPaid     = roundOMR(payments.reduce((s, p) => s + Number(p.amount), 0));
  const totalCredited = roundOMR(returns.reduce((s, r) => s + Number(r.returnAmount), 0));
  const totalRefunded = roundOMR(refunds.reduce((s, r) => s + Number(r.amount), 0));
  const totalReturned = totalCredited;
  const currentBalance = roundOMR(totalCharged - totalCredited - totalPaid + totalRefunded);

  const tenantName     = `${tenant.firstName} ${tenant.lastName}`;
  const tenantNameAr   = tenant.fullNameArabic ?? "";
  const printDate      = fmtShort(new Date());
  const periodLabel    = dateFrom || dateTo
    ? t("periodRange", {
        from: dateFrom ? fmtShort(new Date(dateFrom)) : t("periodAll"),
        to:   dateTo   ? fmtShort(new Date(dateTo))   : t("periodToday"),
      })
    : t("periodAllTime");

  const orgName = org?.name ?? t("defaultOrgName");
  const orgCity = org?.city ?? t("defaultCity");

  const balanceState = currentBalance > 0
    ? t("summary.outstanding")
    : currentBalance < 0
      ? t("summary.credit")
      : t("summary.settled");

  // ── Header ───────────────────────────────────────────────────────────────
  const header = renderPdfHeader({
    brand,
    orgName,
    orgAddressLines: [
      `${orgCity}, ${tCommon("country")}${org?.phone ? ` · ${org.phone}` : ""}`,
      t("printedOn", { date: printDate }),
    ],
    docTitle: t("title"),
    metaRows: [],
  });

  const metaGrid = renderGrid(3, [
    renderFieldStacked({ dir, label: t("labels.tenant"), labelSecondary: tOther("labels.tenant"), value: tenantName, valueSub: tenantNameAr || undefined }),
    renderFieldStacked({ dir, label: t("labels.contact"), labelSecondary: tOther("labels.contact"), value: tenant.phone, ltrNumbers: true, valueSub: tenant.email ?? undefined }),
    renderFieldStacked({ dir, label: t("labels.period"), labelSecondary: tOther("labels.period"), value: periodLabel, valueSub: t("transactions", { count: finalRows.length }) }),
  ]);

  const summaryGrid = renderGrid(4, [
    renderLabeledBox({ variant: "highlight", fields: [{ label: t("summary.totalCharged"), value: `${totalCharged.toFixed(3)} ${tCommon("omr")}`, ltrNumbers: true }] }) +
      `<div style="font-size:7.5pt;color:#9ca3af;margin-top:2px">${escHtml(t("summary.invoicesCount", { count: invoices.length }))}</div>`,
    renderLabeledBox({ variant: "highlight", fields: [{ label: t("summary.totalPaid"), value: `${totalPaid.toFixed(3)} ${tCommon("omr")}`, ltrNumbers: true }] }) +
      `<div style="font-size:7.5pt;color:#9ca3af;margin-top:2px">${escHtml(t("summary.paymentsCount", { count: payments.length }))}</div>`,
    renderLabeledBox({ variant: "highlight", fields: [{ label: t("summary.totalReturned"), value: `${totalReturned.toFixed(3)} ${tCommon("omr")}`, ltrNumbers: true }] }) +
      `<div style="font-size:7.5pt;color:#9ca3af;margin-top:2px">${escHtml(t("summary.refundsCount", { count: refunds.length }))}</div>`,
    `<div class="labeled-box highlight" style="border-color:${currentBalance > 0 ? "#fca5a5" : "#86efac"};background:${currentBalance > 0 ? "#fef2f2" : "#f0fdf4"}">
      <div class="box-title">${escHtml(t("summary.balanceDue"))}</div>
      <div style="font-size:15pt;font-weight:800;color:${currentBalance > 0 ? "#dc2626" : "#16a34a"}" class="ltr-numbers">${currentBalance.toFixed(3)}</div>
      <div style="font-size:7.5pt;color:#9ca3af;margin-top:2px">${escHtml(tCommon("omr"))} · ${escHtml(balanceState)}</div>
    </div>`,
  ]);

  const ledgerRows: PdfTableRow[] = finalRows.map((row) => ({
    cells: [
      `<span style="white-space:nowrap" class="ltr-numbers">${escHtml(fmtShort(row.date))}</span>`,
      `<span class="badge badge-${row.type.toLowerCase()}">${escHtml(t(`types.${row.type}`))}</span>`,
      escHtml(row.description),
      `<span style="color:#6b7280;font-size:8pt">${escHtml(row.reference)}</span>`,
      row.debit > 0 ? `<span class="debit ltr-numbers">${row.debit.toFixed(3)}</span>` : `<span style="color:#d1d5db">${escHtml(tCommon("dash"))}</span>`,
      row.credit > 0 ? `<span class="credit ltr-numbers">${row.credit.toFixed(3)}</span>` : `<span style="color:#d1d5db">${escHtml(tCommon("dash"))}</span>`,
      `<span class="ltr-numbers ${row.balance > 0 ? "bal-pos" : "bal-zero"}">${row.balance.toFixed(3)}</span>`,
    ],
  }));

  const ledgerTable = finalRows.length === 0
    ? `<table class="pdf-table"><tbody><tr><td colspan="7" style="text-align:center;padding:20px;color:#9ca3af">${escHtml(t("noTransactions"))}</td></tr></tbody></table>`
    : renderTable({
        columns: [
          { header: t("table.date"), width: "90px", align: "start" },
          { header: t("table.type"), width: "70px", align: "start" },
          { header: t("table.description"), align: "start" },
          { header: t("table.reference"), width: "90px", align: "start" },
          { header: t("table.charges"), width: "85px" },
          { header: t("table.payments"), width: "85px" },
          { header: t("table.balance"), width: "90px" },
        ],
        rows: ledgerRows,
        zebra: true,
        footerRow: {
          cells: [
            { content: escHtml(t("totalsLine", { count: finalRows.length })), colSpan: 4 },
            `<span class="ltr-numbers">${totalCharged.toFixed(3)}</span>`,
            `<span class="ltr-numbers">${totalPaid.toFixed(3)}</span>`,
            `<span class="ltr-numbers">${escHtml(t("balanceCell", { amount: currentBalance.toFixed(3) }))}</span>`,
          ],
        },
      });

  const footer = renderPdfFooter({
    primaryLine: t("footerLocation", { org: orgName, city: orgCity }),
    metaLine: escHtml(t("generated", { date: printDate })),
  });

  const body = `
  ${header}
  <div class="body" style="padding:20px 0 0">
    <div style="margin-bottom:14px">${metaGrid}</div>
    <div style="margin-bottom:14px">${summaryGrid}</div>
    ${ledgerTable}
  </div>
  ${footer}`;

  const html = renderPdfDocument({
    lang: locale,
    dir,
    brand,
    orientation: "landscape",
    pageMargin: "12mm 14mm",
    baseFontSize: "9pt",
    title: `${t("title")} — ${tenantName}`,
    body,
    extraStyles: `
      .grid-3 { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
      table.pdf-table thead th { background: var(--brand); color: #fff; }
      table.pdf-table tfoot td { background: var(--brand-dark); color: #fff; border-top: 2px solid var(--brand-dark); font-size: 9pt; font-weight: 700; }
      .debit { color: #dc2626; font-weight: 600; }
      .credit { color: #16a34a; font-weight: 600; }
      .bal-pos { color: #dc2626; font-weight: 700; }
      .bal-zero { color: #16a34a; font-weight: 700; }
      .badge { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 9999px; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap; }
      .badge-invoice { background: #dbeafe; color: #1d4ed8; }
      .badge-payment { background: #dcfce7; color: #15803d; }
      .badge-return { background: #fef3c7; color: #92400e; }
      .badge-refund { background: #ffe4e6; color: #9f1239; }
    `,
  });

  const pdf = await htmlToPdf(html, {
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: buildPageNumberFooterTemplate(),
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ledger-${tenantName.replace(/\s+/g, "-")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
