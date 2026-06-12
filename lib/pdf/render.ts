import chromium from "@sparticuz/chromium-min";
import puppeteer, { type Browser } from "puppeteer-core";

/**
 * Remote Chromium binary pack (brotli tar) fetched to /tmp on cold start and
 * reused across warm invocations. Using chromium-min + a remote pack avoids the
 * bundler relocating the ~50MB binary (Turbopack does not reliably keep the
 * package's bin/ in the function), which is the canonical Vercel setup.
 * Override CHROMIUM_PACK_URL to self-host the pack (Supabase/Blob) if desired.
 * The version MUST match the installed @sparticuz/chromium-min version.
 */
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ??
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

/**
 * HTML/CSS → PDF via headless Chromium.
 *
 * This is the single render backend for every document template (reservation,
 * invoice, receipt, return, expense, statement). Templates produce HTML; this
 * turns HTML into a deterministic A4 PDF. Keeping templates separate from the
 * engine means we can swap the backend (external API, Gotenberg) without
 * touching a single template.
 *
 * Engine selection:
 *  - Serverless (Vercel/Lambda): @sparticuz/chromium provides a Linux Chromium
 *    binary + the args needed to run inside a function.
 *  - Local dev: use the developer's installed Chrome/Chromium. Override with
 *    PUPPETEER_EXECUTABLE_PATH if it lives somewhere non-standard.
 */

const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_VERSION || !!process.env.VERCEL;

function localChromePath(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  switch (process.platform) {
    case "darwin":
      return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    case "win32":
      return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    default:
      return "/usr/bin/google-chrome";
  }
}

export interface PdfOptions {
  format?: "A4" | "Letter";
  landscape?: boolean;
  /** Margins. Ignored when the template's CSS @page defines them (preferCSSPageSize). */
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  /** Let the template's CSS @page rule control page size + margins. Default true. */
  preferCSSPageSize?: boolean;
  /** Chromium-rendered repeating header/footer (e.g. page numbers) for multi-page docs. */
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

async function launch(): Promise<Browser> {
  if (isServerless) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    });
  }
  return puppeteer.launch({
    headless: true,
    executablePath: localChromePath(),
    args: ["--no-sandbox", "--font-render-hinting=none"],
  });
}

export async function htmlToPdf(html: string, opts: PdfOptions = {}): Promise<Uint8Array> {
  let browser: Browser | null = null;
  try {
    browser = await launch();
    const page = await browser.newPage();
    // Fonts/assets are embedded as data URIs (no network), so "load" is enough.
    await page.setContent(html, { waitUntil: "load" });
    // Block until embedded @font-face files are parsed/loaded so Arabic shaping
    // and metrics are correct on the very first paint.
    await page.evaluate(async () => {
      await (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready;
    });

    const pdf = await page.pdf({
      format: opts.format ?? "A4",
      landscape: opts.landscape ?? false,
      printBackground: true,
      preferCSSPageSize: opts.preferCSSPageSize ?? true,
      displayHeaderFooter: opts.displayHeaderFooter ?? false,
      headerTemplate: opts.headerTemplate ?? "<span></span>",
      footerTemplate: opts.footerTemplate ?? "<span></span>",
      margin: opts.margin,
    });
    return pdf;
  } finally {
    if (browser) await browser.close();
  }
}
