"use client";

import { useRef } from "react";
import { SCREENS, FOCUS, type Rect } from "@/lib/marketing/screens";
import { Laptop } from "../Device";
import { FocusScreen, Glow, cameraTo } from "../FocusScreen";
import { GoldCheck } from "../GoldCheck";
import { EASE } from "../motion";
import { useScene } from "./useScene";
import s from "../landing.module.css";

/* Chapter 1 — «كل بياناتك في مكان واحد». The camera visits the 4 KPI cards of the real dashboard
 * (as in the video), each gets the gold glow, and its chip below ticks ✓ with the real value. */

const CARDS: Array<{ key: keyof typeof FOCUS.dashboard; value: number }> = [
  { key: "الوصول اليوم", value: 2 },
  { key: "المغادرة", value: 0 },
  { key: "تجاوزات الإقامة", value: 3 },
  { key: "النزلاء الحاليون", value: 3 },
];
const pad = (r: Rect, x = 22, y = 26): Rect => [r[0] - x, r[1] - y, r[2] + 2 * x, r[3] + 2 * y];

export function DashboardScene({ active, alt, labels }: { active: boolean; alt: string; labels: string[] }) {
  const root = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const screen = SCREENS.dashboard;

  useScene(root, active, (tl) => {
    const glows = root.current!.querySelectorAll<HTMLElement>("[data-glow]");
    const chips = root.current!.querySelectorAll<HTMLElement>("[data-kchip]");
    tl.fromTo(cam.current, { scale: 1, xPercent: 0, yPercent: 0 }, { scale: 1, xPercent: 0, yPercent: 0, duration: 0.01 }, 0);
    tl.fromTo(glows, { opacity: 0 }, { opacity: 0, duration: 0.01 }, 0);
    tl.fromTo(chips, { opacity: 0.55 }, { opacity: 0.55, duration: 0.01 }, 0);
    tl.fromTo(root.current!.querySelectorAll("[data-kchip] [data-check-path]"), { strokeDashoffset: 1 }, { strokeDashoffset: 1, duration: 0.01 }, 0);
    tl.fromTo(root.current!.querySelectorAll("[data-kchip] svg"), { scale: 0.6, opacity: 0 }, { scale: 0.6, opacity: 0, duration: 0.01 }, 0);
    CARDS.forEach((c, i) => {
      const at = 0.4 + i * 1.15;
      const rect = FOCUS.dashboard[c.key] as Rect;
      tl.to(cam.current, { ...cameraTo(screen, pad(rect), 2.6), duration: i === 0 ? 0.9 : 0.6, ease: EASE.move }, at);
      if (i > 0) tl.to(glows[i - 1], { opacity: 0, duration: 0.2, ease: EASE.exit }, at);
      const arrive = at + (i === 0 ? 0.85 : 0.55);
      tl.to(glows[i], { opacity: 1, duration: 0.35 }, arrive - 0.1);
      tl.to(chips[i], { opacity: 1, duration: 0.3 }, arrive);
      tl.to(chips[i].querySelector("svg"), { scale: 1, opacity: 1, duration: 0.35 }, arrive);
      tl.to(chips[i].querySelector("[data-check-path]"), { strokeDashoffset: 0, duration: 0.3, ease: "power2.out" }, arrive + 0.08);
    });
    tl.to({}, { duration: 0.8 });
  });

  return (
    <div ref={root} className="w-full">
      <Laptop>
        <FocusScreen ref={cam} screen={screen} alt={alt} sizes="(min-width: 1024px) 680px, 92vw">
          {CARDS.map((c) => (
            <Glow key={c.key} screen={screen} rect={FOCUS.dashboard[c.key] as Rect} />
          ))}
        </FocusScreen>
      </Laptop>
      <ul className="mx-auto mt-7 flex max-w-[640px] list-none flex-wrap justify-center gap-2.5 p-0">
        {CARDS.map((c, i) => (
          <li key={c.key} data-kchip className={`${s.glass} inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[16px] font-semibold md:text-[17px]`}>
            <GoldCheck size={24} drawn />
            <span>{labels[i]}</span>
            <b dir="ltr" className={`${s.goldNum} text-[18px]`}>{c.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
