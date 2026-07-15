"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Search, Building2, DoorClosed, User, CalendarDays, FileText,
  Wallet, Receipt, CornerDownLeft, Loader2, X,
} from "lucide-react";
import { useFormatAmount } from "@/lib/org-context";

/* ============================================================================
 *  Global command-palette search (⌘K / Ctrl+K).
 *
 *  A compact trigger in the header opens a centered modal that queries
 *  /api/search as you type (debounced) and shows grouped, keyboard-navigable
 *  results across every entity the user can see. Fully RTL + i18n aware.
 * ========================================================================= */

type EntityType =
  | "reservation" | "tenant" | "invoice" | "payment" | "expense" | "unit" | "building";

type SearchItem = {
  id: string;
  type: EntityType;
  title: string;
  subtitle: string;
  amount: number | null;
  badge: string | null;
  href: string;
};

type Group = { type: EntityType; items: SearchItem[] };

const ICONS: Record<EntityType, typeof Search> = {
  reservation: CalendarDays,
  tenant: User,
  invoice: FileText,
  payment: Wallet,
  expense: Receipt,
  unit: DoorClosed,
  building: Building2,
};

// Per-type accent for the leading icon chip.
const ICON_TONE: Record<EntityType, string> = {
  reservation: "bg-blue-50 text-blue-600",
  tenant: "bg-indigo-50 text-indigo-600",
  invoice: "bg-violet-50 text-violet-600",
  payment: "bg-emerald-50 text-emerald-600",
  expense: "bg-amber-50 text-amber-600",
  unit: "bg-sky-50 text-sky-600",
  building: "bg-slate-100 text-slate-600",
};

// Badge colour by status/method, per the app's status-colour conventions.
function badgeTone(badge: string): string {
  switch (badge.toUpperCase()) {
    case "PAID":
    case "APPROVED":
    case "PROCESSED":
    case "CHECKED_IN":
    case "AVAILABLE":
    case "CONFIRMED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "PARTIALLY_PAID":
    case "PENDING":
    case "ISSUED":
    case "OCCUPIED":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "OVERDUE":
    case "REJECTED":
    case "NO_SHOW":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-gray-100 text-gray-600 ring-gray-200";
  }
}

const DEBOUNCE_MS = 200;

export default function GlobalSearch() {
  const t = useTranslations("search");
  const router = useRouter();
  const fmtAmount = useFormatAmount();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [isMac, setIsMac] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Flattened item list drives keyboard navigation across all groups.
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setMounted(true);
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // ── Global ⌘K / Ctrl+K to open, "/" when not typing ──────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ── Focus + body scroll lock while open ──────────────────────────────
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ── Debounced fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      abortRef.current?.abort();
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setGroups(Array.isArray(data.groups) ? data.groups : []);
        setActive(0);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") setGroups([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!listRef.current) return;
    const node = listRef.current.querySelector(`[data-idx="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = useCallback(
    (item: SearchItem | undefined) => {
      if (!item) return;
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (!flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % flat.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + flat.length) % flat.length); }
    else if (e.key === "Enter") { e.preventDefault(); go(flat[active]); }
  }

  const badgeLabel = (type: EntityType, badge: string) => {
    const key = `badges.${type}.${badge}`;
    return t.has(key) ? t(key) : badge.replace(/_/g, " ");
  };

  const kbd = isMac ? "⌘K" : "Ctrl K";

  return (
    <>
      {/* ── Header trigger ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("open")}
        className="group flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-gray-500 transition-colors hover:border-gray-300 hover:bg-white sm:min-w-[220px] lg:min-w-[280px]"
      >
        <Search className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="hidden flex-1 text-start text-sm text-gray-400 sm:inline">
          {t("placeholder")}
        </span>
        <kbd className="ms-auto hidden items-center rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-gray-400 sm:inline-flex">
          {kbd}
        </kbd>
      </button>

      {/* ── Palette modal ──────────────────────────────────────────── */}
      {mounted && open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:pt-[12vh]">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={close}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("title")}
              className="relative flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
            >
              {/* Search field */}
              <div className="flex items-center gap-3 border-b border-gray-100 px-4">
                {loading
                  ? <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-brand-500" aria-hidden="true" />
                  : <Search className="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />}
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKey}
                  placeholder={t("placeholder")}
                  className="h-14 flex-1 border-0 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={close}
                  aria-label={t("close")}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Results */}
              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-2">
                {!query.trim() ? (
                  <div className="px-4 py-10 text-center">
                    <Search className="mx-auto h-8 w-8 text-gray-300" aria-hidden="true" />
                    <p className="mt-3 text-sm text-gray-500">{t("prompt")}</p>
                  </div>
                ) : !loading && flat.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <p className="text-sm font-medium text-gray-900">{t("noResults", { query: query.trim() })}</p>
                    <p className="mt-1 text-sm text-gray-500">{t("noResultsHint")}</p>
                  </div>
                ) : (
                  groups.map((group) => (
                    <div key={group.type} className="px-2 pb-1">
                      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {t(`groups.${group.type}`)}
                      </div>
                      {group.items.map((item) => {
                        const idx = flat.indexOf(item);
                        const Icon = ICONS[item.type];
                        const isActive = idx === active;
                        return (
                          <button
                            key={`${item.type}-${item.id}`}
                            type="button"
                            data-idx={idx}
                            onMouseMove={() => setActive(idx)}
                            onClick={() => go(item)}
                            className={[
                              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start transition-colors",
                              isActive ? "bg-brand-50" : "hover:bg-gray-50",
                            ].join(" ")}
                          >
                            <span className={["flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", ICON_TONE[item.type]].join(" ")}>
                              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-gray-900">{item.title}</span>
                              {item.subtitle && (
                                <span className="block truncate text-[12.5px] text-gray-500">{item.subtitle}</span>
                              )}
                            </span>
                            {item.amount != null && (
                              <span className="flex-shrink-0 font-mono text-[12.5px] font-semibold text-gray-700" dir="ltr">
                                {fmtAmount(item.amount)}
                              </span>
                            )}
                            {item.badge && (
                              <span className={["flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", badgeTone(item.badge)].join(" ")}>
                                {badgeLabel(item.type, item.badge)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hints */}
              <div className="flex items-center gap-4 border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11.5px] text-gray-400">
                <span className="flex items-center gap-1"><KbdKey>↑</KbdKey><KbdKey>↓</KbdKey>{t("hintNavigate")}</span>
                <span className="flex items-center gap-1"><KbdKey><CornerDownLeft className="h-3 w-3" /></KbdKey>{t("hintOpen")}</span>
                <span className="flex items-center gap-1"><KbdKey>esc</KbdKey>{t("hintClose")}</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center rounded border border-gray-200 bg-white px-1 py-0.5 font-mono text-[10px] text-gray-500">
      {children}
    </kbd>
  );
}
