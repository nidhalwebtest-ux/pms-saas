"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

const META_PIXEL_ID = "1601162191179211";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * The base code fires PageView once on the initial hard load. App Router
 * navigations don't reload the page, so this fires PageView on every later
 * route change. Comparing against the last tracked URL (instead of a
 * "first render" flag) keeps it to one event per URL, even under StrictMode.
 */
function PageViewOnRouteChange() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams.toString()}`;
  const lastTracked = useRef(url);

  useEffect(() => {
    if (lastTracked.current === url) return;
    lastTracked.current = url;
    window.fbq?.("track", "PageView");
  }, [url]);

  return null;
}

export function MetaPixel() {
  return (
    <>
      {/* afterInteractive: fbevents.js loads async after hydration, never blocking first paint */}
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
      {/* useSearchParams needs a Suspense boundary or it opts the whole tree out of static rendering */}
      <Suspense fallback={null}>
        <PageViewOnRouteChange />
      </Suspense>
    </>
  );
}
