'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import { resolveTemplate } from '@/lib/templates'
import { getEventConfig, type BusinessEventConfig } from '@/lib/event-schemas'

const C = {
  amber:'#F0A84E', amberDim:'rgba(240,168,78,0.10)', amberGlow:'rgba(240,168,78,0.20)',
  teal:'#2DD4BF', tealDim:'rgba(45,212,191,0.10)',
  green:'#34D399', greenDim:'rgba(52,211,153,0.10)',
  red:'#F87171', redDim:'rgba(248,113,113,0.10)',
  yellow:'#FBB53F', yellowDim:'rgba(251,181,63,0.10)',
  violet:'#A78BFA', violetDim:'rgba(167,139,250,0.12)',
  blue:'#60A5FA', blueDim:'rgba(96,165,250,0.10)',
  text:'#E8EEF6', text2:'#8895A7', text3:'#49566A',
  bg:'#0C1018', surface:'#131920', surface2:'#1A2230', surface3:'#202C3E',
  border:'rgba(255,255,255,0.07)', borderMd:'rgba(255,255,255,0.11)',
}
const PLAN_COL: Record<string,string> = { trial:C.amber,free:C.amber,starter:C.blue,pro:C.violet,business:C.green }
const PLAN_LBL: Record<string,string> = { trial:'Trial',free:'Trial',starter:'Starter',pro:'Pro',business:'Business' }
const PLAN_CALLS: Record<string,number> = { trial:10,free:10,starter:50,pro:200,business:600 }

const INTENT_MAP: Record<string, string> = {
  reserva: 'reservation', pedido: 'order', cancelacion: 'cancellation',
  consulta: 'inquiry', otro: 'inquiry',
}
const SCHEMA_MAP: Record<string, { icon: string; color: string; label: string }> = {
  reservation: { icon: '📅', color: '#2DD4BF', label: 'Reserva' },
  appointment: { icon: '📋', color: '#2DD4BF', label: 'Cita' },
  order:       { icon: '🛍️', color: '#A78BFA', label: 'Pedido' },
  cancellation:{ icon: '❌', color: '#F87171', label: 'Cancelación' },
  inquiry:     { icon: '💬', color: '#8895A7', label: 'Consulta' },
  visit:       { icon: '🏠', color: '#60A5FA', label: 'Visita' },
}
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
  type: 'call_incoming'|'call_active'|'call_ended'|'call_missed'|'reservation'|'order'|'pending'|'system'
  icon: string
  color: string
  title: string
  sub?: string
  ts: Date
  priority?: 'high'|'normal'
  demo?: boolean
}


function timeAgo(d: Date) {
  const s = Math.floor((Date.now()-d.getTime())/1000)
  if (s < 5) return 'ahora mismo'
  if (s < 60) return s+'s'
  if (s < 3600) return Math.floor(s/60)+'m'
  return Math.floor(s/3600)+'h'
}

// ── Demo events dinámicos por tipo de negocio ──────────────────────────────
function buildDemoEvents(_evtConfig: BusinessEventConfig): Omit<LiveEvent,'id'|'ts'>[] {
  return [
    { type: 'call_incoming', icon: '📞', color: C.teal, title: 'Llamada entrante — +34 612 345 678', sub: '📅 Reserva detectada', priority: 'high', demo: true },
    { type: 'reservation', icon: '📅', color: C.teal, title: 'Nueva reserva — María López', sub: '4 personas · 21:00', priority: 'high', demo: true },
    { type: 'call_ended', icon: '✅', color: C.green, title: 'Llamada finalizada — Carlos Ruiz', sub: 'Reserva confirmada para mañana', demo: true },
    { type: 'system', icon: '💬', color: C.text2, title: 'Consulta sobre el menú', sub: 'Cliente preguntó por opciones vegetarianas', demo: true },
    { type: 'call_incoming', icon: '📞', color: C.teal, title: 'Llamada entrante — +34 698 765 432', sub: '💬 Consulta detectada', demo: true },
  ]
}

