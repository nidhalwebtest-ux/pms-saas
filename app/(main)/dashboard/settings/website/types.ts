/** Shared types + presets for the website setup wizard (client + server safe). */

export type WebsiteStatus = "DRAFT" | "PUBLISHED" | "DISABLED";
export type TemplateKey = "template_1" | "template_2" | "template_3";

export interface WebsiteForm {
  slug: string;
  templateKey: TemplateKey;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  siteNameEn: string;
  siteNameAr: string;
  taglineEn: string;
  taglineAr: string;
  aboutEn: string;
  aboutAr: string;
  whatsappNumber: string;
  phone: string;
  email: string;
  addressEn: string;
  addressAr: string;
  googleMapsUrl: string;
  instagramUrl: string;
  metaDescriptionEn: string;
  metaDescriptionAr: string;
  ogImageUrl: string | null;
  defaultLanguage: "ar" | "en";
  showPrices: boolean;
  khareefBannerEnabled: boolean;
}

export const EMPTY_FORM: WebsiteForm = {
  slug: "",
  templateKey: "template_1",
  logoUrl: null,
  primaryColor: "#0E7490",
  accentColor: "#F59E0B",
  siteNameEn: "",
  siteNameAr: "",
  taglineEn: "",
  taglineAr: "",
  aboutEn: "",
  aboutAr: "",
  whatsappNumber: "",
  phone: "",
  email: "",
  addressEn: "",
  addressAr: "",
  googleMapsUrl: "",
  instagramUrl: "",
  metaDescriptionEn: "",
  metaDescriptionAr: "",
  ogImageUrl: null,
  defaultLanguage: "ar",
  showPrices: true,
  khareefBannerEnabled: false,
};

/** Curated brand palettes (primary + accent). First is the default. */
export const COLOR_PRESETS: { name: string; primary: string; accent: string }[] = [
  { name: "coastal",  primary: "#0E7490", accent: "#F59E0B" },
  { name: "binaya",   primary: "#185FA5", accent: "#85B7EB" },
  { name: "emerald",  primary: "#047857", accent: "#F59E0B" },
  { name: "desert",   primary: "#B45309", accent: "#0E7490" },
  { name: "midnight", primary: "#0F172A", accent: "#38BDF8" },
  { name: "rose",     primary: "#9F1239", accent: "#FB7185" },
];

export const TEMPLATES: { key: TemplateKey; accentFont: "sans" | "serif" }[] = [
  { key: "template_1", accentFont: "sans" },  // Coastal — light, airy
  { key: "template_2", accentFont: "serif" }, // Classic — elegant, hotel-like
  { key: "template_3", accentFont: "sans" },  // Modern — bold, dark-hero
];

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
