import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // The headless-Chromium PDF stack must stay external (its binary/native bits
  // can't be bundled by the Next compiler). Used by app/api/**/pdf routes.
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
};

export default withNextIntl(nextConfig);
