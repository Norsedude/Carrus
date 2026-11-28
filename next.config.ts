import type { NextConfig } from "next";

// Cache Components / partial prefetching (create-next-app defaults) are turned
// off on purpose: nearly every Carrus page reads the session or live
// availability, so the previous request-time rendering model is simpler and
// safer here. See docs/DECISIONS.md (D-004).
const nextConfig: NextConfig = {
  experimental: {
    // Photos (listing photos and the three pickup-check photos) are downscaled
    // in the browser, so every request stays under Vercel's 4.5 MB limit.
    serverActions: { bodySizeLimit: "4mb" },
    proxyClientMaxBodySize: "4mb",
  },
  // AVIF first (smaller), WebP fallback, for optimized local images.
  // Partner photos in the hosted Supabase bucket are resized per device.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/vehicle-photos/**" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
