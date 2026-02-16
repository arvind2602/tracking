import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // TypeScript errors are now enforced during builds.
  // Fix all TS errors rather than suppressing them.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
