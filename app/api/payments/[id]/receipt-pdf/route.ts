import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

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

  // ── Formatters ────────────────────────────────────────────────────────────
  function fmtDate(d: Date | string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
  }
  function fmtPeriod(start: Date | null, end: Date | null) {
    if (!start || !end) return "";
    const s = new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const e = new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return `${s} – ${e}`;
  }
  function fmtMethod(m: string) {
    const map: Record<string, string> = {
      CASH: "Cash / نقداً",
      CARD: "Card / بطاقة",
      BANK_TRANSFER: "Bank Transfer / تحويل بنكي",
      CHEQUE: "Cheque / شيك",
      ONLINE: "Online / إلكتروني",
      OTHER: "Other / أخرى",
    };
    return map[m] ?? m;
  }

  const today = fmtDate(new Date());
  const receiptNumber = payment.paymentNumber ?? `PAY-${payment.id.slice(0, 8).toUpperCase()}`;

  // ── Invoice allocation rows ───────────────────────────────────────────────
  const allocationRows = payment.allocations.map((alloc) => {
    const inv = alloc.invoice;
    const isPaid = inv.status === "PAID";
    const statusBadge = isPaid
      ? `<span style="color:#15803d;font-weight:700">PAID ✓</span>`
      : `<span style="color:#d97706;font-weight:700">Partial</span>`;

    return `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:12px">${inv.invoiceNumber}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280">${fmtPeriod(inv.periodStart, inv.periodEnd)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600">${Number(alloc.amount).toFixed(3)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:center">${statusBadge}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width"/>
  <title>Receipt ${receiptNumber}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size:13px; color:#1a1a1a; background:#fff; }
    .page { max-width:600px; margin:0 auto; padding:32px; }

    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:20px; border-bottom:3px solid #1d4ed8; margin-bottom:24px; }
    .org-name { font-size:20px; font-weight:800; color:#1d4ed8; }
    .org-sub  { font-size:11px; color:#6b7280; margin-top:5px; line-height:1.7; }
    .doc-area { text-align:right; }
    .doc-title-en { font-size:15px; font-weight:700; color:#1d4ed8; letter-spacing:0.03em; }
    .doc-title-ar { font-size:13px; color:#6b7280; margin-top:2px; direction:rtl; }
    .receipt-num  { font-size:17px; font-weight:800; font-family:monospace; color:#111827; margin-top:8px; }

    .section { margin-bottom:20px; }
    .section-title {
      font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em;
      color:#6b7280; padding-bottom:6px; border-bottom:1px solid #e5e7eb;
      display:flex; justify-content:space-between; margin-bottom:10px;
    }
    .section-title .ar { font-size:11px; color:#9ca3af; text-transform:none; letter-spacing:0; direction:rtl; }

    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .field-label { font-size:10px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:2px; }
    .field-value { font-size:13px; color:#111827; font-weight:600; }

    .amount-box {
      background:#f0fdf4; border:2px solid #86efac; border-radius:10px;
      padding:14px 18px; display:flex; justify-content:space-between; align-items:center;
      margin:16px 0;
    }
    .amount-label { font-size:11px; color:#15803d; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; }
    .amount-value { font-size:22px; font-weight:800; color:#15803d; }

    .words-box { background:#f9fafb; border-radius:8px; padding:12px 14px; margin-bottom:16px; border:1px solid #e5e7eb; }
    .words-en  { font-size:12px; color:#374151; font-style:italic; }
    .words-ar  { font-size:12px; color:#374151; margin-top:4px; direction:rtl; text-align:right; font-style:italic; }

    table { width:100%; border-collapse:collapse; }
    thead tr { background:#f9fafb; }
    th { text-align:left; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280; padding:8px 10px; border-bottom:2px solid #e5e7eb; }
    th.right { text-align:right; }
    th.center { text-align:center; }

    .footer { margin-top:28px; padding-top:16px; border-top:2px solid #e5e7eb; text-align:center; }
    .footer-thank-en { font-size:14px; font-weight:600; color:#374151; }
    .footer-thank-ar { font-size:13px; color:#6b7280; margin-top:4px; direction:rtl; }
    .footer-note { font-size:10px; color:#9ca3af; margin-top:10px; }

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
      <div class="org-name">${org?.name ?? "Property Management"}</div>
      <div class="org-sub">
        ${org?.address ? `<div>${org.address}${org?.city ? `, ${org.city}` : ""}</div>` : ""}
        ${org?.phone ? `<div>Tel: ${org.phone}</div>` : ""}
      </div>
    </div>
    <div class="doc-area">
      <div class="doc-title-en">RECEIPT</div>
      <div class="doc-title-ar">إيصال دفع</div>
      <div class="receipt-num">${receiptNumber}</div>
    </div>
  </div>

  <!-- RECEIPT META -->
  <div class="section">
    <div class="section-title">
      <span>Receipt Details</span>
      <span class="ar">تفاصيل الإيصال</span>
    </div>
    <div class="info-grid">
      <div>
        <div class="field-label">Receipt No / رقم الإيصال</div>
        <div class="field-value" style="font-family:monospace">${receiptNumber}</div>
      </div>
      <div>
        <div class="field-label">Date / التاريخ</div>
        <div class="field-value">${fmtDate(payment.date)}</div>
      </div>
      <div>
        <div class="field-label">Received From / المستأجر</div>
        <div class="field-value">${payment.tenant.firstName} ${payment.tenant.lastName}</div>
        ${payment.tenant.fullNameArabic ? `<div style="font-size:11px;color:#6b7280;direction:rtl">${payment.tenant.fullNameArabic}</div>` : ""}
      </div>
      <div>
        <div class="field-label">Phone / الهاتف</div>
        <div class="field-value">${payment.tenant.phone ?? "—"}</div>
      </div>
    </div>
  </div>

  <!-- PAYMENT DETAILS -->
  <div class="section">
    <div class="section-title">
      <span>Payment Details</span>
      <span class="ar">تفاصيل الدفع</span>
    </div>
    <div class="amount-box">
      <div>
        <div class="amount-label">Amount / المبلغ</div>
        <div style="font-size:11px;color:#15803d;margin-top:2px">Method: ${fmtMethod(payment.method)}</div>
      </div>
      <div class="amount-value">${amount.toFixed(3)} OMR</div>
    </div>
    ${payment.reference ? `
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#374151">
      <span style="color:#9ca3af">Reference / المرجع:</span>
      <span style="font-weight:600">${payment.reference}</span>
    </div>` : ""}
    ${payment.notes ? `
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#374151">
      <span style="color:#9ca3af">Notes / ملاحظات:</span>
      <span style="font-weight:600">${payment.notes}</span>
    </div>` : ""}
  </div>

  <!-- AMOUNT IN WORDS -->
  <div class="words-box">
    <div class="field-label" style="margin-bottom:6px">Amount in Words / المبلغ كتابةً</div>
    <div class="words-en">${amountToWordsEn(amount)}</div>
    <div class="words-ar">${amountToWordsAr(amount)}</div>
  </div>

  <!-- APPLIED TO -->
  ${payment.allocations.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span>Applied To</span>
      <span class="ar">طُبّق على</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Invoice #</th>
          <th>Period</th>
          <th class="right">Applied (OMR)</th>
          <th class="center">Status</th>
        </tr>
      </thead>
      <tbody>${allocationRows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;padding:8px 10px;font-size:13px;font-weight:700;border-top:2px solid #e5e7eb;margin-top:4px">
      <span>Total Applied: ${amount.toFixed(3)} OMR</span>
    </div>
  </div>` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-thank-en">Thank you for your payment</div>
    <div class="footer-thank-ar">شكراً لكم على الدفع</div>
    <div class="footer-note">Computer-generated receipt | إيصال صادر بواسطة النظام</div>
    ${payment.receivedBy ? `<div class="footer-note">Recorded by: ${payment.receivedBy.firstName ?? ""} ${payment.receivedBy.lastName ?? ""}</div>` : ""}
  </div>

</div>
<script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
