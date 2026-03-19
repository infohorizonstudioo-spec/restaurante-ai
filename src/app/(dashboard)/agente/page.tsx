'use client'
'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'

const C = {
  amber:'#F0A84E', amberDim:'rgba(240,168,78,0.10)', amberBorder:'rgba(240,168,78,0.25)',
  teal:'#2DD4BF', tealDim:'rgba(45,212,191,0.10)',
  green:'#4ADE80', greenDim:'rgba(74,222,128,0.10)',
  red:'#F87171', redDim:'rgba(248,113,113,0.10)',
  violet:'#A78BFA', violetDim:'rgba(167,139,250,0.12)',
  text:'#E8EEF6', text2:'#8895A7', text3:'#49566A',
  bg:'#0C1018', surface:'#131920', surface2:'#1A2230', surface3:'#202C3E',
  border:'rgba(255,255,255,0.07)', borderMd:'rgba(255,255,255,0.11)',
}

const STATUS_OPTS = [
  { value:'confirmed',             label:'✓ Confirmar automáticamente', color:C.green },
  { value:'pending_review',        label:'⏳ Dejar pendiente de revisión', color:'#FBB53F' },
  { value:'needs_human_attention', label:'⚠ Requiere atención humana', color:C.amber },
  { value:'rejected',              label:'✕ Rechazar automáticamente', color:C.red },
]
const PATTERN_KEYS = [
  { key:'large_group',       label:'Grupos grandes',             icon:'👥', desc:'Cuando el grupo supera el máximo automático' },
  { key:'birthday_requests', label:'Cumpleaños y celebraciones', icon:'🎂', desc:'Cuando el cliente menciona cumpleaños, aniversario, etc.' },
  { key:'allergy_notes',     label:'Alergias e intolerancias',   icon:'⚕️', desc:'Cuando el cliente menciona alergias o restricciones alimentarias' },
  { key:'table_specific',    label:'Mesa específica',            icon:'📍', desc:'Cuando el cliente pide una mesa o zona concreta' },
  { key:'accessibility',     label:'Accesibilidad',              icon:'♿', desc:'Silla de ruedas, carrito de bebé, movilidad reducida' },
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
  { id:'rules',    label:'⚙️ Reglas',           icon:'⚙️' },
  { id:'knowledge',label:'🧠 Base de conocimiento', icon:'🧠' },
  { id:'memory',   label:'📚 Memoria aprendida', icon:'📚' },
]

