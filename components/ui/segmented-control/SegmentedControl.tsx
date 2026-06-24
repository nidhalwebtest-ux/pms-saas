"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  SegmentedControlOption,
  SegmentedControlProps,
  SegmentedControlSize,
  SegmentedControlVariant,
} from "./types";

/* ============================================================================
 *  Sizing tables
 *
 *  Outer container heights (sm: 32, md: 38, lg: 46) cover the touch target;
 *  inner segments (26 / 30 / 38) sit inside the container's padding.
 * ========================================================================= */

const containerSizeClass: Record<SegmentedControlSize, string> = {
  sm: "p-0.5 rounded-lg",
  md: "p-[3px] rounded-[9px]",
  lg: "p-1 rounded-[10px]",
};

const segmentSizeClass: Record<SegmentedControlSize, string> = {
  sm: "h-[26px] px-2.5 text-[12px] rounded-md gap-1.5",
  md: "h-[30px] px-3 text-[12.5px] rounded-md gap-1.5",
  lg: "h-[38px] px-[18px] text-[13.5px] rounded-[7px] gap-2",
};

const segmentIconSizeClass: Record<SegmentedControlSize, string> = {
  sm: "[&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "[&_svg]:h-4 [&_svg]:w-4",
  lg: "[&_svg]:h-[18px] [&_svg]:w-[18px]",
};

/* ============================================================================
 *  Variant tables — track + segment + sliding-pill treatment
 * ========================================================================= */

const containerVariantClass: Record<SegmentedControlVariant, string> = {
  default:
    "relative inline-flex items-center gap-0.5 bg-subtle border border-border-subtle",
  brand:
    "relative inline-flex items-center gap-0.5 bg-subtle border border-border-subtle",
  ghost:
    "relative inline-flex items-center gap-1 bg-transparent border-0 p-0",
};

const segmentVariantClass: Record<SegmentedControlVariant, string> = {
  default:
    "relative z-[1] inline-flex items-center justify-center whitespace-nowrap " +
    "font-medium text-fg-secondary transition-colors duration-fast " +
    "hover:text-fg " +
    "aria-checked:text-fg " +
    "disabled:text-fg-disabled disabled:cursor-not-allowed disabled:hover:text-fg-disabled " +
    "focus-visible:outline-none focus-visible:shadow-focus",
  brand:
    "relative z-[1] inline-flex items-center justify-center whitespace-nowrap " +
    "font-medium text-fg-secondary transition-colors duration-fast " +
    "hover:text-fg " +
    "aria-checked:text-white " +
    "disabled:text-fg-disabled disabled:cursor-not-allowed disabled:hover:text-fg-disabled " +
    "focus-visible:outline-none focus-visible:shadow-focus",
  ghost:
    "relative inline-flex items-center justify-center whitespace-nowrap " +
    "font-medium text-fg-secondary border border-transparent transition-colors duration-fast " +
    "bg-transparent hover:text-fg " +
    "aria-checked:bg-brand-50 aria-checked:text-brand-700 aria-checked:border-brand-200 " +
    "disabled:text-fg-disabled disabled:cursor-not-allowed disabled:hover:text-fg-disabled " +
    "focus-visible:outline-none focus-visible:shadow-focus",
};

/** Sliding pill — only for `default` and `brand`. `ghost` has no pill. */
const pillVariantClass: Record<SegmentedControlVariant, string> = {
  default: "bg-surface shadow-sm",
  brand:   "bg-brand-500 shadow-sm",
  ghost:   "hidden",
};

/* ============================================================================
 *  Component
 * ========================================================================= */

