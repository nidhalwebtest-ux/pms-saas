"use client";

import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import type { FieldSize } from "./types";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "role" | "aria-checked" | "onClick"
>;

export interface ToggleProps extends NativeButtonProps {
  /** Visible label rendered next to the track. */
  label: ReactNode;
  /** Optional helper text below the label. */
  description?: ReactNode;
  /** Controlled state. */
  checked?: boolean;
  /** Uncontrolled initial state. */
  defaultChecked?: boolean;
  /** Fires when the user toggles. */
  onCheckedChange?: (checked: boolean) => void;
  /** Disabled. */
  disabled?: boolean;
  /** Sizing — affects label only; track stays 36x20. */
  size?: FieldSize;
  /** Where the label sits relative to the track. Default: "end". */
  labelPosition?: "start" | "end";
  /** Outer wrapper class. */
  className?: string;
}

const labelSize: Record<FieldSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-md",
};

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  {
    label,
    description,
    checked,
    defaultChecked,
    onCheckedChange,
    disabled,
    size = "md",
    labelPosition = "end",
    className = "",
    id,
    name,
    ...rest
  },
  ref,
) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(!!defaultChecked);
  const isOn = isControlled ? !!checked : internal;

  const toggle = () => {
    if (disabled) return;
    const next = !isOn;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  };

  const trackClass = `relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
    transition-colors duration-fast ease-out
    focus-visible:outline-none focus-visible:shadow-focus
    ${disabled ? "cursor-not-allowed bg-gray-200" : isOn ? "bg-brand-500" : "bg-gray-300"}`;

  const thumbClass = `pointer-events-none absolute top-0.5 inline-flex h-4 w-4 rounded-full bg-white shadow-sm
    transition-transform duration-fast ease-spring
    ${isOn ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5"}
    ${disabled ? "bg-gray-100" : ""}`;

  const labelNode = (
    <span className="flex flex-col">
      <span
        className={`${labelSize[size]} leading-tight ${
          disabled ? "text-fg-disabled" : "text-fg"
        }`}
      >
        {label}
      </span>
      {description && (
        <span className="mt-0.5 text-xs leading-snug text-fg-tertiary">
          {description}
        </span>
      )}
    </span>
  );

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-3 ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
    >
      {labelPosition === "start" && labelNode}
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={toggle}
        className={trackClass}
        {...rest}
      >
        <span className={thumbClass} aria-hidden="true" />
      </button>
      {/* Hidden field so native form submission carries the value. */}
      {name && (
        <input type="hidden" name={name} value={isOn ? "on" : ""} />
      )}
      {labelPosition === "end" && labelNode}
    </label>
  );
});
