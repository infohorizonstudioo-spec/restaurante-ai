// WebSocket handled by custom server.js — not via Next.js route
// This file exists only as placeholder
export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response('WebSocket endpoint — use ws:// protocol', { status: 426 })
}
