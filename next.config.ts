import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* cacheComponents / partialPrefetching are disabled: the app serves
     dynamic, DB-backed API routes whose `runtime`/`dynamic` route config
     is incompatible with those experimental features. */
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
