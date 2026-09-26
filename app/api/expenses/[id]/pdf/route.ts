import { NextRequest } from "next/server";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { htmlToPdf } from "@/lib/pdf/render";
import { getPdfBranding, footerLine } from "@/lib/pdf/branding";
import { escHtml } from "@/lib/pdf/html";
import {
  renderPdfDocument,
  renderPdfHeader,
  renderStatusBar,
  renderSectionLabel,
  renderField,
  renderTotalsBox,
  renderWorkflowTimeline,
  renderPdfFooter,
  type StatusTone,
  type TimelineStep,
} from "@/lib/pdf/shell";

// Headless Chromium needs the Node runtime (not edge); allow time for cold-start launch.
export const runtime = "nodejs";
export const maxDuration = 60;

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

  const statusTone: Record<string, StatusTone> = {
    PROCESSED: "success", APPROVED: "info", PENDING: "warning", REJECTED: "danger",
  };

  // Workflow steps — raw enum-driven tone mapped to the shell's generic 3-state timeline.
  const steps: { title: string; user: string; at: string; done: boolean; tone: "blue" | "green" | "red" }[] = [
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
  const timelineSteps: TimelineStep[] = steps.map((s) => ({
    label: s.title,
    sublabel: [s.at !== "—" ? s.at : "", s.user ? tDet("byUser", { user: s.user }) : ""].filter(Boolean).join(" · ") || undefined,
    state: s.tone === "red" && s.done ? "rejected" : s.done ? "done" : "pending",
  }));

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
      { label: tP("voucherNo"), value: expense.expenseNumber, ltrNumbers: true },
      { label: tP("issueDate"), value: fmtDate(expense.submittedAt), ltrNumbers: true },
      { label: tP("status"), value: statusLabel },
    ],
  });

  const amountBox = renderTotalsBox({
    rows: [{ label: tDet("amountLabel"), value: `${amount.toFixed(3)} OMR`, tone: "grand", ltrNumbers: true }],
  });

  const categoryLine = `
    <div class="field"><span class="lbl">${escHtml(tDet("categoryLabel"))}</span><span class="val">${escHtml(catName)}</span>${expense.category.nameAr && !isAr ? `<span class="val" style="color:#6b7280;font-weight:400" dir="rtl">(${escHtml(expense.category.nameAr)})</span>` : ""}</div>`;

  const rejectCallout = status === "REJECTED" && expense.rejectionReason
    ? `<div class="callout reject"><div class="h">${escHtml(tP("rejectionHeading"))}</div><div>${escHtml(expense.rejectionReason)}</div></div>`
    : "";

  const processCallout = status === "PROCESSED"
    ? `<div class="callout process">
        <div class="h">${escHtml(tP("processingHeading"))}</div>
        <div>${escHtml(tryT(tPm, expense.paymentMethod ?? "", expense.paymentMethod ?? "—"))}</div>
        ${expense.bankReference ? `<div style="margin-top:3px" class="ltr-numbers">${escHtml(tDet("referenceLabel", { ref: expense.bankReference }))}</div>` : ""}
        ${expense.processingNotes ? `<div style="margin-top:3px">${escHtml(expense.processingNotes)}</div>` : ""}
      </div>`
    : "";

  const footer = renderPdfFooter({
    primaryLine: footerLine(brand, isAr, "") || `${tP("computerGenerated")} · ${org?.name ?? ""}`,
    metaLine: footerLine(brand, isAr, "") ? `${escHtml(tP("computerGenerated"))} · ${escHtml(org?.name ?? "")}` : undefined,
  });

  const body = `
  ${header}
  ${renderStatusBar({ label: statusLabel, tone: statusTone[status] ?? "neutral" })}
  <div class="body">
    <div class="labeled-box highlight" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      ${amountBox}
      <div class="cat" style="display:flex;align-items:center;gap:10px">
        <div>
          <div style="font-size:14px;font-weight:700;color:#111827">${escHtml(catName)}</div>
          ${expense.category.nameAr && !isAr ? `<div style="font-size:12px;color:#6b7280" dir="rtl">${escHtml(expense.category.nameAr)}</div>` : ""}
        </div>
      </div>
    </div>

    <div class="desc" style="margin-bottom:20px">
      ${renderSectionLabel(tDet("descriptionLabel"))}
      <p style="font-size:13px;color:#374151;margin-top:4px;line-height:1.5">${escHtml(expense.description)}</p>
    </div>

    <div class="grid-2">
      ${renderField({ label: tDet("buildingLabel"), value: expense.property.name })}
      ${renderField({ label: tDet("categoryLabel"), value: catName })}
      ${renderField({ label: tDet("submittedByLabel"), value: fullName(expense.submittedBy) })}
      ${renderField({ label: tDet("submittedAtLabel"), value: fmtDate(expense.submittedAt), ltrNumbers: true })}
    </div>

    ${brand.showNotes && expense.notes ? `<div class="desc" style="margin-bottom:20px">${renderSectionLabel(tDet("notesLabel"))}<p style="font-size:13px;color:#374151;margin-top:4px;line-height:1.5">${escHtml(expense.notes)}</p></div>` : ""}

    <div style="margin-bottom:22px">
      ${renderSectionLabel(tDet("workflowHeading"))}
      ${renderWorkflowTimeline(timelineSteps)}
    </div>

    ${rejectCallout}
    ${processCallout}
  </div>
  ${footer}`;

  const html = renderPdfDocument({
    lang: locale,
    dir,
    brand,
    pageMargin: "0",
    title: tP("title", { number: expense.expenseNumber }),
    body,
    extraStyles: `
      .callout { border-radius: 8px; padding: 12px 16px; font-size: 12.5px; margin-bottom: 20px; }
      .callout.reject { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
      .callout.process { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
      .callout .h { font-weight: 700; margin-bottom: 4px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; }
    `,
  });

  const pdf = await htmlToPdf(html, { preferCSSPageSize: true });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="expense-${expense.expenseNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
