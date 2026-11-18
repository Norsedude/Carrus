import type { NextConfig } from "next";

// Cache Components / partial prefetching (create-next-app defaults) are turned
// off on purpose: nearly every Carrus page reads the session or live
// availability, so the previous request-time rendering model is simpler and
// safer here. See docs/DECISIONS.md (D-004).
const nextConfig: NextConfig = {
  experimental: {
    // The pickup condition check (F6) sends three photos of up to 10 MB each in
    // one form. Both limits default lower (1 MB for actions, 10 MB for bodies
    // passing through src/proxy.ts), which would cut those uploads off.
    serverActions: { bodySizeLimit: "32mb" },
    proxyClientMaxBodySize: "32mb",
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
