import { NextRequest, NextResponse } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { requireOrgUser } from "@/lib/tenant";
import { forbiddenIfNo } from "@/lib/access";
import { getBankStatement } from "@/lib/bank-statement";
import { htmlToPdf } from "@/lib/pdf/render";
import { pdfFontFaceCss } from "@/lib/pdf/fonts";
import { getPdfBranding, brandRootCss, logoHtml, footerLine } from "@/lib/pdf/branding";

// Headless Chromium needs the Node runtime.
export const runtime = "nodejs";

function parseDate(s: string | null, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

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
  const t = await getTranslations("settings.banks.statement");
  const branding = await getPdfBranding(orgUser.organizationId);

  const cur = stmt.account.currency;
  const money = (n: number) => `${n.toFixed(3)} ${cur}`;
  const fmtD = (iso: string) => format(new Date(iso), "d MMM yyyy");
  const typeLabel = (ty: string) => (t.has(`types.${ty}`) ? t(`types.${ty}`) : ty);

  const rowsHtml = stmt.rows.map((r) => `
    <tr>
      <td>${fmtD(r.date)}</td>
      <td>${esc(typeLabel(r.type))}</td>
      <td>${esc(r.description ?? "—")}</td>
      <td class="num">${r.amount > 0 ? money(r.amount) : ""}</td>
      <td class="num neg">${r.amount < 0 ? money(Math.abs(r.amount)) : ""}</td>
      <td class="num bold">${money(r.balance)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html dir="${isAr ? "rtl" : "ltr"}" lang="${locale}"><head><meta charset="utf-8">
  <style>
    ${pdfFontFaceCss()}
    ${brandRootCss(branding)}
    * { box-sizing: border-box; }
    body { font-family: 'Inter','Cairo',sans-serif; color:#1f2937; font-size:12px; margin:0; padding:28px; }
    .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid var(--brand); padding-bottom:14px; margin-bottom:16px; }
    .title { font-size:18px; font-weight:700; color:var(--brand); }
    .sub { font-size:11px; color:#6b7280; margin-top:4px; }
    .summary { display:flex; gap:10px; margin-bottom:14px; }
    .box { flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:8px 10px; }
    .box .l { font-size:9px; text-transform:uppercase; letter-spacing:.05em; color:#9ca3af; }
    .box .v { font-size:14px; font-weight:600; margin-top:2px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#f9fafb; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; color:#6b7280; text-align:start; padding:7px 8px; border-bottom:1px solid #e5e7eb; }
    td { padding:7px 8px; border-bottom:1px solid #f3f4f6; }
    .num { text-align:end; direction:ltr; } .neg { color:#dc2626; } .bold { font-weight:600; }
    tfoot td { font-weight:700; background:#f9fafb; border-top:2px solid #e5e7eb; }
    .footer { margin-top:20px; font-size:9px; color:#9ca3af; text-align:center; }
  </style></head><body>
    <div class="head">
      <div>
        <div class="title">${esc(stmt.account.bankName)}${stmt.account.label ? " — " + esc(stmt.account.label) : ""}</div>
        <div class="sub">${t("title")}${stmt.account.accountNumber ? " · " + esc(stmt.account.accountNumber) : ""}</div>
        <div class="sub">${fmtD(stmt.from)} – ${fmtD(stmt.to)}</div>
      </div>
      ${logoHtml(branding, { height: 36 })}
    </div>
    <div class="summary">
      <div class="box"><div class="l">${t("opening")}</div><div class="v">${money(stmt.openingBalance)}</div></div>
      <div class="box"><div class="l">${t("totalIn")}</div><div class="v" style="color:#15803d">${money(stmt.totalIn)}</div></div>
      <div class="box"><div class="l">${t("totalOut")}</div><div class="v" style="color:#dc2626">${money(stmt.totalOut)}</div></div>
      <div class="box"><div class="l">${t("closing")}</div><div class="v">${money(stmt.closingBalance)}</div></div>
    </div>
    <table>
      <thead><tr>
        <th>${t("col.date")}</th><th>${t("col.type")}</th><th>${t("col.description")}</th>
        <th class="num">${t("col.in")}</th><th class="num">${t("col.out")}</th><th class="num">${t("col.balance")}</th>
      </tr></thead>
      <tbody>
        <tr><td colspan="5" style="color:#6b7280">${t("openingRow")}</td><td class="num bold">${money(stmt.openingBalance)}</td></tr>
        ${rowsHtml || `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:24px">${t("empty")}</td></tr>`}
      </tbody>
      <tfoot><tr>
        <td colspan="3">${t("closing")}</td>
        <td class="num" style="color:#15803d">${money(stmt.totalIn)}</td>
        <td class="num neg">${money(stmt.totalOut)}</td>
        <td class="num">${money(stmt.closingBalance)}</td>
      </tr></tfoot>
    </table>
    <div class="footer">${esc(footerLine(branding, isAr, ""))}</div>
  </body></html>`;

  const pdf = await htmlToPdf(html, { preferCSSPageSize: true });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bank-statement-${stmt.account.bankName.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
