'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PageLoader, PageSkeleton } from '@/components/ui'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import { resolveTemplate } from '@/lib/templates'
import { getEventConfig, type BusinessEventConfig } from '@/lib/event-schemas'
import { getTranslations, getCommonStrings, tx } from '@/lib/i18n'
import { C } from '@/lib/colors'
const PLAN_COL: Record<string,string> = { trial:C.amber,free:C.amber,starter:C.blue,pro:C.violet,business:C.green }
const PLAN_LBL: Record<string,string> = { trial:'Trial',free:'Trial',starter:'Starter',pro:'Pro',business:'Business' }
const PLAN_CALLS: Record<string,number> = { trial:10,free:10,starter:50,pro:200,business:600 }

const INTENT_MAP: Record<string, string> = {
  reserva: 'reservation', pedido: 'order', cancelacion: 'cancellation',
  consulta: 'inquiry', otro: 'inquiry',
}
function getSchemaMap(eventLabel?: string): Record<string, { icon: string; color: string; label: string }> {
  const resLabel = eventLabel || 'Reserva'
  return {
    reservation: { icon: '📅', color: '#2DD4BF', label: resLabel },
    appointment: { icon: '📋', color: '#2DD4BF', label: resLabel },
    order:       { icon: '🛍️', color: '#A78BFA', label: 'Pedido' },
    cancellation:{ icon: '❌', color: '#F87171', label: 'Cancelación' },
    inquiry:     { icon: '💬', color: '#8895A7', label: 'Consulta' },
    visit:       { icon: '🏠', color: '#60A5FA', label: resLabel },
  }
}
// Default fallback for contexts without tenant
const SCHEMA_MAP = getSchemaMap()
const CALL_STATE_MAP: Record<string, { label: string; color: string }> = {
  escuchando:   { label: 'Escuchando', color: '#2DD4BF' },
  hablando:     { label: 'Hablando',   color: '#F0A84E' },
  procesando:   { label: 'Procesando', color: '#A78BFA' },
  finalizando:  { label: 'Finalizando', color: '#8895A7' },
}
const ACTIVE_CALL_LABEL = 'Actividad en vivo'

// ── Tipos de evento del feed
interface LiveEvent {
  id: string
  type: 'call_incoming'|'call_active'|'call_ended'|'call_missed'|'reservation'|'order'|'pending'|'system'|'whatsapp'|'email'|'sms'
  icon: string
  color: string
  title: string
  sub?: string
  ts: Date
  priority?: 'high'|'normal'
  demo?: boolean
}


function timeAgo(d: Date, lang='es') {
  const s = Math.floor((Date.now()-d.getTime())/1000)
  if (s < 5) return tx('ahora mismo', lang)
  if (s < 60) return s+'s'
  if (s < 3600) return Math.floor(s/60)+'m'
  return Math.floor(s/3600)+'h'
}

// ── Demo events dinámicos por tipo de negocio ──────────────────────────────
function buildDemoEvents(evtConfig: BusinessEventConfig, lang='es'): Omit<LiveEvent,'id'|'ts'>[] {
  const _t = (s:string) => tx(s, lang)
  const eL = evtConfig.eventLabel || 'Reserva'
  const eLower = eL.toLowerCase()

  // Ejemplos adaptados por tipo de negocio
  const demoByType: Record<string, { name: string; sub: string; consultaSub: string }> = {
    'Cita':    { name: 'María López',   sub: 'Revisión · 10:30',              consultaSub: 'Paciente preguntó por horarios disponibles' },
    'Sesión':  { name: 'Ana García',    sub: 'Sesión individual · 17:00',     consultaSub: 'Cliente preguntó por disponibilidad' },
    'Clase':   { name: 'Roberto Díaz',  sub: 'Spinning · 19:00',             consultaSub: 'Socio preguntó por horarios de clases' },
    'Visita':  { name: 'Elena Mora',    sub: 'Piso 2 hab. centro · 17:00',   consultaSub: 'Cliente preguntó por pisos disponibles' },
    'Pedido':  { name: 'Luis Fernández',sub: '3 productos · 45.90€',         consultaSub: 'Cliente preguntó por estado de envío' },
  }
  const demo = demoByType[eL] || { name: 'María López', sub: '4 personas · 21:00', consultaSub: 'Cliente preguntó por opciones vegetarianas' }

  return [
    { type: 'call_incoming', icon: '📞', color: C.teal, title: `${_t('Llamada entrante')} — +34 612 345 678`, sub: `📅 ${eL} detectada`, priority: 'high', demo: true },
    { type: 'reservation', icon: '📅', color: C.teal, title: `Nueva ${eLower} — ${demo.name}`, sub: demo.sub, priority: 'high', demo: true },
    { type: 'call_ended', icon: '✅', color: C.green, title: `${_t('Llamada finalizada')} — Carlos Ruiz`, sub: `${eL} confirmada para mañana`, demo: true },
    { type: 'system', icon: '💬', color: C.text2, title: _t('Consulta atendida'), sub: demo.consultaSub, demo: true },
    { type: 'call_incoming', icon: '📞', color: C.teal, title: `${_t('Llamada entrante')} — +34 698 765 432`, sub: `💬 ${_t('Consulta detectada')}`, demo: true },
  ]
}

// ── Live Feed Component
function LiveFeed({ events, demoMode, onToggleDemo, lang='es' }: { events:LiveEvent[], demoMode:boolean, onToggleDemo:()=>void, lang?:string }) {
  const _tx = (s:string) => tx(s, lang)
  const display = events.slice(0, 12)

  return (
    <div className="rz-card-premium" style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:C.surface }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="rz-status-online"/>
          <span style={{ fontSize:14, fontWeight:700, color:C.text, letterSpacing:'-0.01em' }}>{_tx(ACTIVE_CALL_LABEL)}</span>
          {demoMode && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(251,181,63,0.15)', color:C.yellow, fontWeight:700, letterSpacing:'0.04em' }}>DEMO</span>}
        </div>
        <button onClick={onToggleDemo} style={{
          fontSize:11, padding:'4px 12px', borderRadius:8, border:`1px solid ${demoMode?C.yellow+'40':C.border}`,
          background:demoMode?'rgba(251,181,63,0.08)':'var(--rz-surface-2)',
          color:demoMode?C.yellow:C.text3, cursor:'pointer', fontFamily:'inherit', fontWeight:600, transition:'all 0.15s'
        }}>
          {demoMode ? '⏹ '+_tx('Salir demo') : '▶ '+_tx('Modo demo')}
        </button>
      </div>

      {/* Events */}
      <div style={{ maxHeight:340, overflowY:'auto', scrollbarWidth:'none' }}>
        {display.length === 0 ? (
          <div style={{ padding:'40px 20px', textAlign:'center' }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(45,212,191,0.08)', border:'1px solid rgba(45,212,191,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:20 }}>⚡</div>
            <p style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:6 }}>{_tx('El sistema está listo')}</p>
            <p style={{ fontSize:12, color:C.text3, lineHeight:1.7, maxWidth:260, margin:'0 auto' }}>{_tx('Tu recepcionista está activa y preparada. Los eventos aparecerán aquí en tiempo real.')}</p>
            <button onClick={onToggleDemo} style={{ marginTop:16, padding:'8px 18px', fontSize:12, fontWeight:700, borderRadius:9, border:`1px solid ${C.amber}40`, background:C.amberDim, color:C.amber, cursor:'pointer', fontFamily:'inherit' }}>
              ▶ {_tx('Ver demo')}
            </button>
          </div>
        ) : display.map((evt, i) => (
          <div key={evt.id} style={{
            display:'flex', gap:12, padding:'11px 18px',
            borderBottom: i < display.length-1 ? `1px solid ${C.border}` : 'none',
            background: evt.priority==='high' ? `${evt.color}05` : 'transparent',
            animation: i===0 ? 'rzSlideIn 0.35s ease' : 'none',
            transition:'background 0.15s',
          }}>
            <div style={{ width:32, height:32, borderRadius:9, background:`${evt.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>
              {evt.icon}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                <p style={{ fontSize:13, fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{evt.title}</p>
                {evt.priority==='high' && <div style={{ width:6, height:6, borderRadius:'50%', background:evt.color, flexShrink:0 }}/>}
              </div>
              {evt.sub && <p style={{ fontSize:11.5, color:C.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{evt.sub}</p>}
            </div>
            <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
              <span style={{ fontSize:10, color:C.text3, whiteSpace:'nowrap' }}>{timeAgo(evt.ts, lang)}</span>
              {evt.demo && <span style={{ fontSize:9, color:C.yellow, fontWeight:700, letterSpacing:'0.04em' }}>DEMO</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── KPI Card
function KpiCard({ value, label, sub, color=C.amber, href, icon, accent=false }:any) {
  const inner = (
    <div className="rz-card-interactive" style={{
      background: C.surface,
      border:`1px solid ${C.borderMd}`, borderRadius:14, padding:'18px 20px',
      position:'relative', overflow:'hidden', cursor:href?'pointer':'default',
    }}>
      {accent && <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${color},transparent)`,borderRadius:'14px 14px 0 0' }}/>}
      {/* Ambient glow */}
      <div style={{ position:'absolute',top:'-30%',right:'-10%',width:120,height:120,background:`radial-gradient(circle,${color}08,transparent 70%)`,pointerEvents:'none' }}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'relative' }}>
        <div>
          <p style={{ fontFamily:'var(--rz-mono)',fontSize:30,fontWeight:800,color,letterSpacing:'-0.03em',lineHeight:1,marginBottom:6 }}>{value}</p>
          <p style={{ fontSize:12,color:C.text2,fontWeight:500 }}>{label}</p>
          {sub && <p style={{ fontSize:11,color:C.text3,marginTop:3 }}>{sub}</p>}
        </div>
        {icon && <div style={{ width:38,height:38,borderRadius:11,background:`linear-gradient(135deg,${color}18,${color}08)`,border:`1px solid ${color}20`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          <span style={{ fontSize:17 }}>{icon}</span>
        </div>}
      </div>
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration:'none' }}>{inner}</Link> : inner
}

