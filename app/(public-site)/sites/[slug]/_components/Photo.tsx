"use client";

import Image from "next/image";
import { HomeModernIcon } from "@heroicons/react/24/outline";

/** Real photo via next/image (optimised) with a branded gradient fallback. */
export default function Photo({
  src, alt, sizes = "(max-width: 640px) 100vw, 33vw", rounded = "rounded-2xl", ratio = "aspect-[4/3]",
}: {
  src?: string | null; alt: string; sizes?: string; rounded?: string; ratio?: string;
}) {
  return (
    <div className={`relative ${ratio} w-full overflow-hidden ${rounded} bg-slate-100`}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--site-primary) 16%, #fff), color-mix(in srgb, var(--site-accent) 22%, #fff))" }}
        >
          <HomeModernIcon className="h-10 w-10 text-white/70" />
        </div>
      )}
    </div>
  );
}
