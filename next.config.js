/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  serverExternalPackages: [
    'twilio',
    '@anthropic-ai/sdk',
    'elevenlabs',
    '@deepgram/sdk',
    'ws',
    'stripe',
  ],
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ]
    }]
  },
  async rewrites() {
    return [
      // API versioning: /api/v1/* → /api/* (forward-compatible)
      {
        source: '/api/v1/:path*',
        destination: '/api/:path*',
      },
    ]
  },
  async redirects() {
    return [
      { source: '/panel/reservas', destination: '/reservas', permanent: true },
      { source: '/panel/mesas',    destination: '/mesas',    permanent: true },
      { source: '/panel/pedidos',  destination: '/pedidos',  permanent: true },
      { source: '/panel/agenda',   destination: '/agenda',   permanent: true },
      { source: '/panel/clientes', destination: '/clientes', permanent: true },
      { source: '/panel/llamadas', destination: '/llamadas', permanent: true },
    ]
  },
}
module.exports = nextConfig
