import "server-only";
import sanitizeHtml from "sanitize-html";
import { htmlToText, slugify } from "./text";

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|var\(--[a-z0-9-]+\))$/i;

/**
 * Whitelist for article HTML produced by the Tiptap editor. Only the super-admin
 * can author articles, but the HTML is still sanitized server-side (defence in
 * depth — it is rendered with dangerouslySetInnerHTML on a public page).
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "code", "pre", "mark", "span",
    "blockquote", "ul", "ol", "li", "a", "img", "figure", "figcaption", "div", "iframe", "video", "source",
    "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title", "referrerpolicy"],
    video: ["src", "controls", "poster", "preload", "playsinline", "width", "height", "title"],
    source: ["src", "type"],
    div: ["data-callout", "data-youtube-video", "data-video"],
    mark: ["data-color", "style"],
    span: ["style"],
    p: ["style"],
    h2: ["style"], h3: ["style"], h4: ["style"],
    th: ["colspan", "rowspan", "colwidth", "style"],
    td: ["colspan", "rowspan", "colwidth", "style"],
    col: ["style"],
    pre: ["class"],
    code: ["class"],
    ol: ["start", "type"],
  },
  allowedStyles: {
    "*": {
      color: [COLOR],
      "background-color": [COLOR],
      "text-align": [/^(left|right|center|justify|start|end)$/],
      "min-width": [/^\d+px$/],
      width: [/^\d+px$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"], video: ["https"], source: ["https"] },
  allowedIframeHostnames: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
  allowProtocolRelative: false,
  // media whose src was rejected (bad scheme / host) would be empty husks
  exclusiveFilter: (frame) => ["img", "iframe", "video"].includes(frame.tag) && !frame.attribs.src,
  transformTags: {
    h1: "h2", // the article title is the only H1 on the page
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?binaya\.app/i.test(href);
      return {
        tagName,
        attribs: external
          ? { ...attribs, target: "_blank", rel: "noopener noreferrer" }
          : { href, ...(attribs.title ? { title: attribs.title } : {}) },
      };
    },
  },
};

/**
 * Sanitize editor HTML, give every H2/H3 a stable id (anchor links + table of
 * contents) and lazy-load media below the fold.
 */
export function processArticleHtml(raw: string): { html: string; toc: TocItem[] } {
  // Re-saving stored HTML: drop the wrappers added below so they are not doubled.
  const unwrapped = raw.replace(/<div class="table-wrap">\s*(<table[\s\S]*?<\/table>)\s*<\/div>/gi, "$1");
  let html = sanitizeHtml(unwrapped, OPTIONS);

  const used = new Set<string>();
  const toc: TocItem[] = [];
  html = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, attrs: string, inner: string) => {
    const text = htmlToText(inner);
    let id = slugify(text) || `section-${toc.length + 1}`;
    for (let n = 2; used.has(id); n++) id = `${slugify(text)}-${n}`;
    used.add(id);
    if (text) toc.push({ id, text, level: Number(lvl) as 2 | 3 });
    return `<h${lvl} id="${id}"${attrs}>${inner}</h${lvl}>`;
  });

  html = html
    .replace(/<img\b/gi, '<img loading="lazy" decoding="async"')
    .replace(/<iframe\b/gi, '<iframe loading="lazy"')
    .replace(/<video\b(?![^>]*preload)/gi, '<video preload="metadata"')
    // tables scroll horizontally on phones instead of breaking the layout
    .replace(/<table\b/gi, '<div class="table-wrap"><table')
    .replace(/<\/table>/gi, "</table></div>")
    // drop empty trailing paragraphs the editor leaves behind
    .replace(/(<p>\s*(<br\s*\/?>)?\s*<\/p>\s*)+$/i, "");

  return { html, toc };
}
