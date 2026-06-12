import { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getPdfLocaleContext } from "@/lib/pdf-i18n";
import { htmlToPdf } from "@/lib/pdf/render";
import { pdfFontFaceCss, PDF_FONT_STACK } from "@/lib/pdf/fonts";

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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

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
      },
    }),
    actor.organizationId
      ? prisma.organization.findUnique({
          where: { id: actor.organizationId },
          select: { name: true, phone: true, address: true, city: true, logo: true },
        })
      : Promise.resolve(null),
  ]);

  if (!payment) return new Response("Payment not found", { status: 404 });
  if (payment.tenant.organizationId !== actor.organizationId) {
    return new Response("Unauthorized", { status: 403 });
  }
  const amount = Number(payment.amount);

  // ── i18n ──────────────────────────────────────────────────────────────────
  const { locale, otherLocale, dir, fmtLong, fmtShort } = await getPdfLocaleContext();
  const t        = await getTranslations({ locale, namespace: "pdfs.receipt" });
  const tOther   = await getTranslations({ locale: otherLocale, namespace: "pdfs.receipt" });
  const tCommon  = await getTranslations({ locale, namespace: "pdfs.common" });
  const tMethods = await getTranslations({ locale, namespace: "payments.methods" });

  const isRtl = dir === "rtl";
  const secondaryDir = isRtl ? "ltr" : "rtl";

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

  // ── Section header helper ─────────────────────────────────────────────────
  const sectionHeader = (key: string) => `
    <div class="section-title">
      <span>${t(key)}</span>
      <span class="sec">${tOther(key)}</span>
    </div>`;

  // ── Invoice allocation rows ───────────────────────────────────────────────
  const allocationRows = payment.allocations.map((alloc) => {
    const inv = alloc.invoice;
    const isPaid = inv.status === "PAID";
    const statusBadge = isPaid
      ? `<span style="color:#15803d;font-weight:700">${t("statuses.paid")}</span>`
      : `<span style="color:#d97706;font-weight:700">${t("statuses.partial")}</span>`;

    return `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:12px">${inv.invoiceNumber}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280">${fmtPeriod(inv.periodStart, inv.periodEnd)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:${isRtl ? "left" : "right"};font-weight:600"><span class="ltr-num">${Number(alloc.amount).toFixed(3)}</span></td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:center">${statusBadge}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width"/>
  <title>${t("title")} ${receiptNumber}</title>
  <style>
    ${pdfFontFaceCss()}
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: ${PDF_FONT_STACK}; font-size:13px; color:#1a1a1a; background:#fff; }
    .page { max-width:600px; margin:0 auto; padding:32px; }

    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:20px; border-bottom:3px solid #1d4ed8; margin-bottom:24px; }
    .org-name { font-size:20px; font-weight:800; color:#1d4ed8; }
    .org-sub  { font-size:11px; color:#6b7280; margin-top:5px; line-height:1.7; }
    .doc-area { text-align:${isRtl ? "left" : "right"}; }
    .doc-title-primary   { font-size:15px; font-weight:700; color:#1d4ed8; letter-spacing:0.03em; }
    .doc-title-secondary { font-size:13px; color:#6b7280; margin-top:2px; direction:${secondaryDir}; }
    .receipt-num { font-size:17px; font-weight:800; font-family:monospace; color:#111827; margin-top:8px; direction:ltr; }

    .section { margin-bottom:20px; }
    .section-title {
      font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em;
      color:#6b7280; padding-bottom:6px; border-bottom:1px solid #e5e7eb;
      display:flex; justify-content:space-between; margin-bottom:10px;
    }
    .section-title .sec { font-size:11px; color:#9ca3af; text-transform:none; letter-spacing:0; direction:${secondaryDir}; }

    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .field-label { font-size:10px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:2px; }
    .field-label .sec { text-transform:none; letter-spacing:0; direction:${secondaryDir}; margin-${isRtl ? "right" : "left"}:4px; }
    .field-value { font-size:13px; color:#111827; font-weight:600; }

    .amount-box {
      background:#f0fdf4; border:2px solid #86efac; border-radius:10px;
      padding:14px 18px; display:flex; justify-content:space-between; align-items:center;
      margin:16px 0;
    }
    .amount-label { font-size:11px; color:#15803d; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; }
    .amount-value { font-size:22px; font-weight:800; color:#15803d; direction:ltr; }

    .words-box { background:#f9fafb; border-radius:8px; padding:12px 14px; margin-bottom:16px; border:1px solid #e5e7eb; }
    .words-primary   { font-size:12px; color:#374151; font-style:italic; }
    .words-secondary { font-size:12px; color:#374151; margin-top:4px; direction:${secondaryDir}; text-align:${isRtl ? "left" : "right"}; font-style:italic; }

    table { width:100%; border-collapse:collapse; }
    thead tr { background:#f9fafb; }
    th { text-align:${isRtl ? "right" : "left"}; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280; padding:8px 10px; border-bottom:2px solid #e5e7eb; }
    th.right { text-align:${isRtl ? "left" : "right"}; }
    th.center { text-align:center; }

    .footer { margin-top:28px; padding-top:16px; border-top:2px solid #e5e7eb; text-align:center; }
    .footer-thank-primary   { font-size:14px; font-weight:600; color:#374151; }
    .footer-thank-secondary { font-size:13px; color:#6b7280; margin-top:4px; direction:${secondaryDir}; }
    .footer-note { font-size:10px; color:#9ca3af; margin-top:10px; }

    .ltr-num { direction:ltr; unicode-bidi:embed; display:inline-block; }

    @page { size:A5; margin:12mm; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .page { padding:0; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="org-name">${orgName}</div>
      <div class="org-sub">
        ${org?.address ? `<div>${org.address}${org?.city ? `, ${org.city}` : ""}</div>` : ""}
        ${org?.phone ? `<div>${tCommon("tel")}: <span class="ltr-num">${org.phone}</span></div>` : ""}
      </div>
    </div>
    <div class="doc-area">
      <div class="doc-title-primary">${t("title")}</div>
      <div class="doc-title-secondary">${tOther("title")}</div>
      <div class="receipt-num">${receiptNumber}</div>
      <div class="footer-note" style="margin-top:6px">${todayStr}</div>
    </div>
  </div>

  <!-- RECEIPT META -->
  <div class="section">
    ${sectionHeader("sections.receiptDetails")}
    <div class="info-grid">
      <div>
        <div class="field-label">${t("fields.receiptNo")}<span class="sec">${tOther("fields.receiptNo")}</span></div>
        <div class="field-value" style="font-family:monospace">${receiptNumber}</div>
      </div>
      <div>
        <div class="field-label">${t("fields.date")}<span class="sec">${tOther("fields.date")}</span></div>
        <div class="field-value">${fmtLong(payment.date)}</div>
      </div>
      <div>
        <div class="field-label">${t("fields.receivedFrom")}<span class="sec">${tOther("fields.receivedFrom")}</span></div>
        <div class="field-value">${payment.tenant.firstName} ${payment.tenant.lastName}</div>
        ${payment.tenant.fullNameArabic ? `<div style="font-size:11px;color:#6b7280;direction:rtl">${payment.tenant.fullNameArabic}</div>` : ""}
      </div>
      <div>
        <div class="field-label">${t("fields.phone")}<span class="sec">${tOther("fields.phone")}</span></div>
        <div class="field-value"><span class="ltr-num">${payment.tenant.phone ?? tCommon("dash")}</span></div>
      </div>
    </div>
  </div>

  <!-- PAYMENT DETAILS -->
  <div class="section">
    ${sectionHeader("sections.paymentDetails")}
    <div class="amount-box">
      <div>
        <div class="amount-label">${t("fields.amount")}<span class="sec" style="text-transform:none;letter-spacing:0;direction:${secondaryDir};margin-${isRtl ? "right" : "left"}:4px">${tOther("fields.amount")}</span></div>
        <div style="font-size:11px;color:#15803d;margin-top:2px">${t("fields.method", { method: fmtMethod(payment.method) })}</div>
      </div>
      <div class="amount-value"><span class="ltr-num">${amount.toFixed(3)}</span> ${tCommon("omr")}</div>
    </div>
    ${payment.reference ? `
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#374151">
      <span style="color:#9ca3af">${t("fields.reference")} <span style="direction:${secondaryDir}">${tOther("fields.reference")}</span></span>
      <span style="font-weight:600">${payment.reference}</span>
    </div>` : ""}
    ${payment.notes ? `
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#374151">
      <span style="color:#9ca3af">${t("fields.notes")} <span style="direction:${secondaryDir}">${tOther("fields.notes")}</span></span>
      <span style="font-weight:600">${payment.notes}</span>
    </div>` : ""}
  </div>

  <!-- AMOUNT IN WORDS -->
  <div class="words-box">
    <div class="field-label" style="margin-bottom:6px">${t("sections.amountInWords")} <span class="sec">${tOther("sections.amountInWords")}</span></div>
    <div class="words-primary">${wordsPrimary}</div>
    <div class="words-secondary">${wordsSecondary}</div>
  </div>

  <!-- APPLIED TO -->
  ${payment.allocations.length > 0 ? `
  <div class="section">
    ${sectionHeader("sections.appliedTo")}
    <table>
      <thead>
        <tr>
          <th>${t("table.invoice")}</th>
          <th>${t("table.period")}</th>
          <th class="right">${t("table.applied")}</th>
          <th class="center">${t("table.status")}</th>
        </tr>
      </thead>
      <tbody>${allocationRows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;padding:8px 10px;font-size:13px;font-weight:700;border-top:2px solid #e5e7eb;margin-top:4px">
      <span>${t("totalApplied", { amount: amount.toFixed(3) })}</span>
    </div>
  </div>` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-thank-primary">${t("footer.thankYou")}</div>
    <div class="footer-thank-secondary">${tOther("footer.thankYou")}</div>
    <div class="footer-note">${t("footer.computerGenerated")} | <span style="direction:${secondaryDir}">${tOther("footer.computerGenerated")}</span></div>
    ${payment.receivedBy ? `<div class="footer-note">${t("footer.recordedBy", { name: `${payment.receivedBy.firstName ?? ""} ${payment.receivedBy.lastName ?? ""}`.trim() })}</div>` : ""}
  </div>

</div>
</body>
</html>`;

  const pdf = await htmlToPdf(html, { preferCSSPageSize: true });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${receiptNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
