import "server-only";

/**
 * PUBLIC SITE DATA LAYER — the ONLY gateway between anonymous website visitors
 * and the database. Every function here returns purpose-built DTOs with an
 * EXPLICIT field whitelist: financials, tenant PII, internal notes, and other
 * orgs' data are structurally absent from anything returned.
 *
 * Availability + pricing REUSE the PMS engine (getUnitPriceForRange,
 * collapseToSegments, NON_BLOCKING_STATUSES) so a public quote is byte-for-byte
 * identical to what the internal calendar computes for the same dates.
 */

import { prisma } from "@/lib/prisma";
import { getUnitPriceForRange } from "@/lib/pricing";
import { longStayDiscount } from "@/lib/stay-rules";
import { getOrgStayRules } from "@/lib/stay-rules-server";
import { calculateNights, collapseToSegments, sumSubtotals, type PriceSegment } from "@/lib/reservation-engine";
import { NON_BLOCKING_STATUSES } from "@/lib/reservation-conflict";
import { extractSiteSlug } from "@/lib/public-site/subdomain";
import { parseSections, parseReviews, parseGallery, parseTime, type SectionConfig, type Review } from "@/lib/public-site/sections";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";

const num = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));

// ── Cross-request cache for slow-changing public content ─────────────────────
// Site settings, buildings and units are read on every public page view but
// change rarely. They're cached for PUBLIC_CACHE_SECONDS and tagged so the
// website wizard can invalidate them instantly on save/publish (updateTag in
// app/dashboard/settings/website/actions.ts). Building/unit edits made
// elsewhere in the PMS show up within PUBLIC_CACHE_SECONDS.
// NOT cached: availability search + quotes — those must always be live.
// Cached values are JSON-serialized, so DTOs must stay plain (no Date/Decimal).
export const PUBLIC_CACHE_SECONDS = 60;
export const publicSiteTag = (slug: string) => `public-site:${slug}`;
export const publicOrgTag = (orgId: string) => `public-org:${orgId}`;

// ── DTOs (the public contract) ───────────────────────────────────────────────

export type PublicSite = {
  organizationId: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "DISABLED";
  templateKey: string;
  fontPreset: string;
  // branding
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  // content
  siteNameEn: string | null;
  siteNameAr: string | null;
  taglineEn: string | null;
  taglineAr: string | null;
  aboutEn: string | null;
  aboutAr: string | null;
  // contact
  whatsappNumber: string | null;
  phone: string | null;
  email: string | null;
  addressEn: string | null;
  addressAr: string | null;
  googleMapsUrl: string | null;
  instagramUrl: string | null;
  // seo
  metaDescriptionEn: string | null;
  metaDescriptionAr: string | null;
  ogImageUrl: string | null;
  // settings
  defaultLanguage: string;
  showPrices: boolean;
  khareefBannerEnabled: boolean;
  // sections (ordered, with visibility) + their content
  sections: SectionConfig[];
  galleryUrls: string[];
  reviews: Review[];
  checkInTime: string | null;
  checkOutTime: string | null;
  policiesEn: string | null;
  policiesAr: string | null;
  // custom domain (canonical host once active)
  customDomain: string | null;
  customDomainActive: boolean;
  // org (public bits only)
  orgName: string;
  orgLogo: string | null;
  currency: string;
};

export type PublicBuilding = {
  id: string;
  name: string;
  type: string;
  city: string;
  governorate: string;
  address: string | null;
  photos: string[];
  descriptionEn: string | null;
  descriptionAr: string | null;
  amenities: string[];
  unitCount: number;
};

export type PublicUnit = {
  id: string;
  buildingId: string;
  buildingName: string;
  name: string;
  unitType: string;
  bedrooms: number;
  bathrooms: number;
  area: number | null;
  maxGuests: number | null;
  amenities: string[];
  amenitiesAr: string[];
  photos: string[];
  descriptionEn: string | null;
  descriptionAr: string | null;
  /** "from" nightly rate, for display only. Actual quote comes from searchAvailability. */
  basePrice: number;
};

export type AvailabilityUnit = PublicUnit & {
  /** Free for the dates AND long enough for the minimum stay (bookable). */
  available: boolean;
  /** Free, but shorter than the minimum stay (Pricing → Stay rules). */
  tooShort: boolean;
  minNights: number;
  nights: number;
  /** Accommodation total before the long-stay discount. */
  subtotal: number;
  /** Long-stay discount (0 when none) and the guest's total after it. */
  discount: number;
  discountPercent: number | null;
  total: number;
  rateAmount: number;
  priceName: string | null;
  segments: PriceSegment[];
};

