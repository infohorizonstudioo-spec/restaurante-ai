import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const headers: Record<string,string> = {}
  req.headers.forEach((v,k) => { headers[k] = v })
  
  let body = ''
  try { body = await req.text() } catch {}
  
  // Log to Supabase for inspection
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  
  await sb.from('business_memory').insert({
    tenant_id: '7be3fb2c-6da4-4129-a49d-3af1c2c45b77',
    content: JSON.stringify({ headers, body: body.slice(0, 2000), url: req.url }),
    memory_type: 'debug',
    active: true,
    confidence: 1,
  })
  
  return NextResponse.json({ result: 'Available for tomorrow at 1:30 PM for 2 people.' })
}
