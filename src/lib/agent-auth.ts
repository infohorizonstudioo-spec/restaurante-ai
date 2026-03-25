import { NextRequest } from 'next/server'

export function validateAgentKey(req: NextRequest): boolean {
  const key = req.headers.get('x-agent-key')
  const expected = process.env.AGENT_API_KEY
  if (!expected) return false // Fail closed: reject if no key configured
  return key === expected
}