// ── Site resolution ──────────────────────────────────────────────────────────

const SITE_SELECT = {
  organizationId: true, slug: true, status: true, templateKey: true, fontPreset: true,
  logoUrl: true, primaryColor: true, accentColor: true,
  siteNameEn: true, siteNameAr: true, taglineEn: true, taglineAr: true,
  aboutEn: true, aboutAr: true,
  whatsappNumber: true, phone: true, email: true,
  addressEn: true, addressAr: true, googleMapsUrl: true, instagramUrl: true,
  metaDescriptionEn: true, metaDescriptionAr: true, ogImageUrl: true,
  defaultLanguage: true, showPrices: true, khareefBannerEnabled: true,
  sections: true, galleryUrls: true, reviews: true, checkInTime: true, checkOutTime: true, policiesEn: true, policiesAr: true,
  customDomain: true, customDomainActive: true,
  organization: { select: { name: true, logo: true, currency: true } },
} satisfies Prisma.OrgWebsiteSelect;

function toPublicSite(row: Prisma.OrgWebsiteGetPayload<{ select: typeof SITE_SELECT }>): PublicSite {
  return {
    organizationId: row.organizationId,
    slug: row.slug,
    status: row.status,
    templateKey: row.templateKey,
    fontPreset: row.fontPreset,
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor,
    siteNameEn: row.siteNameEn, siteNameAr: row.siteNameAr,
    taglineEn: row.taglineEn, taglineAr: row.taglineAr,
    aboutEn: row.aboutEn, aboutAr: row.aboutAr,
    whatsappNumber: row.whatsappNumber, phone: row.phone, email: row.email,
    addressEn: row.addressEn, addressAr: row.addressAr,
    googleMapsUrl: row.googleMapsUrl, instagramUrl: row.instagramUrl,
    metaDescriptionEn: row.metaDescriptionEn, metaDescriptionAr: row.metaDescriptionAr,
    ogImageUrl: row.ogImageUrl,
    defaultLanguage: row.defaultLanguage, showPrices: row.showPrices,
    khareefBannerEnabled: row.khareefBannerEnabled,
    sections: parseSections(row.sections, row.khareefBannerEnabled),
    galleryUrls: parseGallery(row.galleryUrls),
    reviews: parseReviews(row.reviews),
    checkInTime: parseTime(row.checkInTime),
    checkOutTime: parseTime(row.checkOutTime),
    policiesEn: row.policiesEn?.trim() || null,
    policiesAr: row.policiesAr?.trim() || null,
    customDomain: row.customDomain,
    customDomainActive: row.customDomainActive,
    orgName: row.organization.name,
    orgLogo: row.organization.logo,
    currency: row.organization.currency,
  };
}

/**
 * Resolve a site by slug. Public callers get only PUBLISHED sites; the wizard
 * preview passes allowUnpublished so it can render a DRAFT before launch.
 */
export async function getSiteBySlug(
  slug: string,
  opts: { allowUnpublished?: boolean } = {},
): Promise<PublicSite | null> {
  // The wizard preview (allowUnpublished) always reads fresh.
  if (opts.allowUnpublished) return loadSite(slug);
  const site = await unstable_cache(() => loadSite(slug), ["public-site", slug], {
    revalidate: PUBLIC_CACHE_SECONDS,
    tags: [publicSiteTag(slug)],
  })();
  return site && site.status === "PUBLISHED" ? site : null;
}

async function loadSite(slug: string): Promise<PublicSite | null> {
  const row = await prisma.orgWebsite.findUnique({ where: { slug }, select: SITE_SELECT });
  return row ? toPublicSite(row) : null;
}

/** Wrap an org-scoped public read in the shared cross-request cache. */
function cachedForOrg<A extends unknown[], R>(name: string, fn: (orgId: string, ...args: A) => Promise<R>) {
  return (orgId: string, ...args: A): Promise<R> =>
    unstable_cache(() => fn(orgId, ...args), ["public-org", name, orgId, ...args.map(String)], {
      revalidate: PUBLIC_CACHE_SECONDS,
      tags: [publicOrgTag(orgId)],
    })();
}

