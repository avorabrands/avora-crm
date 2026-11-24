import type { MetadataRoute } from "next";

/** Lets staff and clients "Add to Home Screen" and open it full-screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Avora Brands",
    short_name: "Avora",
    description: "One Workspace. Every Client. Every Project.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fc",
    theme_color: "#111827",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
