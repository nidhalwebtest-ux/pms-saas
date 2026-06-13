import { NextRequest } from "next/server";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { htmlToPdf } from "@/lib/pdf/render";
import { pdfFontFaceCss, PDF_FONT_STACK } from "@/lib/pdf/fonts";
import { getPdfBranding, brandRootCss, logoHtml, footerLine } from "@/lib/pdf/branding";

// Headless Chromium needs the Node runtime (not edge); allow time for cold-start launch.
export const runtime = "nodejs";
export const maxDuration = 60;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const fullName = (u: { firstName: string | null; lastName: string | null } | null) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || "—" : "—";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true, role: true },
  });
  if (!dbUser?.organizationId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      category: true,
      property: { select: { id: true, name: true } },
      organization: { select: { name: true, address: true, city: true, area: true, phone: true } },
      submittedBy: { select: { firstName: true, lastName: true } },
      reviewedBy:  { select: { firstName: true, lastName: true } },
      processedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!expense || expense.organizationId !== dbUser.organizationId) {
    return new Response("Expense not found", { status: 404 });
  }
  // STAFF can only access their own expenses (mirror the detail page).
  if (dbUser.role === "STAFF" && expense.submittedById !== user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  // ── i18n ──────────────────────────────────────────────────────────────────
  const locale = await getLocale();
  const isAr   = locale === "ar";
  const dfLoc  = isAr ? arLocale : enLocale;
  const tP     = await getTranslations("expenses.print");
  const tDet   = await getTranslations("expenses.detail");
  const tStat  = await getTranslations("expenses.statusFull");
  const tTl    = await getTranslations("expenses.detail.timeline");
  const tPm    = await getTranslations("expenses.detail.paymentMethods");

  const fmtDate = (d: Date | null) => (d ? format(new Date(d), "d MMM yyyy, HH:mm", { locale: dfLoc }) : "—");
  const tryT = (fn: (k: string) => string, key: string, fallback?: string) => {
    try { return fn(key); } catch { return fallback ?? key; }
  };

  const org = expense.organization;
  const brand = await getPdfBranding(expense.organizationId);
  const amount = Number(expense.amount);
  const status = expense.status; // PENDING | APPROVED | REJECTED | PROCESSED
  const statusLabel = tStat(status);
  const catName = isAr && expense.category.nameAr ? expense.category.nameAr : expense.category.name;

  const dir = isAr ? "rtl" : "ltr";
  const endAlign = isAr ? "left" : "right";

  // Workflow steps
  const steps: { title: string; user: string; at: string; done: boolean; tone: string }[] = [
    { title: tTl("submitted"), user: fullName(expense.submittedBy), at: fmtDate(expense.submittedAt), done: true, tone: "blue" },
    {
      title: status === "REJECTED" ? tTl("rejected") : status === "PENDING" ? tTl("awaitingReview") : tTl("approved"),
      user: expense.reviewedBy ? fullName(expense.reviewedBy) : "",
      at: fmtDate(expense.reviewedAt),
      done: status !== "PENDING",
      tone: status === "REJECTED" ? "red" : "blue",
    },
  ];
  if (status !== "REJECTED") {
    steps.push({
      title: status === "PROCESSED" ? tTl("processed") : tTl("awaitingProcessing"),
      user: expense.processedBy ? fullName(expense.processedBy) : "",
      at: fmtDate(expense.processedAt),
      done: status === "PROCESSED",
      tone: "green",
    });
  }
  const stepRows = steps.map((s) => `
    <div class="step ${s.done ? "done" : ""} ${s.tone}">
      <span class="dot"></span>
      <div>
        <div class="step-title">${esc(s.title)}</div>
        ${s.at !== "—" ? `<div class="step-at ltr-numbers">${esc(s.at)}</div>` : ""}
        ${s.user ? `<div class="step-user">${esc(tDet("byUser", { user: s.user }))}</div>` : ""}
      </div>
    </div>`).join("");

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<title>${esc(tP("title", { number: expense.expenseNumber }))}</title>
<style>
  ${pdfFontFaceCss()}
  ${brandRootCss(brand)}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${PDF_FONT_STACK}; font-size: 13px; color: #1f2937; background: #fff; direction: ${dir}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ltr-numbers { direction: ltr; unicode-bidi: embed; display: inline-block; }
  .page { max-width: 100%; }

  .header { background: linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%); color: #fff; padding: 32px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand-logo { background:#fff; padding:6px 10px; border-radius:8px; margin-bottom:12px; display:inline-block; }
  .header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .org-name { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .org-detail { font-size: 12px; opacity: 0.82; line-height: 1.6; }
  .meta { text-align: ${endAlign}; }
  .meta table { border-collapse: collapse; }
  .meta td { padding: 2px 0; font-size: 12px; }
  .meta td:first-child { opacity: 0.78; padding-${isAr ? "left" : "right"}: 16px; text-align: ${isAr ? "right" : "left"}; }
  .meta td:last-child { font-weight: 600; text-align: ${endAlign}; }

  .status-bar { display: flex; align-items: center; gap: 12px; padding: 10px 40px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .status-bar.PROCESSED { background: #f0fdf4; color: #16a34a; border-bottom: 2px solid #bbf7d0; }
  .status-bar.APPROVED { background: #eff6ff; color: #2563eb; border-bottom: 2px solid #bfdbfe; }
  .status-bar.PENDING { background: #fffbeb; color: #d97706; border-bottom: 2px solid #fde68a; }
  .status-bar.REJECTED { background: #fef2f2; color: #dc2626; border-bottom: 2px solid #fecaca; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; display: inline-block; }

  .body { padding: 28px 40px; }
  .amount-box { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 22px; margin-bottom: 24px; }
  .amount-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
  .amount-val { font-size: 28px; font-weight: 800; color: #be123c; direction: ltr; margin-top: 2px; }
  .cat { display: flex; align-items: center; gap: 10px; }
  .cat .icon { font-size: 26px; }
  .cat .name { font-size: 14px; font-weight: 700; color: #111827; }
  .cat .name-ar { font-size: 12px; color: #6b7280; direction: rtl; }

  .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #f3f4f6; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 24px; }
  .field .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 2px; }
  .field .val { font-size: 13px; color: #111827; font-weight: 500; }
  .desc { margin-bottom: 20px; }
  .desc p { font-size: 13px; color: #374151; margin-top: 4px; line-height: 1.5; }

  .steps { margin-bottom: 22px; }
  .step { display: flex; gap: 12px; padding: 8px 0; align-items: flex-start; }
  .step .dot { width: 10px; height: 10px; border-radius: 50%; background: #d1d5db; margin-top: 3px; flex-shrink: 0; }
  .step.done.blue .dot { background: #2563eb; }
  .step.done.green .dot { background: #16a34a; }
  .step.done.red .dot { background: #dc2626; }
  .step-title { font-size: 13px; font-weight: 600; color: #111827; }
  .step:not(.done) .step-title { color: #9ca3af; }
  .step-at { font-size: 11px; color: #6b7280; margin-top: 1px; }
  .step-user { font-size: 11px; color: #6b7280; margin-top: 1px; }

  .callout { border-radius: 8px; padding: 12px 16px; font-size: 12.5px; margin-bottom: 20px; }
  .callout.reject { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
  .callout.process { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
  .callout .h { font-weight: 700; margin-bottom: 4px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; }

  .footer { text-align: center; padding: 18px 40px 26px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 11px; }

  @page { size: ${brand.paperSize}; margin: 0; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      ${logoHtml(brand) ? `<div class="brand-logo">${logoHtml(brand)}</div>` : ""}
      <div class="org-name">${esc(org?.name)}</div>
      ${org?.address ? `<div class="org-detail">${esc(org.address)}</div>` : ""}
      ${org?.city ? `<div class="org-detail">${esc(org.city)}${org.area ? `, ${esc(org.area)}` : ""}</div>` : ""}
      ${org?.phone ? `<div class="org-detail ltr-numbers">${esc(org.phone)}</div>` : ""}
      <div style="margin-top:16px"><h1>${esc(tP("heading"))}</h1></div>
    </div>
    <div class="meta">
      <table><tbody>
        <tr><td>${esc(tP("voucherNo"))}:</td><td class="ltr-numbers">${esc(expense.expenseNumber)}</td></tr>
        <tr><td>${esc(tP("issueDate"))}:</td><td class="ltr-numbers">${fmtDate(expense.submittedAt)}</td></tr>
        <tr><td>${esc(tP("status"))}:</td><td>${esc(statusLabel)}</td></tr>
      </tbody></table>
    </div>
  </div>

  <div class="status-bar ${status}"><span class="status-dot"></span>${esc(statusLabel)}</div>

  <div class="body">
    <div class="amount-box">
      <div>
        <div class="amount-label">${esc(tDet("amountLabel"))}</div>
        <div class="amount-val">${amount.toFixed(3)} OMR</div>
      </div>
      <div class="cat">
        <span class="icon">${esc(expense.category.icon ?? "📋")}</span>
        <div>
          <div class="name">${esc(catName)}</div>
          ${expense.category.nameAr && !isAr ? `<div class="name-ar">${esc(expense.category.nameAr)}</div>` : ""}
        </div>
      </div>
    </div>

    <div class="desc">
      <div class="section-label">${esc(tDet("descriptionLabel"))}</div>
      <p>${esc(expense.description)}</p>
    </div>

    <div class="grid2">
      <div class="field"><div class="lbl">${esc(tDet("buildingLabel"))}</div><div class="val">${esc(expense.property.name)}</div></div>
      <div class="field"><div class="lbl">${esc(tDet("categoryLabel"))}</div><div class="val">${esc(catName)}</div></div>
      <div class="field"><div class="lbl">${esc(tDet("submittedByLabel"))}</div><div class="val">${esc(fullName(expense.submittedBy))}</div></div>
      <div class="field"><div class="lbl">${esc(tDet("submittedAtLabel"))}</div><div class="val ltr-numbers">${fmtDate(expense.submittedAt)}</div></div>
    </div>

    ${brand.showNotes && expense.notes ? `<div class="desc"><div class="section-label">${esc(tDet("notesLabel"))}</div><p>${esc(expense.notes)}</p></div>` : ""}

    <div class="steps">
      <div class="section-label">${esc(tDet("workflowHeading"))}</div>
      ${stepRows}
    </div>

    ${status === "REJECTED" && expense.rejectionReason ? `
    <div class="callout reject">
      <div class="h">${esc(tP("rejectionHeading"))}</div>
      <div>${esc(expense.rejectionReason)}</div>
    </div>` : ""}

    ${status === "PROCESSED" ? `
    <div class="callout process">
      <div class="h">${esc(tP("processingHeading"))}</div>
      <div>${esc(tryT(tPm, expense.paymentMethod ?? "", expense.paymentMethod ?? "—"))}</div>
      ${expense.bankReference ? `<div style="margin-top:3px" class="ltr-numbers">${esc(tDet("referenceLabel", { ref: expense.bankReference }))}</div>` : ""}
      ${expense.processingNotes ? `<div style="margin-top:3px">${esc(expense.processingNotes)}</div>` : ""}
    </div>` : ""}
  </div>

  <div class="footer">
    ${footerLine(brand, isAr, "") ? `<div style="font-weight:600;color:#6b7280;margin-bottom:3px">${esc(footerLine(brand, isAr, ""))}</div>` : ""}
    ${esc(tP("computerGenerated"))} · ${esc(org?.name)}
  </div>
</div>
</body>
</html>`;

  const pdf = await htmlToPdf(html, { preferCSSPageSize: true });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="expense-${expense.expenseNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
