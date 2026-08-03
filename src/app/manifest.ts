import type { MetadataRoute } from "next";

/**
 * PWA manifest (master plan §10 Phase 6). Colours come from
 * design-system/MASTER.md: graphite background, electric-blue primary.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Провизия — кухня под контролем",
    short_name: "Провизия",
    description:
      "Запасы, рацион, чеки, финансы и вес — один домашний контур в одном приложении.",
    // Straight into the app; the proxy redirects to /login when signed out.
    start_url: "/inventory",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0C10",
    theme_color: "#0A0C10",
    lang: "ru",
    categories: ["food", "lifestyle", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Padded so Android launchers can crop to any shape without clipping.
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
