'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import { resolveTemplate } from '@/lib/templates'

// ── Design tokens (matching globals.css)
const C = {
  amber: '#F0A84E', amberDim: 'rgba(240,168,78,0.10)', amberGlow: 'rgba(240,168,78,0.20)',
  teal: '#2DD4BF', tealDim: 'rgba(45,212,191,0.10)',
  green: '#34D399', greenDim: 'rgba(52,211,153,0.10)',
  red: '#F87171', redDim: 'rgba(248,113,113,0.10)',
  yellow: '#FBB53F',
  violet: '#A78BFA', violetDim: 'rgba(167,139,250,0.12)',
  text: '#E8EEF6', text2: '#8895A7', text3: '#49566A',
  bg: '#0C1018', surface: '#131920', surface2: '#1A2230', surface3: '#202C3E',
  border: 'rgba(255,255,255,0.07)', borderMd: 'rgba(255,255,255,0.11)',
}
const PLAN_COL: Record<string,string> = { trial:C.amber, free:C.amber, starter:'#60A5FA', pro:C.violet, business:C.green }
const PLAN_LBL: Record<string,string> = { trial:'Trial', free:'Trial', starter:'Starter', pro:'Pro', business:'Business' }
const PLAN_CALLS: Record<string,number> = { trial:10, free:10, starter:50, pro:200, business:600 }

// ── Stat Card
function KpiCard({ value, label, sub, color='#E8EEF6', href, accent=false, icon }: any) {
  const el = (
    <div className="rz-fade-up" style={{
      background: accent ? `linear-gradient(135deg, ${color}18 0%, transparent 60%)` : C.surface,
      border: `1px solid ${accent ? color+'25' : C.border}`,
      borderRadius: 14, padding:'18px 20px',
      transition:'all 0.2s ease', cursor: href ? 'pointer' : 'default',
      position:'relative', overflow:'hidden',
    }}
    onMouseEnter={e=>{ if(href) (e.currentTarget as HTMLDivElement).style.borderColor = color+'40' }}
    onMouseLeave={e=>{ if(href) (e.currentTarget as HTMLDivElement).style.borderColor = accent ? color+'25' : C.border }}>
      {/* Top accent line */}
      {accent && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${color}, transparent)`, borderRadius:'14px 14px 0 0' }}/>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <p style={{ fontFamily:'var(--rz-mono)', fontSize:28, fontWeight:600, color, letterSpacing:'-0.03em', lineHeight:1, marginBottom:6 }}>{value}</p>
          <p style={{ fontSize:12, color:C.text2, fontWeight:500 }}>{label}</p>
          {sub && <p style={{ fontSize:11, color:C.text3, marginTop:3 }}>{sub}</p>}
        </div>
        {icon && <div style={{ width:34, height:34, borderRadius:10, background:color+'14', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:16 }}>{icon}</span>
        </div>}
      </div>
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration:'none' }}>{el}</Link> : el
}

// ── Active call block
function ActiveCallBlock({ call }: { call: any }) {
  const STATE_LABEL: Record<string,string> = {
    iniciando:'Iniciando conexión…', escuchando:'Escuchando al cliente', procesando:'Procesando solicitud',
    respondiendo:'Respondiendo…', esperando_datos:'Esperando datos', finalizando:'Cerrando llamada…',
    completada:'Llamada completada', error:'Error'
  }
  const STATE_COLOR: Record<string,string> = {
    iniciando:C.yellow, escuchando:C.teal, procesando:C.amber,
    respondiendo:C.green, esperando_datos:C.violet, finalizando:C.text3,
    completada:C.green, error:C.red
  }
  const state   = call.session_state || 'escuchando'
  const color   = STATE_COLOR[state] || C.teal
  const elapsed = call.started_at ? Math.floor((Date.now()-new Date(call.started_at).getTime())/1000) : 0
  const dur     = elapsed >= 60 ? `${Math.floor(elapsed/60)}m ${elapsed%60}s` : `${elapsed}s`

  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:C.surface2, borderRadius:12, border:`1px solid ${C.border}`, transition:'all 0.15s' }}>
      {/* Phone avatar */}
      <div style={{ width:38, height:38, borderRadius:'50%', background:`${color}18`, border:`1.5px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill={color}><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {call.caller_phone || 'Número oculto'}
        </p>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:color, animation:'rz-pulse 1.5s ease-in-out infinite' }}/>
          <span style={{ fontSize:11, color, fontWeight:500 }}>{STATE_LABEL[state] || state}</span>
        </div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <span style={{ fontFamily:'var(--rz-mono)', fontSize:12, color:C.text3 }}>{dur}</span>
      </div>
    </div>
  )
}

