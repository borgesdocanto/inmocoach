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
    return [
      // Rewrite solo las rutas que NO sean /api
      {
        source: '/:path((?!api).*)',
        destination: '/agents/:path',
        has: [
          {
            type: 'host',
            value: 'card\\.galas\\.com\\.ar',
          },
        ],
      },
      // La raíz de card.galas.com.ar
      {
        source: '/',
        destination: '/agents',
        has: [
          {
            type: 'host',
            value: 'card\\.galas\\.com\\.ar',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
