import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  env: {NEXT_PUBLIC_DEPLOYMENT_TARGET: process.env.GSL_LEGACY_SITES === 'true' ? 'sites' : 'vercel'},
  webpack(config, {webpack}) {
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/, (resource: {request:string}) => {
      resource.request = path.resolve(process.cwd(), 'lib/vercel-bindings.ts');
    }));
    return config;
  },
};

export default nextConfig;