// ── Recent call row
function CallRow({ call, idx }: { call: any; idx: number }) {
  const status  = call.status || 'completada'
  const done    = ['completada','completed'].includes(status)
  const phone   = call.caller_phone || call.from_number || 'Número oculto'
  const dur     = call.duration_seconds ? (call.duration_seconds >= 60 ? `${Math.round(call.duration_seconds/60)}m` : `${call.duration_seconds}s`) : null
  const time    = call.started_at ? new Date(call.started_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : ''
  const intentColors: Record<string,string> = { reserva:C.teal, pedido:C.violet, cancelacion:C.red, consulta:C.text3, otro:C.text3 }
  const intentColor = intentColors[call.intent] || C.text3

  return (
    <div className={`rz-fade-up rz-animate-delay-${Math.min(idx+1,4)}`} style={{
      display:'flex', alignItems:'flex-start', gap:12, padding:'12px 20px',
      borderTop: idx > 0 ? `1px solid ${C.border}` : 'none',
      transition:'background 0.12s',
    }}
    onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)}
    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
      {/* Icon */}
      <div style={{ width:32, height:32, borderRadius:'50%', background: done ? C.greenDim : C.redDim, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill={done ? C.green : C.red}><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
      </div>
      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <p style={{ fontSize:13, fontWeight:600, color:C.text }}>{phone}</p>
          {call.intent && call.intent !== 'consulta' && (
            <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:intentColor+'18', color:intentColor, fontWeight:600, letterSpacing:'0.02em', textTransform:'capitalize' }}>{call.intent}</span>
          )}
          {done && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:C.greenDim, color:C.green, fontWeight:600 }}>Completada</span>}
        </div>
        {call.summary
          ? <p style={{ fontSize:12, color:C.text2, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{call.summary}</p>
          : <p style={{ fontSize:12, color:C.text3 }}>Sin resumen</p>
        }
      </div>
      {/* Meta */}
      <div style={{ flexShrink:0, textAlign:'right' }}>
        <p style={{ fontSize:11, color:C.text3 }}>{time}</p>
        {dur && <p style={{ fontFamily:'var(--rz-mono)', fontSize:11, color:C.text3, marginTop:2 }}>{dur}</p>}
      </div>
    </div>
  )
}

