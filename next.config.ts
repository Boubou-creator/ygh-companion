import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['node:sqlite'],
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
};
export default config;