// ── Active call block — usa schemas dinámicos
function ActiveCallBlock({ call, businessType, lang='es' }:{ call:any; businessType:string; lang?:string }) {
  const _tx = (s:string) => tx(s, lang)
  const state = call.session_state || 'escuchando'
  const stateInfo = CALL_STATE_MAP[state] || { label: state, color: C.teal }
  const color = stateInfo.color
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const elapsed = call.started_at ? Math.floor((now-new Date(call.started_at).getTime())/1000) : 0
  const dur = elapsed>=60 ? `${Math.floor(elapsed/60)}m ${elapsed%60}s` : `${elapsed}s`
  return (
    <div style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 14px',background:C.surface2,borderRadius:11,border:`1px solid ${color}25` }}>
      <div style={{ width:36,height:36,borderRadius:'50%',background:`${color}18`,border:`1.5px solid ${color}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill={color}><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{call.caller_phone||_tx('Número oculto')}</p>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <div style={{ width:5,height:5,borderRadius:'50%',background:color,animation:'rz-pulse 1.5s ease-in-out infinite' }}/>
          <span style={{ fontSize:11,color,fontWeight:500 }}>{_tx(stateInfo.label)}</span>
        </div>
      </div>
      <span style={{ fontFamily:'var(--rz-mono)',fontSize:12,color:C.text3,flexShrink:0 }}>{dur}</span>
    </div>
  )
}

// ── Call row — usa schemas dinámicos
function CallRow({ call, idx, businessType, lang='es', eventLabel }:{ call:any; idx:number; businessType:string; lang?:string; eventLabel?:string }) {
  const _tx = (s:string) => tx(s, lang)
  const schemaType = INTENT_MAP[call.intent] || 'inquiry'
  const schema = getSchemaMap(eventLabel)[schemaType]
  const status = call.status||'completada'
  const done = ['completada','completed'].includes(status)
  const phone = call.caller_phone||call.from_number||_tx('Número oculto')
  const dur = call.duration_seconds ? (call.duration_seconds>=60?`${Math.round(call.duration_seconds/60)}m`:`${call.duration_seconds}s`) : null
  const loc = lang==='es'?'es-ES':lang==='en'?'en-GB':lang==='fr'?'fr-FR':lang==='pt'?'pt-PT':'ca-ES'
  const time = call.started_at ? new Date(call.started_at).toLocaleTimeString(loc,{hour:'2-digit',minute:'2-digit'}) : ''
  const ic = schema?.color || C.text3
  const intentLabel = schema?.label || call.intent
  return (
    <div style={{ display:'flex',alignItems:'flex-start',gap:12,padding:'12px 20px',borderTop:idx>0?`1px solid ${C.border}`:'none',transition:'background 0.12s' }}
      onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
      <div style={{ width:32,height:32,borderRadius:'50%',background:done?C.greenDim:C.redDim,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill={done?C.green:C.red}><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:3 }}>
          <p style={{ fontSize:13,fontWeight:600,color:C.text }}>{phone}</p>
          {schema && call.intent && <span style={{ fontSize:10,padding:'1px 7px',borderRadius:10,background:`${ic}18`,color:ic,fontWeight:600 }}>{schema.icon} {_tx(intentLabel)}</span>}
          {done && <span style={{ fontSize:10,padding:'1px 7px',borderRadius:10,background:C.greenDim,color:C.green,fontWeight:600 }}>{_tx('Completada')}</span>}
        </div>
        {call.summary ? <p style={{ fontSize:12,color:C.text2,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as const,overflow:'hidden' }}>{call.summary}</p>
          : <p style={{ fontSize:12,color:C.text3 }}>{_tx('Sin resumen')}</p>}
      </div>
      <div style={{ flexShrink:0,textAlign:'right' as const }}>
        <p style={{ fontSize:11,color:C.text3 }}>{time}</p>
        {dur && <p style={{ fontFamily:'var(--rz-mono)',fontSize:11,color:C.text3,marginTop:2 }}>{dur}</p>}
      </div>
    </div>
  )
}

// ── Agent status bar
function AgentBar({ agentOn, agentName, lang='es' }:{ agentOn:boolean; agentName:string; lang?:string }) {
  const _tx = (s:string) => tx(s, lang)
  return (
    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
      <div style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 14px',
        background:agentOn?'rgba(45,212,191,0.08)':'rgba(248,113,113,0.08)',
        border:`1px solid ${agentOn?'rgba(45,212,191,0.2)':'rgba(248,113,113,0.2)'}`,borderRadius:20 }}>
        <div style={{ width:6,height:6,borderRadius:'50%',background:agentOn?C.teal:C.red,animation:agentOn?'rz-pulse 2s ease-in-out infinite':'none' }}/>
        <span style={{ fontSize:12,fontWeight:600,color:agentOn?C.teal:C.red }}>{agentOn?(agentName||'Sofía')+' '+_tx('activa'):_tx('Sin número asignado')}</span>
      </div>
      {!agentOn && <Link href="/configuracion" style={{ padding:'6px 14px',fontSize:12,fontWeight:600,color:C.bg,background:C.amber,borderRadius:8,textDecoration:'none' }}>{_tx('Configurar')} →</Link>}
    </div>
  )
}

// ── Insights Panel — AI thoughts
function InsightsPanel({ insights, headerLabel, lang='es', agentName='Sofía' }: { insights: any[]; headerLabel?: string; lang?:string; agentName?:string }) {
  const _tx = (s:string) => tx(s, lang)
  if (insights.length === 0) return null
  const priorityOrder = { high: 0, normal: 1, low: 2 }
  const sorted = [...insights].sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] || 1) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 1))

  return (
    <div className="rz-card-premium" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, background:C.surface }}>
        <div className="rz-status-busy"/>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{headerLabel || (agentName + ' ' + _tx('ha detectado'))}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sorted.map((insight, i) => (
          <div key={insight.id} style={{
            padding: '12px 18px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
            background: insight.priority === 'high' ? 'rgba(240,168,78,0.04)' : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{insight.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>{insight.title}</p>
                <p style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>{insight.body}</p>
                {insight.action && insight.actionHref && (
                  <a href={insight.actionHref} style={{ fontSize: 11, color: C.amber, fontWeight: 600, textDecoration: 'none', marginTop: 6, display: 'inline-block' }}>
                    {insight.action} →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Forecast Chart — previsión de demanda por hora
function ForecastChart({ data, forecastLabel, lang='es' }: { data: { hour: string; predicted: number; actual: number; level: string; color: string }[]; forecastLabel?: string; lang?:string }) {
  const _tx = (s:string) => tx(s, lang)
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.predicted), 1)
  const nowHour = new Date().getHours()
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:'18px 20px', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <span style={{ fontSize:15 }}>📊</span>
        <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{forecastLabel || _tx('Así pinta hoy')}</span>
      </div>
      <div style={{ display:'flex', gap:3, alignItems:'flex-end', height:80 }}>
        {data.map(d => {
          const h = Math.max(4, Math.round((d.predicted / max) * 80))
          const isNow = parseInt(d.hour) === nowHour
          return (
            <div key={d.hour} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <div style={{ width:'100%', height:h, background:d.color, borderRadius:3, opacity: isNow ? 1 : 0.7, border: isNow ? '2px solid #E8EEF6' : 'none', transition:'height 0.3s' }}/>
              <span style={{ fontSize:9, color: isNow ? C.text : C.text3, fontWeight: isNow ? 700 : 400 }}>{d.hour.slice(0,2)}</span>
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:12, marginTop:12, flexWrap:'wrap' }}>
        {[{l:_tx('Tranquilo'),c:'#34D399'},{l:_tx('Normal'),c:'#F0A84E'},{l:_tx('Fuerte'),c:'#FB923C'},{l:_tx('A tope'),c:'#F87171'}].map(x => (
          <div key={x.l} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:x.c }}/>
            <span style={{ fontSize:10, color:C.text3 }}>{x.l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════
export default function PanelPage() {
  const router = useRouter()
  const [loading,setLoading]   = useState(true)
  const [tenant,setTenant]     = useState<any>(null)
  const [calls,setCalls]       = useState<any[]>([])
  const [reservas,setReservas] = useState<any[]>([])
  const [clientes,setClientes] = useState<any[]>([])
  const [activeCalls,setActiveCalls] = useState<any[]>([])
  const [activeOrders,setActiveOrders]           = useState<any[]>([])
  const [activeConsultations,setActiveConsultations] = useState<any[]>([])
  const [events,setEvents]     = useState<LiveEvent[]>([])
  const [demoMode,setDemoMode] = useState(false)
  const [forecast, setForecast] = useState<any[]>([])
  const [insights, setInsights] = useState<any[]>([])
  const [orderAlert, setOrderAlert] = useState<{name:string;type:string;id:string}|null>(null)
  const [daySummary, setDaySummary] = useState<any>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [opContext, setOpContext] = useState<any>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [weeklyComp, setWeeklyComp] = useState<{ thisRevenue: number; lastRevenue: number; thisOrders: number; lastOrders: number; thisReservations: number; lastReservations: number } | null>(null)
  const demoTimer              = useRef<ReturnType<typeof setInterval>|null>(null)
  const demoIdx                = useRef(0)
  const rtChannelRef           = useRef<any>(null)
  const loadedRef              = useRef(false)

  const pushEvent = useCallback((evt: Omit<LiveEvent,'id'|'ts'>) => {
    const id = Math.random().toString(36).slice(2)
    setEvents(prev => [{ ...evt, id, ts:new Date() }, ...prev].slice(0,40))
  }, [])

  const load = useCallback(async () => {
    if (loadedRef.current) return
    loadedRef.current = true
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data:p } = await supabase.from('profiles').select('tenant_id,role').eq('id',user.id).maybeSingle()
    if (!p?.tenant_id) { if(p?.role==='superadmin') router.push('/admin'); else router.push('/onboarding'); return }
    const tid = p.tenant_id
    const today = new Date().toISOString().split('T')[0]
    const [{ data:t },{ data:c },{ data:r },{ data:cl },{ data:ac },{ data:ao },{ data:ac2 }] = await Promise.all([
      supabase.from('tenants').select('id,name,slug,type,plan,agent_name,agent_phone,free_calls_used,free_calls_limit,plan_calls_used,plan_calls_included,reservation_config,agent_config,language').eq('id',tid).maybeSingle(),
      supabase.from('calls').select('id,call_sid,status,intent,summary,started_at,duration_seconds,caller_phone,customer_name,from_number,decision_status,decision_flags,decision_confidence,session_state').eq('tenant_id',tid).order('started_at',{ascending:false}).limit(8),
      supabase.from('reservations').select('id,customer_name,customer_phone,date,time,reservation_time,people,party_size,status,source,notes').eq('tenant_id',tid).eq('date',today).order('time'),
      supabase.from('customers').select('id').eq('tenant_id',tid),
      supabase.from('calls').select('id,call_sid,caller_phone,session_state,started_at').eq('tenant_id',tid).eq('status','activa').order('started_at',{ascending:false}).limit(8),
      supabase.from('order_events').select('*').eq('tenant_id',tid).eq('status','collecting').order('created_at',{ascending:false}).limit(5),
      supabase.from('consultation_events').select('*').eq('tenant_id',tid).eq('status','collecting').order('created_at',{ascending:false}).limit(5),
    ])
    // Filter stale calls (>10 min = probably ended but webhook didn't arrive)
    const tenMinAgo = Date.now() - 10 * 60 * 1000
    const freshCalls = (ac||[]).filter((c: any) => new Date(c.started_at).getTime() > tenMinAgo)
    // Auto-complete stale calls in background
    for (const stale of (ac||[]).filter((c: any) => new Date(c.started_at).getTime() <= tenMinAgo)) {
      supabase.from('calls').update({ status: 'completada', intent: 'completada' }).eq('id', stale.id).then(() => {})
    }
    setTenant(t); setCalls(c||[]); setReservas(r||[]); setClientes(cl||[]); setActiveCalls(freshCalls)
    setActiveOrders(ao||[]); setActiveConsultations(ac2||[])
    setLoading(false)

    // Load insights + forecast + yesterday's summary after main data
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const headers = { 'Authorization': 'Bearer ' + token }
    fetch('/api/insights', { headers }).then(r => r.json()).then(d => setInsights(d.insights || [])).catch(e => { console.error('panel: insights failed', e); setInsights([]) })
    fetch('/api/peak-prediction', { headers }).then(r => r.json()).then(d => setForecast(d.forecast || [])).catch(e => { console.error('panel: peak-prediction failed', e); setForecast([]) })
    fetch('/api/suggestions', { headers }).then(r => r.json()).then(d => setSuggestions(d.suggestions || [])).catch(e => { console.error('panel: suggestions failed', e); setSuggestions([]) })
    fetch('/api/operational-context', { headers }).then(r => r.json()).then(d => setOpContext(d.context || null)).catch(e => { console.error('panel: operational-context failed', e); setOpContext({ activeShift: null, todayOrders: 0, todayRevenue: 0, topSellingNow: [], lowStockItems: [], upcomingReservations: [], activeAlerts: [], suggestion: '' }) })

    // Load yesterday's summary
    const yd = new Date(); yd.setDate(yd.getDate() - 1)
    const ydStr = yd.toISOString().slice(0, 10)
    supabase.from('daily_summaries')
      .select('*').eq('tenant_id', tid).eq('date', ydStr).maybeSingle()
      .then(({ data }) => { if (data) setDaySummary(data) })

    // Weekly comparison: this week vs last week
    ;(async () => {
      try {
        const now = new Date()
        const dayOfWeek = now.getDay() // 0=Sun
        const thisMonday = new Date(now)
        thisMonday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
        thisMonday.setHours(0, 0, 0, 0)
        const lastMonday = new Date(thisMonday)
        lastMonday.setDate(thisMonday.getDate() - 7)
        const thisWeekStr = thisMonday.toISOString()
        const lastWeekStr = lastMonday.toISOString()

        const [thisOrders, lastOrders, thisRes, lastRes] = await Promise.all([
          supabase.from('order_events').select('total_estimate').eq('tenant_id', tid).gte('created_at', thisWeekStr),
          supabase.from('order_events').select('total_estimate').eq('tenant_id', tid).gte('created_at', lastWeekStr).lt('created_at', thisWeekStr),
          supabase.from('reservations').select('id').eq('tenant_id', tid).gte('created_at', thisWeekStr),
          supabase.from('reservations').select('id').eq('tenant_id', tid).gte('created_at', lastWeekStr).lt('created_at', thisWeekStr),
        ])
        const thisRev = (thisOrders.data || []).reduce((s: number, o: any) => s + (o.total_estimate || 0), 0)
        const lastRev = (lastOrders.data || []).reduce((s: number, o: any) => s + (o.total_estimate || 0), 0)
        setWeeklyComp({
          thisRevenue: thisRev, lastRevenue: lastRev,
          thisOrders: (thisOrders.data || []).length, lastOrders: (lastOrders.data || []).length,
          thisReservations: (thisRes.data || []).length, lastReservations: (lastRes.data || []).length,
        })
      } catch (e) { console.error('panel: weekly comparison failed', e) }
    })()
  }, [router])

  useEffect(() => { load() }, [load])

  // Real-time: una sola suscripción, dep única combinada evita doble disparo
  const rtKey = tenant ? `${tenant.id}::${tenant.type||'otro'}` : null
  useEffect(() => {
    if (!rtKey || !tenant) return
    const tenantId   = tenant.id
    const tenantType = tenant.type || 'otro'
    const rtLang = tenant.language || 'es'
    const _rtx = (s:string) => tx(s, rtLang)
    const rtEvt = getEventConfig(tenantType)
    const rtSM = getSchemaMap(rtEvt.eventLabel)
    // Guard: si ya hay canal activo con este mismo key, no re-suscribir
    if (rtChannelRef.current) {
      supabase.removeChannel(rtChannelRef.current)
      rtChannelRef.current = null
    }
    const ch = supabase.channel('panel-rt-v5-' + tenantId)
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'calls', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const c = payload.new as any
        const schType = INTENT_MAP[c.intent||'otro'] || 'inquiry'
        const sch = rtSM[schType]
        pushEvent({ type:'call_incoming' as any, icon:'📞', color:C.teal, title:`${_rtx('Llamada entrante')} — ${c.caller_phone||_rtx('Número oculto')}`, sub: sch ? `${sch.icon} ${_rtx(sch.label)} ${_rtx('detectada')}` : '', priority:'high' })
        if (c.status === 'activa') setActiveCalls(prev => [c, ...prev.filter(x => x.id !== c.id)])
        setCalls(prev => [c, ...prev].slice(0, 8))
      })
      .on('postgres_changes',{ event:'UPDATE', schema:'public', table:'calls', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const c = payload.new as any
        if (c.status === 'activa') {
          setActiveCalls(prev => {
            const exists = prev.find(x => x.id === c.id)
            return exists ? prev.map(x => x.id === c.id ? c : x) : [c, ...prev]
          })
        } else {
          setActiveCalls(prev => prev.filter(x => x.id !== c.id))
        }
        if (c.status==='completada'||c.status==='completed') {
          const schType = INTENT_MAP[c.intent||'otro'] || 'inquiry'
          const sch = rtSM[schType]
          pushEvent({ type:'call_ended' as any, icon:sch?.icon||'✅', color:sch?.color||C.green,
            title:`${_rtx(sch?.label||'Llamada')} ${_rtx('finalizada')}${c.customer_name?' — '+c.customer_name:''}`,
            sub:c.summary?.slice(0,80)||_rtx('Resumen generado') })
        }
        setCalls(prev => prev.map(x => x.id === c.id ? c : x))
      })
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'reservations', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const r = payload.new as any
        const sch = rtSM['reservation'] || rtSM['appointment']
        pushEvent({ type:'reservation' as any, icon:sch?.icon||'📅', color:sch?.color||C.teal,
          title:`${_rtx(sch?.label||rtEvt.eventLabel||'Reserva')} — ${r.customer_name||r.patient_name||r.owner_name||_rtx('Cliente')}`,
          sub:`${r.people||r.party_size||''} ${r.people?_rtx('personas')+' ·':''} ${(r.time||'').slice(0,5)}`.trim(),
          priority:'high' })
        setReservas(prev => [...prev, r])
      })
      .on('postgres_changes',{ event:'UPDATE', schema:'public', table:'reservations', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const r = payload.new as any
        setReservas(prev => prev.map(x => x.id === r.id ? r : x))
        if (r.status === 'cancelled' || r.status === 'no_show') {
          pushEvent({ type:'reservation' as any, icon:'❌', color:C.red,
            title:`${_rtx(rtEvt.eventLabel||'Reserva')} ${r.status==='cancelled'?_rtx('cancelada'):_rtx('no presentado')} — ${r.customer_name||_rtx('Cliente')}`,
            sub:`${(r.time||'').slice(0,5)}`.trim() })
        }
      })
      .on('postgres_changes',{ event:'DELETE', schema:'public', table:'reservations', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const r = payload.old as any
        if (r?.id) setReservas(prev => prev.filter(x => x.id !== r.id))
      })
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'notifications', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const n = payload.new as any
        const icon = n.priority==='critical' ? '🔴' : n.priority==='warning' ? '⚠️' : '💬'
        pushEvent({ type:'system', icon, color: n.priority==='critical'?C.red:n.priority==='warning'?C.yellow:C.text2, title:n.title, sub:n.body||'' })
      })
      // Pedidos en tiempo real
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'order_events', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const o = payload.new as any
        setActiveOrders(prev => [o, ...prev.filter(x => x.id !== o.id)].slice(0,5))
        const itemList = Array.isArray(o.items) && o.items.length > 0
          ? o.items.map((i:any)=>`${i.quantity||1}× ${i.name}`).join(', ')
          : _rtx('tomando pedido…')
        pushEvent({ type:'order' as any, icon:'🛍️', color:C.violet,
          title:`${_rtx('Nuevo pedido')} — ${o.customer_name||o.customer_phone||_rtx('Cliente')}`,
          sub:`${itemList} · ${_rtx(o.order_type||'recoger')}`, priority:'high' })
        // Alerta de pedido según configuración del negocio
        const alertMode = tenant?.agent_config?.order_alert_mode || 'banner'
        if (alertMode !== 'none') {
          try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZiYl5OSjYeFgoB/f4GDhYmNkJKUlZWUko+MiIWCf31+f4GDhYmMj5GTlJWVlJKQjYmGg4B+fX5/gYSHioyPkZOUlZWUkpCNiYaDgH5+fn+BhIeKjI+Rk5SVlZSSkI2JhoOAfn5+f4GEh4qMj5GTlJWVlJKQjYmGg4B+fn5/gYSHioyPkZOUlZWUkpCNiYaDgH5+fn+BhIeKjI+Rk5SVlQ==').play() } catch {}
          if (alertMode === 'redirect') {
            // Ir directamente a pedidos
            window.location.href = '/pedidos'
          } else {
            // Mostrar banner
            setOrderAlert({ name: o.customer_name||'Cliente', type: o.order_type||'recoger', id: o.id })
            setTimeout(() => setOrderAlert(null), 15000)
          }
        }
      })
      .on('postgres_changes',{ event:'UPDATE', schema:'public', table:'order_events', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const o = payload.new as any
        if (o.status === 'collecting') {
          setActiveOrders(prev => prev.map(x => x.id === o.id ? o : x))
        } else {
          setActiveOrders(prev => prev.filter(x => x.id !== o.id))
          if (o.status === 'confirmed') {
            const itemList = Array.isArray(o.items) && o.items.length > 0
              ? o.items.map((i:any)=>`${i.quantity||1}× ${i.name}`).join(', ')
              : 'pedido'
            pushEvent({ type:'order' as any, icon:'✅', color:C.green,
              title:`${_rtx('Pedido confirmado')} — ${o.customer_name||_rtx('Cliente')}`,
              sub:itemList, priority:'high' })
          }
        }
      })
      // Consultas clínica en tiempo real
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'consultation_events', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const ce = payload.new as any
        setActiveConsultations(prev => [ce, ...prev.filter(x => x.id !== ce.id)].slice(0,5))
        const urgIcon = ce.is_urgency ? '🚨' : '⚕️'
        const urgColor = ce.is_urgency ? C.red : C.teal
        pushEvent({ type:'reservation' as any, icon:urgIcon, color:urgColor,
          title:`${ce.is_urgency?'🚨 '+_rtx('Urgencia'):ce.consultation_type||_rtx('Consulta')} — ${ce.patient_name||ce.patient_phone||_rtx('Paciente')}`,
          sub: ce.symptoms ? ce.symptoms.slice(0,60) : `${ce.consultation_type||_rtx('consulta')} · ${ce.duration_minutes||20}min`,
          priority: ce.is_urgency ? 'high' : 'normal' })
      })
      .on('postgres_changes',{ event:'UPDATE', schema:'public', table:'consultation_events', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const ce = payload.new as any
        if (ce.status === 'collecting') {
          setActiveConsultations(prev => prev.map(x => x.id === ce.id ? ce : x))
        } else {
          setActiveConsultations(prev => prev.filter(x => x.id !== ce.id))
          if (ce.status === 'confirmed') {
            pushEvent({ type:'reservation' as any, icon:'✅', color:C.green,
              title:`${_rtx('Cita confirmada')} — ${ce.patient_name||_rtx('Paciente')}`,
              sub:`${ce.consultation_type||_rtx('consulta')} · ${ce.appointment_date||''} ${(ce.appointment_time||'').slice(0,5)}`.trim(),
              priority:'high' })
          } else if (ce.status === 'escalated') {
            pushEvent({ type:'system' as any, icon:'🚨', color:C.red,
              title:`🚨 ${_rtx('URGENTE')} — ${ce.patient_name||ce.patient_phone||_rtx('Paciente')}`,
              sub: ce.symptoms?.slice(0,60) || _rtx('Requiere atención inmediata'),
              priority:'high' })
          }
        }
      })
      // ── Multichannel: conversations + messages ──────────────
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'conversations', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const conv = payload.new as any
        const chMeta: Record<string,{icon:string;color:string;label:string}> = {
          whatsapp: { icon:'💬', color:'#25D366', label:'WhatsApp' },
          email:    { icon:'✉️', color:'#60A5FA', label:'Email' },
          sms:      { icon:'📱', color:C.amber,   label:'SMS' },
        }
        const m = chMeta[conv.channel]
        if (m) {
          pushEvent({ type: conv.channel as any, icon: m.icon, color: m.color,
            title:`${m.label} — ${conv.from_identifier || 'Cliente'}`,
            sub: 'Nueva conversación entrante',
            priority: 'high',
          })
        }
      })
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'messages', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const msg = payload.new as any
        if (msg.role === 'customer' && msg.channel !== 'voice') {
          const chMeta: Record<string,{icon:string;color:string;label:string}> = {
            whatsapp: { icon:'💬', color:'#25D366', label:'WhatsApp' },
            email:    { icon:'✉️', color:'#60A5FA', label:'Email' },
            sms:      { icon:'📱', color:C.amber,   label:'SMS' },
          }
          const m = chMeta[msg.channel]
          if (m) {
            pushEvent({ type: msg.channel as any, icon: m.icon, color: m.color,
              title:`${m.label} — mensaje entrante`,
              sub: (msg.content || '').slice(0, 60),
              priority: 'normal',
            })
          }
        }
      })
      .subscribe(status => {
        // RT status: subscribed or error
      })
    rtChannelRef.current = ch
    return () => {
      if (rtChannelRef.current) {
        supabase.removeChannel(rtChannelRef.current)
        rtChannelRef.current = null
      }
    }
  }, [rtKey]) // una sola dep: cambia solo cuando tenant.id o tenant.type cambian juntos

  // Demo mode loop
  const toggleDemo = useCallback(() => {
    setDemoMode(prev => {
      const next = !prev
      if (!next && demoTimer.current) { clearInterval(demoTimer.current); demoTimer.current=null; demoIdx.current=0 }
      return next
    })
  }, [])

  useEffect(() => {
    if (!demoMode || !tenant) return
    const demoEvents = buildDemoEvents(getEventConfig(tenant.type||'otro'), tenant.language||'es')
    const fire = () => {
      const evt = demoEvents[demoIdx.current % demoEvents.length]
      pushEvent(evt)
      demoIdx.current++
    }
    fire()
    demoTimer.current = setInterval(fire, 3200)
    return () => { if(demoTimer.current) clearInterval(demoTimer.current) }
  }, [demoMode, pushEvent, tenant])

  if (loading) return <PageSkeleton variant="cards"/>
  if (!tenant) return null

  const lang      = tenant.language||'es'
  const _tx       = (s:string) => tx(s, lang)
  const plan      = tenant.plan||'free'
  const isTrial   = plan==='free'||plan==='trial'
  const planColor = PLAN_COL[plan]||C.amber
  const planLabel = PLAN_LBL[plan]||'Trial'
  const callsUsed = isTrial?(tenant.free_calls_used||0):(tenant.plan_calls_used||0)
  const callsLimit= isTrial?(tenant.free_calls_limit||10):(tenant.plan_calls_included||PLAN_CALLS[plan]||50)
  const callsLeft = Math.max(0,callsLimit-callsUsed)
  const agentOn   = !!tenant.agent_phone
  const tmpl      = resolveTemplate(tenant.type||'otro')
  const L         = tmpl.labels
  const evtCfg    = getEventConfig(tenant.type||'otro')
  const SM        = getSchemaMap(evtCfg.eventLabel)
  const panelT    = getTranslations(tenant.language || 'es')
  const cs        = getCommonStrings(tenant.language || 'es')
  const hour      = new Date().getHours()
  const greeting  = hour<13?_tx('Buenos días'):hour<20?_tx('Buenas tardes'):_tx('Buenas noches')
  const todayCalls= calls.filter(c=>c.started_at?.slice(0,10)===new Date().toISOString().split('T')[0])

  return (
    <div style={{ minHeight:'100vh',background:C.bg,fontFamily:'var(--rz-font)' }}>
      <style>{`
        @keyframes rzSlideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rz-pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .rz-live-dot{width:8px;height:8px;border-radius:50%;background:#34D399;animation:rz-pulse 1.5s ease-in-out infinite}
      `}</style>

      {/* ── Header ── */}
      <div style={{ background:C.surface,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',borderBottom:`1px solid ${C.border}`,padding:'14px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:20 }}>
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <h1 style={{ fontSize:16,fontWeight:700,color:C.text,letterSpacing:'-0.02em' }}>
              {greeting}, <span style={{ color:C.amber }}>{tenant.name}</span>
            </h1>
            {activeCalls.length > 0 && (
              <div style={{ display:'flex',alignItems:'center',gap:5,padding:'3px 10px',background:C.tealDim,borderRadius:20,border:'1px solid rgba(45,212,191,0.2)' }}>
                <div className="rz-live-dot" style={{ width:6,height:6 }}/>
                <span style={{ fontSize:11,fontWeight:600,color:C.teal }}>{activeCalls.length} {_tx('en vivo')}</span>
              </div>
            )}
          </div>
          <p style={{ fontSize:11,color:C.text3,marginTop:2,textTransform:'capitalize' }}>{new Date().toLocaleDateString(lang==='es'?'es-ES':lang==='en'?'en-GB':lang==='fr'?'fr-FR':lang==='pt'?'pt-PT':'ca-ES',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <AgentBar agentOn={agentOn} agentName={tenant.agent_name} lang={lang}/>
          <NotificationBell tenantId={tenant.id}/>
        </div>
      </div>

      {/* ── Banner pedido en vivo ── */}
      {orderAlert && (
        <div onClick={() => { window.location.href = '/pedidos'; setOrderAlert(null) }} style={{
          position:'fixed', top:0, left:0, right:0, zIndex:100,
          background:'linear-gradient(135deg, #7c3aed, #a78bfa)',
          padding:'14px 28px', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:12,
          animation:'rzSlideIn 0.3s ease',
          boxShadow:'0 4px 20px rgba(124,58,237,0.4)',
        }}>
          <span style={{ fontSize:22 }}>🛍️</span>
          <div>
            <p style={{ fontSize:15, fontWeight:700, color:C.text }}>{_tx('Nuevo pedido de')} {orderAlert.name}</p>
            <p style={{ fontSize:12, color:C.text }}>{_tx('Para')} {orderAlert.type} · {_tx('Toca para ver en pedidos')}</p>
          </div>
          <span style={{ fontSize:13, color:C.text2, marginLeft:'auto' }}>→ {_tx('Ver pedidos')}</span>
          <button onClick={e => { e.stopPropagation(); setOrderAlert(null) }} style={{ background:C.surface2, border:'none', borderRadius:8, padding:'4px 10px', color:C.text, cursor:'pointer', fontSize:14, marginLeft:8 }} aria-label="Cerrar">✕</button>
        </div>
      )}

      <div className="rz-page-enter" style={{ maxWidth:1200,margin:'0 auto',padding:'22px 28px',display:'flex',flexDirection:'column',gap:16 }}>

        {/* ── Yesterday's Summary ── */}
        {daySummary && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
            overflow: 'hidden',
          }}>
            <button onClick={() => setSummaryOpen(!summaryOpen)} style={{
              width: '100%', padding: '14px 20px', border: 'none', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>📊</span>
                <span style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>
                  {_tx('Resumen de ayer')}
                </span>
                {daySummary.highlights?.length > 0 && (
                  <span style={{ fontSize: 12, color: C.text2 }}>
                    — {daySummary.highlights[0]?.title}
                  </span>
                )}
              </div>
              <span style={{ color: C.text3, fontSize: 12, transform: summaryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
            </button>
            {summaryOpen && (
              <div style={{ padding: '0 20px 16px', borderTop: `1px solid ${C.border}` }}>
                {/* Channel breakdown */}
                {daySummary.channel_breakdown && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                    {Object.entries(daySummary.channel_breakdown as Record<string, any>).map(([ch, data]: [string, any]) => (
                      <div key={ch} style={{
                        padding: '8px 14px', borderRadius: 8, background: C.surface2,
                        border: `1px solid ${C.border}`, minWidth: 100,
                      }}>
                        <div style={{ fontSize: 11, color: C.text3, fontWeight: 600 }}>
                          {ch === 'voice' ? 'Llamadas' : ch === 'whatsapp' ? 'WhatsApp' : ch === 'email' ? 'Email' : 'SMS'}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 2 }}>{data.count}</div>
                        {data.escalated > 0 && (
                          <div style={{ fontSize: 10, color: C.red, marginTop: 2 }}>{data.escalated} escaladas</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Highlights */}
                {daySummary.highlights?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {(daySummary.highlights as any[]).map((h: any, i: number) => (
                      <div key={i} style={{
                        padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: h.type === 'positive' ? C.green : h.type === 'warning' ? C.yellow : C.blue,
                        }} />
                        <span style={{ fontSize: 13, color: C.text }}>{h.title}</span>
                        <span style={{ fontSize: 12, color: C.text3 }}>{h.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Pending actions */}
                {daySummary.pending_actions?.length > 0 && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: C.amberDim, borderRadius: 8, border: `1px solid ${C.amber}20` }}>
                    <div style={{ fontSize: 11, color: C.amber, fontWeight: 700, marginBottom: 4 }}>{_tx('Pendiente')}</div>
                    {(daySummary.pending_actions as string[]).map((a: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>• {a}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Alert trial ── */}
        {isTrial && callsLeft<=5 && (
          <div style={{ background:`linear-gradient(135deg,${C.amberDim},rgba(240,168,78,0.04))`,border:`1px solid ${C.amber}30`,borderRadius:12,padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16 }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ width:7,height:7,borderRadius:'50%',background:C.amber,animation:'rz-pulse 1.5s ease-in-out infinite' }}/>
              <div>
                <p style={{ fontWeight:700,fontSize:14,color:C.amber }}>{callsLeft===0?_tx('Trial agotado'):`${callsLeft} ${_tx(callsLeft!==1?'llamadas restantes':'llamada restante')}`}</p>
                <p style={{ fontSize:12,color:`${C.amber}90`,marginTop:1 }}>{_tx('Activa un plan para seguir recibiendo llamadas sin límites')}</p>
              </div>
            </div>
            <Link href="/precios" style={{ padding:'8px 18px',fontSize:13,fontWeight:700,color:C.bg,background:C.amber,borderRadius:9,textDecoration:'none',whiteSpace:'nowrap',flexShrink:0 }}>{_tx('Ver planes')}</Link>
          </div>
        )}

        {/* ── Llamadas activas ── */}
        {activeCalls.length > 0 && (
          <div style={{ background:`linear-gradient(135deg,${C.surface},${C.surface2})`,border:`1px solid ${C.teal}25`,borderRadius:16,padding:'18px 20px',position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.teal}50,transparent)` }}/>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <div className="rz-live-dot"/>
                <span style={{ fontSize:14,fontWeight:700,color:C.text }}>{activeCalls.length} {_tx(activeCalls.length!==1?'llamadas en curso':'llamada en curso')}</span>
              </div>
              <span style={{ fontSize:10,color:C.text3,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.07em' }}>{_tx('Tiempo real')}</span>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {activeCalls.map(call=><ActiveCallBlock key={call.id} call={call} businessType={tenant.type||'otro'} lang={lang}/>)}
            </div>
          </div>
        )}

        {/* ── Pedidos en curso (solo hostelería) ── */}
        {activeOrders.length > 0 && (
          <div style={{ background:`linear-gradient(135deg,${C.surface},${C.surface2})`,border:`1px solid ${C.violet}25`,borderRadius:16,padding:'18px 20px',position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.violet}50,transparent)` }}/>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <div style={{ width:8,height:8,borderRadius:'50%',background:C.violet,animation:'rz-pulse 1.5s ease-in-out infinite' }}/>
                <span style={{ fontSize:14,fontWeight:700,color:C.text }}>🛍️ {activeOrders.length} {_tx(activeOrders.length!==1?'pedidos en curso':'pedido en curso')}</span>
              </div>
              <Link href="/pedidos" style={{ fontSize:11,color:C.violet,fontWeight:600,textDecoration:'none' }}>{_tx('Ver pedidos')} →</Link>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {activeOrders.map(order=>{
                const items = Array.isArray(order.items) ? order.items : []
                const itemStr = items.map((i:any)=>`${i.quantity||1}× ${i.name}`).join(', ')
                return (
                  <div key={order.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 14px',background:C.surface2,borderRadius:11,border:`1px solid ${C.violet}20` }}>
                    <div style={{ width:34,height:34,borderRadius:'50%',background:`${C.violet}18`,border:`1.5px solid ${C.violet}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16 }}>🛍️</div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <p style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                        {order.customer_name||order.customer_phone||'Cliente'}
                        <span style={{ fontSize:10,color:C.violet,marginLeft:8,padding:'1px 6px',borderRadius:8,background:`${C.violet}15`,fontWeight:600 }}>{order.order_type}</span>
                      </p>
                      <p style={{ fontSize:11,color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                        {itemStr||_tx('Tomando pedido...')}{order.pickup_time?` · ${_tx('Recogida')} ${order.pickup_time}`:''}
                      </p>
                    </div>
                    {order.total_estimate && <span style={{ fontFamily:'var(--rz-mono)',fontSize:12,color:C.violet,flexShrink:0 }}>{order.total_estimate.toFixed(2)}€</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Consultas en curso (solo clínicas) ── */}
        {activeConsultations.length > 0 && (
          <div style={{ background:`linear-gradient(135deg,${C.surface},${C.surface2})`,border:`1px solid ${C.teal}25`,borderRadius:16,padding:'18px 20px',position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.teal}50,transparent)` }}/>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <div style={{ width:8,height:8,borderRadius:'50%',background:C.teal,animation:'rz-pulse 1.5s ease-in-out infinite' }}/>
                <span style={{ fontSize:14,fontWeight:700,color:C.text }}>⚕️ {activeConsultations.length} {_tx(activeConsultations.length!==1?'consultas en curso':'consulta en curso')}</span>
              </div>
              <Link href="/reservas" style={{ fontSize:11,color:C.teal,fontWeight:600,textDecoration:'none' }}>{_tx('Ver citas')} →</Link>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {activeConsultations.map(ce=>{
                const isUrgent = ce.is_urgency
                const borderCol = isUrgent ? C.red : C.teal
                const bgIcon = isUrgent ? C.red : C.teal
                return (
                  <div key={ce.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 14px',background:C.surface2,borderRadius:11,border:`1px solid ${borderCol}20` }}>
                    <div style={{ width:34,height:34,borderRadius:'50%',background:`${bgIcon}18`,border:`1.5px solid ${bgIcon}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16 }}>
                      {isUrgent ? '🚨' : '⚕️'}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:2 }}>
                        <p style={{ fontSize:13,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                          {ce.patient_name||ce.patient_phone||'Paciente'}
                        </p>
                        {isUrgent && <span style={{ fontSize:10,color:C.red,fontWeight:700,padding:'1px 6px',borderRadius:8,background:`${C.red}15`,flexShrink:0 }}>{_tx('URGENTE')}</span>}
                        {!isUrgent && ce.consultation_type && <span style={{ fontSize:10,color:C.teal,padding:'1px 6px',borderRadius:8,background:`${C.teal}15`,fontWeight:600,flexShrink:0 }}>{ce.consultation_type}</span>}
                      </div>
                      <p style={{ fontSize:11,color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                        {ce.symptoms ? ce.symptoms.slice(0,60) : `${ce.duration_minutes||20}min${ce.is_new_patient?' · '+_tx('Primera visita'):''}`}
                      </p>
                    </div>
                    <div style={{ flexShrink:0,textAlign:'right' as const }}>
                      <span style={{ fontSize:10,color:isUrgent?C.red:C.text3,fontWeight:isUrgent?700:400 }}>
                        {isUrgent?'⚠ '+_tx('Revisar'):_tx('En curso')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── KPIs ── */}
        <div className="rz-grid-4col" style={{ gap:12 }}>
          <KpiCard value={todayCalls.length} label={_tx('Llamadas hoy')} icon="📞" color={C.amber} accent href="/llamadas"/>
          <KpiCard value={reservas.length} label={`${L.reservas} ${_tx('hoy')}`} sub={`${reservas.filter(r=>r.status==='confirmada').length} ${_tx('confirmadas')}`} icon="📅" color={C.teal} accent href="/reservas"/>
          {opContext?.todayOrders != null && opContext.todayOrders > 0
            ? <KpiCard value={opContext.todayOrders} label={_tx('Pedidos hoy')} sub={opContext.todayRevenue > 0 ? `${opContext.todayRevenue.toFixed(0)}€` : undefined} icon="🛍️" color={C.violet} accent href="/tpv"/>
            : <KpiCard value={clientes.length} label={L.clientes} icon="👥" color={C.violet} href="/clientes"/>
          }
          {opContext?.todayCovers != null && opContext.todayCovers > 0
            ? <KpiCard value={opContext.todayCovers} label={_tx('Covers hoy')} icon="🍽️" color={C.green} accent/>
            : <KpiCard value={isTrial?callsLeft:`${callsUsed}/${callsLimit}`} label={isTrial?_tx('Llamadas restantes'):_tx('Uso del plan')} sub={planLabel} icon={isTrial?'⚡':'📊'} color={callsLeft<=3?C.red:planColor} accent={isTrial} href="/facturacion"/>
          }
        </div>

        {/* ── Comparativa semanal ── */}
        {weeklyComp && (weeklyComp.thisOrders > 0 || weeklyComp.lastOrders > 0 || weeklyComp.thisReservations > 0 || weeklyComp.lastReservations > 0) && (() => {
          const pctChange = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0
            return Math.round(((curr - prev) / prev) * 100)
          }
          const revPct = pctChange(weeklyComp.thisRevenue, weeklyComp.lastRevenue)
          const ordPct = pctChange(weeklyComp.thisOrders, weeklyComp.lastOrders)
          const resPct = pctChange(weeklyComp.thisReservations, weeklyComp.lastReservations)
          const arrow = (pct: number) => pct > 0 ? '\u25B2' : pct < 0 ? '\u25BC' : '\u2022'
          const color = (pct: number) => pct > 0 ? C.green : pct < 0 ? C.red : C.text3
          const items = [
            { label: _tx('Ingresos'), value: `${weeklyComp.thisRevenue.toFixed(0)}\u20AC`, pct: revPct, show: weeklyComp.thisRevenue > 0 || weeklyComp.lastRevenue > 0 },
            { label: _tx('Pedidos'), value: String(weeklyComp.thisOrders), pct: ordPct, show: weeklyComp.thisOrders > 0 || weeklyComp.lastOrders > 0 },
            { label: L.reservas, value: String(weeklyComp.thisReservations), pct: resPct, show: weeklyComp.thisReservations > 0 || weeklyComp.lastReservations > 0 },
          ].filter(i => i.show)

          return (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 15 }}>📊</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{_tx('Esta semana vs anterior')}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {items.map(item => (
                  <div key={item.label} style={{ flex: '1 1 120px', minWidth: 100 }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0, lineHeight: 1 }}>{item.value}</p>
                    <p style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>{item.label}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: color(item.pct), marginTop: 2 }}>
                      {arrow(item.pct)} {item.pct > 0 ? '+' : ''}{item.pct}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
        {!weeklyComp && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15 }}>📊</span>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{_tx('Esta semana vs anterior')}</span>
              <p style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{_tx('Comparativa semanal disponible a partir de la segunda semana')}</p>
            </div>
          </div>
        )}

        {/* ── Contexto operativo ── */}
        {opContext ? (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Smart suggestion — prominent amber card */}
            {opContext.suggestion && (
              <div style={{
                background:`linear-gradient(135deg, rgba(240,168,78,0.12) 0%, rgba(240,168,78,0.04) 100%)`,
                border:`1px solid ${C.amberBorder}`,
                borderRadius:14, padding:'16px 20px',
                display:'flex', alignItems:'flex-start', gap:12,
              }}>
                <div style={{ width:36, height:36, borderRadius:10, background:C.amberDim, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                  🧠
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:C.amber, letterSpacing:'0.04em', textTransform:'uppercase' as const, marginBottom:4 }}>
                    {_tx('Contexto operativo')}
                  </p>
                  <p style={{ fontSize:14, fontWeight:600, color:C.text, lineHeight:1.5 }}>
                    {opContext.suggestion}
                  </p>
                </div>
              </div>
            )}
            {/* Compact operational pills */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {/* Orders today + revenue */}
              {opContext.todayOrders > 0 && (
                <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14 }}>🛍️</span>
                  <span style={{ fontSize:12, fontWeight:600, color:C.text }}>
                    {_tx('Pedidos hoy')}: {opContext.todayOrders}
                  </span>
                  {opContext.todayRevenue > 0 && (
                    <span style={{ fontSize:11, color:C.text2 }}>
                      ({opContext.todayRevenue.toFixed(0)}€)
                    </span>
                  )}
                </div>
              )}
              {/* Top selling */}
              {opContext.topSellingNow?.length > 0 && (
                <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14 }}>🔥</span>
                  <span style={{ fontSize:12, fontWeight:600, color:C.text }}>Top:</span>
                  <span style={{ fontSize:12, color:C.text2 }}>
                    {opContext.topSellingNow.slice(0, 3).map((i: any) => i.name).join(', ')}
                  </span>
                </div>
              )}
              {/* Low stock */}
              {opContext.lowStockItems?.length > 0 && (
                <div style={{ background:'rgba(248,113,113,0.06)', border:`1px solid rgba(248,113,113,0.2)`, borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14 }}>⚠️</span>
                  <span style={{ fontSize:12, fontWeight:600, color:C.red }}>
                    Stock bajo: {opContext.lowStockItems.length} {opContext.lowStockItems.length === 1 ? 'producto' : 'productos'}
                  </span>
                </div>
              )}
              {/* Upcoming reservations */}
              {opContext.upcomingReservations?.length > 0 && (
                <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14 }}>📅</span>
                  <span style={{ fontSize:12, fontWeight:600, color:C.text }}>
                    {_tx('Reservas')}: {opContext.upcomingReservations.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: C.text3 }}>{_tx('Sin datos operativos todavia')}</p>
            <p style={{ fontSize: 12, marginTop: 4, color: C.text3 }}>{_tx('Los datos apareceran cuando haya actividad')}</p>
          </div>
        )}

        {/* ── Sugerencias inteligentes ── */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10, background:C.surface }}>
            <span style={{ fontSize:15 }}>💡</span>
            <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{_tx('Sugerencias')}</span>
            {suggestions.length > 0 && <span style={{ fontSize:11, color:C.text3, marginLeft:'auto' }}>{suggestions.length} {_tx('activas')}</span>}
          </div>
          {suggestions.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column' }}>
              {suggestions.slice(0, 5).map((s: any, i: number) => {
                const priorityBorder = s.priority === 'high' ? C.red : s.priority === 'medium' ? C.amber : C.teal
                const priorityBg = s.priority === 'high' ? 'rgba(248,113,113,0.04)' : s.priority === 'medium' ? 'rgba(240,168,78,0.04)' : 'transparent'
                return (
                  <div key={s.id} style={{
                    padding:'12px 18px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
                    borderLeft:`3px solid ${priorityBorder}`, background:priorityBg,
                    display:'flex', alignItems:'flex-start', gap:12,
                  }}>
                    <div style={{ width:34, height:34, borderRadius:10, background:`${priorityBorder}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>
                      {s.icon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:3 }}>{s.title}</p>
                      <p style={{ fontSize:12, color:C.text2, lineHeight:1.5 }}>{s.description}</p>
                      {s.action && s.actionHref && (
                        <a href={s.actionHref} style={{ fontSize:11, color:C.amber, fontWeight:600, textDecoration:'none', marginTop:6, display:'inline-block' }}>
                          {s.action} →
                        </a>
                      )}
                    </div>
                    <span style={{
                      fontSize:9, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase' as const,
                      padding:'2px 8px', borderRadius:8,
                      background: s.priority === 'high' ? C.redDim : s.priority === 'medium' ? C.amberDim : C.tealDim,
                      color: priorityBorder, flexShrink:0, marginTop:2,
                    }}>
                      {s.priority === 'high' ? _tx('Urgente') : s.priority === 'medium' ? _tx('Media') : _tx('Info')}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding:'14px 18px', color:C.text3, fontSize:13 }}>
              Sin sugerencias por ahora — llegaran con mas actividad
            </div>
          )}
        </div>

        {/* ── Previsión de hoy ── */}
        {forecast.length > 0 && <ForecastChart data={forecast} forecastLabel={cs.forecast} lang={lang}/>}

        {/* ── Main grid: Live feed + Llamadas ── */}
        <div className="rz-grid-2col" style={{ gap:16 }}>

          {/* Llamadas recientes */}
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden' }}>
            <div style={{ padding:'14px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <h2 style={{ fontSize:14,fontWeight:700,color:C.text }}>{cs.recentCalls}</h2>
              <Link href="/llamadas" style={{ fontSize:12,color:C.amber,fontWeight:600,textDecoration:'none' }}>{cs.viewAll}</Link>
            </div>
            {calls.length===0 ? (
              <div style={{ padding:'52px 20px',textAlign:'center' }}>
                <div style={{ width:56,height:56,borderRadius:'50%',background:'rgba(45,212,191,0.08)',border:'1px solid rgba(45,212,191,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:24 }}>📞</div>
                <p style={{ fontSize:15,fontWeight:700,color:C.text,marginBottom:8 }}>{_tx('Tu recepcionista está activa')}</p>
                <p style={{ fontSize:13,color:C.text3,lineHeight:1.7,maxWidth:280,margin:'0 auto' }}>
                  {agentOn ? _tx('Esperando llamadas. Cuando entren, aparecerán aquí en tiempo real con su resumen.') : _tx('Configura tu número de teléfono para empezar a recibir llamadas.')}
                </p>
                {!agentOn && <Link href="/configuracion" style={{ display:'inline-block',marginTop:16,padding:'9px 20px',fontSize:13,fontWeight:600,color:C.bg,background:C.amber,borderRadius:9,textDecoration:'none' }}>{_tx('Configurar número')} →</Link>}
                {agentOn && (
                  <div style={{ marginTop:20,display:'flex',alignItems:'center',justifyContent:'center',gap:16 }}>
                    {['📞 '+_tx('Responde 24/7'),'📅 '+_tx('Detecta reservas'),'🛍️ '+_tx('Toma pedidos')].map(s=>(
                      <div key={s} style={{ fontSize:12,color:C.text3,display:'flex',alignItems:'center',gap:5 }}>{s}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : calls.map((call,i)=><CallRow key={call.id} call={call} idx={i} businessType={tenant.type||'otro'} lang={lang} eventLabel={evtCfg.eventLabel}/>)}
          </div>

          {/* Columna derecha: feed + reservas */}
          <div style={{ display:'flex',flexDirection:'column',gap:16 }}>

            {/* Live feed */}
            <LiveFeed events={events} demoMode={demoMode} onToggleDemo={toggleDemo} lang={lang}/>

            {/* Mensajes multicanal — acceso rápido */}
            <Link href="/mensajes" style={{ textDecoration:'none' }}>
              <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer' }}>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <span style={{ fontSize:18 }}>💬</span>
                  <span style={{ fontSize:14,fontWeight:700,color:C.text }}>{_tx('Mensajes')}</span>
                  <span style={{ fontSize:11,color:C.text3 }}>WhatsApp · Email · SMS</span>
                </div>
                <span style={{ fontSize:12,color:C.amber,fontWeight:600 }}>{_tx('Ver todo')} →</span>
              </div>
            </Link>

            <InsightsPanel insights={insights} headerLabel={panelT.insights.detected} lang={lang} agentName={tenant.agent_name||'Sofía'}/>

            {/* Reservas hoy */}
            <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden' }}>
              <div style={{ padding:'14px 18px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <h2 style={{ fontSize:14,fontWeight:700,color:C.text }}>{L.reservas} {_tx('hoy')}</h2>
                <Link href="/reservas" style={{ fontSize:12,color:C.amber,fontWeight:600,textDecoration:'none' }}>{cs.manage}</Link>
              </div>
              {reservas.length===0 ? (
                <div style={{ padding:'32px 16px',textAlign:'center' }}>
                  <div style={{ fontSize:24,marginBottom:10 }}>📅</div>
                  <p style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:6 }}>{_tx('Sin')} {L.reservas.toLowerCase()} {_tx('hoy')}</p>
                  <p style={{ fontSize:12,color:C.text3,lineHeight:1.6 }}>{_tx('Las')} {L.reservas.toLowerCase()} {_tx('se mostrarán automáticamente cuando entren.')}</p>
                </div>
              ) : reservas.slice(0,8).map((r,i)=>(
                <div key={r.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderTop:i>0?`1px solid ${C.border}`:'none',transition:'background 0.12s' }}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <div style={{ width:32,height:32,borderRadius:'50%',background:C.amberDim,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,color:C.amber,flexShrink:0 }}>
                    {r.customer_name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <p style={{ fontSize:13,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{r.customer_name}</p>
                    <p style={{ fontSize:11,color:C.text3 }}>{(r.time||r.reservation_time||'').slice(0,5)} · {r.people||r.party_size}p</p>
                  </div>
                  <span style={{ fontSize:10,padding:'2px 8px',borderRadius:10,background:r.status==='confirmada'?C.greenDim:C.surface2,color:r.status==='confirmada'?C.green:C.text3,fontWeight:600,border:`1px solid ${r.status==='confirmada'?C.green+'25':C.border}`,flexShrink:0 }}>{_tx(r.status)}</span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ── Trial usage bar ── */}
        {isTrial && (
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'16px 20px' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
              <span style={{ fontSize:13,fontWeight:600,color:C.text }}>{_tx('Uso del trial gratuito')}</span>
              <span style={{ fontFamily:'var(--rz-mono)',fontSize:13,fontWeight:600,color:callsLeft<=3?C.red:C.text }}>{callsUsed}<span style={{ color:C.text3 }}> / {callsLimit}</span></span>
            </div>
            <div style={{ height:5,background:'var(--rz-border)',borderRadius:3,overflow:'hidden',marginBottom:8 }}>
              <div style={{ height:'100%',width:`${Math.min(100,Math.round(callsUsed/callsLimit*100))}%`,background:callsLeft<=3?C.red:callsUsed/callsLimit>0.7?C.yellow:C.amber,borderRadius:3,transition:'width 0.6s ease' }}/>
            </div>
            <p style={{ fontSize:11,color:C.text3 }}>{_tx('Cada llamada recibida cuenta como una del plan.')}</p>
          </div>
        )}

      </div>
    </div>
  )
}
