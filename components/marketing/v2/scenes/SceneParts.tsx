import Image from "next/image";
import type { ReactNode } from "react";
import type { Screen } from "@/lib/marketing/screens";
import { GoldCheck } from "../GoldCheck";
import s from "../landing.module.css";

/* Small building blocks shared by the chapter scenes. Everything inside a device is a real capture;
 * chips and the cursor are explanatory overlays, never redrawn app UI. */

/** An extra real screen stacked on the camera layer (cross-faded in by the scene timeline). */
export function StackedScreen({ screen, alt, attr }: { screen: Screen; alt: string; attr: string }) {
  return (
    <Image
      {...{ [`data-${attr}`]: "" }}
      src={screen.src}
      alt={alt}
      width={screen.width}
      height={screen.height}
      unoptimized
      draggable={false}
      className="absolute inset-0 h-full w-full object-cover object-top opacity-0"
    />
  );
}

/** Glass chip with a label and a gold number (counters). The visible number is rolled by the scene. */
export function CounterChip({ label, value, numAttr = "num", className = "" }: { label: string; value: string; numAttr?: string; className?: string }) {
  return (
    <div className={`${s.glass} inline-flex flex-col items-center px-7 py-3 ${className}`}>
      <small className="text-[15px] leading-[1.5] text-white/75 md:text-[16px]">{label}</small>
      <b {...{ [`data-${numAttr}`]: "" }} dir="ltr" className={`${s.goldNum} text-[40px] font-bold leading-[1.15] md:text-[46px]`}>
        {value}
      </b>
    </div>
  );
}

/** Glass chip with a gold ✓ (drawn by the scene via [data-check-path]) and a short label. */
export function CheckChip({ label, attr, className = "" }: { label: ReactNode; attr: string; className?: string }) {
  return (
    <div {...{ [`data-${attr}`]: "" }} className={`${s.glass} inline-flex items-center gap-3 px-5 py-2.5 text-[17px] font-bold md:text-[19px] ${className}`}>
      <GoldCheck size={30} drawn={false} />
      <span>{label}</span>
    </div>
  );
}

/** The click cursor that moves over a screen. Lives on a full-size layer translated by --cx/--cy (%),
 * so it stays locked to the UI at any device size and through the camera zoom. */
export function Cursor({ attr = "cursor" }: { attr?: string }) {
  return (
    <div
      {...{ [`data-${attr}`]: "" }}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] opacity-0"
      style={{ transform: "translate(calc(var(--cx, 50) * 1%), calc(var(--cy, 50) * 1%))" }}
    >
      <svg data-cursor-arrow viewBox="0 0 24 24" className="absolute left-0 top-0 w-[1.9%] min-w-[9px] overflow-visible drop-shadow-[0_2px_3px_rgba(0,0,0,.35)]">
        <path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.4 L17.5 13.4 Z" fill="#fff" stroke="#0B1F3A" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