// ── Main page
export default function PanelPage() {
  const router = useRouter()
  const [loading, setLoading]       = useState(true)
  const [tenant, setTenant]         = useState<any>(null)
  const [calls, setCalls]           = useState<any[]>([])
  const [reservas, setReservas]     = useState<any[]>([])
  const [clientes, setClientes]     = useState<any[]>([])
  const [activeCalls, setActiveCalls] = useState<any[]>([])
  const [metrics, setMetrics]       = useState<any>(null)

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data:p } = await supabase.from('profiles').select('tenant_id,role').eq('id',user.id).single()
    if (!p?.tenant_id) { if (p?.role==='superadmin') router.push('/admin'); else router.push('/onboarding'); return }
    const tid   = p.tenant_id
    const today = new Date().toISOString().split('T')[0]
    const [{ data:t },{ data:c },{ data:r },{ data:cl },{ data:ac },m] = await Promise.all([
      supabase.from('tenants').select('*').eq('id',tid).single(),
      supabase.from('calls').select('*').eq('tenant_id',tid).order('started_at',{ascending:false}).limit(8),
      supabase.from('reservations').select('*').eq('tenant_id',tid).eq('date',today).order('time'),
      supabase.from('customers').select('id').eq('tenant_id',tid),
      supabase.from('calls').select('id,call_sid,caller_phone,session_state,started_at').eq('tenant_id',tid).eq('status','activa').order('started_at',{ascending:false}).limit(8),
      supabase.rpc('get_daily_metrics',{ p_tenant_id: tid }),
    ])
    setTenant(t); setCalls(c||[]); setReservas(r||[]); setClientes(cl||[]); setActiveCalls(ac||[]); setMetrics(m?.data||null)
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
    const ch = supabase.channel('panel-rt')
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'calls' }, load)
      .on('postgres_changes',{ event:'UPDATE', schema:'public', table:'calls' }, load)
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'reservations' }, load)
      .on('postgres_changes',{ event:'UPDATE', schema:'public', table:'reservations' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  if (loading) return <PageLoader/>
  if (!tenant) return null

  const plan       = tenant.plan || 'free'
  const isTrial    = plan==='free' || plan==='trial'
  const planColor  = PLAN_COL[plan] || C.amber
  const planLabel  = PLAN_LBL[plan] || 'Trial'
  const callsUsed  = isTrial ? (tenant.free_calls_used||0) : (tenant.plan_calls_used||0)
  const callsLimit = isTrial ? (tenant.free_calls_limit||10) : (tenant.plan_calls_included||PLAN_CALLS[plan]||50)
  const callsLeft  = Math.max(0, callsLimit-callsUsed)
  const agentOn    = !!tenant.agent_phone
  const tmpl       = resolveTemplate(tenant.type||'otro')
  const L          = tmpl.labels

  const hour    = new Date().getHours()
  const greeting = hour<13?'Buenos días':hour<20?'Buenas tardes':'Buenas noches'
  const todayCalls = calls.filter(c => c.started_at?.slice(0,10) === new Date().toISOString().split('T')[0])

  return (
    <div style={{ minHeight:'100vh', background:'var(--rz-bg)', fontFamily:'var(--rz-font)' }}>

      {/* ── Top header bar ── */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:20 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <h1 style={{ fontSize:16, fontWeight:700, color:C.text, letterSpacing:'-0.02em' }}>
              {greeting}, <span style={{ color:C.amber }}>{tenant.name}</span>
            </h1>
            {activeCalls.length > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', background:C.tealDim, borderRadius:20, border:`1px solid rgba(45,212,191,0.2)` }}>
                <div className="rz-live-dot" style={{ width:6, height:6 }}/>
                <span style={{ fontSize:11, fontWeight:600, color:C.teal }}>{activeCalls.length} en vivo</span>
              </div>
            )}
          </div>
          <p style={{ fontSize:11, color:C.text3, marginTop:2, textTransform:'capitalize' }}>
            {new Date().toLocaleDateString('es-ES',{ weekday:'long', day:'numeric', month:'long' })}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background: agentOn ? C.tealDim : C.redDim, border:`1px solid ${agentOn ? 'rgba(45,212,191,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius:20 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background: agentOn ? C.teal : C.red, animation: agentOn ? 'rz-pulse 2s ease-in-out infinite' : 'none' }}/>
            <span style={{ fontSize:12, fontWeight:600, color: agentOn ? C.teal : C.red }}>
              {agentOn ? (tenant.agent_name||'Sofía')+' activa' : 'Sin número'}
            </span>
          </div>
          {!agentOn && (
            <Link href="/configuracion" style={{ padding:'6px 14px', fontSize:12, fontWeight:600, color:'#0C1018', background:C.amber, borderRadius:8, textDecoration:'none' }}>Configurar →</Link>
          )}
        </div>
      </div>

      <div style={{ maxWidth:1160, margin:'0 auto', padding:'24px 28px' }}>

        {/* ── Active calls widget ── */}
        {activeCalls.length > 0 && (
          <div className="rz-fade-up" style={{ background:`linear-gradient(135deg, ${C.surface} 0%, ${C.surface2} 100%)`, border:`1px solid ${C.teal}25`, borderRadius:16, padding:'18px 20px', marginBottom:20, position:'relative', overflow:'hidden' }}>
            {/* Subtle glow */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg, transparent, ${C.teal}50, transparent)` }}/>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div className="rz-live-dot"/>
                <span style={{ fontSize:14, fontWeight:700, color:C.text, letterSpacing:'-0.01em' }}>
                  {activeCalls.length} llamada{activeCalls.length!==1?'s':''} en curso
                </span>
              </div>
              <span style={{ fontSize:11, color:C.text3, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em' }}>Tiempo real</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {activeCalls.map(call => <ActiveCallBlock key={call.id} call={call}/>)}
            </div>
          </div>
        )}

        {/* ── Trial alert ── */}
        {isTrial && callsLeft <= 5 && (
          <div className="rz-fade-up" style={{ background:`linear-gradient(135deg, ${C.amberDim} 0%, rgba(240,168,78,0.05) 100%)`, border:`1px solid ${C.amber}30`, borderRadius:12, padding:'14px 20px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div className="rz-live-dot-amber"/>
              <div>
                <p style={{ fontWeight:700, fontSize:14, color:C.amber, letterSpacing:'-0.01em' }}>
                  {callsLeft===0 ? 'Trial agotado' : `${callsLeft} llamada${callsLeft!==1?'s':''} restante${callsLeft!==1?'s':''}`}
                </p>
                <p style={{ fontSize:12, color:`${C.amber}90`, marginTop:1 }}>Activa un plan para seguir recibiendo llamadas</p>
              </div>
            </div>
            <Link href="/precios" style={{ padding:'8px 18px', fontSize:13, fontWeight:700, color:'#0C1018', background:C.amber, borderRadius:9, textDecoration:'none', whiteSpace:'nowrap', flexShrink:0 }}>
              Ver planes
            </Link>
          </div>
        )}

        {/* ── Metrics bar — today's intents ── */}
        {metrics && (metrics.reservas_detected>0 || metrics.pedidos_detected>0 || metrics.calls_failed>0) && (
          <div className="rz-fade-up" style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
            <span style={{ fontSize:10, fontWeight:700, color:C.text3, textTransform:'uppercase', letterSpacing:'0.07em', flexShrink:0 }}>Hoy detectado:</span>
            {metrics.reservas_detected > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:24, height:24, borderRadius:7, background:C.tealDim, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>📅</div>
                <span style={{ fontFamily:'var(--rz-mono)', fontSize:16, fontWeight:600, color:C.teal }}>{metrics.reservas_detected}</span>
                <span style={{ fontSize:12, color:C.text2 }}>reservas</span>
              </div>
            )}
            {metrics.pedidos_detected > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:24, height:24, borderRadius:7, background:C.violetDim, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>🛍️</div>
                <span style={{ fontFamily:'var(--rz-mono)', fontSize:16, fontWeight:600, color:C.violet }}>{metrics.pedidos_detected}</span>
                <span style={{ fontSize:12, color:C.text2 }}>pedidos</span>
              </div>
            )}
            {metrics.calls_failed > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:24, height:24, borderRadius:7, background:C.redDim, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>⚠️</div>
                <span style={{ fontFamily:'var(--rz-mono)', fontSize:16, fontWeight:600, color:C.red }}>{metrics.calls_failed}</span>
                <span style={{ fontSize:12, color:C.text2 }}>fallidas</span>
              </div>
            )}
            {metrics.with_summary > 0 && (
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:C.green }}/>
                <span style={{ fontSize:11, color:C.text3 }}>{metrics.with_summary} con resumen</span>
              </div>
            )}
          </div>
        )}

        {/* ── KPI grid ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          <KpiCard value={todayCalls.length} label="Llamadas hoy" icon="📞" color={C.amber} accent href="/llamadas"/>
          <KpiCard value={reservas.length} label={`${L.reservas} hoy`} sub={`${reservas.filter(r=>r.status==='confirmada').length} confirmadas`} icon="📅" color={C.teal} accent href="/reservas"/>
          <KpiCard value={clientes.length} label={L.clientes} icon="👥" color={C.violet} href="/clientes"/>
          <KpiCard
            value={isTrial ? callsLeft : `${callsUsed}/${callsLimit}`}
            label={isTrial ? 'Llamadas restantes' : 'Uso del plan'}
            sub={planLabel}
            icon={isTrial ? '⚡' : '📊'}
            color={callsLeft<=3 ? C.red : planColor}
            accent={isTrial}
            href="/facturacion"
          />
        </div>

        {/* ── Trial progress ── */}
        {isTrial && (
          <div className="rz-fade-up" style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 20px', marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:13, fontWeight:600, color:C.text }}>Uso del trial gratuito</span>
              <span style={{ fontFamily:'var(--rz-mono)', fontSize:13, fontWeight:600, color: callsLeft<=3 ? C.red : C.text }}>{callsUsed} <span style={{ color:C.text3 }}>/ {callsLimit}</span></span>
            </div>
            <div style={{ height:5, background:'rgba(255,255,255,0.05)', borderRadius:3, overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', width:`${Math.min(100,Math.round(callsUsed/callsLimit*100))}%`, background: callsLeft<=3 ? C.red : callsUsed/callsLimit>0.7 ? C.yellow : C.amber, borderRadius:3, transition:'width 0.6s ease', transformOrigin:'left' }}/>
            </div>
            <p style={{ fontSize:11, color:C.text3 }}>Cada llamada recibida cuenta como una llamada del plan.</p>
          </div>
        )}

        {/* ── Main grid: calls + reservas ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16 }}>

          {/* Llamadas recientes */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
            <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, letterSpacing:'-0.01em' }}>Llamadas recientes</h2>
              <Link href="/llamadas" style={{ fontSize:12, color:C.amber, fontWeight:600, textDecoration:'none' }}>Ver todas →</Link>
            </div>
            {calls.length === 0
              ? (
                <div style={{ padding:'48px 20px', textAlign:'center' }}>
                  <div style={{ width:52, height:52, borderRadius:'50%', background:C.amberDim, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:22 }}>📞</div>
                  <p style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:6 }}>Sin llamadas aún</p>
                  <p style={{ fontSize:12, color:C.text3, lineHeight:1.6 }}>Las llamadas de tu recepcionista aparecerán aquí en tiempo real.</p>
                  {!agentOn && <Link href="/configuracion" style={{ display:'inline-block', marginTop:14, padding:'8px 18px', fontSize:13, fontWeight:600, color:'#0C1018', background:C.amber, borderRadius:9, textDecoration:'none' }}>Configurar número →</Link>}
                </div>
              )
              : calls.map((call,i) => <CallRow key={call.id} call={call} idx={i}/>)
            }
          </div>

          {/* Reservas de hoy */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
            <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.text, letterSpacing:'-0.01em' }}>{L.reservas} hoy</h2>
              <Link href="/reservas" style={{ fontSize:12, color:C.amber, fontWeight:600, textDecoration:'none' }}>Gestionar →</Link>
            </div>
            {reservas.length === 0
              ? (
                <div style={{ padding:'40px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:28, marginBottom:10 }}>📅</div>
                  <p style={{ fontSize:13, color:C.text3, lineHeight:1.6 }}>Sin {L.reservas.toLowerCase()} hoy</p>
                </div>
              )
              : reservas.slice(0,10).map((r,i) => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', borderTop: i>0 ? `1px solid ${C.border}` : 'none', transition:'background 0.12s' }}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <div style={{ width:34, height:34, borderRadius:'50%', background:C.amberDim, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--rz-font)', fontSize:13, fontWeight:700, color:C.amber, flexShrink:0 }}>
                    {r.customer_name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.customer_name}</p>
                    <p style={{ fontSize:11, color:C.text3 }}>{(r.time||r.reservation_time||'').slice(0,5)} · {r.people||r.party_size}p</p>
                  </div>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background: r.status==='confirmada' ? C.greenDim : C.surface2, color: r.status==='confirmada' ? C.green : C.text3, fontWeight:600, flexShrink:0, border:`1px solid ${r.status==='confirmada'?C.green+'25':C.border}` }}>{r.status}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}
