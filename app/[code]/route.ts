import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PDF_PATH, signShareToken, type ShareDocType } from "@/lib/share-token";

/**
 * Public short-link resolver: binaya.app/<code> → looks up the ShareLink and
 * 302-redirects to the document's PDF route with a freshly-minted, short-lived
 * access token. Explicit routes (/login, /dashboard, …) always take precedence,
 * so this only handles otherwise-unmatched single-segment paths.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!/^[A-Za-z0-9]{4,16}$/.test(code)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const link = await prisma.shareLink.findUnique({ where: { code } });
  if (!link) return new NextResponse("Not found", { status: 404 });
  if (link.expiresAt && link.expiresAt < new Date()) {
    return new NextResponse("This link has expired", { status: 410 });
  }

  const type = link.docType as ShareDocType;
  if (!(type in PDF_PATH)) return new NextResponse("Not found", { status: 404 });

  const token = signShareToken({
    t: type,
    id: link.docId,
    org: link.organizationId,
    prop: link.prop ?? undefined,
    ttlMs: 5 * 60 * 1000, // only needs to survive the redirect hop + download
  });
  const target = `${PDF_PATH[type](link.docId)}?t=${token}`;
  return NextResponse.redirect(new URL(target, _req.url));
}
