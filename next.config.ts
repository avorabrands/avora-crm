import type { NextConfig } from "next";

// Cache Components is intentionally disabled: every CRM screen is per-user,
// request-time data guarded by Supabase RLS, so standard dynamic rendering with
// revalidatePath() after mutations is simpler and avoids stale private data.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
