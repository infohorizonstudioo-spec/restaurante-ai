'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'
import { useToast } from '@/components/NotificationToast'

const STATUS_OPTS = [
  { value:'confirmed',             label:'Aceptar sin preguntar', color:C.green },
  { value:'pending_review',        label:'Avisarme para que yo decida', color:'#FBB53F' },
  { value:'needs_human_attention', label:'Necesita mi aprobación', color:C.amber },
  { value:'rejected',              label:'Rechazar directamente', color:C.red },
]
// Patrones de decisión adaptativos por tipo de negocio
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
    { key:'crisis',        label:'Situaciones de crisis',  icon:'⚠️', desc:'Detección de riesgo — activa protocolo de crisis (024)' },
  ],
  hotel: [
    { key:'large_group',    label:'Grupos grandes',    icon:'👥', desc:'Reservas de muchas habitaciones' },
    { key:'long_stay',      label:'Estancia larga',    icon:'📅', desc:'Estancias superiores a 14 noches' },
    { key:'special_request',label:'Peticiones especiales', icon:'⭐', desc:'Cuna, cama supletoria, vista, planta alta' },
  ],
  ecommerce: [
    { key:'high_value_order', label:'Pedidos de alto valor', icon:'💰', desc:'Pedidos superiores a 500€' },
    { key:'return_request',   label:'Devoluciones',          icon:'🔄', desc:'Solicitudes de devolución o cambio' },
  ],
  taller: [
    { key:'urgency',        label:'Averías urgentes',    icon:'🚨', desc:'Avería en carretera, no arranca, humo' },
    { key:'tow_required',   label:'Necesita grúa',       icon:'🚗', desc:'El vehículo no puede desplazarse' },
  ],
  seguros: [
    { key:'urgency',        label:'Siniestro urgente',   icon:'🚨', desc:'Accidente, robo, siniestro en curso' },
  ],
}
const DEFAULT_PATTERNS = [
  { key:'large_group',  label:'Grupos grandes',  icon:'👥', desc:'Cuando supera el máximo automático' },
  { key:'accessibility',label:'Accesibilidad',   icon:'♿', desc:'Movilidad reducida, necesidades especiales' },
]
const FLAG_LABELS: Record<string,string> = {
  large_group:'Grupo grande', allergy_note:'Alergia', specific_table_request:'Mesa específica',
  special_occasion:'Ocasión especial', modification_request:'Modificación', cancellation_request:'Cancelación',
  out_of_policy:'Fuera de política', confused_customer:'Cliente confuso', accessibility_need:'Accesibilidad',
  low_confidence:'Baja confianza', late_arrival_notice:'Llegada tardía',
}

function inp(extra={}) {
  return { padding:'10px 14px', fontSize:13, background:'#1A2230', border:'1px solid rgba(255,255,255,0.11)',
    borderRadius:9, outline:'none', color:'#E8EEF6', fontFamily:'inherit', width:'100%', ...extra }
}

// ── Tab sections ──────────────────────────────────────────────────────────────
const TABS = [
  { id:'rules',    label:'⚙️ Cómo decide',       icon:'⚙️' },
  { id:'knowledge',label:'🧠 Lo que sabe',        icon:'🧠' },
  { id:'memory',   label:'📚 Lo que ha aprendido', icon:'📚' },
]

