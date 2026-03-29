'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { C } from '@/lib/colors'
import { useTenant } from '@/contexts/TenantContext'

// ── Business types from templates.ts ──────────────────────────────────────────
const BUSINESS_TYPES: { id: string; label: string; icon: string }[] = [
  { id: 'restaurante', label: 'Restaurante', icon: '🍽️' },
  { id: 'bar', label: 'Bar / Pub', icon: '🍸' },
  { id: 'cafeteria', label: 'Cafetería', icon: '☕' },
  { id: 'clinica_dental', label: 'Clínica dental', icon: '🦷' },
  { id: 'clinica_medica', label: 'Clínica médica', icon: '🩺' },
  { id: 'veterinaria', label: 'Veterinaria', icon: '🐾' },
  { id: 'peluqueria', label: 'Peluquería', icon: '✂️' },
  { id: 'barberia', label: 'Barbería', icon: '🪒' },
  { id: 'spa', label: 'Spa / Centro estético', icon: '💆' },
  { id: 'fisioterapia', label: 'Fisioterapia', icon: '🏋️' },
  { id: 'psicologia', label: 'Psicología', icon: '🧠' },
  { id: 'asesoria', label: 'Asesoría / Despacho', icon: '💼' },
  { id: 'seguros', label: 'Seguros', icon: '🛡️' },
  { id: 'inmobiliaria', label: 'Inmobiliaria', icon: '🏠' },
  { id: 'hotel', label: 'Hotel', icon: '🏨' },
  { id: 'gimnasio', label: 'Gimnasio', icon: '💪' },
  { id: 'academia', label: 'Academia', icon: '📚' },
  { id: 'taller', label: 'Taller mecánico', icon: '🔧' },
  { id: 'ecommerce', label: 'Ecommerce', icon: '🛒' },
  { id: 'otro', label: 'Otro tipo', icon: '🏢' },
]

const DAYS = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
]

const GREETING_STYLES = [
  { id: 'professional', label: 'Profesional', desc: 'Formal y cortés' },
  { id: 'friendly', label: 'Amigable', desc: 'Cercano y cálido' },
  { id: 'casual', label: 'Casual', desc: 'Relajado y natural' },
]

const LANGUAGES = [
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
]

const STEP_LABELS = ['Tu negocio', 'Tu recepcionista', 'Horarios', '¡Listo!']

interface DaySchedule {
  closed: boolean
  open: string
  close: string
}

type Schedule = Record<string, DaySchedule>

function defaultSchedule(): Schedule {
  const s: Schedule = {}
  for (const d of DAYS) {
    s[d.key] = d.key === 'sun'
      ? { closed: true, open: '09:00', close: '21:00' }
      : { closed: false, open: '09:00', close: '21:00' }
  }
  return s
}

// ── TIME OPTIONS ──────────────────────────────────────────────────────────────
function timeOptions(): string[] {
  const opts: string[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of ['00', '30']) {
      opts.push(`${String(h).padStart(2, '0')}:${m}`)
    }
  }
  return opts
}
const TIME_OPTS = timeOptions()

