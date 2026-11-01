"use client";

import { useRef } from "react";
import { SCREENS, FOCUS, type Rect } from "@/lib/marketing/screens";
import { Laptop } from "../Device";
import { FocusScreen, Pulse, pct, cameraTo } from "../FocusScreen";
import { GoldCheck } from "../GoldCheck";
import { EASE } from "../motion";
import { useScene, centerPct } from "./useScene";
import { StackedScreen, Cursor, CheckChip } from "./SceneParts";

/* Chapter 2 — «لا حجز مزدوج بعد اليوم». The video's calendar beat, on the four real captures:
 * push into the calendar → click a free start date → hover the booked unit (the app's own booking
 * card; red pulse + chip are explanatory) → click the end date → the real «حجز جديد» dialog →
 * «إنشاء الحجز» gets the gold ✓. Honest framing: the app blocks the overlap when the booking is
 * saved; the scene ends on the button press, not on an invented "booking created" screen. */

export function CalendarScene({ active, alt, warn, ok }: { active: boolean; alt: string; warn: string; ok: string }) {
  const root = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const base = SCREENS["cal-base"];
  const C = FOCUS.calendar;
  const W = base.cssWidth, H = base.cssHeight;
  const at = (r: readonly number[]) => centerPct(r, W, H);

  useScene(root, active, (tl) => {
    const q = (sel: string) => root.current!.querySelector<HTMLElement>(sel);
    const cursor = q("[data-cursor]");
    const arrow = q("[data-cursor-arrow]");
    const click = (t: number) => tl.to(arrow, { scale: 0.86, duration: 0.08, yoyo: true, repeat: 1, transformOrigin: "0 0", ease: "power1.inOut" }, t);
    const move = (r: readonly number[], t: number, d = 0.45, dy = 0) => {
      const p = at(r);
      tl.to(cursor, { "--cx": p.cx, "--cy": p.cy + dy, duration: d, ease: EASE.move }, t);
    };

    // reset
    tl.fromTo(cam.current, { scale: 1, xPercent: 0, yPercent: 0 }, { scale: 1, xPercent: 0, yPercent: 0, duration: 0.01 }, 0);
    tl.fromTo(["[data-cal-start]", "[data-cal-hover]", "[data-cal-dialog]"].map(q), { opacity: 0 }, { opacity: 0, duration: 0.01 }, 0);
    tl.fromTo([q("[data-pulse]"), q("[data-btnok]"), q("[data-warn]"), q("[data-calok]")], { opacity: 0 }, { opacity: 0, duration: 0.01 }, 0);
    tl.fromTo(root.current!.querySelectorAll("[data-check-path]"), { strokeDashoffset: 1 }, { strokeDashoffset: 1, duration: 0.01 }, 0);
    const start = at(C.startCell);
    tl.fromTo(cursor, { opacity: 0, "--cx": start.cx + 8, "--cy": start.cy + 14 }, { opacity: 0, duration: 0.01 }, 0);

    // 1 · push into the calendar
    tl.to(cam.current, { ...cameraTo(base, C.view as Rect, 2.2), duration: 0.9, ease: EASE.move }, 0.3);
    // 2 · click the first free night
    tl.to(cursor, { opacity: 1, duration: 0.25 }, 1.15);
    move(C.startCell, 1.2, 0.5);
    click(1.75);
    tl.to(q("[data-cal-start]"), { opacity: 1, duration: 0.15 }, 1.8);
    // 3 · hover the booked unit: the app shows its booking card; the pulse + chip explain it
    move(C.firstOccupied, 2.15, 0.6);
    tl.to(q("[data-cal-hover]"), { opacity: 1, duration: 0.15 }, 2.8);
    tl.fromTo(q("[data-pulse]"), { opacity: 0 }, { opacity: 1, duration: 0.18, yoyo: true, repeat: 3, ease: "sine.inOut" }, 2.85);
    tl.fromTo(q("[data-warn]"), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.3 }, 2.85);
    tl.to(q("[data-warn]"), { opacity: 0, duration: 0.25, ease: EASE.exit }, 4.1);
    tl.to(q("[data-cal-hover]"), { opacity: 0, duration: 0.15 }, 4.15);
    // 4 · the last free night → the real «حجز جديد» dialog
    move(C.endCell, 4.2, 0.45);
    click(4.7);
    tl.to(q("[data-cal-dialog]"), { opacity: 1, duration: 0.22 }, 4.78);
    // 5 · press «إنشاء الحجز» → gold ✓
    move(C.createButton, 5.35, 0.45, 1.5);
    click(5.85);
    tl.fromTo(q("[data-btnok]"), { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.3 }, 5.95);
    tl.to(q("[data-btnok] [data-check-path]"), { strokeDashoffset: 0, duration: 0.28, ease: "power2.out" }, 6.02);
    tl.to(cursor, { opacity: 0, duration: 0.25, ease: EASE.exit }, 6.2);
    tl.fromTo(q("[data-calok]"), { opacity: 0, y: 12, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.45 }, 6.3);
    tl.to(q("[data-calok] [data-check-path]"), { strokeDashoffset: 0, duration: 0.3, ease: "power2.out" }, 6.4);
    tl.to({}, { duration: 0.8 });
  });

  return (
    <div ref={root} className="relative w-full">
      {/* explanatory chip (not app UI) */}
      <div className="pointer-events-none absolute inset-x-0 -top-5 z-10 flex justify-center">
        <div data-warn className="rounded-full border border-red-500/70 bg-[#0B1F3A]/90 px-5 py-1.5 text-[15px] font-bold text-white opacity-0 md:text-[16px]">
          {warn}
        </div>
      </div>
      <Laptop>
        <FocusScreen ref={cam} screen={base} alt={alt} sizes="(min-width: 1024px) 680px, 92vw">
          <StackedScreen screen={SCREENS["cal-start"]} alt="" attr="cal-start" />
          <StackedScreen screen={SCREENS["cal-hover"]} alt="" attr="cal-hover" />
          <StackedScreen screen={SCREENS["cal-dialog"]} alt="" attr="cal-dialog" />
          <Pulse screen={base} rect={C.redPulse as Rect} />
          <div data-btnok className="absolute z-[4] grid place-items-center rounded-[10px] bg-[#0B1F3A]/60 opacity-0" style={pct(base, C.createButton as Rect)}>
            <GoldCheck size={22} drawn={false} className="h-[78%] w-auto" />
          </div>
          <Cursor />
        </FocusScreen>
      </Laptop>
      <div className="mt-7 flex justify-center">
        <CheckChip label={ok} attr="calok" className="opacity-0" />
      </div>
    </div>
  );
}
