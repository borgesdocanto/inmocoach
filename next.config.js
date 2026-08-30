/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static.tokkobroker.com',
        pathname: '/userprofile/pictures/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        // card.galas.com.ar → /agents
        {
          source: '/:path*',
          destination: '/agents/:path*',
          has: [
            {
              type: 'host',
              value: 'card\\.galas\\.com\\.ar',
            },
          ],
        },
      ],
    };
  },
}

module.exports = nextConfig
