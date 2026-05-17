/**
 * Type declaration for `*.svg?react` imports.
 *
 * When a `.svg` file is imported with the `?react` resource query, the SVGR
 * loader (see next.config.ts) replaces the file with a React component that
 * renders the SVG inline. The exported component accepts any standard SVG
 * props plus `title` (for the accessible name).
 *
 * The default export (no query string) keeps Next.js's asset/resource
 * behavior — it resolves to a string URL.
 */

declare module "*.svg?react" {
  import type { FunctionComponent, SVGProps } from "react";
  const ReactComponent: FunctionComponent<SVGProps<SVGSVGElement> & { title?: string }>;
  export default ReactComponent;
}

declare module "*.svg" {
  const src: string;
  export default src;
}
