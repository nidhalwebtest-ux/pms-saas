import { escHtml } from "../html";

export interface InkStampOptions {
  text: string;
  tone: "success" | "danger" | "neutral";
}

/** Generalization of invoice's .paid-stamp/.overdue-stamp pair into one component + tone. */
export function renderInkStamp(opts: InkStampOptions): string {
  const toneClass = opts.tone === "success" ? "" : ` tone-${opts.tone}`;
  return `<span class="ink-stamp${toneClass}">${escHtml(opts.text)}</span>`;
}
