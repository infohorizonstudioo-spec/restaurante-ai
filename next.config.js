/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ['twilio', '@anthropic-ai/sdk', 'elevenlabs', '@deepgram/sdk', 'ws'],
  experimental: {
    serverComponentsExternalPackages: ['twilio', '@anthropic-ai/sdk', 'elevenlabs', '@deepgram/sdk', 'ws'],
  },
}
module.exports = nextConfig