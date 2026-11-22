/**
 * schema.org JSON-LD for the public booking sites (rendered by _components/JsonLd.tsx).
 *
 * Deliberately NOT included: aggregateRating / Review (operator-entered testimonials are
 * "self-serving" under Google's guidelines and can trigger penalties) and Offer prices
 * (rates vary by date and the pages are cached — a stale price in rich results is worse
 * than none). Everything here is stable business information.
 */
import type { SiteView } from "./render";
import type { PublicBuilding, PublicUnit } from "./data";
import { firstImage, langUrl, siteOrigin } from "./seo";

type Ld = Record<string, unknown>;

const clean = (o: Ld): Ld => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)));
const abs = (urls: (string | null | undefined)[]) => urls.filter((u): u is string => !!u && /^https?:\/\//i.test(u));
const httpOnly = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : undefined);

function urlOf(v: SiteView, path: string) {
  return langUrl(siteOrigin(v.site), v.lang, v.site.defaultLanguage, path);
}

/** The business itself — rendered on the home page. */
export function lodgingBusinessLd(v: SiteView, photos: string[] = []): Ld {
  const { site, lang, siteName } = v;
  const ar = lang === "ar";
  const address = (ar ? site.addressAr || site.addressEn : site.addressEn || site.addressAr) ?? undefined;
  return clean({
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": `${siteOrigin(site)}/#business`,
    name: siteName,
    url: urlOf(v, "/"),
    description: (ar ? site.metaDescriptionAr || site.taglineAr : site.metaDescriptionEn || site.taglineEn) ?? undefined,
    image: abs([site.ogImageUrl, site.logoUrl, ...photos]).slice(0, 5),
    logo: firstImage(site.logoUrl),
    telephone: site.phone ?? undefined,
    email: site.email ?? undefined,
    address: address ? { "@type": "PostalAddress", streetAddress: address, addressCountry: "OM" } : undefined,
    hasMap: httpOnly(site.googleMapsUrl),
    sameAs: [httpOnly(site.instagramUrl)].filter(Boolean),
    checkinTime: site.checkInTime ?? undefined,
    checkoutTime: site.checkOutTime ?? undefined,
    availableLanguage: ["Arabic", "English"],
  });
}

/** A building page: a lodging business that belongs to the main one. */
export function buildingLd(v: SiteView, b: PublicBuilding): Ld {
  const { site, lang, siteName } = v;
  const desc = (lang === "ar" ? b.descriptionAr || b.descriptionEn : b.descriptionEn || b.descriptionAr) ?? undefined;
  return clean({
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: b.name,
    url: urlOf(v, `/buildings/${b.id}`),
    description: desc,
    image: abs(b.photos).slice(0, 5),
    numberOfRooms: b.unitCount || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: b.address ?? undefined,
      addressLocality: b.city || undefined,
      addressRegion: b.governorate || undefined,
      addressCountry: "OM",
    },
    amenityFeature: b.amenities.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
    parentOrganization: { "@type": "LodgingBusiness", "@id": `${siteOrigin(site)}/#business`, name: siteName },
  });
}

const ACCOMMODATION_TYPES = new Set(["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "VILLA"]);

/** A unit page: an apartment/room with its stable facts (no prices). */
export function unitLd(v: SiteView, u: PublicUnit): Ld {
  const { lang } = v;
  const desc = (lang === "ar" ? u.descriptionAr || u.descriptionEn : u.descriptionEn || u.descriptionAr) ?? undefined;
  const amenities = lang === "ar" && u.amenitiesAr.length ? u.amenitiesAr : u.amenities;
  return clean({
    "@context": "https://schema.org",
    "@type": ACCOMMODATION_TYPES.has(u.unitType) ? "Apartment" : "Accommodation",
    name: u.name,
    url: urlOf(v, `/units/${u.id}`),
    description: desc,
    image: abs(u.photos).slice(0, 5),
    numberOfBedrooms: u.bedrooms,
    numberOfBathroomsTotal: u.bathrooms,
    occupancy: u.maxGuests ? { "@type": "QuantitativeValue", maxValue: u.maxGuests } : undefined,
    floorSize: u.area ? { "@type": "QuantitativeValue", value: u.area, unitCode: "MTK" } : undefined,
    amenityFeature: amenities.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
    containedInPlace: { "@type": "LodgingBusiness", name: u.buildingName, url: urlOf(v, `/buildings/${u.buildingId}`) },
  });
}

/** Breadcrumbs: [{ name, path }] from the home page down; the last item is the current page. */
export function breadcrumbLd(v: SiteView, items: { name: string; path: string }[]): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: urlOf(v, it.path) })),
  };
}
