import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  webpack(config) {
    // ── SVGR ──────────────────────────────────────────────────────────────
    // Allow `?react` imports of static .svg files (in /public/illustrations)
    // to produce a React component. Used by EmptyState illustrations so
    // `currentColor` inherits the variant tile color.
    //
    // The default Next rule treats *.svg as an asset (URL). We add a more
    // specific rule that only matches the `?react` resource query and routes
    // those through @svgr/webpack. Plain `<img src="/foo.svg" />` consumers
    // keep the default asset/resource behavior.
    const fileLoaderRule = config.module.rules.find(
      (rule: unknown): rule is { test: RegExp; exclude?: RegExp | RegExp[] } =>
        !!rule &&
        typeof rule === "object" &&
        "test" in rule &&
        (rule as { test?: RegExp }).test instanceof RegExp &&
        (rule as { test: RegExp }).test.test(".svg"),
    );
    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/i;
    }
    config.module.rules.push(
      // Resource queries matching `?react` → SVGR
      {
        test: /\.svg$/i,
        issuer: /\.[jt]sx?$/,
        resourceQuery: /react/,
        use: [
          {
            loader: "@svgr/webpack",
            options: {
              svgo: true,
              titleProp: false,
              ref: false,
            },
          },
        ],
      },
      // Default behavior for non-`?react` SVG imports (returns URL)
      {
        test: /\.svg$/i,
        type: "asset/resource",
      },
    );
    return config;
  },
};

export default withNextIntl(nextConfig);
