"use client";

import { useRef, type ReactNode } from "react";
import { SCREENS, FOCUS, type Rect, type Screen } from "@/lib/marketing/screens";
import { Phone } from "../Device";
import { FocusScreen, Glow, cameraTo } from "../FocusScreen";
import { EASE } from "../motion";
import { useScene, rollNumber, fmtNum } from "./useScene";
import { StackedScreen, CounterChip, CheckChip } from "./SceneParts";

/* Chapters 3–5 — the phone scenes. Real mobile captures only; counters roll to the real values on
 * those screens (20.000 → 40.000 on the pricing page, 1435.000 payments total, 402.000 total due). */

function PhoneStage({ screen, children, side }: { screen: Screen; children: ReactNode; side: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
      <div className="w-[min(72vw,290px)] flex-none">
        <Phone aspect={screen.cssWidth / screen.cssHeight}>{children}</Phone>
      </div>
      <div className="flex flex-col items-center gap-4">{side}</div>
    </div>
  );
}

const reset = (tl: gsap.core.Timeline, cam: HTMLElement | null, hidden: Element[]) => {
  tl.fromTo(cam, { scale: 1, xPercent: 0, yPercent: 0 }, { scale: 1, xPercent: 0, yPercent: 0, duration: 0.01 }, 0);
  tl.fromTo(hidden, { opacity: 0 }, { opacity: 0, duration: 0.01 }, 0);
};

/* ---------------------------------------------------------------- 3 · seasonal pricing */
export function PricingScene({ active, alt, label }: { active: boolean; alt: string; label: string }) {
  const root = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const sc = SCREENS.pricing;
  const P = FOCUS.pricing;

  useScene(root, active, (tl) => {
    const q = (x: string) => root.current!.querySelector<HTMLElement>(x)!;
    const [gDefault, gSeason] = Array.from(root.current!.querySelectorAll<HTMLElement>("[data-glow]"));
    reset(tl, cam.current, [gDefault, gSeason]);
    tl.fromTo(q("[data-chip]"), { opacity: 0, y: 14, filter: "blur(8px)" }, { opacity: 0, duration: 0.01 }, 0);
    tl.to(cam.current, { ...cameraTo(sc, P.view as Rect, 1.6), duration: 0.9, ease: EASE.move }, 0.3);
    tl.to(gDefault, { opacity: 1, duration: 0.35 }, 1.1);
    tl.to(q("[data-chip]"), { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.45 }, 1.1);
    rollNumber(tl, q("[data-num]"), 20000, 20000, 1.1, { duration: 0.01 });
    tl.to(gDefault, { opacity: 0, duration: 0.25, ease: EASE.exit }, 2.2);
    tl.to(gSeason, { opacity: 1, duration: 0.35 }, 2.3);
    rollNumber(tl, q("[data-num]"), 20000, 40000, 2.35, { duration: 0.9 });
    tl.to({}, { duration: 1 });
  });

  return (
    <div ref={root} className="w-full">
      <PhoneStage
        screen={sc}
        side={<div data-chip><CounterChip label={label} value={fmtNum(40000)} /></div>}
      >
        <FocusScreen ref={cam} screen={sc} alt={alt} sizes="290px">
          <Glow screen={sc} rect={P.defaultCard as Rect} />
          <Glow screen={sc} rect={P.seasonCard as Rect} />
        </FocusScreen>
      </PhoneStage>
    </div>
  );
}

