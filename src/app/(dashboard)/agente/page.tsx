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
  { key:'large_group',       label:'Grupos grandes',          icon:'👥', desc:'Cuando el grupo supera el máximo automático' },
  { key:'birthday_requests', label:'Cumpleaños y celebraciones', icon:'🎂', desc:'Cuando el cliente menciona cumpleaños, aniversario, etc.' },
  { key:'allergy_notes',     label:'Alergias e intolerancias', icon:'⚕️', desc:'Cuando el cliente menciona alergias o restricciones alimentarias' },
  { key:'table_specific',    label:'Mesa específica',         icon:'📍', desc:'Cuando el cliente pide una mesa o zona concreta' },
  { key:'accessibility',     label:'Accesibilidad',           icon:'♿', desc:'Silla de ruedas, carrito de bebé, movilidad reducida' },
]
const FLAG_LABELS: Record<string,string> = {
  large_group:'Grupo grande', allergy_note:'Alergia', specific_table_request:'Mesa concreta',
  low_confidence:'Baja confianza', modification_request:'Modificación',
  cancellation_request:'Cancelación', special_occasion:'Celebración',
  accessibility_need:'Accesibilidad', confused_customer:'Cliente confuso',
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, padding:'14px 0', borderBottom:`1px solid ${C.border}` }}>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:2 }}>{label}</p>
        {desc && <p style={{ fontSize:12, color:C.text3, lineHeight:1.5 }}>{desc}</p>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        width:42, height:24, borderRadius:12, border:'none', cursor:'pointer',
        background: value ? C.amber : 'rgba(255,255,255,0.1)',
        position:'relative', flexShrink:0, transition:'background 0.2s',
      }}>
        <div style={{
          position:'absolute', top:3, left: value ? 21 : 3,
          width:18, height:18, borderRadius:'50%', background:'white',
          transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)',
        }}/>
      </button>
    </div>
  )
}

