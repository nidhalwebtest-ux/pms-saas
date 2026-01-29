"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

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

  function handleDismiss() {
    setIsOpen(false);
    setTimeout(() => {
      router.back(); // Go back to the list view
    }, 300); // Wait for animation to finish
  }

  return (
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
        onClick={handleDismiss}
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
                        onClick={handleDismiss}
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
  );
}
