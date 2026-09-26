import { escHtml } from "../html";

/**
 * Generic status vocabulary — every document maps its own status keys/enum
 * to one of these 5 tones locally. The shell never bakes in a status enum;
 * 3 incompatible vocabularies already existed before this module (invoice's
 * semantic lowercase, expense's raw uppercase, return's third set) and a
 * shell-owned 4th would just add to the pile.
 */
export type StatusTone = "success" | "danger" | "info" | "neutral" | "warning";

export interface StatusBarOptions {
  label: string;
  tone: StatusTone;
}

/** Full-width status banner — invoice's original .status-bar pattern. */
export function renderStatusBar(opts: StatusBarOptions): string {
  return `<div class="status-bar status-tone-${opts.tone}"><span class="status-dot"></span>${escHtml(opts.label)}</div>`;
}

/** Small inline pill for use inside a header — reservation's header-badge use case. */
export function renderStatusPill(opts: StatusBarOptions): string {
  return `<span class="status-pill"><span class="status-dot"></span>${escHtml(opts.label)}</span>`;
}
