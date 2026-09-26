import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { verifyShareFromRequest } from "@/lib/share-token";
import { getDisplayStatus, type StoredStatus } from "@/lib/reservation-status";
import { DISPLAY_STATUS_KEY, getPdfLocaleContext } from "@/lib/pdf-i18n";
import { htmlToPdf } from "@/lib/pdf/render";
import { getPdfBranding } from "@/lib/pdf/branding";
import { escHtml } from "@/lib/pdf/html";
import {
  renderPdfDocument,
  renderPdfHeader,
  renderStatusPill,
  renderSectionLabel,
  renderGrid,
  renderFieldStacked,
  renderTable,
  renderTotalsBox,
  renderSignatureBlock,
  renderPdfFooter,
  type StatusTone,
  type PdfTableRow,
} from "@/lib/pdf/shell";

// Headless Chromium needs the Node runtime (not edge); allow time for cold-start launch.
export const runtime = "nodejs";
export const maxDuration = 60;

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, organizationId: true, organization: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Access via a signed public share link (?t=) OR an authenticated session.
  const share = verifyShareFromRequest(req, "reservation", id);
  let organizationId: string;
  let organization: NonNullable<Awaited<ReturnType<typeof getActor>>>["organization"] | null;
  if (share) {
    organizationId = share.org;
    organization = await prisma.organization.findUnique({ where: { id: share.org } });
    if (!organization) return new Response("Unauthorized", { status: 401 });
  } else {
    const actor = await getActor();
    if (!actor) return NextResponse.redirect("/login");
    organizationId = actor.organizationId!;
    organization = actor.organization;
  }

  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant: true,
      unit: { include: { property: { select: { id: true, name: true } } } },
      reservationUnits: {
        include: {
          unit: { include: { property: { select: { id: true, name: true } } } },
        },
      },
      payments: { orderBy: { date: "asc" } },
      charges: true,
    },
  });

  if (!r || r.tenant.organizationId !== organizationId) {
    return new Response("Reservation not found", { status: 404 });
  }

  const org = organization;
  const brand = await getPdfBranding(organizationId);
  const ds  = getDisplayStatus(r.status as StoredStatus, r.startDate, r.endDate);

  // ── i18n ──────────────────────────────────────────────────────────────────
  const { locale, otherLocale, dir, fmtFull, fmtLong } = await getPdfLocaleContext();
  const t       = await getTranslations({ locale, namespace: "pdfs.reservation" });
  const tOther  = await getTranslations({ locale: otherLocale, namespace: "pdfs.reservation" });
  const tCommon = await getTranslations({ locale, namespace: "pdfs.common" });
  const tStatus = await getTranslations({ locale, namespace: "reservations.statuses" });
  const tUnitTypes = await getTranslations({ locale, namespace: "reservations.detail.unitTypes" });

  const isRtl = dir === "rtl";

  // ── Merge units (legacy + junction table) ─────────────────────────────────
  const seen = new Set<string>();
  const units: {
    name: string; unitType: string; propertyName: string;
    rateAmount: string; nights: number; subtotal: string;
    rateType: string; seasonalPriceName: string | null;
  }[] = [];

  if (r.unit) {
    const ru = r.reservationUnits.find((x) => x.unitId === r.unit!.id);
    seen.add(r.unit.id);
    units.push({
      name: r.unit.name, unitType: r.unit.unitType,
      propertyName: r.unit.property.name,
      rateAmount: ru ? ru.rateAmount.toString() : "0",
      nights: ru?.nights ?? r.totalNights,
      subtotal: ru ? ru.subtotal.toString() : Number(r.grandTotal).toFixed(3),
      rateType: ru?.rateType ?? r.rateType,
      seasonalPriceName: ru?.seasonalPriceName ?? null,
    });
  }
  for (const ru of r.reservationUnits) {
    if (!seen.has(ru.unitId)) {
      seen.add(ru.unitId);
      units.push({
        name: ru.unit.name, unitType: ru.unit.unitType,
        propertyName: ru.unit.property.name,
        rateAmount: ru.rateAmount.toString(), nights: ru.nights,
        subtotal: ru.subtotal.toString(), rateType: ru.rateType,
        seasonalPriceName: ru.seasonalPriceName,
      });
    }
  }

  const grandTotal   = Number(r.grandTotal ?? r.totalPrice ?? 0);
  const amountPaid   = Number(r.amountPaid ?? 0);
  const balanceDue   = Math.max(0, grandTotal - amountPaid);
  const isPaid       = balanceDue === 0;

  const fmtUnitType = (type: string) =>
    tUnitTypes.has(type) ? tUnitTypes(type) : type;

  const today = fmtLong(new Date());
  const orgName = org?.name ?? t("defaultOrgName");

  const statusKey = DISPLAY_STATUS_KEY[ds.label];
  const statusLabel = tStatus.has(statusKey) ? tStatus(statusKey) : ds.label;

  const statusTone: StatusTone =
    r.status === "CHECKED_IN" || r.status === "CONFIRMED" ? "success" :
    r.status === "COMPLETED"  ? "info" :
    r.status === "CANCELLED"  ? "danger" : "neutral";

  const durationLabel = r.rateType === "monthly"
    ? t("duration.months", { count: Math.round(r.totalNights / 30) })
    : t("duration.nights", { count: r.totalNights });

  const rateTypeLabel = r.rateType === "monthly"
    ? t("rateTypes.monthly")
    : t("rateTypes.daily");

  const nightsOrMonthsHeader = r.rateType === "monthly"
    ? t("table.months")
    : t("table.nights");

  // ── Unit rows ────────────────────────────────────────────────────────────
  const unitRows: PdfTableRow[] = units.map((u) => ({
    cells: [
      `<strong>${escHtml(u.name)}</strong>`,
      escHtml(u.propertyName),
      escHtml(fmtUnitType(u.unitType)),
      `<span class="ltr-numbers">${Number(u.rateAmount).toFixed(3)}</span>${u.seasonalPriceName ? `<br/><span style="font-size:10px;color:#d97706">${escHtml(u.seasonalPriceName)}</span>` : ""}`,
      `<span class="ltr-numbers">${u.nights}</span>`,
      `<span class="ltr-numbers" style="font-weight:700">${Number(u.subtotal).toFixed(3)}</span>`,
    ],
  }));

  // ── Payment rows ─────────────────────────────────────────────────────────
  const tMethods = await getTranslations({ locale, namespace: "payments.methods" });
  const fmtMethod = (m: string) => (tMethods.has(m) ? tMethods(m) : m);

  const paymentRows = r.payments.map((p) => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#374151">
      <span>${escHtml(fmtLong(p.date))} — ${escHtml(fmtMethod(p.method))}${p.reference ? ` <span style="color:#9ca3af">(${escHtml(p.reference)})</span>` : ""}</span>
      <span class="ltr-numbers">${Number(p.amount).toFixed(3)}</span>
    </div>`).join("");

  // ── Charge rows ──────────────────────────────────────────────────────────
  const chargeRows = r.charges.length > 0 ? r.charges.map((c) => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#374151">
      <span style="color:#d97706">${escHtml(c.description)}</span>
      <span class="ltr-numbers">+${Number(c.amount).toFixed(3)}</span>
    </div>`).join("") : "";

  // ── Header ───────────────────────────────────────────────────────────────
  // The original design shows the reservation number as a large monospace
  // figure and the "printed on" date as a small caption below the meta
  // table, not as ordinary label:value rows — passed via metaExtra since
  // that layout is visually distinct from a normal meta row.
  const resNumberBlock = `
    <div style="font-size:20px;font-weight:800;font-family:monospace;color:#111827;margin-top:10px" class="ltr-numbers">${escHtml(r.reservationNumber ?? r.id.slice(0, 8).toUpperCase())}</div>
    <div style="font-size:11px;color:#9ca3af;margin-top:3px">${escHtml(t("printedOn", { date: today }))}</div>`;

  const header = renderPdfHeader({
    brand,
    orgName,
    orgAddressLines: [
      org?.address ? `${org.address}${org?.city ? `, ${org.city}` : ""}` : "",
      org?.phone ? `${tCommon("tel")}: ${org.phone}` : "",
    ].filter(Boolean),
    docTitle: t("title"),
    metaRows: [],
    metaExtra: resNumberBlock,
    statusPill: { label: statusLabel, tone: statusTone },
  });

  // ── Guest info / stay details (4-col grids) ─────────────────────────────
  const guestInfoGrid = renderGrid(4, [
    renderFieldStacked({ dir, label: t("fields.fullName"), value: `${r.tenant.firstName} ${r.tenant.lastName}`, valueSub: r.tenant.fullNameArabic ?? undefined }),
    renderFieldStacked({ dir, label: t("fields.phone"), value: r.tenant.phone, ltrNumbers: true, valueSub: r.tenant.whatsappNumber ? t("whatsapp", { number: r.tenant.whatsappNumber }) : undefined }),
    renderFieldStacked({ dir, label: t("fields.idDocument"), value: `${r.tenant.idType?.toUpperCase() ?? "ID"}: ${r.tenant.idNumber ?? tCommon("dash")}` }),
    renderFieldStacked({ dir, label: t("fields.nationality"), value: r.tenant.nationality ?? tCommon("dash") }),
  ]);

  const stayDetailsGrid = renderGrid(4, [
    renderFieldStacked({ dir, label: t("fields.checkIn"), value: fmtFull(r.startDate), valueSub: r.actualCheckIn ? t("actual", { date: fmtFull(r.actualCheckIn) }) : undefined }),
    renderFieldStacked({ dir, label: t("fields.checkOut"), value: fmtFull(r.endDate), valueSub: r.actualCheckOut ? t("actual", { date: fmtFull(r.actualCheckOut) }) : undefined }),
    renderFieldStacked({ dir, label: t("fields.duration"), value: durationLabel }),
    renderFieldStacked({ dir, label: t("fields.rateType"), value: rateTypeLabel }),
  ]);

  const unitsTable = renderTable({
    columns: [
      { header: t("table.unit"), align: "start" },
      { header: t("table.property"), align: "start" },
      { header: t("table.type"), align: "start" },
      { header: t("table.rate") },
      { header: nightsOrMonthsHeader },
      { header: t("table.subtotal") },
    ],
    rows: unitRows,
  });

  // ── Financial summary ────────────────────────────────────────────────────
  const financialRows = units.map((u) => `
    <div class="totals-row"><span style="color:#6b7280">${escHtml(u.name)}: <span class="ltr-numbers">${u.nights} × ${Number(u.rateAmount).toFixed(3)}</span></span><span class="ltr-numbers">${Number(u.subtotal).toFixed(3)}</span></div>`).join("");

  const financialSummary = `
    <div style="max-width:360px;margin-${isRtl ? "right" : "left"}:auto">
      ${financialRows}
      ${chargeRows ? `<div style="font-size:10px;color:#d97706;text-transform:uppercase;letter-spacing:0.06em;margin-top:8px;margin-bottom:4px">${escHtml(t("extraCharges"))}</div>${chargeRows}` : ""}
      ${Number(r.discountAmount) > 0 ? `<div class="totals-row"><span>${escHtml(t("discount"))}</span><span class="tone-positive ltr-numbers">-${Number(r.discountAmount).toFixed(3)}</span></div>` : ""}
      <div class="totals-row tone-grand"><span>${escHtml(t("grandTotal"))}</span><span class="ltr-numbers">${escHtml(t("grandTotalAmount", { amount: grandTotal.toFixed(3) }))}</span></div>
      ${r.payments.length > 0 ? `
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-top:16px;margin-bottom:6px">${escHtml(t("paymentsReceived"))}</div>
        ${paymentRows}
        <div class="totals-row" style="border-top:1px dashed #e5e7eb;padding-top:6px;margin-top:4px;font-weight:600"><span>${escHtml(t("totalPaid"))}</span><span class="ltr-numbers">${escHtml(t("totalPaidAmount", { amount: amountPaid.toFixed(3) }))}</span></div>` : ""}
      ${renderTotalsBox({
        rows: [{
          label: isPaid ? t("fullyPaid") : t("balanceDue"),
          value: isPaid ? t("grandTotalAmount", { amount: "0.000" }) : t("grandTotalAmount", { amount: balanceDue.toFixed(3) }),
          tone: isPaid ? "positive" : "negative",
          ltrNumbers: true,
        }],
      })}
    </div>`;

  const notesSection = brand.showNotes && r.notes
    ? `<div class="section">${renderSectionLabel(t("sections.notes"))}<p style="font-size:12px;color:#374151;line-height:1.6">${escHtml(r.notes)}</p></div>`
    : "";

  const signatureSection = brand.showSignature
    ? renderSignatureBlock({
        lines: [
          { label: `${t("signatures.authorizedBy")} ________________________` },
          { label: `${t("signatures.guestSignature")} ________________________` },
        ],
      })
    : "";

  const footerPrimaryText = (isRtl ? (brand.footerTextAr || brand.footerText) : brand.footerText)?.trim();
  const footer = renderPdfFooter({
    primaryLine: footerPrimaryText || t("footer.thankYou", { name: org?.name ?? t("defaultPropertyDescription") }),
    secondaryLine: footerPrimaryText ? undefined : tOther("footer.thankYou", { name: org?.name ?? tOther("defaultPropertyDescription") }),
  });

  const body = `
  ${header}
  <div class="body" style="padding:28px 0 0">
    <div class="section">${renderSectionLabel(t("sections.guestInfo"), tOther("sections.guestInfo"))}${guestInfoGrid}</div>
    <div class="section">${renderSectionLabel(t("sections.stayDetails"), tOther("sections.stayDetails"))}${stayDetailsGrid}</div>
    <div class="section">${renderSectionLabel(t("sections.units"), tOther("sections.units"))}${unitsTable}</div>
    <div class="section">${renderSectionLabel(t("sections.financialSummary"), tOther("sections.financialSummary"))}${financialSummary}</div>
    ${notesSection}
    ${signatureSection}
  </div>
  ${footer}`;

  const html = renderPdfDocument({
    lang: locale,
    dir,
    brand,
    pageMargin: "15mm",
    baseFontSize: "12px",
    title: `${t("title")} ${r.reservationNumber ?? r.id.slice(0, 8)} — ${org?.name ?? ""}`,
    body,
  });

  const pdf = await htmlToPdf(html, { preferCSSPageSize: true });
  const fileName = `reservation-${r.reservationNumber ?? r.id.slice(0, 8)}.pdf`;

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline → opens in the browser's PDF viewer (the UI opens it in a new tab)
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
