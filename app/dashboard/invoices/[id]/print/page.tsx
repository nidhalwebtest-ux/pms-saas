import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { getTranslations, getLocale } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PriceSegment {
  days?: number;
  nights?: number;
  label: string;
  rate?: number;
  subtotal: number;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let orgUser: Awaited<ReturnType<typeof requireOrgUser>>;
  try {
    orgUser = await requireOrgUser();
  } catch {
    redirect("/login");
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      tenant: true,
      reservation: {
        include: {
          reservationUnits: { include: { unit: true } },
        },
      },
      property: true,
      lineItems: {
        include: { unit: true },
        orderBy: { sortOrder: "asc" },
      },
      allocations: {
        include: {
          payment: {
            select: {
              id: true, date: true, method: true,
              reference: true, amount: true, isRefund: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      organization: true,
    },
  });

  if (!invoice || invoice.organizationId !== orgUser.organizationId) {
    notFound();
  }

  // ── i18n ──────────────────────────────────────────────────────────────────────
  const locale  = await getLocale();
  const isAr    = locale === "ar";
  const dfLoc   = isAr ? arLocale : enLocale;
  const tPrint  = await getTranslations("invoices.print");
  const tStatus = await getTranslations("invoices.statuses");
  const tMethod = await getTranslations("invoices.paymentMethods");

  const fmtDate = (d: Date | string) =>
    format(new Date(d), "d MMM yyyy", { locale: dfLoc });

  const tryT = (fn: (k: string) => string, key: string, fallback?: string): string => {
    try { return fn(key); } catch { return fallback ?? key; }
  };

  const methodLabel = (m: string) => tryT(tMethod, m, m.toLowerCase().replace("_", " "));

  const org = invoice.organization;
  const tenant = invoice.tenant;
  const reservation = invoice.reservation;

  const totalAmount = Number(invoice.totalAmount);
  const amountPaid  = Number(invoice.amountPaid);
  const balanceDue  = Number(invoice.balanceDue);
  const subtotal    = Number(invoice.subtotal);
  const discount    = Number(invoice.discountAmount);
  const tax         = Number(invoice.taxAmount);

  const isPaid = invoice.status === "PAID" || balanceDue <= 0;
  const isOverdue =
    (invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") &&
    new Date(invoice.dueDate) < new Date();

  // Calc nights
  const nights = Math.round(
    (new Date(reservation.endDate).getTime() - new Date(reservation.startDate).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  const statusKey: Record<string, string> = {
    DRAFT:          "draft",
    ISSUED:         "issued",
    PARTIALLY_PAID: "partiallyPaid",
    PAID:           "paid",
    CANCELLED:      "cancelled",
  };
  const statusLabel = tryT(tStatus, statusKey[invoice.status] ?? invoice.status, invoice.status);

  const statusBarKey =
    isPaid ? "paid" :
    isOverdue ? "overdue" :
    invoice.status === "PARTIALLY_PAID" ? "partial" :
    invoice.status === "ISSUED" ? "issued" :
    invoice.status === "DRAFT" ? "draft" :
    invoice.status === "CANCELLED" ? "cancelled" : "issued";

  const statusBarClass =
    isPaid ? "paid" :
    isOverdue ? "overdue" :
    invoice.status === "PARTIALLY_PAID" ? "partial" :
    invoice.status === "ISSUED" ? "issued" :
    invoice.status === "DRAFT" ? "draft" :
    invoice.status === "CANCELLED" ? "cancelled" : "issued";

  const dirAttr = isAr ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dirAttr}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{tPrint("title", { number: invoice.invoiceNumber })}</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body {
                font-family: ${isAr
                  ? "'Tajawal','Cairo','Segoe UI',Tahoma,sans-serif"
                  : "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"};
                font-size: 13px;
                color: #1f2937;
                background: #f9fafb;
                direction: ${dirAttr};
              }
              .ltr-numbers { direction: ltr; unicode-bidi: embed; display: inline-block; }
              .page {
                max-width: 800px;
                margin: 24px auto;
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.10);
                overflow: hidden;
              }
              .print-button {
                display: flex;
                justify-content: flex-end;
                padding: 16px 32px 0;
              }
              .print-button button {
                background: #4f46e5;
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 8px 20px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                letter-spacing: 0.02em;
              }
              .print-button button:hover { background: #4338ca; }

              /* Header */
              .header {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                color: #fff;
                padding: 32px 40px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
              }
              .header h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
              .org-name { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
              .org-detail { font-size: 12px; opacity: 0.82; line-height: 1.6; }
              .inv-meta { text-align: ${isAr ? "left" : "right"}; }
              .inv-meta table { border-collapse: collapse; }
              .inv-meta td { padding: 2px 0; font-size: 12px; }
              .inv-meta td:first-child { opacity: 0.75; padding-${isAr ? "left" : "right"}: 16px; text-align: ${isAr ? "right" : "left"}; }
              .inv-meta td:last-child { font-weight: 600; text-align: ${isAr ? "left" : "right"}; }

              /* Status banner */
              .status-bar {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 40px;
                font-size: 12px;
                font-weight: 600;
                letter-spacing: 0.04em;
                text-transform: uppercase;
              }
              .status-bar.paid    { background: #f0fdf4; color: #16a34a; border-bottom: 2px solid #bbf7d0; }
              .status-bar.overdue { background: #fef2f2; color: #dc2626; border-bottom: 2px solid #fecaca; }
              .status-bar.issued  { background: #eff6ff; color: #2563eb; border-bottom: 2px solid #bfdbfe; }
              .status-bar.draft   { background: #f9fafb; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
              .status-bar.partial { background: #fffbeb; color: #d97706; border-bottom: 2px solid #fde68a; }
              .status-bar.cancelled { background: #fef2f2; color: #9ca3af; border-bottom: 2px solid #fecaca; }
              .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; display: inline-block; }

              /* Body sections */
              .body { padding: 32px 40px; }
              .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }

              .section-label {
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #6b7280;
                margin-bottom: 8px;
                padding-bottom: 4px;
                border-bottom: 1px solid #f3f4f6;
              }

              .info-row { display: flex; gap: 8px; margin-bottom: 4px; font-size: 12.5px; }
              .info-row .lbl { color: #6b7280; min-width: 80px; }
              .info-row .val { font-weight: 500; color: #111827; }

              .tenant-name { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 4px; }

              /* Items table */
              .items-section { margin-bottom: 28px; }
              table.items {
                width: 100%;
                border-collapse: collapse;
                font-size: 12.5px;
              }
              table.items thead tr {
                background: #f3f4f6;
              }
              table.items thead th {
                padding: 8px 12px;
                text-align: ${isAr ? "right" : "left"};
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.07em;
                color: #6b7280;
                border-bottom: 1px solid #e5e7eb;
              }
              table.items thead th:not(:first-child) { text-align: ${isAr ? "left" : "right"}; }
              table.items tbody td {
                padding: 9px 12px;
                border-bottom: 1px solid #f3f4f6;
                color: #374151;
              }
              table.items tbody td:not(:first-child) { text-align: ${isAr ? "left" : "right"}; }
              table.items tbody tr.segment td {
                padding: 5px 12px 5px 28px;
                font-size: 11.5px;
                color: #6b7280;
                background: #fafafa;
              }
              table.items tbody tr.segment td:first-child::before {
                content: "└ ";
                color: #d1d5db;
              }
              table.items tbody tr:last-child td { border-bottom: none; }

              /* Totals */
              .totals {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 28px;
              }
              .totals-box { min-width: 280px; }
              .totals-row {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                font-size: 13px;
                color: #374151;
                border-bottom: 1px solid #f3f4f6;
              }
              .totals-row:last-child { border-bottom: none; }
              .totals-row.grand {
                font-size: 15px;
                font-weight: 800;
                color: #111827;
                padding: 8px 0 6px;
                border-top: 2px solid #e5e7eb;
                border-bottom: none;
                margin-top: 2px;
              }
              .totals-row.balance {
                font-size: 14px;
                font-weight: 700;
                color: #dc2626;
                padding-top: 6px;
              }
              .totals-row.balance.zero { color: #16a34a; }
              .totals-row .discount { color: #16a34a; }

              /* Payments */
              .payments-section { margin-bottom: 28px; }
              table.payments {
                width: 100%;
                border-collapse: collapse;
                font-size: 12.5px;
              }
              table.payments thead th {
                background: #f3f4f6;
                padding: 7px 12px;
                text-align: ${isAr ? "right" : "left"};
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.07em;
                color: #6b7280;
                border-bottom: 1px solid #e5e7eb;
              }
              table.payments thead th:last-child { text-align: ${isAr ? "left" : "right"}; }
              table.payments tbody td {
                padding: 8px 12px;
                border-bottom: 1px solid #f3f4f6;
                color: #374151;
              }
              table.payments tbody td:last-child { text-align: ${isAr ? "left" : "right"}; font-weight: 600; color: #16a34a; }
              table.payments tbody tr.refund td:last-child { color: #dc2626; }

              /* Paid stamp */
              .paid-stamp {
                display: inline-block;
                border: 3px solid #16a34a;
                border-radius: 8px;
                color: #16a34a;
                font-size: 22px;
                font-weight: 900;
                letter-spacing: 4px;
                padding: 4px 18px;
                transform: rotate(-3deg);
                opacity: 0.85;
                margin-top: 4px;
              }
              .overdue-stamp {
                display: inline-block;
                border: 3px solid #dc2626;
                border-radius: 8px;
                color: #dc2626;
                font-size: 22px;
                font-weight: 900;
                letter-spacing: 4px;
                padding: 4px 18px;
                transform: rotate(-3deg);
                opacity: 0.85;
                margin-top: 4px;
              }

              /* Notes */
              .notes-section {
                background: #fffbeb;
                border: 1px solid #fde68a;
                border-radius: 8px;
                padding: 12px 16px;
                font-size: 12.5px;
                color: #92400e;
                margin-bottom: 24px;
              }
              .notes-section strong { color: #78350f; }

              /* Footer */
              .footer {
                text-align: center;
                padding: 20px 40px 28px;
                border-top: 1px solid #f3f4f6;
                color: #9ca3af;
                font-size: 12px;
              }
              .footer .thank-you { font-size: 14px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }

              /* Print overrides */
              @media print {
                body { background: #fff; }
                .page {
                  box-shadow: none;
                  border-radius: 0;
                  margin: 0;
                  max-width: 100%;
                }
                .print-button { display: none !important; }
                .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .status-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                table.items thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                table.payments thead { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
              @page { margin: 0.5cm; }
            `,
          }}
        />
      </head>
      <body>
        <div className="page">

          {/* Print button — screen only */}
          <div className="print-button">
            <button id="print-btn">{tPrint("printBtn")}</button>
          </div>

          {/* Header */}
          <div className="header">
            <div>
              <div className="org-name">{org.name}</div>
              {org.address && <div className="org-detail">{org.address}</div>}
              {org.city && <div className="org-detail">{org.city}{org.area ? `, ${org.area}` : ""}</div>}
              {org.phone && <div className="org-detail ltr-numbers">{org.phone}</div>}
              <div style={{ marginTop: 16 }}>
                <h1>{tPrint("invoiceHeading")}</h1>
              </div>
            </div>
            <div className="inv-meta">
              <table>
                <tbody>
                  <tr>
                    <td>{tPrint("invoiceMeta.invoiceNo")}:</td>
                    <td className="ltr-numbers">{invoice.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td>{tPrint("invoiceMeta.issueDate")}:</td>
                    <td className="ltr-numbers">{fmtDate(invoice.issueDate)}</td>
                  </tr>
                  <tr>
                    <td>{tPrint("invoiceMeta.dueDate")}:</td>
                    <td className="ltr-numbers">{fmtDate(invoice.dueDate)}</td>
                  </tr>
                  <tr>
                    <td>{tPrint("invoiceMeta.status")}:</td>
                    <td>{statusLabel}</td>
                  </tr>
                  {invoice.property && (
                    <tr>
                      <td>{tPrint("invoiceMeta.property")}:</td>
                      <td>{invoice.property.name}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status bar */}
          <div className={`status-bar ${statusBarClass}`}>
            <span className="status-dot" />
            {tPrint(`statusBar.${statusBarKey}`)}
          </div>

          <div className="body">

            {/* Bill To + Reservation */}
            <div className="two-col">
              {/* Tenant */}
              <div>
                <div className="section-label">{tPrint("billTo")}</div>
                <div className="tenant-name">
                  {tenant.firstName} {tenant.lastName}
                </div>
                {tenant.fullNameArabic && (
                  <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                    {tenant.fullNameArabic}
                  </div>
                )}
                <div className="info-row">
                  <span className="val ltr-numbers">{tenant.phone}</span>
                </div>
                {tenant.email && (
                  <div className="info-row">
                    <span className="val">{tenant.email}</span>
                  </div>
                )}
                {tenant.idType && tenant.idNumber && (
                  <div className="info-row" style={{ marginTop: 6 }}>
                    <span className="lbl" style={{ textTransform: "capitalize" }}>
                      {tenant.idType.replace("_", " ")}:
                    </span>
                    <span className="val ltr-numbers">{tenant.idNumber}</span>
                  </div>
                )}
                {tenant.nationality && (
                  <div className="info-row">
                    <span className="lbl">{tPrint("nationality")}:</span>
                    <span className="val">{tenant.nationality}</span>
                  </div>
                )}
              </div>

              {/* Reservation info */}
              <div>
                <div className="section-label">{tPrint("reservation")}</div>
                {reservation.reservationNumber && (
                  <div className="info-row">
                    <span className="lbl">{tPrint("refNo")}:</span>
                    <span className="val ltr-numbers" style={{ fontFamily: "monospace" }}>{reservation.reservationNumber}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="lbl">{tPrint("checkIn")}:</span>
                  <span className="val ltr-numbers">{fmtDate(reservation.startDate)}</span>
                </div>
                <div className="info-row">
                  <span className="lbl">{tPrint("checkOut")}:</span>
                  <span className="val ltr-numbers">{fmtDate(reservation.endDate)}</span>
                </div>
                <div className="info-row">
                  <span className="lbl">{tPrint("duration")}:</span>
                  <span className="val">{tPrint("nights", { count: nights })}</span>
                </div>
                {reservation.reservationUnits.length > 0 && (
                  <div className="info-row" style={{ marginTop: 6 }}>
                    <span className="lbl">{tPrint("units")}:</span>
                    <span className="val">
                      {reservation.reservationUnits.map((ru) => ru.unit.name).join(", ")}
                    </span>
                  </div>
                )}
                {invoice.invoiceType === "MONTHLY" && invoice.monthNumber && (
                  <div className="info-row">
                    <span className="lbl">{tPrint("month")}:</span>
                    <span className="val ltr-numbers">{invoice.monthNumber}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            <div className="items-section">
              <div className="section-label">{tPrint("charges")}</div>
              <table className="items">
                <thead>
                  <tr>
                    <th style={{ width: "50%" }}>{tPrint("description")}</th>
                    <th style={{ width: "10%" }}>{tPrint("qty")}</th>
                    <th style={{ width: "20%" }}>{tPrint("rate")}</th>
                    <th style={{ width: "20%" }}>{tPrint("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item) => {
                    const breakdown = item.priceBreakdown as PriceSegment[] | null;
                    return (
                      <>
                        <tr key={item.id}>
                          <td>
                            <strong>
                              {item.unit ? `${item.unit.name} — ` : ""}
                              {item.description}
                            </strong>
                            {item.seasonalPriceName && (
                              <span style={{ color: "#6366f1", fontSize: 11, display: "block" }}>
                                {item.seasonalPriceName}
                              </span>
                            )}
                          </td>
                          <td className="ltr-numbers">{breakdown ? "—" : Number(item.quantity).toFixed(0)}</td>
                          <td className="ltr-numbers">{breakdown ? "—" : `${Number(item.unitPrice).toFixed(3)} OMR`}</td>
                          <td className="ltr-numbers" style={{ fontWeight: 700 }}>{Number(item.lineTotal).toFixed(3)} OMR</td>
                        </tr>
                        {breakdown && breakdown.map((seg, si) => (
                          <tr key={`${item.id}-seg-${si}`} className="segment">
                            <td>{seg.label}</td>
                            <td className="ltr-numbers">{seg.days ?? seg.nights ?? "—"}</td>
                            <td className="ltr-numbers">{seg.rate !== undefined ? `${Number(seg.rate).toFixed(3)} OMR` : "—"}</td>
                            <td className="ltr-numbers">{Number(seg.subtotal).toFixed(3)} OMR</td>
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="totals">
              <div className="totals-box">
                <div className="totals-row">
                  <span>{tPrint("subtotal")}</span>
                  <span className="ltr-numbers">{subtotal.toFixed(3)} OMR</span>
                </div>
                {discount > 0 && (
                  <div className="totals-row">
                    <span>{tPrint("discount")}</span>
                    <span className="discount ltr-numbers">−{discount.toFixed(3)} OMR</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="totals-row">
                    <span>{tPrint("tax")}</span>
                    <span className="ltr-numbers">{tax.toFixed(3)} OMR</span>
                  </div>
                )}
                <div className="totals-row grand">
                  <span>{tPrint("total")}</span>
                  <span className="ltr-numbers">{totalAmount.toFixed(3)} OMR</span>
                </div>
                {amountPaid > 0 && (
                  <div className="totals-row" style={{ color: "#16a34a" }}>
                    <span>{tPrint("totalPaid")}</span>
                    <span className="ltr-numbers">−{amountPaid.toFixed(3)} OMR</span>
                  </div>
                )}
                <div className={`totals-row balance ${balanceDue <= 0 ? "zero" : ""}`}>
                  <span>{tPrint("balanceDue")}</span>
                  <span className="ltr-numbers">{balanceDue.toFixed(3)} OMR</span>
                </div>
                {isPaid && (
                  <div style={{ textAlign: isAr ? "left" : "right", marginTop: 8 }}>
                    <span className="paid-stamp">{tPrint("paidStamp")}</span>
                  </div>
                )}
                {isOverdue && (
                  <div style={{ textAlign: isAr ? "left" : "right", marginTop: 8 }}>
                    <span className="overdue-stamp">{tPrint("overdueStamp")}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment History */}
            {invoice.allocations.length > 0 && (
              <div className="payments-section">
                <div className="section-label">{tPrint("paymentHistory")}</div>
                <table className="payments">
                  <thead>
                    <tr>
                      <th>{tPrint("paymentDate")}</th>
                      <th>{tPrint("paymentMethod")}</th>
                      <th>{tPrint("paymentReference")}</th>
                      <th>{tPrint("paymentAmount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.allocations.map((alloc) => (
                      <tr key={alloc.id} className={alloc.payment.isRefund ? "refund" : ""}>
                        <td className="ltr-numbers">{fmtDate(alloc.payment.date)}</td>
                        <td>{methodLabel(alloc.payment.method)}{alloc.payment.isRefund ? tPrint("refundSuffix") : ""}</td>
                        <td className="ltr-numbers">{alloc.payment.reference || "—"}</td>
                        <td className="ltr-numbers">
                          {alloc.payment.isRefund ? "−" : ""}{Number(alloc.amount).toFixed(3)} OMR
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="notes-section">
                <strong>{tPrint("notesLabel")}:</strong> {invoice.notes}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="footer">
            <div className="thank-you">{tPrint("thankYou")}</div>
            <div style={{ fontSize: 11, color: "#d1d5db" }}>
              <span>{org.name}</span>
              {org.city && <span> · {org.city}</span>}
              {org.phone && <span> · <span className="ltr-numbers">{org.phone}</span></span>}
            </div>
          </div>
        </div>

        {/* Print button inline script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.getElementById('print-btn').addEventListener('click', function() {
                window.print();
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
