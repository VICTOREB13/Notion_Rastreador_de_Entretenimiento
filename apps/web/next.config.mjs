import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "package.json"), "utf-8")
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.NEXT_PUBLIC_APP_VERSION || ("v" + packageJson.version),
  },
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.steamstatic.com",
      },
      {
        protocol: "https",
        hostname: "**.akamaihd.net",
      },
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "notion.so",
      },
      {
        protocol: "https",
        hostname: "**.notion.so",
      },
      {
        protocol: "https",
        hostname: "media.rawg.io",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
  output: "standalone",
  async rewrites() {
    const apiTarget = process.env.INTERNAL_API_URL || "http://127.0.0.1:3001";
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/api/:path*",
          destination: `${apiTarget}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
