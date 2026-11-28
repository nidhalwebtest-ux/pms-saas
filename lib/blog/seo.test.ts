import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSeo, type SeoInput } from "./seo";
import { analyzeHtml, countWords, normalizeText, slugify } from "./text";

const words = (n: number, w = "lorem") => Array.from({ length: n }, () => w).join(" ");

function base(over: Partial<SeoInput> = {}): SeoInput {
  const body = `<p>Khareef pricing guide intro: how to set Khareef pricing for apartments. ${words(120)}</p>
<h2>Why Khareef pricing matters</h2><p>${words(300)}</p>
<h2>Step by step</h2><p>${words(300)} <a href="/blog/en/other">related</a> <a href="https://example.com">source</a></p>
<img src="https://x.supabase.co/a.jpg" alt="A view of Salalah in Khareef">`;
  return {
    lang: "en",
    title: "Khareef pricing guide for furnished apartments",
    slug: "khareef-pricing-guide",
    excerpt: "Everything an apartment manager in Salalah needs to know about setting Khareef season rates without losing bookings.",
    seoTitle: "",
    seoDescription: "Khareef pricing guide: how apartment managers in Salalah set seasonal rates, avoid empty nights and keep guests happy during the busiest months.",
    focusKeyword: "Khareef pricing",
    coverImageUrl: "https://x.supabase.co/cover.jpg",
    coverImageAlt: "Green hills of Salalah",
    contentHtml: body,
    ...over,
  };
}

test("a complete article scores well and has no blockers", () => {
  const r = analyzeSeo(base());
  assert.equal(r.blockers.length, 0, r.blockers.map((b) => b.id).join(","));
  assert.ok(r.score >= 80, `score ${r.score}`);
  assert.equal(r.grade, "good");
});

test("scored weights sum to 100", () => {
  const r = analyzeSeo(base());
  assert.equal(r.checks.filter((c) => !c.required).reduce((s, c) => s + c.weight, 0), 100);
});

test("publish gate: missing cover, short content, missing alt, empty description", () => {
  const r = analyzeSeo(base({
    coverImageUrl: null,
    contentHtml: `<p>${words(50)}</p><img src="https://x/a.jpg" alt="">`,
    seoDescription: "",
    excerpt: "",
  }));
  const ids = r.blockers.map((b) => b.id).sort();
  assert.deepEqual(ids, ["cover", "description", "img-alt", "min-words"]);
});

test("invalid slug blocks publishing", () => {
  assert.ok(analyzeSeo(base({ slug: "Has Spaces" })).blockers.some((b) => b.id === "slug"));
  assert.ok(analyzeSeo(base({ slug: "" })).blockers.some((b) => b.id === "slug"));
});

test("no focus keyword → keyword checks earn nothing", () => {
  const r = analyzeSeo(base({ focusKeyword: "" }));
  for (const id of ["keyword-set", "kw-title", "kw-description", "kw-slug", "kw-intro", "kw-heading", "kw-density"]) {
    assert.equal(r.checks.find((c) => c.id === id)!.points, 0, id);
  }
});

test("Arabic: keyword matching ignores diacritics and alef/taa-marbuta variants", () => {
  const html = `<p>دليل تسعير الخريف للشقق المفروشة في صلالة. ${words(150, "نص")}</p><h2>لماذا تسعير الخريف مهم</h2><p>${words(400, "نص")}</p>`;
  const r = analyzeSeo(base({
    lang: "ar",
    title: "دليل تَسعير الخريف للشقق المفروشة في صلالة",
    slug: slugify("دليل تسعير الخريف"),
    focusKeyword: "تسعير الخريف",
    seoDescription: "دليل تسعير الخريف: كيف يحدد مديرو الشقق المفروشة في صلالة أسعار الموسم ويتجنبون الليالي الفارغة ويحافظون على رضا النزلاء.",
    contentHtml: html,
  }));
  assert.equal(r.checks.find((c) => c.id === "kw-title")!.status, "pass");
  assert.equal(r.checks.find((c) => c.id === "kw-slug")!.status, "pass");
  assert.equal(r.checks.find((c) => c.id === "kw-heading")!.status, "pass");
  assert.equal(normalizeText("إدارة الشقة"), normalizeText("ادارة الشقه"));
});

test("slugify keeps Arabic letters and Latin words", () => {
  assert.equal(slugify("  Khareef 2026: Pricing Guide! "), "khareef-2026-pricing-guide");
  assert.equal(slugify("دليل تَسعير الخريف"), "دليل-تسعير-الخريف");
  assert.equal(slugify("---"), "");
});

test("analyzeHtml: words, headings, internal vs external links, images", () => {
  const a = analyzeHtml(`<h2>One</h2><p>Hello <strong>big</strong> world</p><a href="/x">i</a><a href="https://www.binaya.app/y">i2</a><a href="https://google.com">e</a><a href="#top">anchor</a><img src="a" alt="ok">`);
  assert.equal(a.headings.length, 1);
  assert.equal(a.links.filter((l) => l.internal).length, 2);
  assert.equal(a.links.filter((l) => !l.internal).length, 1);
  assert.equal(a.images[0].alt, "ok");
  assert.equal(countWords("Hello — world 2026"), 3);
});
