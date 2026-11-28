import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

/** /blog → /blog/{lang}: the visitor's chosen language, else their browser's, else English. */
export default async function BlogRoot() {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  let lang = isLocale(cookie) ? cookie : null;
  if (!lang) {
    const accept = (await headers()).get("accept-language") ?? "";
    lang = /^\s*ar\b/i.test(accept) ? "ar" : "en";
  }
  redirect(`/blog/${lang}`);
}
