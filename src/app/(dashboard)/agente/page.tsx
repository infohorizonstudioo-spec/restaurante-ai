'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'
import { useToast } from '@/components/NotificationToast'

/* ── What happens in each special situation ─────────────────────────── */
const STATUS_OPTS = [
  { value:'confirmed',             label:'Aceptar sin preguntar',      color:C.green  },
  { value:'pending_review',        label:'Avisarme para que yo decida', color:'#FBB53F' },
  { value:'needs_human_attention', label:'Necesita mi aprobación',      color:'#E87B35' },
  { value:'rejected',              label:'Rechazar directamente',       color:C.red    },
]

/* ── Adaptive patterns by business type ─────────────────────────────── */
const PATTERN_KEYS_BY_TYPE: Record<string, { key:string; label:string; icon:string; desc:string }[]> = {
  restaurante: [
    { key:'large_group',       label:'Grupos grandes',             icon:'👥', desc:'Cuando el grupo supera el máximo automático' },
    { key:'birthday_requests', label:'Cumpleaños y celebraciones', icon:'🎂', desc:'Cuando el cliente menciona cumpleaños, aniversario, etc.' },
    { key:'allergy_notes',     label:'Alergias e intolerancias',   icon:'⚕️', desc:'Cuando el cliente menciona alergias o restricciones alimentarias' },
    { key:'table_specific',    label:'Mesa específica',            icon:'📍', desc:'Cuando el cliente pide una mesa o zona concreta' },
    { key:'accessibility',     label:'Accesibilidad',              icon:'♿', desc:'Silla de ruedas, carrito de bebé, movilidad reducida' },
  ],
  clinica_dental: [
    { key:'urgency',            label:'Urgencias dentales',      icon:'🚨', desc:'Dolor agudo, rotura de pieza, sangrado' },
    { key:'first_visit_complex',label:'Primera visita compleja', icon:'📋', desc:'Nuevo paciente con caso complejo' },
    { key:'accessibility',      label:'Accesibilidad',           icon:'♿', desc:'Movilidad reducida, silla de ruedas' },
  ],
  clinica_medica: [
    { key:'urgency',       label:'Urgencias médicas',    icon:'🚨', desc:'Fiebre alta, dolor agudo, malestar severo' },
    { key:'accessibility', label:'Accesibilidad',        icon:'♿', desc:'Movilidad reducida' },
  ],
  veterinaria: [
    { key:'urgency',       label:'Urgencias veterinarias', icon:'🚨', desc:'Accidente, no respira, no come, muy mal' },
    { key:'surgery',       label:'Cirugías',               icon:'🔪', desc:'Operaciones programadas' },
  ],
  psicologia: [
    { key:'crisis', label:'Situaciones de crisis', icon:'⚠️', desc:'Detección de riesgo — activa protocolo de crisis (024)' },
  ],
  hotel: [
    { key:'large_group',    label:'Grupos grandes',       icon:'👥', desc:'Reservas de muchas habitaciones' },
    { key:'long_stay',      label:'Estancia larga',       icon:'📅', desc:'Estancias superiores a 14 noches' },
    { key:'special_request',label:'Peticiones especiales', icon:'⭐', desc:'Cuna, cama supletoria, vista, planta alta' },
  ],
  ecommerce: [
    { key:'high_value_order', label:'Pedidos de alto valor', icon:'💰', desc:'Pedidos superiores a 500€' },
    { key:'return_request',   label:'Devoluciones',          icon:'🔄', desc:'Solicitudes de devolución o cambio' },
  ],
  taller: [
    { key:'urgency',        label:'Averías urgentes', icon:'🚨', desc:'Avería en carretera, no arranca, humo' },
    { key:'tow_required',   label:'Necesita grúa',    icon:'🚗', desc:'El vehículo no puede desplazarse' },
  ],
  seguros: [
    { key:'urgency', label:'Siniestro urgente', icon:'🚨', desc:'Accidente, robo, siniestro en curso' },
  ],
}
const DEFAULT_PATTERNS = [
  { key:'large_group',  label:'Grupos grandes',  icon:'👥', desc:'Cuando supera el máximo automático' },
  { key:'accessibility',label:'Accesibilidad',   icon:'♿', desc:'Movilidad reducida, necesidades especiales' },
]

/* ── Feedback flag labels (human-readable) ──────────────────────────── */
const FLAG_LABELS: Record<string,string> = {
  large_group:'Grupo grande', allergy_note:'Alergia', specific_table_request:'Mesa específica',
  special_occasion:'Ocasión especial', modification_request:'Modificación', cancellation_request:'Cancelación',
  out_of_policy:'Fuera de política', confused_customer:'Cliente confuso', accessibility_need:'Accesibilidad',
  low_confidence:'Baja confianza', late_arrival_notice:'Llegada tardía',
}

