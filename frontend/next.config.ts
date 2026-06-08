import type { NextConfig } from "next";

const isStaticExport = process.env.CAPACITOR_BUILD === "true" || process.env.BUILD_WEB === "true";

const nextConfig: NextConfig = {
  ...(isStaticExport
    ? {

        output: "export",
        images: { unoptimized: true },
      }
    : {

        images: {
          unoptimized: true,
          qualities: [75, 100],
        },
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://127.0.0.1:8000/api/:path*",
            },
            {
              source: "/ws",
              destination: "http://127.0.0.1:8000/ws",
            },
          ];
        },
      }),
};

export default nextConfig;
