"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access";
import { isValidSlug, isReservedSlug } from "@/lib/public-site/subdomain";
import { addTenantDomain, tenantHost } from "@/lib/public-site/provision";
import { HEX_RE, type WebsiteForm, type TemplateKey } from "./types";

async function orgId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id }, select: { organizationId: true },
  });
  return dbUser?.organizationId ?? null;
}

// ── Slug availability ─────────────────────────────────────────────────────────

export type SlugResult =
  | { ok: true; available: true }
  | { ok: true; available: false; reason: "invalid" | "reserved" | "taken" }
  | { ok: false; error: string };

/** Live check used by the wizard's subdomain field (debounced on the client). */
export async function checkSlug(slugRaw: string): Promise<SlugResult> {
  if (!(await hasAccess("settingsWebsite", "VIEW"))) return { ok: false, error: "forbidden" };
  const slug = slugRaw.trim().toLowerCase();
  if (isReservedSlug(slug)) return { ok: true, available: false, reason: "reserved" };
  if (!isValidSlug(slug)) return { ok: true, available: false, reason: "invalid" };

  const org = await orgId();
  if (!org) return { ok: false, error: "no_org" };

  const existing = await prisma.orgWebsite.findUnique({
    where: { slug }, select: { organizationId: true },
  });
  if (existing && existing.organizationId !== org) return { ok: true, available: false, reason: "taken" };
  return { ok: true, available: true };
}

// ── Persist (draft) ───────────────────────────────────────────────────────────

const clampHex = (v: string, fallback: string) => (HEX_RE.test(v?.trim()) ? v.trim() : fallback);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const nullable = (v: unknown) => { const s = str(v); return s || null; };

/** Map the wizard form to a Prisma payload, sanitising every field. */
function toData(input: Partial<WebsiteForm>) {
  const tpl = (["template_1", "template_2", "template_3"] as TemplateKey[]).includes(input.templateKey as TemplateKey)
    ? (input.templateKey as TemplateKey) : "template_1";
  return {
    templateKey: tpl,
    logoUrl: input.logoUrl ?? null,
    primaryColor: clampHex(input.primaryColor ?? "", "#0E7490"),
    accentColor: clampHex(input.accentColor ?? "", "#F59E0B"),
    siteNameEn: nullable(input.siteNameEn), siteNameAr: nullable(input.siteNameAr),
    taglineEn: nullable(input.taglineEn), taglineAr: nullable(input.taglineAr),
    aboutEn: nullable(input.aboutEn), aboutAr: nullable(input.aboutAr),
    whatsappNumber: nullable(input.whatsappNumber), phone: nullable(input.phone), email: nullable(input.email),
    addressEn: nullable(input.addressEn), addressAr: nullable(input.addressAr),
    googleMapsUrl: nullable(input.googleMapsUrl), instagramUrl: nullable(input.instagramUrl),
    metaDescriptionEn: nullable(input.metaDescriptionEn), metaDescriptionAr: nullable(input.metaDescriptionAr),
    ogImageUrl: input.ogImageUrl ?? null,
    defaultLanguage: input.defaultLanguage === "en" ? "en" : "ar",
    showPrices: input.showPrices !== false,
    khareefBannerEnabled: !!input.khareefBannerEnabled,
  };
}

export type SaveResult = { ok: true } | { ok: false; error: string; field?: "slug" };

/** Upsert the site config (keeps current status; used for Save-draft + step nav). */
export async function saveWebsite(input: Partial<WebsiteForm>): Promise<SaveResult> {
  if (!(await hasAccess("settingsWebsite", "EDIT"))) return { ok: false, error: "forbidden" };
  const org = await orgId();
  if (!org) return { ok: false, error: "no_org" };

  const slug = str(input.slug).toLowerCase();
  if (slug) {
    if (isReservedSlug(slug) || !isValidSlug(slug)) return { ok: false, error: "bad_slug", field: "slug" };
    const clash = await prisma.orgWebsite.findUnique({ where: { slug }, select: { organizationId: true } });
    if (clash && clash.organizationId !== org) return { ok: false, error: "slug_taken", field: "slug" };
  }

  const data = toData(input);
  try {
    await prisma.orgWebsite.upsert({
      where: { organizationId: org },
      update: { ...data, ...(slug ? { slug } : {}) },
      create: { organizationId: org, slug: slug || `site-${org.slice(0, 8)}`, status: "DRAFT", ...data },
    });
  } catch (e) {
    console.error("[saveWebsite]", e);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/dashboard/settings/website");
  return { ok: true };
}

// ── Publish (launch) ──────────────────────────────────────────────────────────

export type PublishResult =
  | { ok: true; url: string; host: string; domainWarning?: string }
  | { ok: false; error: string; field?: "slug" | "whatsappNumber" | "siteName" };

/**
 * Validate required fields, persist as PUBLISHED, register the Vercel subdomain,
 * and revalidate the public site's ISR paths.
 */
export async function publishWebsite(input: WebsiteForm): Promise<PublishResult> {
  if (!(await hasAccess("settingsWebsite", "EDIT"))) return { ok: false, error: "forbidden" };
  const org = await orgId();
  if (!org) return { ok: false, error: "no_org" };

  const slug = str(input.slug).toLowerCase();
  if (isReservedSlug(slug) || !isValidSlug(slug)) return { ok: false, error: "bad_slug", field: "slug" };
  if (!str(input.whatsappNumber)) return { ok: false, error: "whatsapp_required", field: "whatsappNumber" };
  if (!str(input.siteNameEn) && !str(input.siteNameAr)) return { ok: false, error: "name_required", field: "siteName" };

  const clash = await prisma.orgWebsite.findUnique({ where: { slug }, select: { organizationId: true } });
  if (clash && clash.organizationId !== org) return { ok: false, error: "slug_taken", field: "slug" };

  const data = toData(input);
  try {
    await prisma.orgWebsite.upsert({
      where: { organizationId: org },
      update: { ...data, slug, status: "PUBLISHED", publishedAt: new Date() },
      create: { organizationId: org, slug, status: "PUBLISHED", publishedAt: new Date(), ...data },
    });
  } catch (e) {
    console.error("[publishWebsite]", e);
    return { ok: false, error: "generic" };
  }

  // Attach the subdomain on Vercel (no-op if creds absent, e.g. demo/local).
  const provision = await addTenantDomain(slug);

  revalidatePath(`/sites/${slug}`, "layout");
  revalidatePath("/dashboard/settings/website");

  return {
    ok: true,
    host: tenantHost(slug),
    url: `https://${tenantHost(slug)}`,
    domainWarning: provision.ok ? undefined : provision.error,
  };
}

// ── Status toggle (post-launch dashboard) ─────────────────────────────────────

export async function setWebsiteStatus(status: "PUBLISHED" | "DISABLED"): Promise<SaveResult> {
  if (!(await hasAccess("settingsWebsite", "EDIT"))) return { ok: false, error: "forbidden" };
  const org = await orgId();
  if (!org) return { ok: false, error: "no_org" };

  const site = await prisma.orgWebsite.findUnique({ where: { organizationId: org }, select: { slug: true } });
  if (!site) return { ok: false, error: "no_site" };

  try {
    await prisma.orgWebsite.update({
      where: { organizationId: org },
      data: { status, ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}) },
    });
    if (status === "PUBLISHED") await addTenantDomain(site.slug);
  } catch (e) {
    console.error("[setWebsiteStatus]", e);
    return { ok: false, error: "generic" };
  }
  revalidatePath(`/sites/${site.slug}`, "layout");
  revalidatePath("/dashboard/settings/website");
  return { ok: true };
}
