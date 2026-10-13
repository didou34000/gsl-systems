import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  env: {NEXT_PUBLIC_DEPLOYMENT_TARGET: process.env.GSL_LEGACY_SITES === 'true' ? 'sites' : 'vercel'},
  async redirects() {
    return [
      {source:'/secteurs/mecanique-cablage',destination:'/secteurs/pieces-mecaniques',permanent:true},
      {source:'/secteurs/robots-plateformes',destination:'/catalogue',permanent:true},
    ];
  },
  webpack(config, {webpack}) {
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/, (resource: {request:string}) => {
      resource.request = path.resolve(process.cwd(), 'lib/vercel-bindings.ts');
    }));
    return config;
  },
};

export default nextConfig;
