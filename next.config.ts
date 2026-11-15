import type { NextConfig } from "next";

// Cache Components / partial prefetching (create-next-app defaults) are turned
// off on purpose: nearly every Carrus page reads the session or live
// availability, so the previous request-time rendering model is simpler and
// safer here. See docs/DECISIONS.md (D-004).
const nextConfig: NextConfig = {
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
