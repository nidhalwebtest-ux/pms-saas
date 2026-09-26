import { NextRequest, NextResponse } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { requireOrgUser } from "@/lib/tenant";
import { forbiddenIfNo } from "@/lib/access";
import { getBankStatement } from "@/lib/bank-statement";
import { htmlToPdf } from "@/lib/pdf/render";
import { getPdfBranding, footerLine } from "@/lib/pdf/branding";
import { escHtml } from "@/lib/pdf/html";
import {
  renderPdfDocument,
  renderPdfHeader,
  renderGrid,
  renderLabeledBox,
  renderTable,
  renderPdfFooter,
  buildPageNumberFooterTemplate,
  type PdfTableRow,
} from "@/lib/pdf/shell";

// Headless Chromium needs the Node runtime.
export const runtime = "nodejs";

function parseDate(s: string | null, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await forbiddenIfNo("banks", "VIEW");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const now = new Date();
  const from = parseDate(sp.get("from"), new Date(now.getFullYear(), now.getMonth(), 1));
  const to = parseDate(sp.get("to"), now);
  to.setHours(23, 59, 59, 999);

  const stmt = await getBankStatement({ orgId: orgUser.organizationId, bankAccountId: id, from, to });
  if (!stmt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const locale = await getLocale();
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const t = await getTranslations("settings.banks.statement");
  const brand = await getPdfBranding(orgUser.organizationId);

  const cur = stmt.account.currency;
  const money = (n: number) => `${n.toFixed(3)} ${cur}`;
  const fmtD = (iso: string) => format(new Date(iso), "d MMM yyyy");
  const typeLabel = (ty: string) => (t.has(`types.${ty}`) ? t(`types.${ty}`) : ty);

  const rows: PdfTableRow[] = stmt.rows.map((r) => ({
    cells: [
      `<span class="ltr-numbers">${escHtml(fmtD(r.date))}</span>`,
      escHtml(typeLabel(r.type)),
      escHtml(r.description ?? "—"),
      r.amount > 0 ? `<span class="ltr-numbers" style="color:#15803d">${escHtml(money(r.amount))}</span>` : "",
      r.amount < 0 ? `<span class="ltr-numbers" style="color:#dc2626">${escHtml(money(Math.abs(r.amount)))}</span>` : "",
      `<span class="ltr-numbers" style="font-weight:600">${escHtml(money(r.balance))}</span>`,
    ],
  }));

  const openingRow: PdfTableRow = {
    cells: [
      { content: `<span style="color:#6b7280">${escHtml(t("openingRow"))}</span>`, colSpan: 5 },
      `<span class="ltr-numbers" style="font-weight:600">${escHtml(money(stmt.openingBalance))}</span>`,
    ],
  };

  const emptyRow: PdfTableRow = {
    cells: [{ content: `<span style="text-align:center;display:block;color:#9ca3af;padding:24px 0">${escHtml(t("empty"))}</span>`, colSpan: 6 }],
  };

  const header = renderPdfHeader({
    brand,
    orgName: `${stmt.account.bankName}${stmt.account.label ? " — " + stmt.account.label : ""}`,
    orgAddressLines: [
      `${t("title")}${stmt.account.accountNumber ? " · " + stmt.account.accountNumber : ""}`,
      `${fmtD(stmt.from)} – ${fmtD(stmt.to)}`,
    ],
    docTitle: t("title"),
    metaRows: [],
  });

  const summaryGrid = renderGrid(4, [
    renderLabeledBox({ variant: "highlight", fields: [{ label: t("opening"), value: money(stmt.openingBalance), ltrNumbers: true }] }),
    `<div class="labeled-box highlight"><div class="box-title">${escHtml(t("totalIn"))}</div><div style="font-size:18px;font-weight:800;color:#15803d" class="ltr-numbers">${escHtml(money(stmt.totalIn))}</div></div>`,
    `<div class="labeled-box highlight"><div class="box-title">${escHtml(t("totalOut"))}</div><div style="font-size:18px;font-weight:800;color:#dc2626" class="ltr-numbers">${escHtml(money(stmt.totalOut))}</div></div>`,
    renderLabeledBox({ variant: "highlight", fields: [{ label: t("closing"), value: money(stmt.closingBalance), ltrNumbers: true }] }),
  ]);

  const table = renderTable({
    columns: [
      { header: t("col.date"), align: "start" },
      { header: t("col.type"), align: "start" },
      { header: t("col.description"), align: "start" },
      { header: t("col.in") },
      { header: t("col.out") },
      { header: t("col.balance") },
    ],
    rows: [openingRow, ...(rows.length > 0 ? rows : [emptyRow])],
    zebra: true,
    footerRow: {
      cells: [
        { content: escHtml(t("closing")), colSpan: 3 },
        `<span class="ltr-numbers" style="color:#15803d">${escHtml(money(stmt.totalIn))}</span>`,
        `<span class="ltr-numbers" style="color:#dc2626">${escHtml(money(stmt.totalOut))}</span>`,
        `<span class="ltr-numbers">${escHtml(money(stmt.closingBalance))}</span>`,
      ],
    },
  });

  const footer = renderPdfFooter({ primaryLine: footerLine(brand, isAr, "") });

  const body = `
  ${header}
  <div class="body" style="padding:20px 0 0">
    <div style="margin-bottom:16px">${summaryGrid}</div>
    ${table}
  </div>
  ${footer}`;

  const html = renderPdfDocument({
    lang: locale,
    dir,
    brand,
    pageMargin: "10mm",
    baseFontSize: "12px",
    title: `${t("title")} — ${stmt.account.bankName}`,
    body,
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
      "Content-Disposition": `inline; filename="bank-statement-${stmt.account.bankName.replace(/\s+/g, "-")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