/** Resolve the active site directly from a request Host header (for API routes). */
export async function getSiteFromHost(host: string | null | undefined): Promise<PublicSite | null> {
  const slug = extractSiteSlug(host);
  if (slug) return getSiteBySlug(slug);
  // A connected custom domain (e.g. www.noory.com) resolves to its site too.
  const hostname = (host ?? "").split(":")[0].trim().toLowerCase();
  if (!hostname || !hostname.includes(".")) return null;
  const row = await unstable_cache(
    () => prisma.orgWebsite.findUnique({ where: { customDomain: hostname }, select: { slug: true } }),
    ["public-site-host", hostname],
    { revalidate: PUBLIC_CACHE_SECONDS },
  )();
  return row ? getSiteBySlug(row.slug) : null;
}

// ── Seasons (opt-in landing pages) ───────────────────────────────────────────

export type PublicSeason = {
  id: string;
  name: string;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  /** inclusive, "YYYY-MM-DD" */
  startDate: string;
  endDate: string;
  color: string;
  minNights: number | null;
};

const toISODay = (d: Date) => d.toISOString().slice(0, 10);

async function loadSeasons(orgId: string): Promise<PublicSeason[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.season.findMany({
    where: { organizationId: orgId, isActive: true, publicPage: true, endDate: { gte: today } },
    orderBy: { startDate: "asc" },
    take: 12,
  });
  return rows.map((r) => ({
    id: r.id, name: r.name, nameAr: r.nameAr,
    descriptionEn: r.descriptionEn, descriptionAr: r.descriptionAr,
    startDate: toISODay(r.startDate), endDate: toISODay(r.endDate),
    color: r.color, minNights: r.minNights,
  }));
}

/** Seasons the operator chose to publish (current + upcoming). */
export const getPublicSeasons = cachedForOrg("seasons", loadSeasons);

// ── Buildings ────────────────────────────────────────────────────────────────

const BUILDING_WHERE = (orgId: string): Prisma.PropertyWhereInput => ({
  organizationId: orgId,
  isActive: true,
  isArchived: false,
});

export const getBuildings = cachedForOrg("buildings", loadBuildings);
export const getBuilding = cachedForOrg("building", loadBuilding);
export const getUnits = cachedForOrg("units", loadUnits);
export const getUnit = cachedForOrg("unit", loadUnit);

