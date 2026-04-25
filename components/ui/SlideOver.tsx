"use client";

import { useRouter } from "next/navigation";
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

type SlideOverApi = {
  /** Close the panel (animated) and let the @modal slot fall back to default. */
  dismiss: () => void;
  /**
   * Close the panel (animated) and replace the URL with `href`. Use this from
   * a child form on successful save so the modal slides out before the
   * destination page mounts.
   */
  closeAndNavigate: (href: string) => void;
};

const SlideOverContext = createContext<SlideOverApi | null>(null);

export function useSlideOver(): SlideOverApi | null {
  return useContext(SlideOverContext);
}

export default function SlideOver({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Trigger animation after mount
  useEffect(() => {
    setIsOpen(true);
  }, []);

  const dismiss = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => router.back(), 300);
  }, [router]);

  const closeAndNavigate = useCallback(
    (href: string) => {
      setIsOpen(false);
      setTimeout(() => {
        // replace() drops /new from history so back-button doesn't reopen it.
        router.replace(href);
      }, 300);
    },
    [router],
  );

  return (
    <SlideOverContext.Provider value={{ dismiss, closeAndNavigate }}>
      <div
        className="relative z-50"
        aria-labelledby="slide-over-title"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity duration-300 ease-in-out ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={dismiss}
        />

        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              {/* The Drawer Panel */}
              <div
                className={`pointer-events-auto w-screen max-w-2xl transform transition duration-300 ease-in-out sm:duration-300 ${
                  isOpen ? "translate-x-0" : "translate-x-full"
                }`}
              >
                <div className="flex h-full flex-col overflow-y-scroll bg-white py-6 shadow-xl">
                  <div className="px-4 sm:px-6">
                    <div className="flex items-start justify-between">
                      <h2
                        className="text-xl font-semibold leading-6 text-gray-900"
                        id="slide-over-title"
                      >
                        {title || "Details"}
                      </h2>
                      <div className="ml-3 flex h-7 items-center">
                        <button
                          type="button"
                          className="relative rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                          onClick={dismiss}
                        >
                          <span className="absolute -inset-2.5" />
                          <span className="sr-only">Close panel</span>
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="relative mt-6 flex-1 px-4 sm:px-6">
                    {children}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideOverContext.Provider>
  );
}
