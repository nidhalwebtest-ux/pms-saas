import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  MegaphoneIcon,
  BellAlertIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import type { AlertVariant } from "./types";

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Variant → default icon. Caller can override by passing `icon` on `<Alert>`.
 * Outline style matches the rest of the product chrome (Heroicons 24/outline).
 */
export const variantIcon: Record<AlertVariant, IconCmp> = {
  info:         InformationCircleIcon,
  success:      CheckCircleIcon,
  warning:      ExclamationTriangleIcon,
  error:        ExclamationCircleIcon,
  neutral:      BellAlertIcon,
  announcement: MegaphoneIcon,
};
