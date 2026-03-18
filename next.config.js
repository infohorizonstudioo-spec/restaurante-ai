/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: [
    'twilio',
    '@anthropic-ai/sdk',
    'elevenlabs',
    '@deepgram/sdk',
    'ws',
    'stripe',
  ],
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
