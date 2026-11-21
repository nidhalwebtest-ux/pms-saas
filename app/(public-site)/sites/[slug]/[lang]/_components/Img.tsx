import { getImageProps, type ImageProps } from "next/image";
import { preload } from "react-dom";

/**
 * Optimised responsive image with ZERO client JS: same srcset/sizes as
 * next/image (via getImageProps → Vercel image optimisation), rendered as a
 * plain <img> from a server component. `priority` also preloads it (LCP hero).
 */
export default function Img({ priority, ...rest }: ImageProps) {
  const { props } = getImageProps({ ...rest, priority });
  if (priority && props.srcSet) {
    preload(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "high" });
  }
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} />;
}
