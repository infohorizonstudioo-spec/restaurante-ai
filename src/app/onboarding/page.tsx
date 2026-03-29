'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { C } from '@/lib/colors'
import { useTenant } from '@/contexts/TenantContext'

// ── Active types (hospitality focus) ─────────────────────────────────────────
const ACTIVE_TYPES = ['restaurante', 'bar', 'cafeteria']

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

function ComingSoonRotator() {
  const coming = BUSINESS_TYPES.filter(t => !ACTIVE_TYPES.includes(t.id))
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % coming.length), 2200)
    return () => clearInterval(t)
  }, [coming.length])
  const item = coming[idx]
  if (!item) return null
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'rgba(255,255,255,0.02)', border:`1px solid ${C.border}`, borderRadius:10, marginTop:14 }}>
      <div style={{ width:6, height:6, borderRadius:'50%', background: C.amber, flexShrink:0 }}/>
      <div style={{ flex:1, overflow:'hidden' }}>
        <div key={idx} style={{ display:'flex', alignItems:'center', gap:8, animation:'fade-in 0.4s ease' }}>
          <span style={{ fontSize:16 }}>{item.icon}</span>
          <span style={{ fontSize:12, color: C.text3, fontWeight:500 }}>{item.label}</span>
        </div>
      </div>
      <span style={{ fontSize:10, color: C.amber, fontWeight:600, letterSpacing:'0.04em', flexShrink:0 }}>PRÓXIMAMENTE</span>
    </div>
  )
}

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

const STEP_LABELS = ['Tu negocio', 'Tu recepcionista', 'Horarios', 'Tu carta', '¡Listo!']

// ── Categories by business type (for menu step) ─────────────────────────────
const MENU_CATEGORIES_BY_TYPE: Record<string, string[]> = {
  restaurante: ['Entrantes', 'Platos', 'Postres', 'Bebidas', 'Vinos', 'Cervezas', 'Cafés', 'Otro'],
  bar: ['Raciones', 'Bocadillos', 'Bebidas', 'Cervezas', 'Vinos', 'Cócteles', 'Cafés', 'Otro'],
  cafeteria: ['Cafés', 'Desayunos', 'Bocadillos', 'Bebidas', 'Bollería', 'Postres', 'Otro'],
}

// ── Auto-detect category from product name ──────────────────────────────────
function autoDetectCategory(name: string, bType: string): string {
  const n = name.toLowerCase().trim()
  const rules: [string[], string][] = [
    [['café', 'cafe', 'cortado', 'americano', 'cappuccino', 'espresso', 'latte'], 'Cafés'],
    [['coca cola', 'fanta', 'agua', 'refresco', 'zumo', 'nestea'], 'Bebidas'],
    [['cerveza', 'caña', 'tercio', 'doble', 'ipa', 'lager'], 'Cervezas'],
    [['vino', 'tinto', 'blanco', 'ribera', 'rioja', 'verdejo', 'rosado'], 'Vinos'],
    [['tostada', 'croissant', 'bollería', 'magdalena', 'napolitana'], 'Desayunos'],
    [['hamburguesa', 'filete', 'pollo', 'solomillo', 'entrecot', 'chuleta'], 'Platos'],
    [['ensalada', 'gazpacho', 'croqueta', 'patatas bravas'], 'Entrantes'],
    [['tarta', 'helado', 'flan', 'brownie', 'natillas', 'coulant'], 'Postres'],
    [['ración', 'racion', 'tapa', 'pincho', 'montadito'], 'Raciones'],
    [['bocadillo', 'sandwich', 'bocata'], 'Bocadillos'],
    [['gin tonic', 'mojito', 'copa', 'daiquiri', 'margarita', 'sangría'], 'Cócteles'],
  ]
  for (const [keywords, cat] of rules) {
    if (keywords.some(k => n.includes(k))) return cat
  }
  const cats = MENU_CATEGORIES_BY_TYPE[bType]
  return cats ? cats[0] : 'Otro'
}

