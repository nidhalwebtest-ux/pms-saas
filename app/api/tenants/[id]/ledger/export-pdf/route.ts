import { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getPdfLocaleContext } from "@/lib/pdf-i18n";

function roundOMR(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgUser;
  try { orgUser = await requireOrgUser(); }
  catch { return new Response("Unauthorized", { status: 401 }); }

  const { id: tenantId } = await params;
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
  if (!tenant || tenant.organizationId !== orgUser.organizationId)
    return new Response("Tenant not found", { status: 404 });

  const org = await prisma.organization.findUnique({
    where:  { id: orgUser.organizationId },
    select: { name: true, phone: true, city: true },
  });

  // Date filters
  const dateGte = dateFrom ? new Date(dateFrom) : undefined;
  const dateLte = dateTo   ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)) : undefined;

  const [invoices, payments, refunds, returns] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        tenantId,
        organizationId: orgUser.organizationId,
        status: { notIn: ["CANCELLED", "VOID"] },
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
        organizationId: orgUser.organizationId,
        isRefund: false,
        ...(dateGte || dateLte ? { date: { ...(dateGte ? { gte: dateGte } : {}), ...(dateLte ? { lte: dateLte } : {}) } } : {}),
      },
      select: { id: true, paymentNumber: true, amount: true, date: true, method: true, reference: true },
      orderBy: { date: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        organizationId: orgUser.organizationId,
        isRefund: true,
        ...(dateGte || dateLte ? { date: { ...(dateGte ? { gte: dateGte } : {}), ...(dateLte ? { lte: dateLte } : {}) } } : {}),
      },
      select: { id: true, paymentNumber: true, amount: true, date: true, method: true, reference: true },
      orderBy: { date: "asc" },
    }),
    prisma.return.findMany({
      where: {
        tenantId,
        organizationId: orgUser.organizationId,
        status: "active",
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

  const isRtl = dir === "rtl";
  const secondaryDir = isRtl ? "ltr" : "rtl";

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

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t("title")} — ${tenantName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4 landscape;
    margin: 12mm 14mm;
  }

  body {
    font-family: -apple-system, 'Segoe UI', Arial, sans-serif;
    font-size: 9pt;
    color: #1a1a2e;
    background: #fff;
    line-height: 1.4;
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #2563eb;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .header-left h1 {
    font-size: 18pt;
    font-weight: 700;
    color: #2563eb;
    letter-spacing: -0.3px;
  }
  .header-left .subtitle {
    font-size: 8pt;
    color: #6b7280;
    margin-top: 2px;
    direction: ${secondaryDir};
  }
  .header-right {
    text-align: ${isRtl ? "left" : "right"};
  }
  .header-right .org-name {
    font-size: 11pt;
    font-weight: 700;
    color: #111827;
  }
  .header-right .org-sub {
    font-size: 8pt;
    color: #6b7280;
    margin-top: 2px;
  }

  /* ── Tenant & Meta Info ── */
  .meta-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 14px;
  }
  .meta-block .label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #9ca3af;
    font-weight: 600;
  }
  .meta-block .label .sec {
    text-transform: none;
    letter-spacing: 0;
    color: #cbd5e1;
    margin-${isRtl ? "right" : "left"}: 4px;
    direction: ${secondaryDir};
  }
  .meta-block .value {
    font-size: 9.5pt;
    font-weight: 600;
    color: #111827;
    margin-top: 2px;
  }
  .meta-block .value-sub {
    font-size: 7.5pt;
    color: #6b7280;
    margin-top: 1px;
  }

  /* ── Summary boxes ── */
  .summary-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 14px;
  }
  .summary-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
  }
  .summary-box .s-label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #9ca3af;
    font-weight: 600;
  }
  .summary-box .s-value {
    font-size: 13pt;
    font-weight: 700;
    margin-top: 3px;
    color: #111827;
    direction: ltr;
  }
  .summary-box.charged .s-value { color: #1d4ed8; }
  .summary-box.paid    .s-value { color: #15803d; }
  .summary-box.returned .s-value { color: #b45309; }
  .summary-box.balance  { border-color: ${currentBalance > 0 ? "#fca5a5" : "#86efac"}; background: ${currentBalance > 0 ? "#fef2f2" : "#f0fdf4"}; }
  .summary-box.balance .s-value { color: ${currentBalance > 0 ? "#dc2626" : "#16a34a"}; font-size: 15pt; }
  .summary-box .s-sub {
    font-size: 7.5pt;
    color: #9ca3af;
    margin-top: 2px;
  }

  /* ── Table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
  }
  thead tr {
    background: #1e40af;
    color: #fff;
  }
  thead th {
    padding: 7px 8px;
    text-align: ${isRtl ? "right" : "left"};
    font-weight: 600;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    white-space: nowrap;
  }
  thead th.num { text-align: ${isRtl ? "left" : "right"}; }

  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr:hover           { background: #eff6ff; }

  tbody td {
    padding: 5.5px 8px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
    color: #374151;
  }
  tbody td.num { text-align: ${isRtl ? "left" : "right"}; font-variant-numeric: tabular-nums; direction: ltr; }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border-radius: 9999px;
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
  .badge-invoice { background: #dbeafe; color: #1d4ed8; }
  .badge-payment { background: #dcfce7; color: #15803d; }
  .badge-return  { background: #fef3c7; color: #92400e; }
  .badge-refund  { background: #ffe4e6; color: #9f1239; }

  .debit  { color: #dc2626; font-weight: 600; }
  .credit { color: #16a34a; font-weight: 600; }
  .bal-pos { color: #dc2626; font-weight: 700; }
  .bal-zero{ color: #16a34a; font-weight: 700; }

  /* ── Footer ── */
  tfoot tr {
    background: #1e40af;
    color: #fff;
  }
  tfoot td {
    padding: 7px 8px;
    font-weight: 700;
    font-size: 9pt;
    border-top: 2px solid #1e3a8a;
  }
  tfoot td.num { text-align: ${isRtl ? "left" : "right"}; font-variant-numeric: tabular-nums; direction: ltr; }

  /* ── Page footer ── */
  .page-footer {
    margin-top: 14px;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #9ca3af;
    border-top: 1px solid #e5e7eb;
    padding-top: 6px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>

<!-- Print button (hidden on print) -->
<div class="no-print" style="position:fixed;top:12px;${isRtl ? "left" : "right"}:16px;z-index:99;display:flex;gap:8px;">
  <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(37,99,235,.35);">${t("buttons.printSavePdf")}</button>
  <button onclick="window.close()" style="background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;">${t("buttons.close")}</button>
</div>

<!-- Header -->
<div class="header">
  <div class="header-left">
    <h1>${t("title")}</h1>
    <div class="subtitle">${tOther("title")}</div>
  </div>
  <div class="header-right">
    <div class="org-name">${orgName}</div>
    <div class="org-sub">${orgCity}, ${tCommon("country")}${org?.phone ? ` · <span style="direction:ltr">${org.phone}</span>` : ""}</div>
    <div class="org-sub" style="margin-top:4px;">${t("printedOn", { date: printDate })}</div>
  </div>
</div>

<!-- Tenant & Period Info -->
<div class="meta-row">
  <div class="meta-block">
    <div class="label">${t("labels.tenant")} <span class="sec">${tOther("labels.tenant")}</span></div>
    <div class="value">${tenantName}</div>
    ${tenantNameAr ? `<div class="value-sub" dir="rtl">${tenantNameAr}</div>` : ""}
  </div>
  <div class="meta-block">
    <div class="label">${t("labels.contact")} <span class="sec">${tOther("labels.contact")}</span></div>
    <div class="value" style="direction:ltr">${tenant.phone}</div>
    ${tenant.email ? `<div class="value-sub" style="direction:ltr">${tenant.email}</div>` : ""}
  </div>
  <div class="meta-block">
    <div class="label">${t("labels.period")} <span class="sec">${tOther("labels.period")}</span></div>
    <div class="value">${periodLabel}</div>
    <div class="value-sub">${t("transactions", { count: finalRows.length })}</div>
  </div>
</div>

<!-- Summary -->
<div class="summary-row">
  <div class="summary-box charged">
    <div class="s-label">${t("summary.totalCharged")}</div>
    <div class="s-value">${totalCharged.toFixed(3)}</div>
    <div class="s-sub">${tCommon("omr")} · ${t("summary.invoicesCount", { count: invoices.length })}</div>
  </div>
  <div class="summary-box paid">
    <div class="s-label">${t("summary.totalPaid")}</div>
    <div class="s-value">${totalPaid.toFixed(3)}</div>
    <div class="s-sub">${tCommon("omr")} · ${t("summary.paymentsCount", { count: payments.length })}</div>
  </div>
  <div class="summary-box returned">
    <div class="s-label">${t("summary.totalReturned")}</div>
    <div class="s-value">${totalReturned.toFixed(3)}</div>
    <div class="s-sub">${tCommon("omr")} · ${t("summary.refundsCount", { count: refunds.length })}</div>
  </div>
  <div class="summary-box balance">
    <div class="s-label">${t("summary.balanceDue")}</div>
    <div class="s-value">${currentBalance.toFixed(3)}</div>
    <div class="s-sub">${tCommon("omr")} · ${balanceState}</div>
  </div>
</div>

<!-- Ledger Table -->
<table>
  <thead>
    <tr>
      <th style="width:90px">${t("table.date")}</th>
      <th style="width:70px">${t("table.type")}</th>
      <th>${t("table.description")}</th>
      <th style="width:90px">${t("table.reference")}</th>
      <th class="num" style="width:85px">${t("table.charges")}</th>
      <th class="num" style="width:85px">${t("table.payments")}</th>
      <th class="num" style="width:90px">${t("table.balance")}</th>
    </tr>
  </thead>
  <tbody>
    ${finalRows.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:20px;color:#9ca3af;">${t("noTransactions")}</td></tr>`
      : finalRows.map((row) => `
    <tr>
      <td style="white-space:nowrap;direction:ltr">${fmtShort(row.date)}</td>
      <td><span class="badge badge-${row.type.toLowerCase()}">${t(`types.${row.type}`)}</span></td>
      <td>${row.description}</td>
      <td style="color:#6b7280;font-size:8pt">${row.reference}</td>
      <td class="num">${row.debit > 0 ? `<span class="debit">${row.debit.toFixed(3)}</span>` : `<span style="color:#d1d5db">${tCommon("dash")}</span>`}</td>
      <td class="num">${row.credit > 0 ? `<span class="credit">${row.credit.toFixed(3)}</span>` : `<span style="color:#d1d5db">${tCommon("dash")}</span>`}</td>
      <td class="num ${row.balance > 0 ? "bal-pos" : "bal-zero"}">${row.balance.toFixed(3)}</td>
    </tr>`).join("")}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="4">${t("totalsLine", { count: finalRows.length })}</td>
      <td class="num">${totalCharged.toFixed(3)}</td>
      <td class="num">${totalPaid.toFixed(3)}</td>
      <td class="num">${t("balanceCell", { amount: currentBalance.toFixed(3) })}</td>
    </tr>
  </tfoot>
</table>

<!-- Page Footer -->
<div class="page-footer">
  <span>${t("footerLocation", { org: orgName, city: orgCity })}</span>
  <span>${t("generated", { date: printDate })}</span>
</div>

</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
