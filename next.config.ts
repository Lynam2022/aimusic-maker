import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.109", "192.168.1.109:3000", "localhost:3000"],
  // Turbopack (Next.js 16+ default) — empty config silences the webpack warning
  turbopack: {},
  // playwright-core và undici cần chạy như Node.js thuần (không bundle)
  serverExternalPackages: ['playwright-core', 'undici'],
};

export default nextConfig;
