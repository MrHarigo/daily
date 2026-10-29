import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headless Chromium for Meetup automation: keep it unbundled and ship its binaries
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/spike/meetup": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
