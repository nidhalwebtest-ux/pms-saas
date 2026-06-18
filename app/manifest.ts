import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Binaya — Property Management",
    short_name: "Binaya",
    description:
      "Manage properties, tenants, reservations, and payments in one modern platform.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#185FA5",
    icons: [
      { src: "/brand/binaya-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/binaya-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
