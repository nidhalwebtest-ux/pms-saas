import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // The headless-Chromium PDF stack must stay external (its binary/native bits
  // can't be bundled by the Next compiler). Used by app/api/**/pdf routes.
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
  // Public booking sites render org/property/unit images stored in Supabase
  // Storage (bucket "pms-media") via next/image — allow that host.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
