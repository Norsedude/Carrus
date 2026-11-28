import type { NextConfig } from "next";

// Cache Components / partial prefetching (create-next-app defaults) are turned
// off on purpose: nearly every Carrus page reads the session or live
// availability, so the previous request-time rendering model is simpler and
// safer here. See docs/DECISIONS.md (D-004).
const nextConfig: NextConfig = {
  // Listing photos are downscaled in the browser and sent one per request;
  // stay under Vercel's 4.5 MB request limit.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
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
