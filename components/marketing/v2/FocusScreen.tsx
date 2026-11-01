"use client";

import Image from "next/image";
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import type { Rect, Screen } from "@/lib/marketing/screens";
import s from "./landing.module.css";

/* A real app screenshot inside a device screen, on a "camera" layer that can zoom and pan to a UI
 * area (the promo video's camera push). Overlays (glow, pulse, chips) live on the same layer, so
 * they stay locked to the UI as the camera moves. Positions are percentages of the screen. */

export const pct = (screen: Screen, r: Rect): CSSProperties => ({
  left: `${(r[0] / screen.cssWidth) * 100}%`,
  top: `${(r[1] / screen.cssHeight) * 100}%`,
  width: `${(r[2] / screen.cssWidth) * 100}%`,
  height: `${(r[3] / screen.cssHeight) * 100}%`,
});

/** GSAP vars that move the camera so `rect` fills the screen (with margin), clamped to the image edges. */
export function cameraTo(screen: Screen, rect: Rect, maxScale = 2.8, fill = 0.86) {
  const fw = rect[2] / screen.cssWidth;
  const fh = rect[3] / screen.cssHeight;
  const S = Math.max(1, Math.min(maxScale, fill / fw, fill / fh));
  const cx = (rect[0] + rect[2] / 2) / screen.cssWidth;
  const cy = (rect[1] + rect[3] / 2) / screen.cssHeight;
  const clamp = (v: number) => Math.min(0, Math.max((1 - S) * 100, v));
  return {
    scale: +S.toFixed(3),
    xPercent: +clamp((0.5 - S * cx) * 100).toFixed(2),
    yPercent: +clamp((0.5 - S * cy) * 100).toFixed(2),
  };
}

export const CAMERA_HOME = { scale: 1, xPercent: 0, yPercent: 0 };

export const FocusScreen = forwardRef<HTMLDivElement, {
  screen: Screen;
  alt: string;
  /** sizes hint for next/image (the device's rendered width) */
  sizes?: string;
  priority?: boolean;
  children?: ReactNode;
}>(function FocusScreen({ screen, alt, sizes = "(min-width: 1024px) 720px, 92vw", priority = false, children }, ref) {
  return (
    <div ref={ref} className={s.cam}>
      <Image
        src={screen.src}
        alt={alt}
        width={screen.width}
        height={screen.height}
        sizes={sizes}
        priority={priority}
        // served as-is: the WebP is already optimised (55–90 KB) and must stay full-resolution for the zoom
        unoptimized
        draggable={false}
      />
      {children}
    </div>
  );
});

export function Glow({ screen, rect, className = "", id }: { screen: Screen; rect: Rect; className?: string; id?: string }) {
  return <div id={id} data-glow className={`${s.glow} ${className}`} style={pct(screen, rect)} />;
}

export function Pulse({ screen, rect, className = "" }: { screen: Screen; rect: Rect; className?: string }) {
  return <div data-pulse className={`${s.pulse} ${className}`} style={pct(screen, rect)} />;
}
