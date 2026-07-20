import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// A production build with NEXT_PUBLIC_API_URL unset would silently bake in
// the frontend/lib/api.ts localhost fallback, so every deployed visitor's
// browser would try to hit their OWN machine's localhost:8000 instead of
// the real backend. Fail the build loudly instead of shipping that.
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is required for a production build. " +
      "Set it to the deployed backend URL (e.g. https://<your-backend>.up.railway.app) " +
      "before running `next build`.",
  );
}

/** @type {import('next').RemotePattern[]} */
function configuredImageHosts() {
  const urls = [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    "https://raw.githubusercontent.com",
    ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ];

  const patterns = [];
  for (const raw of urls) {
    if (!raw) continue;
    try {
      const url = new URL(raw);
      patterns.push({
        protocol: url.protocol.replace(":", ""),
        hostname: url.hostname,
      });
    } catch {
      patterns.push({ protocol: "https", hostname: raw });
    }
  }

  if (process.env.NODE_ENV !== "production") {
    patterns.push({ protocol: "http", hostname: "localhost" });
    patterns.push({ protocol: "http", hostname: "127.0.0.1" });
  }

  return patterns;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  outputFileTracingRoot: path.join(__dirname, ".."),
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    remotePatterns: configuredImageHosts(),
  },
  webpack: (config) => {
    config.externals = [...config.externals, { canvas: "canvas" }];
    return config;
  },
};

export default nextConfig;