/* ---------------------------------------------------------------- 4 · payments + cash box */
export function PaymentsScene({ active, alt, totalLabel, matched }: { active: boolean; alt: string; totalLabel: string; matched: string }) {
  const root = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const sc = SCREENS.payments;

  useScene(root, active, (tl) => {
    const q = (x: string) => root.current!.querySelector<HTMLElement>(x)!;
    const [gPay, gCash] = Array.from(root.current!.querySelectorAll<HTMLElement>("[data-glow]"));
    reset(tl, cam.current, [gPay, gCash, q("[data-cashbox]")]);
    tl.fromTo([q("[data-chip]"), q("[data-matched]")], { opacity: 0, y: 14, filter: "blur(8px)" }, { opacity: 0, duration: 0.01 }, 0);
    tl.fromTo(q("[data-matched] [data-check-path]"), { strokeDashoffset: 1 }, { strokeDashoffset: 1, duration: 0.01 }, 0);
    tl.to(cam.current, { ...cameraTo(sc, FOCUS.payments.view as Rect, 1.5), duration: 0.9, ease: EASE.move }, 0.3);
    tl.to(gPay, { opacity: 1, duration: 0.35 }, 1.1);
    tl.to(q("[data-chip]"), { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.45 }, 1.1);
    rollNumber(tl, q("[data-num]"), 0, 1435000, 1.2, { duration: 0.9 });
    // the daily cash box: same phone, next real screen
    tl.to(gPay, { opacity: 0, duration: 0.2, ease: EASE.exit }, 2.6);
    tl.to(q("[data-cashbox]"), { opacity: 1, duration: 0.35 }, 2.6);
    tl.to(cam.current, { ...cameraTo(SCREENS.cashbox, FOCUS.cashbox.view as Rect, 1.5), duration: 0.7, ease: EASE.move }, 2.6);
    tl.to(gCash, { opacity: 1, duration: 0.4 }, 3.25);
    tl.to(q("[data-matched]"), { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.45 }, 3.35);
    tl.to(q("[data-matched] [data-check-path]"), { strokeDashoffset: 0, duration: 0.3, ease: "power2.out" }, 3.45);
    tl.to({}, { duration: 1 });
  });

  return (
    <div ref={root} className="w-full">
      <PhoneStage
        screen={sc}
        side={
          <>
            <div data-chip><CounterChip label={totalLabel} value={fmtNum(1435000)} /></div>
            <div data-matched><CheckChip label={matched} attr="matched-chip" /></div>
          </>
        }
      >
        <FocusScreen ref={cam} screen={sc} alt={alt} sizes="290px">
          <StackedScreen screen={SCREENS.cashbox} alt="" attr="cashbox" />
          <Glow screen={sc} rect={FOCUS.payments.key as Rect} />
          <Glow screen={SCREENS.cashbox} rect={FOCUS.cashbox.key as Rect} />
        </FocusScreen>
      </PhoneStage>
    </div>
  );
}

/* ---------------------------------------------------------------- 5 · invoices + overdue */
export function InvoicesScene({ active, alt, dueLabel }: { active: boolean; alt: string; dueLabel: string }) {
  const root = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const sc = SCREENS.invoice;

  useScene(root, active, (tl) => {
    const q = (x: string) => root.current!.querySelector<HTMLElement>(x)!;
    const [gInv, gOver] = Array.from(root.current!.querySelectorAll<HTMLElement>("[data-glow]"));
    reset(tl, cam.current, [gInv, gOver, q("[data-overdue]")]);
    tl.fromTo(q("[data-chip]"), { opacity: 0, y: 14, filter: "blur(8px)" }, { opacity: 0, duration: 0.01 }, 0);
    tl.to(cam.current, { ...cameraTo(sc, FOCUS.invoice.view as Rect, 1.5), duration: 0.9, ease: EASE.move }, 0.3);
    tl.to(gInv, { opacity: 1, duration: 0.35 }, 1.1);
    // the overdue list: same phone, next real screen; «المتبقي» glows and the total due rolls
    tl.to(gInv, { opacity: 0, duration: 0.2, ease: EASE.exit }, 2.3);
    tl.to(q("[data-overdue]"), { opacity: 1, duration: 0.35 }, 2.3);
    tl.to(cam.current, { ...cameraTo(SCREENS.overdue, FOCUS.overdue.view as Rect, 1.5), duration: 0.7, ease: EASE.move }, 2.3);
    tl.to(gOver, { opacity: 1, duration: 0.4 }, 2.95);
    tl.to(q("[data-chip]"), { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.45 }, 3.0);
    rollNumber(tl, q("[data-num]"), 0, 402000, 3.05, { duration: 0.9 });
    tl.to({}, { duration: 1 });
  });

  return (
    <div ref={root} className="w-full">
      <PhoneStage screen={sc} side={<div data-chip><CounterChip label={dueLabel} value={fmtNum(402000)} /></div>}>
        <FocusScreen ref={cam} screen={sc} alt={alt} sizes="290px">
          <StackedScreen screen={SCREENS.overdue} alt="" attr="overdue" />
          <Glow screen={sc} rect={FOCUS.invoice.key as Rect} />
          <Glow screen={SCREENS.overdue} rect={FOCUS.overdue.key as Rect} />
        </FocusScreen>
      </PhoneStage>
    </div>
  );
}
