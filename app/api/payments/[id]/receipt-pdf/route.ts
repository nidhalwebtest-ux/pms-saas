import { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { verifyShareFromRequest } from "@/lib/share-token";
import { getPdfLocaleContext } from "@/lib/pdf-i18n";
import { htmlToPdf } from "@/lib/pdf/render";
import { getPdfBranding } from "@/lib/pdf/branding";
import { escHtml } from "@/lib/pdf/html";
import {
  renderPdfDocument,
  renderPdfHeader,
  renderSectionLabel,
  renderFieldStacked,
  renderTotalsBox,
  renderAmountInWords,
  renderTable,
  renderPdfFooter,
  type PdfTableRow,
} from "@/lib/pdf/shell";

// Headless Chromium needs the Node runtime (not edge); allow time for cold-start launch.
export const runtime = "nodejs";
export const maxDuration = 60;

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, organizationId: true, organization: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

// ── Amount-in-words helpers ───────────────────────────────────────────────────

const ONES_EN = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS_EN = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function threeDigitsEn(n: number): string {
  if (n === 0) return "";
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;
  let result = "";
  if (hundreds > 0) result += ONES_EN[hundreds] + " Hundred";
  if (remainder > 0) {
    if (result) result += " ";
    if (remainder < 20) {
      result += ONES_EN[remainder];
    } else {
      result += TENS_EN[tens];
      if (ones > 0) result += " " + ONES_EN[ones];
    }
  }
  return result;
}

export function amountToWordsEn(amount: number): string {
  const rials = Math.floor(amount);
  const baisa = Math.round((amount - rials) * 1000);

  const rialWords = (() => {
    if (rials === 0) return "Zero";
    const thousands = Math.floor(rials / 1000);
    const remainder = rials % 1000;
    let result = "";
    if (thousands > 0) {
      result += threeDigitsEn(thousands) + " Thousand";
    }
    if (remainder > 0) {
      if (result) result += " ";
      result += threeDigitsEn(remainder);
    }
    return result;
  })();

  let out = rialWords + " Omani Rial" + (rials !== 1 ? "s" : "");
  if (baisa > 0) {
    out += " and " + threeDigitsEn(baisa) + " Baisa";
  }
  return out;
}

// ── Arabic number words ───────────────────────────────────────────────────────

const ONES_AR = [
  "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر",
  "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];
const TENS_AR = [
  "", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون",
];
const HUNDREDS_AR = [
  "", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة",
];

function threeDigitsAr(n: number): string {
  if (n === 0) return "";
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(HUNDREDS_AR[hundreds]);
  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(ONES_AR[remainder]);
    } else {
      if (ones > 0) parts.push(ONES_AR[ones]);
      parts.push(TENS_AR[tens]);
    }
  }
  return parts.join(" و");
}

