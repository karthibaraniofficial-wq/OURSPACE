/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ourspace/types', '@ourspace/validation', '@ourspace/shared'],
  experimental: {
    serverComponentsExternalPackages: ['livekit-server-sdk'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
