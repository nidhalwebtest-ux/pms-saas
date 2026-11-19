#!/usr/bin/env node
/**
 * Self-host the Google Fonts the app uses (run once, or when the font list changes).
 *
 * Why: `next/font/google` downloads fonts from Google during EVERY build, and
 * Turbopack intermittently fails that download ("next/font/google queries have
 * exactly one entry" / module-not-found on [next]/internal/font/google/…css),
 * which fails the whole build — it broke a production deploy on 2026-11-19.
 * With the files in the repo, builds never touch the network for fonts.
 *
 * What it does: for each family below, fetches the Google Fonts CSS (woff2),
 * keeps only the listed subsets, downloads every file into public/fonts/<slug>/,
 * and writes styles/fonts.css with the @font-face rules (unicode-range kept, so
 * a page only downloads the Arabic or Latin files it actually renders) plus the
 * CSS variables the code uses (--font-sans, --font-cairo, …).
 *
 *   node scripts/fonts/sync-google-fonts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath (not URL.pathname) — the project path contains spaces and "&".
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "public/fonts");
const CSS_OUT = path.join(ROOT, "styles/fonts.css");
// A modern Chrome UA makes Google serve woff2 with unicode-range per subset.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** family → weights, subsets, and the CSS variable(s) that point at it. */
const FONTS = [
  // App (app/layout.tsx)
  { family: "IBM Plex Sans", weights: [300, 400, 500, 600, 700], subsets: ["latin", "latin-ext"], vars: { "--font-sans": "sans" } },
  { family: "IBM Plex Sans Arabic", weights: [400, 500, 600], subsets: ["arabic"], vars: { "--font-arabic": "sans" } },
  { family: "IBM Plex Mono", weights: [400, 500, 600], subsets: ["latin"], vars: { "--font-mono": "mono" } },
  // Landing (components/marketing/v2/fonts.ts)
  { family: "Cairo", weights: [400, 600, 700], subsets: ["arabic", "latin"], vars: { "--font-cairo": null } },
  { family: "Poppins", weights: [600], subsets: ["latin"], vars: { "--font-poppins": null } },
  // Public booking sites (app/(public-site)/sites/[slug]/layout.tsx + lib/public-site/theme.ts)
  { family: "Fraunces", weights: [400, 500, 600, 700], subsets: ["latin"], vars: { "--font-fraunces": null, "--font-display-latin": null } },
  { family: "Tajawal", weights: [400, 500, 700], subsets: ["arabic"], vars: { "--font-tajawal": null, "--font-display-ar": null } },
  { family: "Playfair Display", weights: [400, 500, 600, 700], subsets: ["latin"], vars: { "--font-playfair": null } },
  { family: "Amiri", weights: [400, 700], subsets: ["arabic"], vars: { "--font-amiri": null } },
  { family: "Space Grotesk", weights: [400, 500, 600, 700], subsets: ["latin"], vars: { "--font-space": null } },
];

const FALLBACK = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

async function main() {
  const blocks = [];
  const vars = [];
  let files = 0, bytes = 0;

  for (const f of FONTS) {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, "+")}:wght@${f.weights.join(";")}&display=swap`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${f.family}: HTTP ${res.status}`);
    const css = await res.text();

    // Google's CSS: "/* subset */\n@font-face { … }" repeated.
    const faces = [...css.matchAll(/\/\*\s*([a-z0-9-]+)\s*\*\/\s*(@font-face\s*{[^}]*})/g)];
    const kept = faces.filter(([, subset]) => f.subsets.includes(subset));
    if (!kept.length) throw new Error(`${f.family}: no faces for subsets ${f.subsets}`);

    const dir = path.join(OUT_DIR, slug(f.family));
    fs.mkdirSync(dir, { recursive: true });
    const downloaded = new Map(); // remote url → local path (variable fonts reuse one file for all weights)

    for (const [, subset, face] of kept) {
      const remote = face.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
      const weight = face.match(/font-weight:\s*([^;]+);/)?.[1].trim();
      if (!remote || !weight) throw new Error(`${f.family}: unexpected @font-face ${face.slice(0, 80)}`);
      let local = downloaded.get(remote);
      if (!local) {
        const name = `${slug(f.family)}-${subset}-${weight.replace(/\s+/g, "_")}.woff2`;
        const buf = Buffer.from(await (await fetch(remote)).arrayBuffer());
        fs.writeFileSync(path.join(dir, name), buf);
        files++; bytes += buf.length;
        local = `/fonts/${slug(f.family)}/${name}`;
        downloaded.set(remote, local);
      }
      blocks.push(`/* ${f.family} — ${subset} */\n${face.replace(remote, local)}`);
    }
    // kind null = bare family name (like next/font): these vars are composed into stacks
    // ("var(--font-space), var(--font-cairo), sans-serif"), where a fallback inside the var
    // would win over the next font for Arabic glyphs.
    for (const [v, kind] of Object.entries(f.vars)) vars.push(`  ${v}: "${f.family}"${kind ? `, ${FALLBACK[kind]}` : ""};`);
    console.log(`${f.family.padEnd(22)} ${kept.length} faces, ${downloaded.size} files`);
  }

  const header = `/*
 * GENERATED by scripts/fonts/sync-google-fonts.mjs — do not edit by hand.
 * Self-hosted Google Fonts (files in public/fonts/). Replaces next/font/google,
 * whose build-time downloads intermittently failed Turbopack builds.
 * unicode-range is kept per subset, so a page only downloads the files it renders.
 */\n\n`;
  const root = `/* Font variables used by Tailwind (tailwind.config.ts) and components. */\n:root {\n${vars.join("\n")}\n}\n\n/* Landing page type (components/marketing/v2/fonts.ts). */\n.font-landing {\n  font-family: var(--font-cairo), ${FALLBACK.sans};\n}\n`;
  fs.writeFileSync(CSS_OUT, header + root + "\n" + blocks.join("\n\n") + "\n");
  console.log(`\n${files} files, ${(bytes / 1024).toFixed(0)} KB → public/fonts/ ; CSS → styles/fonts.css`);
}

main().catch((e) => { console.error(e); process.exit(1); });
