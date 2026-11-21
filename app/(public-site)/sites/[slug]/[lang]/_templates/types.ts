import type { ComponentType } from "react";
import type { SiteView } from "@/lib/public-site/render";
import type { PublicBuilding } from "@/lib/public-site/data";

/** Everything a home-page template needs — computed once in page.tsx. */
export type HomeProps = {
  v: SiteView;
  buildings: PublicBuilding[];
  name: string;
  tagline: string | null;
  about: string | null;
  /** address, or a default place line */
  location: string;
  heroPhoto: string | null;
  aboutPhoto: string | null;
  highlights: { icon: ComponentType<{ className?: string }>; t: string; d: string }[];
};

export const DISPLAY = "font-[family-name:var(--font-display)]";
