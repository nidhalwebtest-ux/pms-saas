#!/usr/bin/env node
/**
 * Repeatable page-speed probe. Hits each URL N times and prints the median
 * TTFB, total time, HTML size, and the Vercel region that served it
 * (x-vercel-id "edge::function::id" → the function region is the 2nd part).
 *
 *   node scripts/perf/measure.mjs                       # default public URLs, 5 runs
 *   node scripts/perf/measure.mjs https://www.binaya.app/dashboard /dashboard/reservations
 *   RUNS=10 node scripts/perf/measure.mjs ...
 *
 * Authenticated pages: copy the Cookie header from a logged-in browser tab
 * (DevTools → Network → any dashboard request → Request Headers → cookie) into
 * PERF_COOKIE. Relative paths are resolved against PERF_BASE.
 *
 *   PERF_BASE=https://www.binaya.app PERF_COOKIE='sb-...=...; NEXT_LOCALE=en' \
 *     node scripts/perf/measure.mjs /dashboard /dashboard/reservations /dashboard/invoices
 *
 * Paste the output table into docs/perf/ for before/after comparisons.
 */
const RUNS = Number(process.env.RUNS ?? 5);
const BASE = process.env.PERF_BASE ?? "https://www.binaya.app";
const COOKIE = process.env.PERF_COOKIE ?? "";

const DEFAULT_URLS = [
  "https://www.binaya.app/",
  "https://www.binaya.app/login",
  "https://demo.binaya.app/",
  "https://demo.binaya.app/buildings",
];

const urls = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_URLS).map((u) =>
  u.startsWith("http") ? u : BASE + u,
);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function probe(url) {
  const t0 = performance.now();
  const res = await fetch(url, {
    redirect: "manual",
    headers: { ...(COOKIE ? { cookie: COOKIE } : {}), "cache-control": "no-cache" },
  });
  // TTFB ≈ when headers arrive; then read the full body for total time + size.
  const ttfb = performance.now() - t0;
  const body = await res.arrayBuffer();
  const total = performance.now() - t0;
  const vid = res.headers.get("x-vercel-id") ?? "";
  const region = vid.split("::").slice(0, -1).join("→") || "local";
  return { status: res.status, ttfb, total, bytes: body.byteLength, region, cache: res.headers.get("x-vercel-cache") ?? "" };
}

console.log(`runs=${RUNS}  ${new Date().toISOString()}\n`);
console.log("| URL | status | median TTFB | median total | HTML KB | region | cache |");
console.log("|---|---|---|---|---|---|---|");
for (const url of urls) {
  const results = [];
  for (let i = 0; i < RUNS; i++) results.push(await probe(url));
  const last = results.at(-1);
  console.log(
    `| ${url} | ${last.status} | ${median(results.map((r) => r.ttfb)).toFixed(0)} ms | ${median(results.map((r) => r.total)).toFixed(0)} ms | ${(last.bytes / 1024).toFixed(0)} | ${last.region} | ${last.cache} |`,
  );
}