export function SegmentedControl<V extends string = string>({
  value,
  onValueChange,
  options,
  size = "sm",
  variant = "default",
  equalWidth = false,
  collapseToIcons = false,
  ariaLabel,
  ariaLabelledby,
  className = "",
  testId,
}: SegmentedControlProps<V>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [hasMeasured, setHasMeasured] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  /* Measure the active segment and translate the sliding pill. */
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      if (!container) return;
      const active = container.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
      if (!active) return;
      setBox({
        x: active.offsetLeft,
        y: active.offsetTop,
        w: active.offsetWidth,
        h: active.offsetHeight,
      });
      setHasMeasured(true);
    }

    measure();
    const mo = new MutationObserver(measure);
    mo.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-checked"],
    });
    const ro = new ResizeObserver(measure);
    ro.observe(container);

    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, [value, options]);

  /* Track viewport for `collapseToIcons`. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!collapseToIcons) {
      setCollapsed(false);
      return;
    }
    const breakpoint = typeof collapseToIcons === "number" ? collapseToIcons : 640;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const sync = () => setCollapsed(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [collapseToIcons]);

  /* Keyboard handling — radio-group semantics. Arrow keys move AND select. */
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = options.findIndex((o) => o.value === value);
    if (idx < 0) return;

    const isRTL = typeof document !== "undefined" && document.documentElement.dir === "rtl";

    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") {
      nextIdx = nextEnabled(options, idx, isRTL ? -1 : +1);
    } else if (e.key === "ArrowLeft") {
      nextIdx = nextEnabled(options, idx, isRTL ? +1 : -1);
    } else if (e.key === "ArrowDown") {
      nextIdx = nextEnabled(options, idx, +1);
    } else if (e.key === "ArrowUp") {
      nextIdx = nextEnabled(options, idx, -1);
    } else if (e.key === "Home") {
      nextIdx = nextEnabled(options, -1, +1);
    } else if (e.key === "End") {
      nextIdx = nextEnabled(options, options.length, -1);
    }

    if (nextIdx !== null) {
      e.preventDefault();
      onValueChange(options[nextIdx].value);
      // Focus the newly selected segment.
      const btn = containerRef.current?.querySelector<HTMLButtonElement>(
        `[data-value="${options[nextIdx].value}"]`,
      );
      btn?.focus();
    }
  }

  const containerCls = [
    containerVariantClass[variant],
    containerSizeClass[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const pillCls = [
    // Physical left/top anchor on purpose: box.x/box.y come from offsetLeft/
    // offsetTop and the transform below is physical (LTR) too. Using the logical
    // `start-0` here breaks in RTL — the pill anchors right but translates left,
    // landing it outside the control (e.g. over an adjacent button).
    "absolute top-0 left-0 pointer-events-none z-0",
    "motion-safe:transition-[transform,width,height] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(.4,0,.2,1)]",
    pillVariantClass[variant],
    // Pill radius matches the segment radius — easiest done via segment class
    size === "lg" ? "rounded-[7px]" : "rounded-md",
  ].join(" ");

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      data-testid={testId}
      onKeyDown={handleKeyDown}
      className={containerCls}
    >
      {variant !== "ghost" && hasMeasured && (
        <span
          aria-hidden="true"
          className={pillCls}
          style={{
            transform: `translate(${box.x - parsePad(size)}px, ${box.y - parsePad(size)}px)`,
            width:  box.w,
            height: box.h,
          }}
        />
      )}

      {options.map((opt) => (
        <Segment
          key={opt.value}
          option={opt}
          checked={opt.value === value}
          size={size}
          variant={variant}
          equalWidth={equalWidth}
          collapsed={collapsed}
          onSelect={() => onValueChange(opt.value)}
        />
      ))}
    </div>
  );
}

/** Container padding in px — used to offset the pill against the trigger's
 *  offsetLeft (which is measured from the padding box). */
function parsePad(size: SegmentedControlSize): number {
  return size === "sm" ? 2 : size === "md" ? 3 : 4;
}

function nextEnabled<V extends string>(
  options: SegmentedControlOption<V>[],
  fromIdx: number,
  step: 1 | -1,
): number {
  // Walk in `step` direction until we find a non-disabled option. Wrap.
  let i = fromIdx + step;
  for (let n = 0; n < options.length; n++) {
    if (i < 0) i = options.length - 1;
    if (i >= options.length) i = 0;
    if (!options[i].disabled) return i;
    i += step;
  }
  return fromIdx; // all disabled — stay
}

/* ============================================================================
 *  Segment — one radio button. Roving tabindex: only the active segment is
 *  in the tab order; others get tabIndex={-1}.
 * ========================================================================= */

function Segment<V extends string>({
  option,
  checked,
  size,
  variant,
  equalWidth,
  collapsed,
  onSelect,
}: {
  option: SegmentedControlOption<V>;
  checked: boolean;
  size: SegmentedControlSize;
  variant: SegmentedControlVariant;
  equalWidth: boolean;
  collapsed: boolean;
  onSelect: () => void;
}) {
  const label = option.label;
  const showLabel = label !== undefined && !collapsed;
  const ariaLabel = option.ariaLabel ?? (showLabel ? undefined : label);

  const cls = [
    segmentVariantClass[variant],
    segmentSizeClass[size],
    segmentIconSizeClass[size],
    equalWidth ? "flex-1" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={option.tooltip}
      data-value={option.value}
      tabIndex={checked ? 0 : -1}
      disabled={option.disabled}
      onClick={() => {
        if (option.disabled) return;
        if (!checked) onSelect();
      }}
      className={cls}
    >
      {option.icon}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