async function loadBuildings(orgId: string): Promise<PublicBuilding[]> {
  const rows = await prisma.property.findMany({
    where: BUILDING_WHERE(orgId),
    select: {
      id: true, name: true, type: true, city: true, governorate: true, address: true,
      photos: true, publicDescriptionEn: true, publicDescriptionAr: true, amenities: true,
      _count: { select: { units: { where: { isActive: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({
    id: r.id, name: r.name, type: r.type, city: r.city, governorate: r.governorate,
    address: r.address, photos: r.photos,
    descriptionEn: r.publicDescriptionEn, descriptionAr: r.publicDescriptionAr,
    amenities: r.amenities, unitCount: r._count.units,
  }));
}

async function loadBuilding(orgId: string, buildingId: string): Promise<PublicBuilding | null> {
  const r = await prisma.property.findFirst({
    where: { ...BUILDING_WHERE(orgId), id: buildingId },
    select: {
      id: true, name: true, type: true, city: true, governorate: true, address: true,
      photos: true, publicDescriptionEn: true, publicDescriptionAr: true, amenities: true,
      _count: { select: { units: { where: { isActive: true } } } },
    },
  });
  if (!r) return null;
  return {
    id: r.id, name: r.name, type: r.type, city: r.city, governorate: r.governorate,
    address: r.address, photos: r.photos,
    descriptionEn: r.publicDescriptionEn, descriptionAr: r.publicDescriptionAr,
    amenities: r.amenities, unitCount: r._count.units,
  };
}

// ── Units ────────────────────────────────────────────────────────────────────

const UNIT_SELECT = {
  id: true, name: true, unitType: true, bedrooms: true, bathrooms: true, area: true,
  maxGuests: true, amenities: true, amenitiesAr: true, photos: true,
  publicDescriptionEn: true, publicDescriptionAr: true, basePrice: true,
  propertyId: true, property: { select: { name: true } },
} satisfies Prisma.UnitSelect;

type UnitRow = Prisma.UnitGetPayload<{ select: typeof UNIT_SELECT }>;

function toPublicUnit(u: UnitRow): PublicUnit {
  return {
    id: u.id, buildingId: u.propertyId, buildingName: u.property.name,
    name: u.name, unitType: u.unitType, bedrooms: u.bedrooms, bathrooms: u.bathrooms,
    area: u.area, maxGuests: u.maxGuests, amenities: u.amenities, amenitiesAr: u.amenitiesAr,
    photos: u.photos, descriptionEn: u.publicDescriptionEn, descriptionAr: u.publicDescriptionAr,
    basePrice: num(u.basePrice),
  };
}

/** Units for a building (or the whole org if buildingId omitted). Public + bookable only. */
async function loadUnits(orgId: string, buildingId?: string): Promise<PublicUnit[]> {
  const rows = await prisma.unit.findMany({
    where: {
      isActive: true,
      status: { not: "MAINTENANCE" }, // maintenance units are not publicly bookable
      property: { ...BUILDING_WHERE(orgId), ...(buildingId ? { id: buildingId } : {}) },
    },
    select: UNIT_SELECT,
    orderBy: [{ property: { name: "asc" } }, { floor: "asc" }, { name: "asc" }],
  });
  return rows.map(toPublicUnit);
}

async function loadUnit(orgId: string, unitId: string): Promise<PublicUnit | null> {
  const u = await prisma.unit.findFirst({
    where: {
      id: unitId, isActive: true,
      property: { ...BUILDING_WHERE(orgId) },
    },
    select: UNIT_SELECT,
  });
  return u ? toPublicUnit(u) : null;
}

// ── Availability search (daily, short-term — the public booking path) ─────────

export type AvailabilityQuery = {
  buildingId?: string;
  startDate: Date;
  endDate: Date;
  guests?: number;
};

/**
 * Available units for a date range with a seasonal-priced quote per unit.
 * Same half-open [start,end) semantics, same NON_BLOCKING_STATUSES, and same
 * pricing functions as the PMS calendar → identical answers for identical input.
 */
export async function searchAvailability(orgId: string, q: AvailabilityQuery): Promise<AvailabilityUnit[]> {
  const { startDate, endDate, buildingId, guests } = q;

  const unitWhere: Prisma.UnitWhereInput = {
    isActive: true,
    status: { not: "MAINTENANCE" },
    property: { ...BUILDING_WHERE(orgId), ...(buildingId ? { id: buildingId } : {}) },
    ...(guests && guests > 1 ? { OR: [{ maxGuests: null }, { maxGuests: { gte: guests } }] } : {}),
  };

  const units = await prisma.unit.findMany({ where: unitWhere, select: UNIT_SELECT });
  if (units.length === 0) return [];

  const unitIds = units.map((u) => u.id);
  const blocking = { notIn: [...NON_BLOCKING_STATUSES] };

  // Conflicts via BOTH attachment styles (legacy Reservation.unitId + ReservationUnit join).
  const [conflictOld, conflictNew] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        unitId: { in: unitIds },
        status: blocking,
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
      select: { unitId: true },
    }),
    prisma.reservationUnit.findMany({
      where: {
        unitId: { in: unitIds },
        reservation: { status: blocking, startDate: { lt: endDate }, endDate: { gt: startDate } },
      },
      select: { unitId: true },
    }),
  ]);

  const occupied = new Set<string>();
  for (const r of conflictOld) if (r.unitId) occupied.add(r.unitId);
  for (const ru of conflictNew) occupied.add(ru.unitId);

  const nights = calculateNights(startDate, endDate);
  const rules = await getOrgStayRules(orgId);

  return Promise.all(
    units.map(async (u): Promise<AvailabilityUnit> => {
      const base = toPublicUnit(u);
      const available = !occupied.has(u.id);
      if (!available) {
        return { ...base, available: false, tooShort: false, minNights: rules.defaultMinNights, nights, subtotal: 0, discount: 0, discountPercent: null, total: 0, rateAmount: 0, priceName: null, segments: [] };
      }
      const priceResult = await getUnitPriceForRange(u.id, startDate, endDate);
      const segments = collapseToSegments(priceResult.dailyBreakdown);
      const subtotal = sumSubtotals(segments.map((s) => s.subtotal));
      const tooShort = nights < priceResult.minNights; // minimum stay: BLOCK online
      const ls = longStayDiscount(subtotal, nights, rules.longStayTiers);
      return {
        ...base,
        available: !tooShort,
        tooShort,
        minNights: priceResult.minNights,
        nights,
        subtotal,
        discount: ls.amount,
        discountPercent: ls.tier?.percent ?? null,
        total: Math.round((subtotal - ls.amount) * 1000) / 1000,
        rateAmount: segments[0]?.ratePerNight ?? 0,
        priceName: segments[0]?.priceName ?? null,
        segments,
      };
    }),
  );
}
