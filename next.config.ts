import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite resolves its own WASM and data files relative to the installed package, so it must be
  // loaded from node_modules at runtime instead of being bundled into the server chunk.
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