function Slider({ value, onChange, min, max, step, label, desc, format }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step: number;
  label: string; desc?: string; format?: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={{ padding:'14px 0', borderBottom:`1px solid ${C.border}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <div>
          <p style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:2 }}>{label}</p>
          {desc && <p style={{ fontSize:12, color:C.text3 }}>{desc}</p>}
        </div>
        <span style={{ fontSize:16, fontWeight:700, color:C.amber, fontFamily:'monospace' }}>
          {format ? format(value) : value}
        </span>
      </div>
      <div style={{ position:'relative', height:6, background:'rgba(255,255,255,0.08)', borderRadius:3 }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:pct+'%', background:C.amber, borderRadius:3 }}/>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position:'absolute', inset:0, width:'100%', opacity:0, cursor:'pointer', height:'100%' }}/>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
        <span style={{ fontSize:10, color:C.text3 }}>{format ? format(min) : min}</span>
        <span style={{ fontSize:10, color:C.text3 }}>{format ? format(max) : max}</span>
      </div>
    </div>
  )
}

export default function AgentePage() {
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [token, setToken]       = useState('')
  const [feedback, setFeedback] = useState<any[]>([])
  const [updatedAt, setUpdatedAt] = useState<string|null>(null)

  const [rules, setRules] = useState({
    max_auto_party_size:             6,
    special_requests_require_review: true,
    allow_auto_cancellations:        true,
    offer_alternative_times:         true,
    min_confidence_to_confirm:       0.72,
  })
  const [patterns, setPatterns] = useState<Record<string,string>>({
    large_group:       'pending_review',
    birthday_requests: 'pending_review',
    allergy_notes:     'pending_review',
    table_specific:    'pending_review',
    accessibility:     'pending_review',
  })

  const loadRules = useCallback(async (tok: string) => {
    try {
      const res = await fetch('/api/voice/rules', {
        headers: { 'Authorization': 'Bearer ' + tok }
      })
      const data = await res.json()
      if (data.rules) {
        setRules(r => ({ ...r, ...data.rules }))
        setPatterns(p => ({ ...p, ...data.patterns }))
        setFeedback(data.feedback || [])
        setUpdatedAt(data.updated_at)
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      setToken(session.access_token)
      await loadRules(session.access_token)
    })()
  }, [loadRules])

  const saveRules = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch('/api/voice/rules', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, patterns })
      })
      const data = await res.json()
      if (data.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
      else setError(data.error || 'Error al guardar')
    } catch(e: any) { setError(e.message) }
    setSaving(false)
  }

  if (loading) return <PageLoader/>

  const R = (k: keyof typeof rules, v: any) => setRules(r => ({ ...r, [k]: v }))
  const P = (k: string, v: string) => setPatterns(p => ({ ...p, [k]: v }))

  return (
    <div style={{ background:C.bg, minHeight:'100vh' }}>
      {/* HEADER */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:20 }}>
        <div>
          <h1 style={{ fontSize:16, fontWeight:700, color:C.text, letterSpacing:'-0.02em' }}>Comportamiento del agente</h1>
          <p style={{ fontSize:11, color:C.text3, marginTop:2 }}>Configura cómo decide y responde tu recepcionista IA</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {updatedAt && <p style={{ fontSize:11, color:C.text3 }}>Guardado {new Date(updatedAt).toLocaleDateString('es-ES')}</p>}
          {saved && <span style={{ fontSize:12, color:C.green, fontWeight:600 }}>✓ Guardado</span>}
          {error && <span style={{ fontSize:12, color:C.red }}>{error}</span>}
          <button onClick={saveRules} disabled={saving} style={{
            padding:'8px 20px', fontSize:13, fontWeight:700, borderRadius:9, border:'none',
            background: saving ? 'rgba(240,168,78,0.4)' : C.amber,
            color:'#0A0D14', cursor:'pointer', fontFamily:'inherit', opacity:saving?0.7:1,
          }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <NotifBell/>
        </div>
      </div>

      <div style={{ maxWidth:780, margin:'0 auto', padding:'24px 24px 60px' }}>

        {/* NIVEL DE AUTOMATIZACIÓN */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, background:'rgba(240,168,78,0.04)' }}>
            <p style={{ fontSize:13, fontWeight:700, color:C.amber }}>🧠 Nivel de automatización</p>
            <p style={{ fontSize:12, color:C.text3, marginTop:2 }}>Qué puede hacer el agente por su cuenta y qué requiere tu revisión</p>
          </div>
          <div style={{ padding:'4px 20px 8px' }}>
            <Slider
              value={rules.max_auto_party_size} onChange={v => R('max_auto_party_size', v)}
              min={1} max={20} step={1} label="Tamaño máximo de grupo para confirmar automáticamente"
              desc="Grupos con más personas pasarán a revisión manual"
              format={v => v + ' personas'}
            />
            <Slider
              value={Math.round(rules.min_confidence_to_confirm * 100)}
              onChange={v => R('min_confidence_to_confirm', v / 100)}
              min={30} max={95} step={5}
              label="Confianza mínima para confirmar automáticamente"
              desc="Por debajo de este nivel, la llamada pasa a revisión"
              format={v => v + '%'}
            />
            <Toggle value={rules.special_requests_require_review}  onChange={v => R('special_requests_require_review', v)}  label="Las peticiones especiales requieren revisión" desc="Alergias, mesas concretas, celebraciones, accesibilidad…" />
            <Toggle value={rules.allow_auto_cancellations}         onChange={v => R('allow_auto_cancellations', v)}          label="Permitir cancelaciones automáticas" desc="El agente puede cancelar citas si los datos están completos" />
            <div style={{ paddingBottom:6 }}>
              <Toggle value={rules.offer_alternative_times} onChange={v => R('offer_alternative_times', v)} label="Ofrecer horarios alternativos si no hay disponibilidad" desc="El agente propondrá otra hora en lugar de rechazar directamente" />
            </div>
          </div>
        </div>

        {/* PATRONES — qué hace el agente ante cada situación */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, background:'rgba(167,139,250,0.04)' }}>
            <p style={{ fontSize:13, fontWeight:700, color:C.violet }}>⚡ Patrones de decisión</p>
            <p style={{ fontSize:12, color:C.text3, marginTop:2 }}>Qué debe hacer el agente cuando detecta cada situación</p>
          </div>
          <div style={{ padding:'8px 20px 16px' }}>
            {PATTERN_KEYS.map((pk, i) => (
              <div key={pk.key} style={{ padding:'14px 0', borderBottom: i < PATTERN_KEYS.length-1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:3 }}>{pk.icon} {pk.label}</p>
                    <p style={{ fontSize:12, color:C.text3, lineHeight:1.5 }}>{pk.desc}</p>
                  </div>
                  <select value={patterns[pk.key] || 'pending_review'} onChange={e => P(pk.key, e.target.value)}
                    style={{ fontSize:12, padding:'6px 10px', borderRadius:8, border:`1px solid ${C.borderMd}`,
                      background:C.surface2, color:C.text, cursor:'pointer', fontFamily:'inherit', flexShrink:0, minWidth:220 }}>
                    {STATUS_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* HISTORIAL DE CORRECCIONES */}
        {feedback.length > 0 && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', marginBottom:20 }}>
            <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}` }}>
              <p style={{ fontSize:13, fontWeight:700, color:C.text }}>📚 Historial de aprendizaje</p>
              <p style={{ fontSize:12, color:C.text3, marginTop:2 }}>Correcciones que has hecho al agente — alimentan su mejora</p>
            </div>
            <div style={{ padding:'8px 20px 16px' }}>
              {feedback.slice(0, 8).map((fb, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom: i < Math.min(feedback.length,8)-1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(167,139,250,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>✏️</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, padding:'2px 8px', borderRadius:6, background:C.redDim, color:C.red, fontWeight:600 }}>{fb.original_status}</span>
                      <span style={{ fontSize:11, color:C.text3 }}>→</span>
                      <span style={{ fontSize:12, padding:'2px 8px', borderRadius:6, background:C.greenDim, color:C.green, fontWeight:600 }}>{fb.corrected_status}</span>
                      {(fb.flags||[]).map((f:string) => (
                        <span key={f} style={{ fontSize:10, padding:'1px 7px', borderRadius:5, background:C.violetDim, color:C.violet }}>{FLAG_LABELS[f]||f}</span>
                      ))}
                    </div>
                    {fb.note && <p style={{ fontSize:12, color:C.text3, fontStyle:'italic' }}>"{fb.note}"</p>}
                    <p style={{ fontSize:11, color:C.text3, marginTop:2 }}>{new Date(fb.created_at).toLocaleDateString('es-ES', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CÓMO FUNCIONA */}
        <div style={{ background:'rgba(240,168,78,0.04)', border:`1px solid ${C.amberBorder}`, borderRadius:14, padding:'16px 20px' }}>
          <p style={{ fontSize:12, fontWeight:700, color:C.amber, marginBottom:10 }}>💡 Cómo funciona el aprendizaje</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              ['El agente decide', 'En cada llamada evalúa confianza, datos y tus reglas para elegir el estado'],
              ['Tú corriges', 'Desde el panel de llamadas puedes corregir cualquier decisión con un click'],
              ['El sistema aprende', 'Con 3 correcciones iguales del mismo patrón, sugiere automatizarlo'],
              ['Tú apruebas', 'Solo tú decides si aplicar la nueva regla — nunca ocurre solo'],
            ].map(([title, desc]) => (
              <div key={title} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:C.amber, marginTop:5, flexShrink:0 }}/>
                <p style={{ fontSize:12, color:C.text2, lineHeight:1.6 }}><strong style={{ color:C.text }}>{title}:</strong> {desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
