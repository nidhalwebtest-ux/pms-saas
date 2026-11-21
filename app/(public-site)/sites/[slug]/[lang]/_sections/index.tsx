import { Fragment, type ReactNode } from "react";
import type { SiteView } from "@/lib/public-site/render";
import type { SectionKey } from "@/lib/public-site/sections";
import type { PublicBuilding } from "@/lib/public-site/data";
import Gallery from "./Gallery";
import Reviews from "./Reviews";
import Policies from "./Policies";
import Location from "./Location";

/** Gallery photos: the operator's own, or (when none were added) the buildings' photos. */
export function galleryPhotos(v: SiteView, buildings: PublicBuilding[]): string[] {
  if (v.site.galleryUrls.length > 0) return v.site.galleryUrls;
  return [...new Set(buildings.flatMap((b) => b.photos))].slice(0, 8);
}

/** The sections every template renders the same way (each adapts its look to the template's tokens). */
export function sharedSections(v: SiteView, buildings: PublicBuilding[]): Pick<Record<SectionKey, ReactNode>, "gallery" | "reviews" | "policies" | "location"> {
  return {
    gallery: <Gallery v={v} photos={galleryPhotos(v, buildings)} />,
    reviews: <Reviews v={v} reviews={v.site.reviews} />,
    policies: <Policies v={v} />,
    location: <Location v={v} />,
  };
}

/** Render the enabled sections in the operator's order. A key with no block (or an empty one) renders nothing. */
export function renderSections(v: SiteView, blocks: Partial<Record<SectionKey, ReactNode>>) {
  return v.site.sections
    .filter((s) => s.enabled)
    .map((s) => <Fragment key={s.key}>{blocks[s.key] ?? null}</Fragment>);
}
