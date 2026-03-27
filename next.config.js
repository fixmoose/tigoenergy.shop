import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'unoruqsweyrmkshmscub.supabase.co',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizeCss: true,
  },
  outputFileTracingIncludes: {
    '/**': [
      './src/lib/email/templates/**/*',
      './src/messages/**/*',
    ],
  },
  compress: true,
  poweredByHeader: false,
  compiler: {
    // Only remove console.log, keep console.error and console.warn for debugging
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  modularizeImports: {
    '@heroicons/react': {
      transform: '@heroicons/react/{{kebabCase member}}/24/outline',
    },
  },
  async redirects() {
    const redirectDomains = [
      'tigoenergy.be',
      'tigoenergy.ch',
      'tigoenergy.dk',
      'tigoenergy.se',
      'tigoenergy.pl',
      'tigoenergy.fr',
      'tigoenergy.es',
      'tigoenergy.ro',
      'tigoenergy.rs',
      'tigoenergy.mk',
      'tigoenergy.me',
      'tigoenergy.uk',
    ]

    return redirectDomains.flatMap((domain) => [
      {
        source: '/:path*',
        has: [{ type: 'host', value: domain }],
        destination: 'https://www.tigoenergy.com/:path*',
        permanent: true,
      },
      {
        source: '/',
        has: [{ type: 'host', value: domain }],
        destination: 'https://www.tigoenergy.com',
        permanent: true,
      },
    ])
  },
  webpack: (config) => {
    // Optimize bundle size
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Optimize image imports
    config.module.rules.push({
      test: /\.(jpe?g|png|webp|avif)$/i,
      type: 'asset',
      generator: {
        filename: 'static/media/[name].[hash][ext]',
      },
      parser: {
        dataUrlCondition: {
          maxSize: 8 * 1024, // 8kb
        },
      },
    });

    return config;
  },
}

export default withNextIntl(nextConfig)
