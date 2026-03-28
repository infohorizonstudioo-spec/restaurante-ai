/**
 * Twilio SIP Domain handler — cuando Retell envía una llamada outbound
 * via SIP, Twilio la recibe aquí y la rutea al número destino via PSTN.
 */
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.text()
  const params = new URLSearchParams(body)
  const to = params.get('To') || params.get('SipDomainSid') || ''
  const from = params.get('From') || ''

  // Extract phone number from SIP URI: sip:+34619781190@reservo-retell.sip.twilio.com
  let destNumber = to
  if (to.startsWith('sip:')) {
    destNumber = to.replace('sip:', '').split('@')[0]
  }
  if (!destNumber.startsWith('+')) {
    destNumber = '+' + destNumber
  }

  // Extract caller from SIP
  let callerNumber = from
  if (from.startsWith('sip:')) {
    callerNumber = from.replace('sip:', '').split('@')[0]
  }
  if (!callerNumber.startsWith('+')) {
    callerNumber = '+' + callerNumber
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerNumber}">
    <Number>${destNumber}</Number>
  </Dial>
</Response>`

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}