export default function AgentePage() {
  const toast = useToast()
  const { tenant, tx } = useTenant()
  const PATTERN_KEYS = PATTERN_KEYS_BY_TYPE[tenant?.type || ''] || PATTERN_KEYS_BY_TYPE.restaurante || DEFAULT_PATTERNS
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'rules'|'knowledge'|'memory'>('rules')
  const [token, setToken]           = useState<string>('')
  const [rules, setRules]           = useState<any>({ max_auto_party_size:6, special_requests_require_review:true, allow_auto_cancellations:true, offer_alternative_times:true, min_confidence_to_confirm:0.72 })
  const [patterns, setPatterns]     = useState<Record<string,string>>({ large_group:'pending_review', birthday_requests:'pending_review', allergy_notes:'pending_review', table_specific:'pending_review', accessibility:'pending_review' })
  const [knowledge, setKnowledge]   = useState<any>({ services:[], menu:{}, hours:{}, faqs:[], policies:{}, special_notes:'' })
  const [feedback, setFeedback]     = useState<any[]>([])
  const [saving, setSaving]         = useState(false)
  const [savingK, setSavingK]       = useState(false)
  const [saved, setSaved]           = useState(false)
  const [savedK, setSavedK]         = useState(false)
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
    toast.push({ title: 'Reglas guardadas', body: 'El comportamiento del agente se ha actualizado', type: 'agent', priority: 'info', icon: '🤖' })
  }

  const saveKnowledge = async () => {
    setSavingK(true)
    const res = await fetch('/api/voice/knowledge', {
      method:'POST', headers:{ 'Authorization':'Bearer '+token, 'Content-Type':'application/json' },
      body: JSON.stringify({ knowledge })
    })
    if (res.ok) { setSavedK(true); setTimeout(()=>setSavedK(false), 2000) }
    setSavingK(false)
  }

  if (loading) return <PageLoader/>

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      {/* Header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:40 }}>
        <div>
          <h1 style={{ fontSize:16, fontWeight:700, color:C.text }}>{tx('Mi recepcionista')}</h1>
          <p style={{ fontSize:11, color:C.text3, marginTop:2 }}>{tx('Ajusta cómo atiende, qué sabe y qué ha aprendido')}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {tab==='rules' && updatedAt && <p style={{ fontSize:11, color:C.text3 }}>{tx('Guardado')} {new Date(updatedAt).toLocaleDateString('es-ES')}</p>}
          {tab==='rules' && saved  && <span style={{ fontSize:12, color:C.green, fontWeight:600 }}>✓ {tx('Guardado')}</span>}
          {tab==='knowledge' && savedK && <span style={{ fontSize:12, color:C.green, fontWeight:600 }}>✓ {tx('Guardado')}</span>}
          {error && <span style={{ fontSize:12, color:C.red }}>{error}</span>}
          {tab==='rules' && (
            <button onClick={saveRules} disabled={saving} style={{ padding:'8px 20px', fontSize:13, fontWeight:700, borderRadius:9, border:'none', background:saving?'rgba(240,168,78,0.4)':C.amber, color:'#0A0D14', cursor:'pointer', fontFamily:'inherit' }}>
              {saving ? tx('Guardando...') : tx('Guardar cambios')}
            </button>
          )}
          {tab==='knowledge' && (
            <button onClick={saveKnowledge} disabled={savingK} style={{ padding:'8px 20px', fontSize:13, fontWeight:700, borderRadius:9, border:'none', background:savingK?'rgba(240,168,78,0.4)':C.amber, color:'#0A0D14', cursor:'pointer', fontFamily:'inherit' }}>
              {savingK ? tx('Guardando...') : tx('Guardar conocimiento')}
            </button>
          )}
          <NotifBell/>
        </div>
      </div>

      {/* Tabs */}
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

        {/* ── TAB: RULES ──────────────────────────────────────────────────────── */}
        {tab==='rules' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Reglas numéricas */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:18 }}>{tx('¿Qué puede hacer sola?')}</h2>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <label style={{ fontSize:12, color:C.text2, fontWeight:600, display:'block', marginBottom:6 }}>{tx('Grupos de hasta... personas')}</label>
                  <input type="number" min={1} max={50} value={rules.max_auto_party_size} onChange={e=>setRules((r:any)=>({...r,max_auto_party_size:parseInt(e.target.value)||6}))} style={inp()} />
                  <p style={{ fontSize:11, color:C.text3, marginTop:4 }}>{tx('Si vienen más, te avisa antes de confirmar')}</p>
                </div>
                <div>
                  <label style={{ fontSize:12, color:C.text2, fontWeight:600, display:'block', marginBottom:6 }}>{tx('¿Cuándo te avisa?')}</label>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <input type="range" min={30} max={100} step={5} value={Math.round(rules.min_confidence_to_confirm * 100)}
                      onChange={e=>setRules((r:any)=>({...r,min_confidence_to_confirm:parseInt(e.target.value)/100}))}
                      style={{ flex:1, accentColor:C.amber }} />
                    <span style={{ fontSize:14, fontWeight:700, color:C.amber, minWidth:40, textAlign:'right' }}>{Math.round(rules.min_confidence_to_confirm * 100)}%</span>
                  </div>
                  <p style={{ fontSize:11, color:C.text3, marginTop:4 }}>{tx('Si no está segura al')} {Math.round(rules.min_confidence_to_confirm * 100)}%, {tx('te lo pasa a ti')}</p>
                </div>
              </div>
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

            {/* Patrones */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>{tx('Situaciones especiales')}</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:18 }}>{tx('¿Qué hace tu recepcionista cuando pasa algo fuera de lo normal?')}</p>
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

            {/* Historial de feedback */}
            {feedback.length > 0 && (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
                <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:14 }}>📚 {tx('Últimas correcciones que le has hecho')}</h2>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {feedback.slice(0,8).map((f:any,i:number) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:C.surface2, borderRadius:8 }}>
                      <span style={{ fontSize:11, color:C.text3, flexShrink:0 }}>{new Date(f.created_at).toLocaleDateString('es-ES')}</span>
                      <span style={{ fontSize:12, color:C.red }}>{f.original_status}</span>
                      <span style={{ fontSize:11, color:C.text3 }}>→</span>
                      <span style={{ fontSize:12, color:C.green }}>{f.corrected_status}</span>
                      {(f.flags||[]).map((flag:string)=>(
                        <span key={flag} style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:C.amberDim||'rgba(240,168,78,0.10)', color:C.amber, fontWeight:600 }}>{tx(FLAG_LABELS[flag]||flag)}</span>
                      ))}
                      {f.note && <span style={{ fontSize:11, color:C.text3, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: KNOWLEDGE BASE ──────────────────────────────────────────────── */}
        {tab==='knowledge' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Servicios */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>🛎️ {tx('¿Qué ofreces?')}</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:14 }}>{tx('Los servicios que ofrece tu negocio (separados por coma)')}</p>
              <input value={(knowledge.services||[]).join(', ')} onChange={e=>setKnowledge((k:any)=>({...k,services:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)}))}
                placeholder={tx('reservas, pedido para recoger, menú del día, entrega a domicilio...')}
                style={{...inp()}}/>
            </div>

            {/* Horarios */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>🕐 {tx('Horarios')}</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:14 }}>{tx('¿Cuándo abres? Tu recepcionista lo usará para ofrecer huecos')}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[['lunch','Mediodía'],['dinner','Noche'],['morning','Mañana'],['weekend','Fin de semana']].map(([key,label])=>(
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:12, color:C.text2, fontWeight:600, width:100, flexShrink:0 }}>{tx(label)}</span>
                    <input value={(knowledge.hours||{})[key]||''} onChange={e=>setKnowledge((k:any)=>({...k,hours:{...(k.hours||{}),[key]:e.target.value}}))}
                      placeholder={tx('ej: 13:00-16:00')} style={{...inp()}}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Menú */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>🍽️ {tx('Tu carta / catálogo')}</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:14 }}>{tx('Lo que vendes, organizado por categorías. Tu recepcionista lo usará para responder preguntas.')}</p>
              <MenuEditor menu={knowledge.menu||{}} onChange={(m:any)=>setKnowledge((k:any)=>({...k,menu:m}))} tx={tx}/>
            </div>

            {/* FAQs */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>❓ {tx('Preguntas frecuentes')}</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:14 }}>{tx('Respuestas exactas que dará tu recepcionista cuando le pregunten esto')}</p>
              <FaqEditor faqs={knowledge.faqs||[]} onChange={(f:any)=>setKnowledge((k:any)=>({...k,faqs:f}))} tx={tx}/>
            </div>

            {/* Notas especiales */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>📝 {tx('Instrucciones extra')}</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:14 }}>{tx('Cualquier cosa que deba saber tu recepcionista: políticas, normas, excepciones...')}</p>
              <textarea value={knowledge.special_notes||''} onChange={e=>setKnowledge((k:any)=>({...k,special_notes:e.target.value}))}
                rows={4} placeholder={tx('Ej: Los domingos solo abrimos para cenas. No aceptamos grupos de más de 20 sin reserva previa...')}
                style={{...inp(), resize:'vertical'}}/>
            </div>

          </div>
        )}

        {/* ── TAB: MEMORIA ─────────────────────────────────────────────────────── */}
        {tab==='memory' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>📚 {tx('Lo que ha aprendido')}</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:16 }}>{tx('Cada vez que corriges una decisión, tu recepcionista aprende. Aquí puedes ver qué ha ido aprendiendo.')}</p>
              {feedback.length === 0 ? (
                <div style={{ padding:'32px 0', textAlign:'center' }}>
                  <div style={{ fontSize:28, marginBottom:10 }}>🧠</div>
                  <p style={{ fontSize:13, color:C.text3 }}>{tx('Todavía no has corregido ninguna decisión. Cuando lo hagas, tu recepcionista aprenderá y mejorará.')}</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {feedback.map((f:any,i:number)=>(
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr auto', gap:10, alignItems:'center', padding:'10px 14px', background:C.surface2, borderRadius:9, border:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:11, color:C.text3 }}>{new Date(f.created_at).toLocaleDateString('es-ES')}</span>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {(f.flags||[]).map((flag:string)=>(
                          <span key={flag} style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:`${C.amber}18`, color:C.amber, fontWeight:600 }}>{tx(FLAG_LABELS[flag]||flag)}</span>
                        ))}
                        {!f.flags?.length && <span style={{ fontSize:11, color:C.text3 }}>{f.intent||'—'}</span>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:`${C.red}18`, color:C.red }}>{f.original_status}</span>
                        <span style={{ fontSize:11, color:C.text3 }}>→</span>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:`${C.green}18`, color:C.green }}>{f.corrected_status}</span>
                      </div>
                      <span style={{ fontSize:11, color:C.text3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>{f.note||''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── MenuEditor sub-component ──────────────────────────────────────────────
function MenuEditor({ menu, onChange, tx=(s:string)=>s }: { menu: Record<string,string[]>; onChange:(m:any)=>void; tx?:(s:string)=>string }) {
  const [newCat, setNewCat] = useState('')
  const categories = Object.keys(menu)
  const addCategory = () => {
    if (!newCat.trim()) return
    onChange({ ...menu, [newCat.trim().toLowerCase()]: [] })
    setNewCat('')
  }
  const removeCategory = (cat: string) => {
    const m = { ...menu }; delete m[cat]; onChange(m)
  }
  const updateItems = (cat: string, val: string) => {
    onChange({ ...menu, [cat]: val.split(',').map(s=>s.trim()).filter(Boolean) })
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {categories.map(cat=>(
        <div key={cat} style={{ background:C.surface2, borderRadius:9, padding:'12px 14px', border:`1px solid ${C.border}` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:600, color:C.text, textTransform:'capitalize' }}>{cat}</span>
            <button onClick={()=>removeCategory(cat)} style={{ fontSize:11, color:C.red, background:'none', border:'none', cursor:'pointer' }}>✕ {tx('eliminar')}</button>
          </div>
          <input value={(menu[cat]||[]).join(', ')} onChange={e=>updateItems(cat,e.target.value)}
            placeholder={`${tx('Productos en')} ${cat} (${tx('separados por coma')})`} style={{...inp()}}/>
        </div>
      ))}
      <div style={{ display:'flex', gap:8 }}>
        <input value={newCat} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCategory()}
          placeholder={tx('Nueva categoría (ej: carnes, postres...)')} style={{...inp()}}/>
        <button onClick={addCategory} style={{ padding:'10px 18px', fontSize:13, fontWeight:600, background:C.amberDim, border:`1px solid ${C.amberBorder}`, borderRadius:9, color:C.amber, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>+ {tx('Añadir')}</button>
      </div>
    </div>
  )
}

// ── FaqEditor sub-component ───────────────────────────────────────────────
function FaqEditor({ faqs, onChange, tx=(s:string)=>s }: { faqs: Array<{q:string;a:string}>; onChange:(f:any)=>void; tx?:(s:string)=>string }) {
  const addFaq = () => onChange([...faqs, { q:'', a:'' }])
  const removeFaq = (i:number) => onChange(faqs.filter((_:any,idx:number)=>idx!==i))
  const updateFaq = (i:number, field:'q'|'a', val:string) => {
    const updated = faqs.map((f:any,idx:number)=>idx===i?{...f,[field]:val}:f)
    onChange(updated)
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {faqs.map((faq:any,i:number)=>(
        <div key={i} style={{ background:C.surface2, borderRadius:9, padding:'12px 14px', border:`1px solid ${C.border}`, display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, color:C.text3, fontWeight:600, width:18, flexShrink:0 }}>P:</span>
            <input value={faq.q} onChange={e=>updateFaq(i,'q',e.target.value)} placeholder={tx('Pregunta del cliente...')} style={{...inp()}}/>
            <button onClick={()=>removeFaq(i)} style={{ fontSize:11, color:C.red, background:'none', border:'none', cursor:'pointer', flexShrink:0 }}>✕</button>
          </div>
          <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
            <span style={{ fontSize:11, color:C.teal, fontWeight:600, width:18, flexShrink:0, marginTop:10 }}>R:</span>
            <textarea value={faq.a} onChange={e=>updateFaq(i,'a',e.target.value)} rows={2}
              placeholder={tx('Respuesta exacta que dará el agente...')} style={{...inp(), resize:'vertical'}}/>
          </div>
        </div>
      ))}
      <button onClick={addFaq} style={{ padding:'10px 18px', fontSize:13, fontWeight:600, background:C.amberDim, border:`1px solid ${C.amberBorder}`, borderRadius:9, color:C.amber, cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
        + {tx('Añadir pregunta frecuente')}
      </button>
    </div>
  )
}
