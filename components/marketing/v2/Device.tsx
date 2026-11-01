import type { ReactNode } from "react";
import s from "./landing.module.css";

/* CSS-built devices from the promo video. The screen content (a FocusScreen) is passed as children;
 * the screen keeps the screenshot's own aspect ratio so nothing is stretched or cropped. */

export function Laptop({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${s.laptop} ${className}`}>
      <div className={s.lid}>
        <div className={s.screen} style={{ aspectRatio: "16 / 10" }}>
          {children}
          <div className={s.reflect} />
        </div>
      </div>
      <div className={s.base} />
    </div>
  );
}

export function Phone({
  children,
  className = "",
  aspect = 390 / 844,
}: {
  children: ReactNode;
  className?: string;
  /** width / height of the screen (defaults to the 390×844 phone captures) */
  aspect?: number;
}) {
  return (
    <div className={`${s.phone} ${className}`}>
      <div className={s.screen} style={{ aspectRatio: String(aspect) }}>
        {children}
        <div className={s.island} />
        <div className={s.reflect} />
      </div>
    </div>
  );
}