export default function AgentePage() {
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
          <h1 style={{ fontSize:16, fontWeight:700, color:C.text }}>Comportamiento del agente</h1>
          <p style={{ fontSize:11, color:C.text3, marginTop:2 }}>Configura cómo decide y responde tu recepcionista IA</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {tab==='rules' && updatedAt && <p style={{ fontSize:11, color:C.text3 }}>Guardado {new Date(updatedAt).toLocaleDateString('es-ES')}</p>}
          {tab==='rules' && saved  && <span style={{ fontSize:12, color:C.green, fontWeight:600 }}>✓ Guardado</span>}
          {tab==='knowledge' && savedK && <span style={{ fontSize:12, color:C.green, fontWeight:600 }}>✓ Guardado</span>}
          {error && <span style={{ fontSize:12, color:C.red }}>{error}</span>}
          {tab==='rules' && (
            <button onClick={saveRules} disabled={saving} style={{ padding:'8px 20px', fontSize:13, fontWeight:700, borderRadius:9, border:'none', background:saving?'rgba(240,168,78,0.4)':C.amber, color:'#0A0D14', cursor:'pointer', fontFamily:'inherit' }}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          )}
          {tab==='knowledge' && (
            <button onClick={saveKnowledge} disabled={savingK} style={{ padding:'8px 20px', fontSize:13, fontWeight:700, borderRadius:9, border:'none', background:savingK?'rgba(240,168,78,0.4)':C.amber, color:'#0A0D14', cursor:'pointer', fontFamily:'inherit' }}>
              {savingK ? 'Guardando...' : 'Guardar conocimiento'}
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
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 28px 60px' }}>

        {/* ── TAB: RULES ──────────────────────────────────────────────────────── */}
        {tab==='rules' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Reglas numéricas */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:18 }}>Reglas automáticas</h2>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <label style={{ fontSize:12, color:C.text2, fontWeight:600, display:'block', marginBottom:6 }}>Tamaño máximo sin revisión</label>
                  <input type="number" min={1} max={50} value={rules.max_auto_party_size} onChange={e=>setRules((r:any)=>({...r,max_auto_party_size:parseInt(e.target.value)||6}))} style={inp()} />
                  <p style={{ fontSize:11, color:C.text3, marginTop:4 }}>Grupos más grandes quedarán pendientes de revisión</p>
                </div>
                <div>
                  <label style={{ fontSize:12, color:C.text2, fontWeight:600, display:'block', marginBottom:6 }}>Confianza mínima para confirmar</label>
                  <input type="number" min={0.3} max={1} step={0.05} value={rules.min_confidence_to_confirm} onChange={e=>setRules((r:any)=>({...r,min_confidence_to_confirm:parseFloat(e.target.value)||0.72}))} style={inp()} />
                  <p style={{ fontSize:11, color:C.text3, marginTop:4 }}>0.72 = 72%. Por debajo: requiere atención humana</p>
                </div>
              </div>
              <div style={{ display:'flex', gap:12, marginTop:14, flexWrap:'wrap' }}>
                {[
                  { key:'special_requests_require_review', label:'Peticiones especiales → revisión' },
                  { key:'allow_auto_cancellations',        label:'Permitir cancelaciones automáticas' },
                  { key:'offer_alternative_times',         label:'Ofrecer horarios alternativos' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={()=>setRules((r:any)=>({...r,[key]:!r[key]}))} style={{
                    padding:'8px 16px', fontSize:12, fontWeight:600, borderRadius:9, cursor:'pointer', fontFamily:'inherit',
                    background: (rules[key] as boolean) ? 'rgba(74,222,128,0.12)' : C.surface2,
                    border: `1px solid ${(rules[key] as boolean) ? C.green+'40' : C.border}`,
                    color: (rules[key] as boolean) ? C.green : C.text3, transition:'all 0.15s',
                  }}>{(rules[key] as boolean) ? '✓' : '○'} {label}</button>
                ))}
              </div>
            </div>

            {/* Patrones */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>Patrones de decisión</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:18 }}>Define qué hace el agente cuando detecta cada situación</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {PATTERN_KEYS.map(({ key, label, icon, desc }) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:C.surface2, borderRadius:10, border:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:C.text }}>{label}</p>
                      <p style={{ fontSize:11, color:C.text3 }}>{desc}</p>
                    </div>
                    <select value={patterns[key]||'pending_review'} onChange={e=>setPatterns(p=>({...p,[key]:e.target.value}))}
                      style={{ ...inp({ width:'auto', minWidth:220, padding:'7px 12px' }) }}>
                      {STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial de feedback */}
            {feedback.length > 0 && (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
                <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:14 }}>📚 Correcciones recientes</h2>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {feedback.slice(0,8).map((f:any,i:number) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:C.surface2, borderRadius:8 }}>
                      <span style={{ fontSize:11, color:C.text3, flexShrink:0 }}>{new Date(f.created_at).toLocaleDateString('es-ES')}</span>
                      <span style={{ fontSize:12, color:C.red }}>{f.original_status}</span>
                      <span style={{ fontSize:11, color:C.text3 }}>→</span>
                      <span style={{ fontSize:12, color:C.green }}>{f.corrected_status}</span>
                      {(f.flags||[]).map((flag:string)=>(
                        <span key={flag} style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:C.amberDim||'rgba(240,168,78,0.10)', color:C.amber, fontWeight:600 }}>{FLAG_LABELS[flag]||flag}</span>
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
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>🛎️ Servicios ofrecidos</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:14 }}>Qué servicios ofrece tu negocio (separados por coma)</p>
              <input value={(knowledge.services||[]).join(', ')} onChange={e=>setKnowledge((k:any)=>({...k,services:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)}))}
                placeholder="reservas, pedido para recoger, menú del día, entrega a domicilio..."
                style={{...inp()}}/>
            </div>

            {/* Horarios */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>🕐 Horarios</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:14 }}>Define los turnos de tu negocio</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[['lunch','Mediodía'],['dinner','Noche'],['morning','Mañana'],['weekend','Fin de semana']].map(([key,label])=>(
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:12, color:C.text2, fontWeight:600, width:100, flexShrink:0 }}>{label}</span>
                    <input value={(knowledge.hours||{})[key]||''} onChange={e=>setKnowledge((k:any)=>({...k,hours:{...(k.hours||{}),[key]:e.target.value}}))}
                      placeholder="ej: 13:00-16:00" style={{...inp()}}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Menú */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>🍽️ Menú / Catálogo</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:14 }}>Categorías y productos. El agente usará esto para responder preguntas sobre disponibilidad.</p>
              <MenuEditor menu={knowledge.menu||{}} onChange={(m:any)=>setKnowledge((k:any)=>({...k,menu:m}))}/>
            </div>

            {/* FAQs */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>❓ Preguntas frecuentes</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:14 }}>Preguntas que el agente responderá directamente sin improvisar</p>
              <FaqEditor faqs={knowledge.faqs||[]} onChange={(f:any)=>setKnowledge((k:any)=>({...k,faqs:f}))}/>
            </div>

            {/* Notas especiales */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>📝 Notas especiales</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:14 }}>Información adicional para el agente (políticas, restricciones, etc.)</p>
              <textarea value={knowledge.special_notes||''} onChange={e=>setKnowledge((k:any)=>({...k,special_notes:e.target.value}))}
                rows={4} placeholder="Ej: Los domingos solo abrimos para cenas. No aceptamos grupos de más de 20 sin reserva previa..."
                style={{...inp(), resize:'vertical'}}/>
            </div>

          </div>
        )}

        {/* ── TAB: MEMORIA ─────────────────────────────────────────────────────── */}
        {tab==='memory' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 24px' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>📚 Correcciones acumuladas</h2>
              <p style={{ fontSize:12, color:C.text3, marginBottom:16 }}>Patrones detectados a partir de tus correcciones. Cuando hay 3 o más del mismo tipo, el sistema puede sugerirte automatizarlos.</p>
              {feedback.length === 0 ? (
                <div style={{ padding:'32px 0', textAlign:'center' }}>
                  <div style={{ fontSize:28, marginBottom:10 }}>🧠</div>
                  <p style={{ fontSize:13, color:C.text3 }}>Sin correcciones aún. Cuando corrijas decisiones del agente, aparecerán aquí y el sistema aprenderá.</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {feedback.map((f:any,i:number)=>(
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr auto', gap:10, alignItems:'center', padding:'10px 14px', background:C.surface2, borderRadius:9, border:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:11, color:C.text3 }}>{new Date(f.created_at).toLocaleDateString('es-ES')}</span>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {(f.flags||[]).map((flag:string)=>(
                          <span key={flag} style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:`${C.amber}18`, color:C.amber, fontWeight:600 }}>{FLAG_LABELS[flag]||flag}</span>
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
function MenuEditor({ menu, onChange }: { menu: Record<string,string[]>; onChange:(m:any)=>void }) {
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
            <button onClick={()=>removeCategory(cat)} style={{ fontSize:11, color:C.red, background:'none', border:'none', cursor:'pointer' }}>✕ eliminar</button>
          </div>
          <input value={(menu[cat]||[]).join(', ')} onChange={e=>updateItems(cat,e.target.value)}
            placeholder={`Productos en ${cat} (separados por coma)`} style={{...inp()}}/>
        </div>
      ))}
      <div style={{ display:'flex', gap:8 }}>
        <input value={newCat} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCategory()}
          placeholder="Nueva categoría (ej: carnes, postres...)" style={{...inp()}}/>
        <button onClick={addCategory} style={{ padding:'10px 18px', fontSize:13, fontWeight:600, background:C.amberDim, border:`1px solid ${C.amberBorder}`, borderRadius:9, color:C.amber, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>+ Añadir</button>
      </div>
    </div>
  )
}

// ── FaqEditor sub-component ───────────────────────────────────────────────
function FaqEditor({ faqs, onChange }: { faqs: Array<{q:string;a:string}>; onChange:(f:any)=>void }) {
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
            <input value={faq.q} onChange={e=>updateFaq(i,'q',e.target.value)} placeholder="Pregunta del cliente..." style={{...inp()}}/>
            <button onClick={()=>removeFaq(i)} style={{ fontSize:11, color:C.red, background:'none', border:'none', cursor:'pointer', flexShrink:0 }}>✕</button>
          </div>
          <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
            <span style={{ fontSize:11, color:C.teal, fontWeight:600, width:18, flexShrink:0, marginTop:10 }}>R:</span>
            <textarea value={faq.a} onChange={e=>updateFaq(i,'a',e.target.value)} rows={2}
              placeholder="Respuesta exacta que dará el agente..." style={{...inp(), resize:'vertical'}}/>
          </div>
        </div>
      ))}
      <button onClick={addFaq} style={{ padding:'10px 18px', fontSize:13, fontWeight:600, background:C.amberDim, border:`1px solid ${C.amberBorder}`, borderRadius:9, color:C.amber, cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
        + Añadir pregunta frecuente
      </button>
    </div>
  )
}
