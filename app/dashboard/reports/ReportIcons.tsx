/**
 * Inline SVG sprite for the Reports module. Rendered once by the reports layout
 * so the report markup can reference icons via <svg class="ic"><use href="#i-…"/></svg>.
 * Ported verbatim from the Reports design.
 */
export default function ReportIcons() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="i-chev-right" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="m6 4 4 4-4 4" /></symbol>
        <symbol id="i-chev-down" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="m4 6 4 4 4-4" /></symbol>
        <symbol id="i-chev-up" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="m4 10 4-4 4 4" /></symbol>
        <symbol id="i-search" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13-2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></symbol>
        <symbol id="i-cal" viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></symbol>
        <symbol id="i-building" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" d="M3 14V3.5l5-1.5 5 1.5V14" /><path d="M3 14h10M5.5 6h1M5.5 8.5h1M5.5 11h1M9.5 6h1M9.5 8.5h1M9.5 11h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></symbol>
        <symbol id="i-coins" viewBox="0 0 16 16"><circle cx="6" cy="6" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6 4.5v3M4.8 6h2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /><path d="M9.5 11.5a3.5 3.5 0 1 0 0-5" fill="none" stroke="currentColor" strokeWidth="1.5" /></symbol>
        <symbol id="i-trending" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" d="M2 12 6 8l2.5 2L14 4M14 4v3M14 4h-3" /></symbol>
        <symbol id="i-users" viewBox="0 0 16 16"><circle cx="6" cy="5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M11 7a2 2 0 1 0-1.4-3.4M14 13c0-1.8-1.2-3.4-3-3.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></symbol>
        <symbol id="i-shield" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" d="M8 2 3 4v4c0 3 2.2 5.5 5 6 2.8-.5 5-3 5-6V4l-5-2Z" /></symbol>
        <symbol id="i-download" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M8 2.5v8M5 7.5l3 3 3-3M3 13.5h10" /></symbol>
        <symbol id="i-save" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" d="M3 3h7l3 3v7H3z" /><path d="M5 3v3h5V3M5 9.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></symbol>
        <symbol id="i-schedule" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></symbol>
        <symbol id="i-filter" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" d="M2.5 3.5h11l-4 5v4l-3-1.5v-2.5z" /></symbol>
        <symbol id="i-star" viewBox="0 0 16 16"><path fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" d="m8 2 1.8 3.7L14 6.3l-3 2.9.7 4.1L8 11.4l-3.7 1.9.7-4.1-3-2.9 4.2-.6Z" /></symbol>
        <symbol id="i-arrow-up" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M8 12V4M5 7l3-3 3 3" /></symbol>
        <symbol id="i-arrow-down" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M8 4v8M5 9l3 3 3-3" /></symbol>
        <symbol id="i-info" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 7v4M8 5.2v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></symbol>
        <symbol id="i-empty" viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M3.5 10h17M8 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></symbol>
      </defs>
    </svg>
  );
}
