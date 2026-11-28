import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

export default getRequestConfig(async () => {
  // A language chosen by the URL (blog: /blog/{en|ar}/…, set by middleware.ts) wins over the cookie.
  const fromUrl = (await headers()).get("x-binaya-locale");
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(fromUrl) ? fromUrl : isLocale(cookieValue) ? cookieValue : defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return { locale, messages };
});