// ── CONFETTI ──────────────────────────────────────────────────────────────────
function Confetti() {
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; color: string; rot: number; speed: number; size: number; drift: number }[]
  >([])

  useEffect(() => {
    const colors = ['#F0A84E', '#2DD4BF', '#34D399', '#F87171', '#A78BFA', '#60A5FA', '#FB923C', '#FCD34D']
    const p = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -(Math.random() * 20),
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      speed: 1.5 + Math.random() * 3,
      size: 6 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 2,
    }))
    setParticles(p)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rot}deg)`,
            animation: `confetti-fall ${2 + p.speed}s linear forwards`,
            animationDelay: `${Math.random() * 0.8}s`,
            opacity: 0.9,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function OnboardingWizard() {
  const router = useRouter()
  const { tenant, userId, reload } = useTenant()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(tenant?.id ?? null)

  // Step 1
  const [businessName, setBusinessName] = useState(tenant?.name ?? '')
  const [businessType, setBusinessType] = useState(tenant?.type ?? '')
  const [phone, setPhone] = useState(tenant?.agent_phone ?? '')
  const [address, setAddress] = useState(tenant?.address ?? '')

  // Step 2
  const [agentName, setAgentName] = useState(tenant?.agent_name ?? 'Sofia')
  const [greetingStyle, setGreetingStyle] = useState(tenant?.greeting_style ?? 'friendly')
  const [language, setLanguage] = useState(tenant?.language ?? 'es')

  // Step 3
  const [schedule, setSchedule] = useState<Schedule>(
    tenant?.schedule ? (typeof tenant.schedule === 'string' ? JSON.parse(tenant.schedule) : tenant.schedule) : defaultSchedule()
  )

  // Sync when tenant loads
  useEffect(() => {
    if (tenant) {
      setTenantId(tenant.id)
      setBusinessName(tenant.name || '')
      setBusinessType(tenant.type || '')
      setPhone(tenant.agent_phone || '')
      setAddress(tenant.address || '')
      setAgentName(tenant.agent_name || 'Sofia')
      setGreetingStyle(tenant.greeting_style || 'friendly')
      setLanguage(tenant.language || 'es')
      if (tenant.schedule) {
        const sched = typeof tenant.schedule === 'string' ? JSON.parse(tenant.schedule) : tenant.schedule
        setSchedule(sched)
      }
    }
  }, [tenant])

  // ── Save logic ────────────────────────────────────────────────────────────
  const saveStep = useCallback(async (nextStep: number) => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const payload: Record<string, unknown> = {}

      if (step === 0) {
        payload.name = businessName
        payload.type = businessType
        payload.agent_phone = phone
        payload.address = address
      } else if (step === 1) {
        payload.agent_name = agentName
        payload.greeting_style = greetingStyle
        payload.language = language
      } else if (step === 2) {
        payload.schedule = schedule
      }

      if (tenantId) {
        // Update existing tenant
        await supabase.from('tenants').update(payload).eq('id', tenantId)
      } else {
        // Create new tenant + link profile
        payload.plan = 'free'
        const { data: newTenant } = await supabase.from('tenants')
          .insert(payload).select('id').single()
        if (newTenant) {
          setTenantId(newTenant.id)
          await supabase.from('profiles')
            .update({ tenant_id: newTenant.id })
            .eq('id', user.id)
        }
      }

      if (nextStep === 4) {
        // Mark onboarding done
        if (tenantId) {
          await supabase.from('tenants').update({ onboarding_done: true }).eq('id', tenantId)
        }
        reload()
      }

      setStep(nextStep)
    } finally {
      setSaving(false)
    }
  }, [step, tenantId, businessName, businessType, phone, address, agentName, greetingStyle, language, schedule, reload])

  // ── Validation ────────────────────────────────────────────────────────────
  const canAdvance = step === 0
    ? businessName.trim().length > 0 && businessType.length > 0
    : true

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: C.surface2,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    color: C.text,
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 600,
    color: C.text2,
    letterSpacing: '0.02em',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238895A7' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: 36,
    cursor: 'pointer',
  }

  // ── Progress bar ──────────────────────────────────────────────────────────
  function ProgressBar() {
    return (
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          {STEP_LABELS.map((label, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                backgroundColor: i <= step ? C.amber : C.surface2,
                color: i <= step ? '#0C1018' : C.text3,
                transition: 'all 0.3s',
                border: i === step ? `2px solid ${C.amber}` : '2px solid transparent',
                boxShadow: i === step ? '0 0 16px rgba(240,168,78,0.3)' : 'none',
              }}>
                {i < step ? '\u2713' : i + 1}
              </div>
              <span style={{
                fontSize: 11,
                marginTop: 6,
                color: i <= step ? C.text : C.text3,
                fontWeight: i === step ? 600 : 400,
                textAlign: 'center',
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <div style={{
          height: 3,
          backgroundColor: C.surface2,
          borderRadius: 4,
          overflow: 'hidden',
          marginTop: 4,
        }}>
          <div style={{
            height: '100%',
            width: `${(step / (STEP_LABELS.length - 1)) * 100}%`,
            backgroundColor: C.amber,
            borderRadius: 4,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>
    )
  }

  // ── Step 1: Tu negocio ────────────────────────────────────────────────────
  function Step1() {
    return (
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Tu negocio
        </h2>
        <p style={{ fontSize: 14, color: C.text2, marginBottom: 28 }}>
          Cuéntanos sobre tu negocio para personalizar tu experiencia.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Business name */}
          <div>
            <label style={labelStyle}>Nombre del negocio *</label>
            <input
              style={inputStyle}
              placeholder="Ej: Restaurante La Plaza"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
            />
          </div>

          {/* Business type */}
          <div>
            <label style={labelStyle}>Tipo de negocio *</label>
            <select
              style={selectStyle}
              value={businessType}
              onChange={e => setBusinessType(e.target.value)}
            >
              <option value="">Selecciona un tipo...</option>
              {BUSINESS_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>

          {/* Phone */}
          <div>
            <label style={labelStyle}>Teléfono</label>
            <input
              style={inputStyle}
              placeholder="+34 600 000 000"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              type="tel"
            />
          </div>

          {/* Address */}
          <div>
            <label style={labelStyle}>Dirección (opcional)</label>
            <input
              style={inputStyle}
              placeholder="Calle, ciudad, código postal"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: Tu recepcionista ──────────────────────────────────────────────
  function Step2() {
    return (
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Tu recepcionista
        </h2>
        <p style={{ fontSize: 14, color: C.text2, marginBottom: 28 }}>
          Configura la personalidad de tu agente de voz.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Agent name */}
          <div>
            <label style={labelStyle}>Nombre del agente</label>
            <input
              style={inputStyle}
              placeholder="Sofia"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
            />
          </div>

          {/* Greeting style */}
          <div>
            <label style={labelStyle}>Estilo de saludo</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {GREETING_STYLES.map(gs => (
                <label
                  key={gs.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: `1px solid ${greetingStyle === gs.id ? C.amber : C.border}`,
                    backgroundColor: greetingStyle === gs.id ? 'rgba(240,168,78,0.06)' : C.surface2,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${greetingStyle === gs.id ? C.amber : C.text3}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {greetingStyle === gs.id && (
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: C.amber,
                      }} />
                    )}
                  </div>
                  <input
                    type="radio"
                    name="greeting"
                    value={gs.id}
                    checked={greetingStyle === gs.id}
                    onChange={() => setGreetingStyle(gs.id)}
                    style={{ display: 'none' }}
                  />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{gs.label}</div>
                    <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>{gs.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label style={labelStyle}>Idioma</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {LANGUAGES.map(lang => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setLanguage(lang.id)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: `1px solid ${language === lang.id ? C.amber : C.border}`,
                    backgroundColor: language === lang.id ? 'rgba(240,168,78,0.06)' : C.surface2,
                    color: C.text,
                    fontSize: 14,
                    fontWeight: language === lang.id ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{lang.flag}</span>
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: Horarios ──────────────────────────────────────────────────────
  function Step3() {
    const updateDay = (key: string, field: keyof DaySchedule, value: string | boolean) => {
      setSchedule(prev => ({
        ...prev,
        [key]: { ...prev[key], [field]: value },
      }))
    }

    return (
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Horarios
        </h2>
        <p style={{ fontSize: 14, color: C.text2, marginBottom: 28 }}>
          Define cuándo tu agente atenderá llamadas.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '110px 1fr 1fr 60px',
            gap: 8,
            padding: '0 4px 8px',
            borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text3 }}>Día</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text3 }}>Apertura</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text3 }}>Cierre</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text3, textAlign: 'center' }}>Cerrado</span>
          </div>

          {DAYS.map(day => {
            const d = schedule[day.key]
            return (
              <div
                key={day.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 1fr 60px',
                  gap: 8,
                  alignItems: 'center',
                  padding: '8px 4px',
                  borderRadius: 8,
                  backgroundColor: d.closed ? 'rgba(248,113,113,0.04)' : 'transparent',
                }}
              >
                <span style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: d.closed ? C.text3 : C.text,
                }}>
                  {day.label}
                </span>

                <select
                  style={{
                    ...selectStyle,
                    padding: '8px 12px',
                    fontSize: 13,
                    opacity: d.closed ? 0.3 : 1,
                    pointerEvents: d.closed ? 'none' : 'auto',
                  }}
                  value={d.open}
                  onChange={e => updateDay(day.key, 'open', e.target.value)}
                  disabled={d.closed}
                >
                  {TIME_OPTS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <select
                  style={{
                    ...selectStyle,
                    padding: '8px 12px',
                    fontSize: 13,
                    opacity: d.closed ? 0.3 : 1,
                    pointerEvents: d.closed ? 'none' : 'auto',
                  }}
                  value={d.close}
                  onChange={e => updateDay(day.key, 'close', e.target.value)}
                  disabled={d.closed}
                >
                  {TIME_OPTS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => updateDay(day.key, 'closed', !d.closed)}
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 11,
                      border: 'none',
                      backgroundColor: d.closed ? C.red : C.surface2,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      position: 'absolute',
                      top: 3,
                      left: d.closed ? 21 : 3,
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Step 4: Listo ─────────────────────────────────────────────────────────
  function Step4() {
    const typeName = BUSINESS_TYPES.find(b => b.id === businessType)?.label || businessType
    const typeIcon = BUSINESS_TYPES.find(b => b.id === businessType)?.icon || '🏢'
    const langName = LANGUAGES.find(l => l.id === language)?.label || language
    const styleName = GREETING_STYLES.find(g => g.id === greetingStyle)?.label || greetingStyle

    // Count open days
    const openDays = DAYS.filter(d => !schedule[d.key].closed)

    return (
      <div style={{ textAlign: 'center' }}>
        <Confetti />

        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          ¡Todo listo!
        </h2>
        <p style={{ fontSize: 15, color: C.text2, marginBottom: 32 }}>
          Tu agente está listo para atender llamadas.
        </p>

        {/* Summary card */}
        <div style={{
          backgroundColor: C.surface2,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 24,
          textAlign: 'left',
          marginBottom: 32,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Business */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: 'rgba(240,168,78,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}>
                {typeIcon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{businessName}</div>
                <div style={{ fontSize: 12, color: C.text2 }}>{typeName}</div>
              </div>
            </div>

            <div style={{ height: 1, backgroundColor: C.border }} />

            {/* Agent */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: 'rgba(45,212,191,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}>
                🤖
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{agentName}</div>
                <div style={{ fontSize: 12, color: C.text2 }}>{styleName} · {langName}</div>
              </div>
            </div>

            <div style={{ height: 1, backgroundColor: C.border }} />

            {/* Schedule */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: 'rgba(52,211,153,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}>
                🕐
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                  {openDays.length} días activo
                </div>
                <div style={{ fontSize: 12, color: C.text2 }}>
                  {openDays.map(d => d.label.slice(0, 3)).join(', ')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => router.push('/panel')}
          style={{
            width: '100%',
            padding: '16px 24px',
            borderRadius: 12,
            border: 'none',
            backgroundColor: C.amber,
            color: '#0C1018',
            fontSize: 17,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s',
            boxShadow: '0 4px 24px rgba(240,168,78,0.3)',
          }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.transform = 'translateY(-1px)'
            ;(e.target as HTMLElement).style.boxShadow = '0 6px 32px rgba(240,168,78,0.4)'
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.transform = 'translateY(0)'
            ;(e.target as HTMLElement).style.boxShadow = '0 4px 24px rgba(240,168,78,0.3)'
          }}
        >
          Ir al panel →
        </button>
      </div>
    )
  }

  // ── Navigation buttons ────────────────────────────────────────────────────
  function NavButtons() {
    return (
      <div style={{
        display: 'flex',
        gap: 12,
        marginTop: 32,
        justifyContent: step === 0 ? 'flex-end' : 'space-between',
      }}>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            style={{
              padding: '12px 28px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              backgroundColor: 'transparent',
              color: C.text2,
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Atrás
          </button>
        )}
        <button
          type="button"
          disabled={!canAdvance || saving}
          onClick={() => saveStep(step + 1)}
          style={{
            padding: '12px 32px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: canAdvance ? C.amber : C.surface2,
            color: canAdvance ? '#0C1018' : C.text3,
            fontSize: 15,
            fontWeight: 600,
            cursor: canAdvance && !saving ? 'pointer' : 'not-allowed',
            opacity: saving ? 0.7 : 1,
            transition: 'all 0.2s',
            minWidth: 140,
          }}
        >
          {saving ? 'Guardando...' : step === 2 ? 'Finalizar' : 'Siguiente'}
        </button>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: C.bg,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '40px 16px 60px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 540,
      }}>
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
            reservo<span style={{ color: C.amber }}>.ai</span>
          </div>
          <p style={{ fontSize: 13, color: C.text3, marginTop: 4 }}>Configura tu negocio en 2 minutos</p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          padding: step === 3 ? '32px 28px' : '28px 28px 32px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        }}>
          <ProgressBar />

          {step === 0 && <Step1 />}
          {step === 1 && <Step2 />}
          {step === 2 && <Step3 />}
          {step === 3 && <Step4 />}

          {step < 3 && <NavButtons />}
        </div>
      </div>
    </div>
  )
}
