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
import { calculateNights, collapseToSegments, sumSubtotals, type PriceSegment } from "@/lib/reservation-engine";
import { NON_BLOCKING_STATUSES } from "@/lib/reservation-conflict";
import { extractSiteSlug } from "@/lib/public-site/subdomain";
import type { Prisma } from "@prisma/client";

const num = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));

// ── DTOs (the public contract) ───────────────────────────────────────────────

export type PublicSite = {
  organizationId: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "DISABLED";
  templateKey: string;
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
  available: boolean;
  nights: number;
  subtotal: number;
  rateAmount: number;
  priceName: string | null;
  segments: PriceSegment[];
};

// ── Site resolution ──────────────────────────────────────────────────────────

const SITE_SELECT = {
  organizationId: true, slug: true, status: true, templateKey: true,
  logoUrl: true, primaryColor: true, accentColor: true,
  siteNameEn: true, siteNameAr: true, taglineEn: true, taglineAr: true,
  aboutEn: true, aboutAr: true,
  whatsappNumber: true, phone: true, email: true,
  addressEn: true, addressAr: true, googleMapsUrl: true, instagramUrl: true,
  metaDescriptionEn: true, metaDescriptionAr: true, ogImageUrl: true,
  defaultLanguage: true, showPrices: true, khareefBannerEnabled: true,
  organization: { select: { name: true, logo: true, currency: true } },
} satisfies Prisma.OrgWebsiteSelect;

function toPublicSite(row: Prisma.OrgWebsiteGetPayload<{ select: typeof SITE_SELECT }>): PublicSite {
  return {
    organizationId: row.organizationId,
    slug: row.slug,
    status: row.status,
    templateKey: row.templateKey,
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
  const row = await prisma.orgWebsite.findUnique({ where: { slug }, select: SITE_SELECT });
  if (!row) return null;
  if (!opts.allowUnpublished && row.status !== "PUBLISHED") return null;
  return toPublicSite(row);
}

/** Resolve the active site directly from a request Host header (for API routes). */
export async function getSiteFromHost(host: string | null | undefined): Promise<PublicSite | null> {
  const slug = extractSiteSlug(host);
  if (!slug) return null;
  return getSiteBySlug(slug);
}

// ── Buildings ────────────────────────────────────────────────────────────────

const BUILDING_WHERE = (orgId: string): Prisma.PropertyWhereInput => ({
  organizationId: orgId,
  isActive: true,
  isArchived: false,
});

export async function getBuildings(orgId: string): Promise<PublicBuilding[]> {
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

export async function getBuilding(orgId: string, buildingId: string): Promise<PublicBuilding | null> {
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
export async function getUnits(orgId: string, buildingId?: string): Promise<PublicUnit[]> {
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

export async function getUnit(orgId: string, unitId: string): Promise<PublicUnit | null> {
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

  return Promise.all(
    units.map(async (u): Promise<AvailabilityUnit> => {
      const base = toPublicUnit(u);
      const available = !occupied.has(u.id);
      if (!available) {
        return { ...base, available: false, nights, subtotal: 0, rateAmount: 0, priceName: null, segments: [] };
      }
      const priceResult = await getUnitPriceForRange(u.id, startDate, endDate);
      const segments = collapseToSegments(priceResult.dailyBreakdown);
      return {
        ...base,
        available: true,
        nights,
        subtotal: sumSubtotals(segments.map((s) => s.subtotal)),
        rateAmount: segments[0]?.ratePerNight ?? 0,
        priceName: segments[0]?.priceName ?? null,
        segments,
      };
    }),
  );
}
