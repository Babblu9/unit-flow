/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['exceljs'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent webpack from bundling exceljs internals
      config.externals = [...(config.externals || []), 'exceljs'];
    }
    return config;
  },
};

module.exports = nextConfig;