// ── Live Feed Component
function LiveFeed({ events, demoMode, onToggleDemo }: { events:LiveEvent[], demoMode:boolean, onToggleDemo:()=>void }) {
  const display = events.slice(0, 12)

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:C.green, animation:'rz-pulse 2s ease-in-out infinite' }}/>
          <span style={{ fontSize:14, fontWeight:700, color:C.text, letterSpacing:'-0.01em' }}>{ACTIVE_CALL_LABEL}</span>
          {demoMode && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(251,181,63,0.15)', color:C.yellow, fontWeight:700, letterSpacing:'0.04em' }}>DEMO</span>}
        </div>
        <button onClick={onToggleDemo} style={{
          fontSize:11, padding:'4px 12px', borderRadius:8, border:`1px solid ${demoMode?C.yellow+'40':C.border}`,
          background:demoMode?'rgba(251,181,63,0.08)':'rgba(255,255,255,0.03)',
          color:demoMode?C.yellow:C.text3, cursor:'pointer', fontFamily:'inherit', fontWeight:600, transition:'all 0.15s'
        }}>
          {demoMode ? '⏹ Salir demo' : '▶ Modo demo'}
        </button>
      </div>

      {/* Events */}
      <div style={{ maxHeight:340, overflowY:'auto', scrollbarWidth:'none' }}>
        {display.length === 0 ? (
          <div style={{ padding:'40px 20px', textAlign:'center' }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(45,212,191,0.08)', border:'1px solid rgba(45,212,191,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:20 }}>⚡</div>
            <p style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:6 }}>El sistema está listo</p>
            <p style={{ fontSize:12, color:C.text3, lineHeight:1.7, maxWidth:260, margin:'0 auto' }}>Tu recepcionista está activa y preparada. Los eventos aparecerán aquí en tiempo real.</p>
            <button onClick={onToggleDemo} style={{ marginTop:16, padding:'8px 18px', fontSize:12, fontWeight:700, borderRadius:9, border:`1px solid ${C.amber}40`, background:C.amberDim, color:C.amber, cursor:'pointer', fontFamily:'inherit' }}>
              ▶ Ver demo
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
              <span style={{ fontSize:10, color:C.text3, whiteSpace:'nowrap' }}>{timeAgo(evt.ts)}</span>
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
    <div style={{
      background: accent ? `linear-gradient(135deg,${color}14,transparent 70%)` : C.surface,
      border:`1px solid ${accent?color+'22':C.border}`, borderRadius:14, padding:'18px 20px',
      position:'relative', overflow:'hidden', cursor:href?'pointer':'default', transition:'border-color 0.15s',
    }}>
      {accent && <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${color},transparent)`,borderRadius:'14px 14px 0 0' }}/>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <p style={{ fontFamily:'var(--rz-mono)',fontSize:28,fontWeight:600,color,letterSpacing:'-0.03em',lineHeight:1,marginBottom:6 }}>{value}</p>
          <p style={{ fontSize:12,color:C.text2,fontWeight:500 }}>{label}</p>
          {sub && <p style={{ fontSize:11,color:C.text3,marginTop:3 }}>{sub}</p>}
        </div>
        {icon && <div style={{ width:34,height:34,borderRadius:10,background:`${color}14`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          <span style={{ fontSize:16 }}>{icon}</span>
        </div>}
      </div>
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration:'none' }}>{inner}</Link> : inner
}

// ── Active call block — usa schemas dinámicos
function ActiveCallBlock({ call, businessType }:{ call:any; businessType:string }) {
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
        <p style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{call.caller_phone||'Número oculto'}</p>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <div style={{ width:5,height:5,borderRadius:'50%',background:color,animation:'rz-pulse 1.5s ease-in-out infinite' }}/>
          <span style={{ fontSize:11,color,fontWeight:500 }}>{stateInfo.label}</span>
        </div>
      </div>
      <span style={{ fontFamily:'var(--rz-mono)',fontSize:12,color:C.text3,flexShrink:0 }}>{dur}</span>
    </div>
  )
}

// ── Call row — usa schemas dinámicos
function CallRow({ call, idx, businessType }:{ call:any; idx:number; businessType:string }) {
  const schemaType = INTENT_MAP[call.intent] || 'inquiry'
  const schema = SCHEMA_MAP[schemaType]
  const status = call.status||'completada'
  const done = ['completada','completed'].includes(status)
  const phone = call.caller_phone||call.from_number||'Número oculto'
  const dur = call.duration_seconds ? (call.duration_seconds>=60?`${Math.round(call.duration_seconds/60)}m`:`${call.duration_seconds}s`) : null
  const time = call.started_at ? new Date(call.started_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : ''
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
          {schema && call.intent && <span style={{ fontSize:10,padding:'1px 7px',borderRadius:10,background:`${ic}18`,color:ic,fontWeight:600 }}>{schema.icon} {intentLabel}</span>}
          {done && <span style={{ fontSize:10,padding:'1px 7px',borderRadius:10,background:C.greenDim,color:C.green,fontWeight:600 }}>Completada</span>}
        </div>
        {call.summary ? <p style={{ fontSize:12,color:C.text2,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as const,overflow:'hidden' }}>{call.summary}</p>
          : <p style={{ fontSize:12,color:C.text3 }}>Sin resumen</p>}
      </div>
      <div style={{ flexShrink:0,textAlign:'right' as const }}>
        <p style={{ fontSize:11,color:C.text3 }}>{time}</p>
        {dur && <p style={{ fontFamily:'var(--rz-mono)',fontSize:11,color:C.text3,marginTop:2 }}>{dur}</p>}
      </div>
    </div>
  )
}

// ── Agent status bar
function AgentBar({ agentOn, agentName }:{ agentOn:boolean; agentName:string }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
      <div style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 14px',
        background:agentOn?'rgba(45,212,191,0.08)':'rgba(248,113,113,0.08)',
        border:`1px solid ${agentOn?'rgba(45,212,191,0.2)':'rgba(248,113,113,0.2)'}`,borderRadius:20 }}>
        <div style={{ width:6,height:6,borderRadius:'50%',background:agentOn?C.teal:C.red,animation:agentOn?'rz-pulse 2s ease-in-out infinite':'none' }}/>
        <span style={{ fontSize:12,fontWeight:600,color:agentOn?C.teal:C.red }}>{agentOn?(agentName||'Sofía')+' activa':'Sin número asignado'}</span>
      </div>
      {!agentOn && <Link href="/configuracion" style={{ padding:'6px 14px',fontSize:12,fontWeight:600,color:'#0C1018',background:C.amber,borderRadius:8,textDecoration:'none' }}>Configurar →</Link>}
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
      supabase.from('tenants').select('id,name,slug,type,plan,agent_name,agent_phone,free_calls_used,free_calls_limit,plan_calls_used,plan_calls_included,reservation_config,agent_config').eq('id',tid).maybeSingle(),
      supabase.from('calls').select('id,call_sid,status,intent,summary,started_at,duration_seconds,caller_phone,customer_name,from_number,decision_status,decision_flags,decision_confidence,session_state').eq('tenant_id',tid).order('started_at',{ascending:false}).limit(8),
      supabase.from('reservations').select('id,customer_name,customer_phone,date,time,reservation_time,people,party_size,status,source,notes').eq('tenant_id',tid).eq('date',today).order('time'),
      supabase.from('customers').select('id').eq('tenant_id',tid),
      supabase.from('calls').select('id,call_sid,caller_phone,session_state,started_at').eq('tenant_id',tid).eq('status','activa').order('started_at',{ascending:false}).limit(8),
      supabase.from('order_events').select('*').eq('tenant_id',tid).eq('status','collecting').order('created_at',{ascending:false}).limit(5),
      supabase.from('consultation_events').select('*').eq('tenant_id',tid).eq('status','collecting').order('created_at',{ascending:false}).limit(5),
    ])
    setTenant(t); setCalls(c||[]); setReservas(r||[]); setClientes(cl||[]); setActiveCalls(ac||[])
    setActiveOrders(ao||[]); setActiveConsultations(ac2||[])
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  // Real-time: una sola suscripción, dep única combinada evita doble disparo
  const rtKey = tenant ? `${tenant.id}::${tenant.type||'otro'}` : null
  useEffect(() => {
    if (!rtKey || !tenant) return
    const tenantId   = tenant.id
    const tenantType = tenant.type || 'otro'
    // Guard: si ya hay canal activo con este mismo key, no re-suscribir
    if (rtChannelRef.current) {
      supabase.removeChannel(rtChannelRef.current)
      rtChannelRef.current = null
    }
    const ch = supabase.channel('panel-rt-v5-' + tenantId)
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'calls', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const c = payload.new as any
        const schType = INTENT_MAP[c.intent||'otro'] || 'inquiry'
        const sch = SCHEMA_MAP[schType]
        pushEvent({ type:'call_incoming' as any, icon:'📞', color:C.teal, title:`${ACTIVE_CALL_LABEL} — ${c.caller_phone||'Número oculto'}`, sub: sch ? `${sch.icon} ${sch.label} detectada` : '', priority:'high' })
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
          const sch = SCHEMA_MAP[schType]
          pushEvent({ type:'call_ended' as any, icon:sch?.icon||'✅', color:sch?.color||C.green,
            title:`${sch?.label||'Llamada'} finalizada${c.customer_name?' — '+c.customer_name:''}`,
            sub:c.summary?.slice(0,80)||'Resumen generado' })
        }
        setCalls(prev => prev.map(x => x.id === c.id ? c : x))
      })
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'reservations', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const r = payload.new as any
        const sch = SCHEMA_MAP['reservation'] || SCHEMA_MAP['appointment']
        pushEvent({ type:'reservation' as any, icon:sch?.icon||'📅', color:sch?.color||C.teal,
          title:`${sch?.label||'Nueva cita'} — ${r.customer_name||r.patient_name||r.owner_name||'Cliente'}`,
          sub:`${r.people||r.party_size||''} ${r.people?'personas ·':''} ${(r.time||'').slice(0,5)}`.trim(),
          priority:'high' })
        setReservas(prev => [...prev, r])
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
          : 'tomando pedido…'
        pushEvent({ type:'order' as any, icon:'🛍️', color:C.violet,
          title:`Nuevo pedido — ${o.customer_name||o.customer_phone||'Cliente'}`,
          sub:`${itemList} · ${o.order_type||'recoger'}`, priority:'high' })
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
              title:`Pedido confirmado — ${o.customer_name||'Cliente'}`,
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
          title:`${ce.is_urgency?'🚨 Urgencia':ce.consultation_type||'Consulta'} — ${ce.patient_name||ce.patient_phone||'Paciente'}`,
          sub: ce.symptoms ? ce.symptoms.slice(0,60) : `${ce.consultation_type||'consulta'} · ${ce.duration_minutes||20}min`,
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
              title:`Cita confirmada — ${ce.patient_name||'Paciente'}`,
              sub:`${ce.consultation_type||'consulta'} · ${ce.appointment_date||''} ${(ce.appointment_time||'').slice(0,5)}`.trim(),
              priority:'high' })
          } else if (ce.status === 'escalated') {
            pushEvent({ type:'system' as any, icon:'🚨', color:C.red,
              title:`🚨 URGENCIA — ${ce.patient_name||ce.patient_phone||'Paciente'}`,
              sub: ce.symptoms?.slice(0,60) || 'Requiere atención inmediata',
              priority:'high' })
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
    const demoEvents = buildDemoEvents(getEventConfig(tenant.type||'otro'))
    const fire = () => {
      const evt = demoEvents[demoIdx.current % demoEvents.length]
      pushEvent(evt)
      demoIdx.current++
    }
    fire()
    demoTimer.current = setInterval(fire, 3200)
    return () => { if(demoTimer.current) clearInterval(demoTimer.current) }
  }, [demoMode, pushEvent, tenant])

  if (loading) return <PageLoader/>
  if (!tenant) return null

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
  const hour      = new Date().getHours()
  const greeting  = hour<13?'Buenos días':hour<20?'Buenas tardes':'Buenas noches'
  const todayCalls= calls.filter(c=>c.started_at?.slice(0,10)===new Date().toISOString().split('T')[0])

  return (
    <div style={{ minHeight:'100vh',background:C.bg,fontFamily:'var(--rz-font)' }}>
      <style>{`
        @keyframes rzSlideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rz-pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .rz-live-dot{width:8px;height:8px;border-radius:50%;background:#34D399;animation:rz-pulse 1.5s ease-in-out infinite}
      `}</style>

      {/* ── Header ── */}
      <div style={{ background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'14px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:20 }}>
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <h1 style={{ fontSize:16,fontWeight:700,color:C.text,letterSpacing:'-0.02em' }}>
              {greeting}, <span style={{ color:C.amber }}>{tenant.name}</span>
            </h1>
            {activeCalls.length > 0 && (
              <div style={{ display:'flex',alignItems:'center',gap:5,padding:'3px 10px',background:C.tealDim,borderRadius:20,border:'1px solid rgba(45,212,191,0.2)' }}>
                <div className="rz-live-dot" style={{ width:6,height:6 }}/>
                <span style={{ fontSize:11,fontWeight:600,color:C.teal }}>{activeCalls.length} en vivo</span>
              </div>
            )}
          </div>
          <p style={{ fontSize:11,color:C.text3,marginTop:2,textTransform:'capitalize' }}>{new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <AgentBar agentOn={agentOn} agentName={tenant.agent_name}/>
          <NotificationBell tenantId={tenant.id}/>
        </div>
      </div>

      <div style={{ maxWidth:1200,margin:'0 auto',padding:'22px 28px',display:'flex',flexDirection:'column',gap:16 }}>

        {/* ── Alert trial ── */}
        {isTrial && callsLeft<=5 && (
          <div style={{ background:`linear-gradient(135deg,${C.amberDim},rgba(240,168,78,0.04))`,border:`1px solid ${C.amber}30`,borderRadius:12,padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16 }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ width:7,height:7,borderRadius:'50%',background:C.amber,animation:'rz-pulse 1.5s ease-in-out infinite' }}/>
              <div>
                <p style={{ fontWeight:700,fontSize:14,color:C.amber }}>{callsLeft===0?'Trial agotado':`${callsLeft} llamada${callsLeft!==1?'s':''} restante${callsLeft!==1?'s':''}`}</p>
                <p style={{ fontSize:12,color:`${C.amber}90`,marginTop:1 }}>Activa un plan para seguir recibiendo llamadas sin límites</p>
              </div>
            </div>
            <Link href="/precios" style={{ padding:'8px 18px',fontSize:13,fontWeight:700,color:'#0C1018',background:C.amber,borderRadius:9,textDecoration:'none',whiteSpace:'nowrap',flexShrink:0 }}>Ver planes</Link>
          </div>
        )}

        {/* ── Llamadas activas ── */}
        {activeCalls.length > 0 && (
          <div style={{ background:`linear-gradient(135deg,${C.surface},${C.surface2})`,border:`1px solid ${C.teal}25`,borderRadius:16,padding:'18px 20px',position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.teal}50,transparent)` }}/>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <div className="rz-live-dot"/>
                <span style={{ fontSize:14,fontWeight:700,color:C.text }}>{activeCalls.length} llamada{activeCalls.length!==1?'s':''} en curso</span>
              </div>
              <span style={{ fontSize:10,color:C.text3,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.07em' }}>Tiempo real</span>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {activeCalls.map(call=><ActiveCallBlock key={call.id} call={call} businessType={tenant.type||'otro'}/>)}
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
                <span style={{ fontSize:14,fontWeight:700,color:C.text }}>🛍️ {activeOrders.length} pedido{activeOrders.length!==1?'s':''} en curso</span>
              </div>
              <Link href="/pedidos" style={{ fontSize:11,color:C.violet,fontWeight:600,textDecoration:'none' }}>Ver pedidos →</Link>
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
                        {itemStr||'Tomando pedido…'}{order.pickup_time?` · Recogida ${order.pickup_time}`:''}
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
                <span style={{ fontSize:14,fontWeight:700,color:C.text }}>⚕️ {activeConsultations.length} consulta{activeConsultations.length!==1?'s':''} en curso</span>
              </div>
              <Link href="/reservas" style={{ fontSize:11,color:C.teal,fontWeight:600,textDecoration:'none' }}>Ver citas →</Link>
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
                        {isUrgent && <span style={{ fontSize:10,color:C.red,fontWeight:700,padding:'1px 6px',borderRadius:8,background:`${C.red}15`,flexShrink:0 }}>URGENTE</span>}
                        {!isUrgent && ce.consultation_type && <span style={{ fontSize:10,color:C.teal,padding:'1px 6px',borderRadius:8,background:`${C.teal}15`,fontWeight:600,flexShrink:0 }}>{ce.consultation_type}</span>}
                      </div>
                      <p style={{ fontSize:11,color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                        {ce.symptoms ? ce.symptoms.slice(0,60) : `${ce.duration_minutes||20}min${ce.is_new_patient?' · Primera visita':''}`}
                      </p>
                    </div>
                    <div style={{ flexShrink:0,textAlign:'right' as const }}>
                      <span style={{ fontSize:10,color:isUrgent?C.red:C.text3,fontWeight:isUrgent?700:400 }}>
                        {isUrgent?'⚠ Revisar':'En curso'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── KPIs ── */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12 }}>
          <KpiCard value={todayCalls.length} label="Llamadas hoy" icon="📞" color={C.amber} accent href="/llamadas"/>
          <KpiCard value={reservas.length} label={`${L.reservas} hoy`} sub={`${reservas.filter(r=>r.status==='confirmada').length} confirmadas`} icon="📅" color={C.teal} accent href="/reservas"/>
          <KpiCard value={clientes.length} label={L.clientes} icon="👥" color={C.violet} href="/clientes"/>
          <KpiCard value={isTrial?callsLeft:`${callsUsed}/${callsLimit}`} label={isTrial?'Llamadas restantes':'Uso del plan'} sub={planLabel} icon={isTrial?'⚡':'📊'} color={callsLeft<=3?C.red:planColor} accent={isTrial} href="/facturacion"/>
        </div>

        {/* ── Main grid: Live feed + Llamadas ── */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 380px',gap:16 }}>

          {/* Llamadas recientes */}
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden' }}>
            <div style={{ padding:'14px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <h2 style={{ fontSize:14,fontWeight:700,color:C.text }}>Llamadas recientes</h2>
              <Link href="/llamadas" style={{ fontSize:12,color:C.amber,fontWeight:600,textDecoration:'none' }}>Ver todas →</Link>
            </div>
            {calls.length===0 ? (
              <div style={{ padding:'52px 20px',textAlign:'center' }}>
                <div style={{ width:56,height:56,borderRadius:'50%',background:'rgba(45,212,191,0.08)',border:'1px solid rgba(45,212,191,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:24 }}>📞</div>
                <p style={{ fontSize:15,fontWeight:700,color:C.text,marginBottom:8 }}>Tu recepcionista está activa</p>
                <p style={{ fontSize:13,color:C.text3,lineHeight:1.7,maxWidth:280,margin:'0 auto' }}>
                  {agentOn ? 'Esperando llamadas. Cuando entren, aparecerán aquí en tiempo real con su resumen.' : 'Configura tu número de teléfono para empezar a recibir llamadas.'}
                </p>
                {!agentOn && <Link href="/configuracion" style={{ display:'inline-block',marginTop:16,padding:'9px 20px',fontSize:13,fontWeight:600,color:'#0C1018',background:C.amber,borderRadius:9,textDecoration:'none' }}>Configurar número →</Link>}
                {agentOn && (
                  <div style={{ marginTop:20,display:'flex',alignItems:'center',justifyContent:'center',gap:16 }}>
                    {['📞 Responde 24/7','📅 Detecta reservas','🛍️ Toma pedidos'].map(s=>(
                      <div key={s} style={{ fontSize:12,color:C.text3,display:'flex',alignItems:'center',gap:5 }}>{s}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : calls.map((call,i)=><CallRow key={call.id} call={call} idx={i} businessType={tenant.type||'otro'}/>)}
          </div>

          {/* Columna derecha: feed + reservas */}
          <div style={{ display:'flex',flexDirection:'column',gap:16 }}>

            {/* Live feed */}
            <LiveFeed events={events} demoMode={demoMode} onToggleDemo={toggleDemo}/>

            {/* Reservas hoy */}
            <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden' }}>
              <div style={{ padding:'14px 18px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <h2 style={{ fontSize:14,fontWeight:700,color:C.text }}>{L.reservas} hoy</h2>
                <Link href="/reservas" style={{ fontSize:12,color:C.amber,fontWeight:600,textDecoration:'none' }}>Gestionar →</Link>
              </div>
              {reservas.length===0 ? (
                <div style={{ padding:'32px 16px',textAlign:'center' }}>
                  <div style={{ fontSize:24,marginBottom:10 }}>📅</div>
                  <p style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:6 }}>Sin {L.reservas.toLowerCase()} hoy</p>
                  <p style={{ fontSize:12,color:C.text3,lineHeight:1.6 }}>Las {L.reservas.toLowerCase()} se mostrarán automáticamente cuando entren.</p>
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
                  <span style={{ fontSize:10,padding:'2px 8px',borderRadius:10,background:r.status==='confirmada'?C.greenDim:C.surface2,color:r.status==='confirmada'?C.green:C.text3,fontWeight:600,border:`1px solid ${r.status==='confirmada'?C.green+'25':C.border}`,flexShrink:0 }}>{r.status}</span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ── Trial usage bar ── */}
        {isTrial && (
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'16px 20px' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
              <span style={{ fontSize:13,fontWeight:600,color:C.text }}>Uso del trial gratuito</span>
              <span style={{ fontFamily:'var(--rz-mono)',fontSize:13,fontWeight:600,color:callsLeft<=3?C.red:C.text }}>{callsUsed}<span style={{ color:C.text3 }}> / {callsLimit}</span></span>
            </div>
            <div style={{ height:5,background:'rgba(255,255,255,0.05)',borderRadius:3,overflow:'hidden',marginBottom:8 }}>
              <div style={{ height:'100%',width:`${Math.min(100,Math.round(callsUsed/callsLimit*100))}%`,background:callsLeft<=3?C.red:callsUsed/callsLimit>0.7?C.yellow:C.amber,borderRadius:3,transition:'width 0.6s ease' }}/>
            </div>
            <p style={{ fontSize:11,color:C.text3 }}>Cada llamada recibida cuenta como una del plan.</p>
          </div>
        )}

      </div>
    </div>
  )
}
