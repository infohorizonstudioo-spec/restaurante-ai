'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { UpgradeGate } from '@/components/UpgradeGate'
import type { Feature } from '@/lib/feature-flags'
import { C } from '@/lib/colors'

const CHANNELS = [
  {
    key: 'whatsapp', label: 'WhatsApp', icon: '💬', color: '#25D366',
    description: 'Responde automáticamente a los mensajes de WhatsApp de tus clientes.',
    connectFields: ['phone'],
  },
  {
    key: 'email', label: 'Email', icon: '✉️', color: '#60A5FA',
    description: 'Recibe y responde emails de forma automática.',
    connectFields: [],
  },
  {
    key: 'sms', label: 'SMS', icon: '📱', color: '#F0A84E',
    description: 'Responde a los SMS entrantes automáticamente.',
    connectFields: [],
  },
]

const TONES = [
  { value: 'professional', label: 'Profesional', desc: 'Formal y eficiente' },
  { value: 'friendly', label: 'Cercano', desc: 'Cálido pero profesional' },
  { value: 'casual', label: 'Informal', desc: 'Conversacional y relajado' },
]

type ChannelConfig = {
  channel: string; enabled: boolean; auto_respond: boolean;
  response_tone: string; greeting_message?: string; away_message?: string;
}

export default function CanalesPage() {
  const { tenant, tx } = useTenant()
  const [configs, setConfigs] = useState<Record<string, ChannelConfig>>({})
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connectPhone, setConnectPhone] = useState('')
  const [testTo, setTestTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const tid = tenant?.id

  // ── Load configs ───────────────────────────────────────────
  const loadConfigs = useCallback(async (tenantId: string) => {
    const { data } = await supabase.from('channel_configs')
      .select('*').eq('tenant_id', tenantId)
    const map: Record<string, ChannelConfig> = {}
    for (const c of data || []) map[c.channel] = c
    setConfigs(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (tid) loadConfigs(tid)
  }, [tid, loadConfigs])

  // ── Connect channel ────────────────────────────────────────
  const connectChannel = async (channel: string) => {
    if (!tid) return
    setSaving(true)

    const body: any = { tenant_id: tid, channel }
    if (channel === 'whatsapp') body.phone = connectPhone

    const res = await fetch('/api/channels/connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (data.success) {
      setMessage({ text: `${channel} conectado correctamente`, type: 'success' })
      setConnecting(null)
      loadConfigs(tid)
    } else {
      setMessage({ text: data.error || 'Error al conectar', type: 'error' })
    }
    setSaving(false)
  }

  // ── Update config ──────────────────────────────────────────
  const updateConfig = async (channel: string, updates: Partial<ChannelConfig>) => {
    if (!tid) return
    await fetch('/api/channels/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tid, channel, ...updates }),
    })
    loadConfigs(tid)
  }

  // ── Test channel ───────────────────────────────────────────
  const testChannel = async (channel: string) => {
    if (!tid || !testTo) return
    setSaving(true)
    const res = await fetch('/api/channels/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tid, channel, to: testTo }),
    })
    const data = await res.json()
    setMessage({ text: data.message, type: data.success ? 'success' : 'error' })
    setSaving(false)
  }

  if (!tenant) return <PageLoader />

  return (
    <div className="rz-page-enter" style={{ padding: '32px 40px', maxWidth: 900 }}>
      <h1 style={{ color: C.text, fontSize: 24, fontWeight: 700, margin: 0 }}>
        {tx('Canales de comunicación')}
      </h1>
      <p style={{ color: C.text2, fontSize: 14, marginTop: 6, marginBottom: 32 }}>
        {tx('Conecta y configura los canales por los que tu agente atenderá a tus clientes.')}
      </p>

      {/* Status message */}
      {message && (
        <div style={{
          padding: '12px 20px', borderRadius: 10, marginBottom: 24,
          background: message.type === 'success' ? C.greenDim : C.redDim,
          color: message.type === 'success' ? C.green : C.red,
          fontSize: 14,
        }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{
            float: 'right', background: 'none', border: 'none', color: 'inherit',
            cursor: 'pointer', fontSize: 16,
          }} aria-label="Cerrar">✕</button>
        </div>
      )}

      {/* Channel cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {CHANNELS.map(ch => {
          const cfg = configs[ch.key]
          const isConnected = cfg?.enabled
          const gateFeature: Record<string, Feature> = { whatsapp: 'multichannel_whatsapp', email: 'multichannel_email' }
          const gate = gateFeature[ch.key]
          const card = (
            <div key={ch.key} style={{
              background: C.surface, borderRadius: 16, padding: 28,
              border: `1px solid ${isConnected ? ch.color + '40' : C.border}`,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{ch.icon}</span>
                  <div>
                    <span style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>{ch.label}</span>
                    <div style={{
                      display: 'inline-block', marginLeft: 12, fontSize: 11, fontWeight: 600,
                      padding: '3px 10px', borderRadius: 20,
                      background: isConnected ? C.greenDim : C.redDim,
                      color: isConnected ? C.green : C.red,
                    }}>
                      {isConnected ? tx('Conectado') : tx('Desconectado')}
                    </div>
                  </div>
                </div>

                {isConnected && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <span style={{ color: C.text2, fontSize: 13 }}>{tx('Respuesta automática')}</span>
                    <input type="checkbox" checked={cfg?.auto_respond !== false}
                      onChange={e => updateConfig(ch.key, { auto_respond: e.target.checked })}
                      style={{ width: 18, height: 18, accentColor: C.amber }}
                    />
                  </label>
                )}
              </div>

              <p style={{ color: C.text2, fontSize: 13, margin: '0 0 20px' }}>{ch.description}</p>

              {/* Not connected → Connect button */}
              {!isConnected && connecting !== ch.key && (
                <button onClick={() => setConnecting(ch.key)} style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: ch.color + '20', color: ch.color,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  {tx('Conectar')} {ch.label}
                </button>
              )}

              {/* Connecting form */}
              {connecting === ch.key && (
                <div style={{ padding: 20, background: C.surface2, borderRadius: 12, marginTop: 12 }}>
                  {ch.key === 'whatsapp' && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ color: C.text2, fontSize: 12, display: 'block', marginBottom: 6 }}>
                        {tx('Número de WhatsApp Business')}
                      </label>
                      <input type="tel" value={connectPhone}
                        onChange={e => setConnectPhone(e.target.value)}
                        placeholder="+34 612 345 678"
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 8,
                          background: C.bg, border: `1px solid ${C.border}`,
                          color: C.text, fontSize: 14, outline: 'none',
                        }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => connectChannel(ch.key)} disabled={saving} style={{
                      padding: '10px 24px', borderRadius: 10, border: 'none',
                      background: C.amber, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      opacity: saving ? 0.5 : 1,
                    }}>
                      {saving ? tx('Conectando...') : tx('Conectar')}
                    </button>
                    <button onClick={() => setConnecting(null)} style={{
                      padding: '10px 24px', borderRadius: 10, border: `1px solid ${C.border}`,
                      background: 'transparent', color: C.text2, fontSize: 14, cursor: 'pointer',
                    }}>
                      {tx('Cancelar')}
                    </button>
                  </div>
                </div>
              )}

              {/* Connected → Settings */}
              {isConnected && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    {/* Tone selector */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={{ color: C.text2, fontSize: 12, display: 'block', marginBottom: 8 }}>
                        {tx('Tono de respuesta')}
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {TONES.map(tone => (
                          <button key={tone.value}
                            onClick={() => updateConfig(ch.key, { response_tone: tone.value })}
                            style={{
                              padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
                              background: cfg?.response_tone === tone.value ? C.amberDim : 'transparent',
                              color: cfg?.response_tone === tone.value ? C.amber : C.text2,
                              fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            {tone.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Test */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={{ color: C.text2, fontSize: 12, display: 'block', marginBottom: 8 }}>
                        {tx('Enviar mensaje de prueba')}
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="text" value={testTo}
                          onChange={e => setTestTo(e.target.value)}
                          placeholder={ch.key === 'email' ? 'email@ejemplo.com' : '+34612345678'}
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: 8,
                            background: C.bg, border: `1px solid ${C.border}`,
                            color: C.text, fontSize: 13, outline: 'none',
                          }}
                        />
                        <button onClick={() => testChannel(ch.key)} disabled={saving || !testTo} style={{
                          padding: '8px 16px', borderRadius: 8, border: 'none',
                          background: testTo ? ch.color + '20' : C.surface2,
                          color: testTo ? ch.color : C.text3,
                          fontSize: 12, fontWeight: 600, cursor: testTo ? 'pointer' : 'default',
                        }}>
                          {tx('Test')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Away message */}
                  <div style={{ marginTop: 16 }}>
                    <label style={{ color: C.text2, fontSize: 12, display: 'block', marginBottom: 6 }}>
                      {tx('Mensaje fuera de horario')} <span style={{ color: C.text3 }}>({tx('opcional')})</span>
                    </label>
                    <input type="text" value={cfg?.away_message || ''}
                      onChange={e => updateConfig(ch.key, { away_message: e.target.value })}
                      placeholder={tx('Estamos fuera de horario. Te responderemos pronto.')}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 8,
                        background: C.bg, border: `1px solid ${C.border}`,
                        color: C.text, fontSize: 13, outline: 'none',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
          if (gate) return <div key={ch.key}><UpgradeGate feature={gate}>{card}</UpgradeGate></div>
          return card
        })}
      </div>
    </div>
  )
}
