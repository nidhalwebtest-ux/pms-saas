import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { signShareToken, type ShareDocType } from "@/lib/share-token";

const PDF_PATH: Record<ShareDocType, (id: string) => string> = {
  invoice:     (id) => `/api/invoices/${id}/pdf`,
  receipt:     (id) => `/api/payments/${id}/receipt-pdf`,
  ledger:      (id) => `/api/tenants/${id}/ledger/export-pdf`,
  reservation: (id) => `/api/reservations/${id}/pdf`,
  return:      (id) => `/api/returns/${id}/pdf`,
};

const fmt = (n: unknown) => Number(n ?? 0).toFixed(3);

/**
 * POST /api/share/mint  { type, id }
 * Verifies the document belongs to the caller's org, then returns a signed
 * public share URL + a ready-to-send bilingual message, the authenticated PDF
 * URL (for download / native file-share), and the tenant's WhatsApp number.
 */
export async function POST(req: NextRequest) {
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: ShareDocType; id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const type = body.type as ShareDocType;
  const id = body.id;
  if (!type || !id || !(type in PDF_PATH)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const org = orgUser.organizationId;
  const t = await getTranslations("share.messages");

  const organization = await prisma.organization.findUnique({ where: { id: org }, select: { name: true } });
  const orgName = organization?.name ?? "";

  // Resolve the document, enforce org ownership, and gather message details.
  let tenant: { firstName: string; lastName: string; phone: string | null; whatsappNumber: string | null; email: string | null } | null = null;
  let title = "";
  let fileName = "document.pdf";
  let message = "";
  let prop: string | undefined;

  if (type === "invoice") {
    const inv = await prisma.invoice.findUnique({
      where: { id },
      select: { organizationId: true, invoiceNumber: true, totalAmount: true, tenant: { select: { firstName: true, lastName: true, phone: true, whatsappNumber: true, email: true } } },
    });
    if (!inv || inv.organizationId !== org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    tenant = inv.tenant;
    title = inv.invoiceNumber;
    fileName = `Invoice-${inv.invoiceNumber}.pdf`;
    message = t("invoice", { name: tenant ? `${tenant.firstName} ${tenant.lastName}` : "", number: inv.invoiceNumber, amount: fmt(inv.totalAmount), org: orgName });
  } else if (type === "receipt") {
    const pay = await prisma.payment.findUnique({
      where: { id },
      select: { paymentNumber: true, amount: true, tenant: { select: { organizationId: true, firstName: true, lastName: true, phone: true, whatsappNumber: true, email: true } } },
    });
    if (!pay || pay.tenant.organizationId !== org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    tenant = pay.tenant;
    const num = pay.paymentNumber ?? id.slice(0, 8).toUpperCase();
    title = num;
    fileName = `Receipt-${num}.pdf`;
    message = t("receipt", { name: `${tenant.firstName} ${tenant.lastName}`, number: num, amount: fmt(pay.amount), org: orgName });
  } else if (type === "reservation") {
    const res = await prisma.reservation.findUnique({
      where: { id },
      select: { reservationNumber: true, tenant: { select: { organizationId: true, firstName: true, lastName: true, phone: true, whatsappNumber: true, email: true } } },
    });
    if (!res || res.tenant.organizationId !== org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    tenant = res.tenant;
    title = res.reservationNumber ?? "";
    fileName = `Reservation-${res.reservationNumber ?? id.slice(0, 8)}.pdf`;
    message = t("reservation", { name: `${tenant.firstName} ${tenant.lastName}`, number: res.reservationNumber ?? "", org: orgName });
  } else if (type === "return") {
    const ret = await prisma.return.findUnique({
      where: { id },
      select: { organizationId: true, returnNumber: true, returnAmount: true, tenant: { select: { firstName: true, lastName: true, phone: true, whatsappNumber: true, email: true } } },
    });
    if (!ret || ret.organizationId !== org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    tenant = ret.tenant;
    title = ret.returnNumber;
    fileName = `Return-${ret.returnNumber}.pdf`;
    message = t("return", { name: tenant ? `${tenant.firstName} ${tenant.lastName}` : "", number: ret.returnNumber, amount: fmt(ret.returnAmount), org: orgName });
  } else { // ledger
    const tn = await prisma.tenant.findUnique({
      where: { id },
      select: { organizationId: true, firstName: true, lastName: true, phone: true, whatsappNumber: true, email: true },
    });
    if (!tn || tn.organizationId !== org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    tenant = tn;
    title = `${tn.firstName} ${tn.lastName}`;
    fileName = `Statement-${tn.firstName}-${tn.lastName}.pdf`.replace(/\s+/g, "-");
    message = t("ledger", { name: `${tn.firstName} ${tn.lastName}`, org: orgName });
    // Capture the currently-selected building so the shared statement matches.
    prop = (await getSelectedPropertyId()) ?? undefined;
  }

  const token = signShareToken({ t: type, id, org, prop });
  const origin = new URL(req.url).origin;
  const pdfUrl = PDF_PATH[type](id);
  const shareUrl = `${origin}${pdfUrl}?t=${token}`;
  const tenantPhone = tenant?.whatsappNumber || tenant?.phone || null;

  return NextResponse.json({
    shareUrl,
    pdfUrl,
    fileName,
    title,
    message,
    tenantPhone,
    tenantEmail: tenant?.email ?? null,
  });
}
