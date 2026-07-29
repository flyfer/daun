import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um bundle autossuficiente em .next/standalone — usado pela imagem Docker.
  // Não atrapalha o deploy na Vercel, que ignora essa opção.
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
