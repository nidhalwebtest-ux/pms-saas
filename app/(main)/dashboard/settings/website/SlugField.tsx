"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { Spinner } from "@/components/ui";
import { isValidSlug, isReservedSlug } from "@/lib/public-site/subdomain";
import { checkSlug } from "./actions";

export type SlugStatus = "idle" | "checking" | "available" | "invalid" | "reserved" | "taken";

export default function SlugField({
  value,
  onChange,
  onStatus,
  rootDomain,
}: {
  value: string;
  onChange: (v: string) => void;
  onStatus: (s: SlugStatus) => void;
  rootDomain: string;
}) {
  const t = useTranslations("settings.website");
  const [status, setStatus] = useState<SlugStatus>("idle");
  const seq = useRef(0);

  // Sanitize keystrokes to valid slug chars as the user types.
  const handle = (raw: string) => {
    const clean = raw.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
    onChange(clean);
  };

  useEffect(() => {
    const s = value.trim().toLowerCase();
    const set = (v: SlugStatus) => { setStatus(v); onStatus(v); };

    if (!s) { set("idle"); return; }
    if (isReservedSlug(s)) { set("reserved"); return; }
    if (!isValidSlug(s)) { set("invalid"); return; }

    set("checking");
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      const res = await checkSlug(s);
      if (id !== seq.current) return; // stale
      if (!res.ok) { set("invalid"); return; }
      set(res.available ? "available" : (res as { reason: SlugStatus }).reason);
    }, 400);
    return () => clearTimeout(timer);
  }, [value, onStatus]);

  const ring =
    status === "available" ? "ring-green-500/50 border-green-400"
    : status === "checking" || status === "idle" ? "border-gray-300 focus-within:ring-blue-500/30"
    : "ring-red-500/40 border-red-400";

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {t("fields.subdomain")} <span className="text-red-500">*</span>
      </label>
      <div
        dir="ltr"
        className={`flex items-stretch overflow-hidden rounded-lg border bg-white ring-2 ring-transparent transition ${ring}`}
      >
        <input
          value={value}
          onChange={(e) => handle(e.target.value)}
          placeholder="my-hotel"
          className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none placeholder:text-gray-300"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <span className="flex items-center gap-1.5 whitespace-nowrap bg-gray-50 px-3 text-sm text-gray-500 border-l border-gray-200">
          .{rootDomain}
          <span className="ms-1">
            {status === "checking" && <span className="text-gray-400"><Spinner size={16} /></span>}
            {status === "available" && <CheckCircleIcon className="h-5 w-5 text-green-500" />}
            {(status === "invalid" || status === "reserved" || status === "taken") && (
              <XCircleIcon className="h-5 w-5 text-red-500" />
            )}
          </span>
        </span>
      </div>
      <p className={`mt-1.5 text-xs ${
        status === "available" ? "text-green-600"
        : status === "idle" || status === "checking" ? "text-gray-500"
        : "text-red-600"
      }`}>
        {status === "available" && t("slug.available", { host: `${value}.${rootDomain}` })}
        {status === "taken" && t("slug.taken")}
        {status === "reserved" && t("slug.reserved")}
        {status === "invalid" && t("slug.invalid")}
        {(status === "idle" || status === "checking") && t("slug.hint")}
      </p>
    </div>
  );
}