/* ── Status labels for feedback display ─────────────────────────────── */
const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  confirmed:             { label: 'Confirmado',    color: C.green },
  pending_review:        { label: 'Para revisión', color: '#FBB53F' },
  needs_human_attention: { label: 'Requiere atención', color: '#E87B35' },
  rejected:              { label: 'Rechazado',     color: C.red },
}

function inp(extra={}) {
  return { padding:'10px 14px', fontSize:13, background:'#1A2230', border:'1px solid rgba(255,255,255,0.11)',
    borderRadius:9, outline:'none', color:'#E8EEF6', fontFamily:'inherit', width:'100%', ...extra }
}

/* ── Two clean tabs ─────────────────────────────────────────────────── */
const TABS = [
  { id:'behavior', label:'Comportamiento' },
  { id:'knowledge', label:'Conocimiento' },
]

export default function AgentePage() {
  const toast = useToast()
  const { tenant, tx } = useTenant()
  const PATTERN_KEYS = PATTERN_KEYS_BY_TYPE[tenant?.type || ''] || PATTERN_KEYS_BY_TYPE.restaurante || DEFAULT_PATTERNS
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'behavior'|'knowledge'>('behavior')
  const [token, setToken]           = useState<string>('')
  const [rules, setRules]           = useState<any>({ max_auto_party_size:6, special_requests_require_review:true, allow_auto_cancellations:true, offer_alternative_times:true, min_confidence_to_confirm:0.72 })
  const [patterns, setPatterns]     = useState<Record<string,string>>({ large_group:'pending_review', birthday_requests:'pending_review', allergy_notes:'pending_review', table_specific:'pending_review', accessibility:'pending_review' })
  const [knowledge, setKnowledge]   = useState<any>({ services:[], menu:{}, hours:{}, faqs:[], policies:{}, special_notes:'' })
  const [feedback, setFeedback]     = useState<any[]>([])
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState('')
  const [updatedAt, setUpdatedAt]   = useState<string|null>(null)

  const loadRules = useCallback(async (tok: string) => {
    const res = await fetch('/api/voice/rules', { headers:{ 'Authorization':'Bearer '+tok } })
    if (!res.ok) return
    const d = await res.json()
    if (d.rules)    setRules(d.rules)
    if (d.patterns) setPatterns(d.patterns)
    if (d.feedback) setFeedback(d.feedback)
    if (d.updated_at) setUpdatedAt(d.updated_at)
  }, [])

  const loadKnowledge = useCallback(async (tok: string) => {
    const res = await fetch('/api/voice/knowledge', { headers:{ 'Authorization':'Bearer '+tok } })
    if (!res.ok) return
    const d = await res.json()
    if (d.knowledge) setKnowledge(d.knowledge)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data:{ session } }) => {
      if (!session?.access_token) return
      setToken(session.access_token)
      await Promise.all([loadRules(session.access_token), loadKnowledge(session.access_token)])
      setLoading(false)
    })
  }, [loadRules, loadKnowledge])

  const saveRules = async () => {
    setSaving(true); setError('')
    const res = await fetch('/api/voice/rules', {
      method:'POST', headers:{ 'Authorization':'Bearer '+token, 'Content-Type':'application/json' },
      body: JSON.stringify({ rules, patterns })
    })
    const d = await res.json()
    if (!res.ok) { setError(d.error||'Error'); setSaving(false); return }
    setSaved(true); setTimeout(()=>setSaved(false), 2000)
    setSaving(false)
    toast.push({ title: tx('Cambios guardados'), body: tx('Tu recepcionista ya actúa con las nuevas reglas'), type: 'agent', priority: 'info', icon: '✓' })
  }

  if (loading) return <PageLoader/>

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:40 }}>
        <div>
          <h1 style={{ fontSize:16, fontWeight:700, color:C.text }}>{tx('Mi recepcionista')}</h1>
          <p style={{ fontSize:11, color:C.text3, marginTop:2 }}>{tx('Configura cómo atiende y qué sabe sobre tu negocio')}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {tab==='behavior' && updatedAt && <p style={{ fontSize:11, color:C.text3 }}>{tx('Guardado')} {new Date(updatedAt).toLocaleDateString()}</p>}
          {tab==='behavior' && saved && <span style={{ fontSize:12, color:C.green, fontWeight:600 }}>✓ {tx('Guardado')}</span>}
          {error && <span style={{ fontSize:12, color:C.red }}>{error}</span>}
          {tab==='behavior' && (
            <button onClick={saveRules} disabled={saving} style={{ padding:'8px 20px', fontSize:13, fontWeight:700, borderRadius:9, border:'none', background:saving?'rgba(240,168,78,0.4)':C.amber, color:'#0A0D14', cursor:'pointer', fontFamily:'inherit' }}>
              {saving ? tx('Guardando...') : tx('Guardar cambios')}
            </button>
          )}
          <NotifBell/>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'0 28px', display:'flex', gap:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id as any)} style={{
            padding:'12px 20px', fontSize:13, fontWeight:600, background:'none', border:'none',
            borderBottom: tab===t.id ? `2px solid ${C.amber}` : '2px solid transparent',
            color: tab===t.id ? C.amber : C.text3, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
          }}>{tx(t.label)}</button>
        ))}
      </div>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 28px 60px' }}>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: COMPORTAMIENTO — How your receptionist acts                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {tab==='behavior' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* ── Section 1: Autonomy rules ──────────────────────────────── */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:4 }}>{tx('¿Qué puede hacer sola?')}</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:18 }}>{tx('Decide cuánta libertad tiene tu recepcionista para tomar decisiones sin consultarte.')}</p>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                {/* Max group size */}
                <div>
                  <label style={{ fontSize:12, color:C.text2, fontWeight:600, display:'block', marginBottom:6 }}>{tx('Acepta grupos de hasta...')}</label>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <input type="number" min={1} max={50} value={rules.max_auto_party_size} onChange={e=>setRules((r:any)=>({...r,max_auto_party_size:parseInt(e.target.value)||6}))} style={inp({ width:80, textAlign:'center' })} />
                    <span style={{ fontSize:13, color:C.text2 }}>{tx('personas')}</span>
                  </div>
                  <p style={{ fontSize:11, color:C.text3, marginTop:4 }}>{tx('Si vienen más, te avisa antes de confirmar')}</p>
                </div>
                {/* Confidence threshold */}
                <div>
                  <label style={{ fontSize:12, color:C.text2, fontWeight:600, display:'block', marginBottom:6 }}>{tx('Nivel de seguridad para decidir sola')}</label>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <input type="range" min={30} max={100} step={5} value={Math.round(rules.min_confidence_to_confirm * 100)}
                      onChange={e=>setRules((r:any)=>({...r,min_confidence_to_confirm:parseInt(e.target.value)/100}))}
                      style={{ flex:1, accentColor:C.amber }} />
                    <span style={{ fontSize:14, fontWeight:700, color:C.amber, minWidth:40, textAlign:'right' }}>{Math.round(rules.min_confidence_to_confirm * 100)}%</span>
                  </div>
                  <p style={{ fontSize:11, color:C.text3, marginTop:4 }}>{tx('Si no está segura, te lo pasa a ti')}</p>
                </div>
              </div>

              {/* Toggle buttons */}
              <div style={{ display:'flex', gap:12, marginTop:14, flexWrap:'wrap' }}>
                {[
                  { key:'special_requests_require_review', label:'Avisarme con peticiones especiales' },
                  { key:'allow_auto_cancellations',        label:'Puede cancelar reservas sola' },
                  { key:'offer_alternative_times',         label:'Ofrece alternativas si no hay hueco' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={()=>setRules((r:any)=>({...r,[key]:!r[key]}))} style={{
                    padding:'8px 16px', fontSize:12, fontWeight:600, borderRadius:9, cursor:'pointer', fontFamily:'inherit',
                    background: (rules[key] as boolean) ? 'rgba(74,222,128,0.12)' : C.surface2,
                    border: `1px solid ${(rules[key] as boolean) ? C.green+'40' : C.border}`,
                    color: (rules[key] as boolean) ? C.green : C.text3, transition:'all 0.15s',
                  }}>{(rules[key] as boolean) ? '✓' : '○'} {tx(label)}</button>
                ))}
              </div>
            </div>

            {/* ── Section 2: Special situations ──────────────────────────── */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:4 }}>{tx('Cuando pasa algo especial')}</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:18 }}>{tx('Elige qué hace tu recepcionista en cada situación.')}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {PATTERN_KEYS.map(({ key, label, icon, desc }) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:C.surface2, borderRadius:10, border:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:C.text }}>{tx(label)}</p>
                      <p style={{ fontSize:11, color:C.text3 }}>{tx(desc)}</p>
                    </div>
                    <select value={patterns[key]||'pending_review'} onChange={e=>setPatterns(p=>({...p,[key]:e.target.value}))}
                      style={{ ...inp({ width:'auto', minWidth:220, padding:'7px 12px' }) }}>
                      {STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{tx(o.label)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 3: Corrections history (merged from old tab 3) ── */}
            {feedback.length > 0 && (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
                <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:4 }}>{tx('Tus correcciones')}</h2>
                <p style={{ fontSize:12, color:C.text3, marginBottom:14 }}>{tx('Cada vez que corriges una decisión, tu recepcionista aprende y mejora.')}</p>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {feedback.slice(0,8).map((f:any,i:number) => {
                    const orig = STATUS_DISPLAY[f.original_status] || { label: f.original_status, color: C.text3 }
                    const corr = STATUS_DISPLAY[f.corrected_status] || { label: f.corrected_status, color: C.green }
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:C.surface2, borderRadius:9, border:`1px solid ${C.border}` }}>
                        <span style={{ fontSize:11, color:C.text3, flexShrink:0, minWidth:70 }}>{new Date(f.created_at).toLocaleDateString()}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, minWidth:0, flexWrap:'wrap' }}>
                          {(f.flags||[]).map((flag:string)=>(
                            <span key={flag} style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:`${C.amber}18`, color:C.amber, fontWeight:600 }}>{tx(FLAG_LABELS[flag]||flag)}</span>
                          ))}
                          {!f.flags?.length && f.intent && <span style={{ fontSize:11, color:C.text3 }}>{f.intent}</span>}
                        </div>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:`${orig.color}18`, color:orig.color }}>{tx(orig.label)}</span>
                        <span style={{ fontSize:11, color:C.text3 }}>→</span>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:`${corr.color}18`, color:corr.color }}>{tx(corr.label)}</span>
                        {f.note && <span style={{ fontSize:11, color:C.text3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:140 }}>{f.note}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: CONOCIMIENTO — What your receptionist knows                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {tab==='knowledge' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Knowledge summary */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'24px' }}>
              <h2 style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:6 }}>{tx('Lo que sabe sobre tu negocio')}</h2>
              <p style={{ fontSize:13, color:C.text3, lineHeight:1.6, marginBottom:20 }}>{tx('Aquí ves un resumen de la información que tiene tu recepcionista. Para editarla, ve a Configuración.')}</p>

              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* Services */}
                <KnowledgeRow icon="🛎️" title={tx('Servicios')} value={(knowledge.services||[]).length > 0 ? (knowledge.services||[]).join(', ') : null} empty={tx('Sin configurar')} />
                {/* Hours */}
                <KnowledgeRow icon="🕐" title={tx('Horarios')} value={Object.values(knowledge.hours||{}).filter(Boolean).length > 0 ? Object.entries(knowledge.hours||{}).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(' · ') : null} empty={tx('Sin configurar')} />
                {/* Menu/catalog */}
                <KnowledgeRow icon="🍽️" title={tx('Carta / catálogo')} value={Object.keys(knowledge.menu||{}).length > 0 ? Object.keys(knowledge.menu||{}).join(', ') : null} empty={tx('Sin configurar')} />
                {/* FAQs */}
                <KnowledgeRow icon="❓" title={tx('Preguntas frecuentes')} value={(knowledge.faqs||[]).length > 0 ? `${(knowledge.faqs||[]).length} ${tx('preguntas configuradas')}` : null} empty={tx('Sin configurar')} />
                {/* Special notes */}
                {knowledge.special_notes && (
                  <KnowledgeRow icon="📝" title={tx('Instrucciones especiales')} value={knowledge.special_notes.slice(0,120)+(knowledge.special_notes.length>120?'...':'')} empty="" />
                )}
              </div>

              <a href="/configuracion" style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:20, padding:'10px 20px', fontSize:13, fontWeight:700, color:'#0C1018', background:`linear-gradient(135deg,${C.amber},#E8923A)`, borderRadius:9, textDecoration:'none', boxShadow:'0 2px 12px rgba(240,168,78,0.25)' }}>
                {tx('Editar en Configuración')} →
              </a>
            </div>


          </div>
        )}

      </div>
    </div>
  )
}

/* ── Knowledge row sub-component ──────────────────────────────────────── */
function KnowledgeRow({ icon, title, value, empty }: { icon: string; title: string; value: string | null; empty: string }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 16px', background:C.surface2, borderRadius:10 }}>
      <span style={{ fontSize:18, flexShrink:0 }}>{icon}</span>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:12, fontWeight:600, color:C.text2, marginBottom:4 }}>{title}</p>
        <p style={{ fontSize:13, color: value ? C.text : C.text3, fontStyle: value ? 'normal' : 'italic' }}>{value || empty}</p>
      </div>
    </div>
  )
}