interface MenuItem {
  id?: string
  name: string
  price: number
  category: string
}

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
      ? { closed: true, open: '12:00', close: '23:00' }
      : { closed: false, open: '12:00', close: '23:00' }
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
  const [lockedToast, setLockedToast] = useState<string | null>(null)

  // Step 2
  const [agentName, setAgentName] = useState(tenant?.agent_name ?? 'Sofia')
  const [greetingStyle, setGreetingStyle] = useState(tenant?.greeting_style ?? 'friendly')
  const [language, setLanguage] = useState(tenant?.language ?? 'es')

  // Step 3
  const [schedule, setSchedule] = useState<Schedule>(
    tenant?.schedule ? (typeof tenant.schedule === 'string' ? JSON.parse(tenant.schedule) : tenant.schedule) : defaultSchedule()
  )

  // Step 4 — Menu
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('')
  const [showBulkPaste, setShowBulkPaste] = useState(false)
  const [bulkText, setBulkText] = useState('')

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

      if (nextStep === 5) {
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
  }, [step, tenantId, businessName, businessType, phone, address, agentName, greetingStyle, language, schedule, menuItems, reload])

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
    const handleTypeClick = (typeId: string) => {
      if (ACTIVE_TYPES.includes(typeId)) {
        setBusinessType(typeId)
        setLockedToast(null)
      } else {
        setLockedToast('Estamos trabajando para este tipo de negocio. Muy pronto estará disponible.')
        setTimeout(() => setLockedToast(null), 3500)
      }
    }

    // Sort: active types first, then locked
    const sortedTypes = [...BUSINESS_TYPES].sort((a, b) => {
      const aActive = ACTIVE_TYPES.includes(a.id) ? 0 : 1
      const bActive = ACTIVE_TYPES.includes(b.id) ? 0 : 1
      return aActive - bActive
    })

    return (
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Tu negocio
        </h2>
        <p style={{ fontSize: 14, color: C.text2, marginBottom: 4 }}>
          ¿Qué tipo de negocio tienes? Actualmente optimizado para hostelería
        </p>
        <p style={{ fontSize: 13, color: C.text3, marginBottom: 28 }}>
          Más sectores próximamente
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

          {/* Business type — card grid */}
          <div>
            <label style={labelStyle}>Tipo de negocio *</label>

            {/* Toast for locked types */}
            {lockedToast && (
              <div style={{
                padding: '10px 16px',
                marginBottom: 12,
                borderRadius: 10,
                backgroundColor: 'rgba(240,168,78,0.10)',
                border: '1px solid rgba(240,168,78,0.25)',
                color: C.amber,
                fontSize: 13,
                fontWeight: 500,
                animation: 'fade-in 0.2s ease',
              }}>
                {lockedToast}
              </div>
            )}

            {/* Active types — big cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
              {BUSINESS_TYPES.filter(t => ACTIVE_TYPES.includes(t.id)).map(t => {
                const isSelected = businessType === t.id
                return (
                  <button key={t.id} type="button" onClick={() => handleTypeClick(t.id)} style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                    padding:'22px 12px', borderRadius:14,
                    border: `2px solid ${isSelected ? C.amber : C.border}`,
                    backgroundColor: isSelected ? 'rgba(240,168,78,0.08)' : C.surface2,
                    color: C.text, cursor:'pointer', transition:'all 0.2s',
                  }}>
                    <span style={{ fontSize:32 }}>{t.icon}</span>
                    <span style={{ fontSize:14, fontWeight:700, color: isSelected ? C.amber : C.text }}>{t.label}</span>
                    {isSelected && <span style={{ fontSize:10, color: C.amber, fontWeight:600 }}>Seleccionado</span>}
                  </button>
                )
              })}
            </div>

            {/* Coming soon — animated rotator */}
            <ComingSoonRotator />
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

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
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
          Configura la personalidad de tu recepcionista virtual.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Agent name */}
          <div>
            <label style={labelStyle}>Nombre del agente</label>
            <input
              style={inputStyle}
              placeholder="Ej: Sofia, Ana, Carlos..."
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

  // ── Step 4: Tu carta ─────────────────────────────────────────────────────
  function Step4Menu() {
    const categories = MENU_CATEGORIES_BY_TYPE[businessType] || ['General', 'Otro']
    const effectiveCategory = newItemCategory || (newItemName.trim() ? autoDetectCategory(newItemName, businessType) : categories[0])

    const addItem = async () => {
      const name = newItemName.trim()
      const price = parseFloat(newItemPrice)
      if (!name || isNaN(price) || price < 0) return

      const category = effectiveCategory
      const item: MenuItem = { name, price, category }

      // Save to Supabase immediately
      if (tenantId) {
        const { data } = await supabase.from('menu_items').insert({
          tenant_id: tenantId,
          name,
          price,
          category,
          active: true,
          sort_order: menuItems.length,
        }).select('id').single()
        if (data) item.id = data.id
      }

      setMenuItems(prev => [...prev, item])
      setNewItemName('')
      setNewItemPrice('')
      setNewItemCategory('')
    }

    const removeItem = async (index: number) => {
      const item = menuItems[index]
      if (item.id && tenantId) {
        await supabase.from('menu_items').update({ active: false }).eq('id', item.id).eq('tenant_id', tenantId)
      }
      setMenuItems(prev => prev.filter((_, i) => i !== index))
    }

    const parseBulk = async () => {
      const lines = bulkText.split('\n').filter(l => l.trim())
      const parsed: MenuItem[] = []

      for (const line of lines) {
        // Match: "Name - Price" or "Name Price€" or "Name Price"
        const match = line.match(/^(.+?)[\s\-–]+(\d+[.,]?\d*)\s*€?\s*$/)
        if (match) {
          const name = match[1].trim()
          const price = parseFloat(match[2].replace(',', '.'))
          if (name && !isNaN(price)) {
            const category = autoDetectCategory(name, businessType)
            const item: MenuItem = { name, price, category }

            if (tenantId) {
              const { data } = await supabase.from('menu_items').insert({
                tenant_id: tenantId,
                name,
                price,
                category,
                active: true,
                sort_order: menuItems.length + parsed.length,
              }).select('id').single()
              if (data) item.id = data.id
            }

            parsed.push(item)
          }
        }
      }

      if (parsed.length > 0) {
        setMenuItems(prev => [...prev, ...parsed])
        setBulkText('')
        setShowBulkPaste(false)
      }
    }

    // Group items by category
    const grouped: Record<string, MenuItem[]> = {}
    for (const item of menuItems) {
      if (!grouped[item.category]) grouped[item.category] = []
      grouped[item.category].push(item)
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              Tu carta
            </h2>
            <p style={{ fontSize: 14, color: C.text2, marginBottom: 24 }}>
              Añade tus productos y el sistema organizará tu TPV automáticamente
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep(4)}
            style={{
              background: 'none',
              border: 'none',
              color: C.text3,
              fontSize: 13,
              cursor: 'pointer',
              padding: '4px 0',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Omitir y completar después →
          </button>
        </div>

        {/* Quick-add form */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 100px 1fr auto',
          gap: 8,
          alignItems: 'end',
          marginBottom: 20,
        }}>
          <div>
            <label style={labelStyle}>Producto</label>
            <input
              style={inputStyle}
              placeholder="Ej: Café con leche"
              value={newItemName}
              onChange={e => {
                setNewItemName(e.target.value)
                if (!newItemCategory) {
                  // Auto-detect hint — don't set state, just let effectiveCategory show it
                }
              }}
            />
          </div>
          <div>
            <label style={labelStyle}>Precio</label>
            <input
              style={inputStyle}
              placeholder="2.50"
              type="number"
              step="0.01"
              min="0"
              value={newItemPrice}
              onChange={e => setNewItemPrice(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Categoría</label>
            <select
              style={selectStyle}
              value={newItemCategory || effectiveCategory}
              onChange={e => setNewItemCategory(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addItem}
            disabled={!newItemName.trim() || !newItemPrice}
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: 'none',
              backgroundColor: newItemName.trim() && newItemPrice ? C.amber : C.surface2,
              color: newItemName.trim() && newItemPrice ? '#0C1018' : C.text3,
              fontSize: 14,
              fontWeight: 600,
              cursor: newItemName.trim() && newItemPrice ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            Añadir +
          </button>
        </div>

        {/* Bulk paste toggle */}
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setShowBulkPaste(!showBulkPaste)}
            style={{
              background: 'none',
              border: 'none',
              color: C.amber,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {showBulkPaste ? '✕ Cerrar' : '¿Tienes la carta en texto?'}
          </button>

          {showBulkPaste && (
            <div style={{ marginTop: 10 }}>
              <textarea
                style={{
                  ...inputStyle,
                  minHeight: 100,
                  resize: 'vertical',
                  fontFamily: 'monospace',
                  fontSize: 13,
                }}
                placeholder={'Café con leche - 1.80\nTostada mixta - 3.50\nCoca Cola - 2.50'}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
              />
              <button
                type="button"
                onClick={parseBulk}
                disabled={!bulkText.trim()}
                style={{
                  marginTop: 8,
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: bulkText.trim() ? C.amber : C.surface2,
                  color: bulkText.trim() ? '#0C1018' : C.text3,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: bulkText.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Importar productos
              </button>
            </div>
          )}
        </div>

        {/* Product list */}
        {menuItems.length === 0 ? (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: C.text3,
            fontSize: 14,
            backgroundColor: C.surface2,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
          }}>
            Aún no has añadido productos. Empieza con los más importantes.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text2,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  {cat}
                  <span style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: C.text3,
                    backgroundColor: C.surface2,
                    padding: '2px 8px',
                    borderRadius: 10,
                  }}>
                    {items.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {items.map((item, idx) => {
                    const globalIdx = menuItems.indexOf(item)
                    return (
                      <div
                        key={globalIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          backgroundColor: C.surface2,
                          borderRadius: 8,
                          border: `1px solid ${C.border}`,
                        }}
                      >
                        <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{item.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 14, color: C.amber, fontWeight: 600 }}>{item.price.toFixed(2)} €</span>
                          <button
                            type="button"
                            onClick={() => removeItem(globalIdx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: C.text3,
                              fontSize: 16,
                              cursor: 'pointer',
                              padding: '0 4px',
                              lineHeight: 1,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Step 5: Listo ─────────────────────────────────────────────────────────
  function Step5() {
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
          {saving ? 'Guardando...' : step === 3 ? 'Finalizar' : 'Siguiente'}
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
          padding: step === 4 ? '32px 28px' : '28px 28px 32px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        }}>
          <ProgressBar />

          {step === 0 && <Step1 />}
          {step === 1 && <Step2 />}
          {step === 2 && <Step3 />}
          {step === 3 && <Step4Menu />}
          {step === 4 && <Step5 />}

          {step < 4 && <NavButtons />}
        </div>
      </div>
    </div>
  )
}
