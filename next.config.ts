import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headless Chromium for Meetup automation: keep it unbundled and ship its binaries
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    // playwright-core loads files (e.g. browsers.json) dynamically, so tracing misses them
    "/api/spike/meetup": ["./node_modules/@sparticuz/chromium/bin/**", "./node_modules/playwright-core/**"],
  },
};

export default nextConfig;
