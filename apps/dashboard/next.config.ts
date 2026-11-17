import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
    ] }, { source: "/drop", headers: [
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ] }];
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  transpilePackages: ["@repo/ui"],
};

export default nextConfig;