export function amountToWordsAr(amount: number): string {
  const rials = Math.floor(amount);
  const baisa = Math.round((amount - rials) * 1000);

  const rialWords = (() => {
    if (rials === 0) return "صفر";
    if (rials === 1000) return "ألف";
    if (rials === 2000) return "ألفان";
    const thousands = Math.floor(rials / 1000);
    const remainder = rials % 1000;
    const parts: string[] = [];
    if (thousands > 0) {
      if (thousands === 1) parts.push("ألف");
      else if (thousands === 2) parts.push("ألفان");
      else parts.push(threeDigitsAr(thousands) + " آلاف");
    }
    if (remainder > 0) {
      parts.push(threeDigitsAr(remainder));
    }
    return parts.join(" و");
  })();

  let out = rialWords + " ريال عماني";
  if (baisa > 0) {
    out += " و" + threeDigitsAr(baisa) + " بيسة";
  }
  return out;
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Access via a signed public share link (?t=) OR an authenticated session.
  const share = verifyShareFromRequest(req, "receipt", id);
  let organizationId: string;
  if (share) {
    organizationId = share.org;
  } else {
    const actor = await getActor();
    if (!actor) return new Response("Unauthorized", { status: 401 });
    organizationId = actor.organizationId!;
  }

  const [payment, org] = await Promise.all([
    prisma.payment.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullNameArabic: true,
            phone: true,
            organizationId: true,
          },
        },
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                periodStart: true,
                periodEnd: true,
                totalAmount: true,
                amountPaid: true,
                balanceDue: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        receivedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        bankAccount: {
          select: { bankName: true, label: true },
        },
      },
    }),
    organizationId
      ? prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true, phone: true, address: true, city: true, logo: true },
        })
      : Promise.resolve(null),
  ]);

  if (!payment) return new Response("Payment not found", { status: 404 });
  if (payment.tenant.organizationId !== organizationId) {
    return new Response("Unauthorized", { status: 403 });
  }
  const amount = Number(payment.amount);
  const brand = await getPdfBranding(payment.tenant.organizationId);

  // ── i18n ──────────────────────────────────────────────────────────────────
  const { locale, otherLocale, dir, fmtLong, fmtShort } = await getPdfLocaleContext();
  const t        = await getTranslations({ locale, namespace: "pdfs.receipt" });
  const tOther   = await getTranslations({ locale: otherLocale, namespace: "pdfs.receipt" });
  const tCommon  = await getTranslations({ locale, namespace: "pdfs.common" });
  const tMethods = await getTranslations({ locale, namespace: "payments.methods" });

  const isRtl = dir === "rtl";

  const fmtPeriod = (start: Date | null, end: Date | null) => {
    if (!start || !end) return "";
    return `${fmtShort(start)} – ${fmtShort(end)}`;
  };
  const fmtMethod = (m: string) => (tMethods.has(m) ? tMethods(m) : m);

  const todayStr = fmtLong(new Date());
  const receiptNumber = payment.paymentNumber ?? `PAY-${payment.id.slice(0, 8).toUpperCase()}`;
  const orgName = org?.name ?? t("defaultOrgName");

  // Bilingual amount-in-words: primary in user locale, secondary in other
  const wordsPrimary   = locale === "ar" ? amountToWordsAr(amount) : amountToWordsEn(amount);
  const wordsSecondary = locale === "ar" ? amountToWordsEn(amount) : amountToWordsAr(amount);

  // ── Invoice allocation rows ───────────────────────────────────────────────
  const allocationRows: PdfTableRow[] = payment.allocations.map((alloc) => {
    const inv = alloc.invoice;
    const isPaid = inv.status === "PAID";
    const statusBadge = isPaid
      ? `<span style="color:#15803d;font-weight:700">${escHtml(t("statuses.paid"))}</span>`
      : `<span style="color:#d97706;font-weight:700">${escHtml(t("statuses.partial"))}</span>`;
    return {
      cells: [
        `<span style="font-family:monospace;font-size:12px">${escHtml(inv.invoiceNumber)}</span>`,
        `<span style="font-size:11px;color:#6b7280">${escHtml(fmtPeriod(inv.periodStart, inv.periodEnd))}</span>`,
        `<span class="ltr-numbers" style="font-weight:600">${Number(alloc.amount).toFixed(3)}</span>`,
        `<span style="text-align:center;display:block">${statusBadge}</span>`,
      ],
    };
  });

  const header = renderPdfHeader({
    brand,
    compact: true,
    orgName,
    orgAddressLines: [
      org?.address ? `${org.address}${org?.city ? `, ${org.city}` : ""}` : "",
      org?.phone ? `${tCommon("tel")}: ${org.phone}` : "",
    ].filter(Boolean),
    docTitle: t("title"),
    metaRows: [
      { label: t("fields.receiptNo"), value: receiptNumber, ltrNumbers: true },
      { label: t("fields.date"), value: todayStr },
    ],
  });

  // Green-tinted highlight (not the shell's neutral .highlight) — this is the
  // one figure on a payment receipt that should read as "money confirmed
  // received," matching the original design's #f0fdf4/#86efac treatment.
  // The method/bank line lives inside the box (a second line under the
  // amount), not as a sibling — matching the original's single bordered card.
  const methodLine = `${escHtml(t("fields.method", { method: fmtMethod(payment.method) }))}${payment.bankAccount ? ` · ${escHtml(payment.bankAccount.bankName)}${payment.bankAccount.label ? " — " + escHtml(payment.bankAccount.label) : ""}` : ""}`;
  const amountBox = `<div class="labeled-box highlight" style="background:#f0fdf4;border-color:#86efac">${renderTotalsBox({
    rows: [{ label: t("fields.amount"), value: `${amount.toFixed(3)} ${tCommon("omr")}`, tone: "positive", ltrNumbers: true }],
  })}<div style="font-size:11px;color:#15803d;margin-top:4px">${methodLine}</div></div>`;

  const applicableSection = brand.showPaymentHistory && payment.allocations.length > 0
    ? `
    <div class="section">
      ${renderSectionLabel(t("sections.appliedTo"), tOther("sections.appliedTo"))}
      ${renderTable({
        columns: [
          { header: t("table.invoice"), align: "start" },
          { header: t("table.period"), align: "start" },
          { header: t("table.applied") },
          { header: t("table.status") },
        ],
        rows: allocationRows,
      })}
      <div style="display:flex;justify-content:flex-end;padding:8px 10px;font-size:13px;font-weight:700;border-top:2px solid #e5e7eb;margin-top:4px">
        <span>${escHtml(t("totalApplied", { amount: amount.toFixed(3) }))}</span>
      </div>
    </div>`
    : "";

  const footerPrimaryText = (isRtl ? (brand.footerTextAr || brand.footerText) : brand.footerText)?.trim();
  const footer = renderPdfFooter({
    primaryLine: footerPrimaryText || t("footer.thankYou"),
    secondaryLine: footerPrimaryText ? undefined : tOther("footer.thankYou"),
    metaLine: `${escHtml(t("footer.computerGenerated"))} | ${escHtml(tOther("footer.computerGenerated"))}${payment.receivedBy ? `<br/>${escHtml(t("footer.recordedBy", { name: `${payment.receivedBy.firstName ?? ""} ${payment.receivedBy.lastName ?? ""}`.trim() }))}` : ""}`,
  });

  const body = `
  ${header}
  <div class="body" style="padding:20px 0 0">
    <div class="section">
      ${renderSectionLabel(t("sections.receiptDetails"), tOther("sections.receiptDetails"))}
      <div class="info-grid">
        ${renderFieldStacked({ dir, label: t("fields.receiptNo"), labelSecondary: tOther("fields.receiptNo"), value: receiptNumber, ltrNumbers: true })}
        ${renderFieldStacked({ dir, label: t("fields.date"), labelSecondary: tOther("fields.date"), value: fmtLong(payment.date) })}
        ${renderFieldStacked({ dir, label: t("fields.receivedFrom"), labelSecondary: tOther("fields.receivedFrom"), value: `${payment.tenant.firstName} ${payment.tenant.lastName}`, valueSub: payment.tenant.fullNameArabic ?? undefined })}
        ${renderFieldStacked({ dir, label: t("fields.phone"), labelSecondary: tOther("fields.phone"), value: payment.tenant.phone ?? tCommon("dash"), ltrNumbers: true })}
      </div>
    </div>

    <div class="section">
      ${renderSectionLabel(t("sections.paymentDetails"), tOther("sections.paymentDetails"))}
      <div style="margin-bottom:12px">${amountBox}</div>
      ${payment.reference ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#374151"><span style="color:#9ca3af">${escHtml(t("fields.reference"))}</span><span style="font-weight:600">${escHtml(payment.reference)}</span></div>` : ""}
      ${payment.notes ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#374151"><span style="color:#9ca3af">${escHtml(t("fields.notes"))}</span><span style="font-weight:600">${escHtml(payment.notes)}</span></div>` : ""}
    </div>

    ${renderAmountInWords({ primary: wordsPrimary, secondary: wordsSecondary })}

    ${applicableSection}
  </div>
  ${footer}`;

  const html = renderPdfDocument({
    lang: locale,
    dir,
    brand,
    paperSize: "A4", // overridden by extraStyles' @page rule below — receipt is the one A5 document
    pageMargin: "12mm",
    baseFontSize: "13px",
    title: `${t("title")} ${receiptNumber}`,
    body,
    extraStyles: `
      @page { size: A5; margin: 12mm; }
      .page { max-width: 600px; margin: 0 auto; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .section { margin-bottom: 20px; }
    `,
  });

  const pdf = await htmlToPdf(html, { preferCSSPageSize: true });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${receiptNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
