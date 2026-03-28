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

// ── Demo events dinamicos por tipo de negocio
function buildDemoEvents(evtConfig: BusinessEventConfig, lang='es'): Omit<LiveEvent,'id'|'ts'>[] {
  const _t = (s:string) => tx(s, lang)
  const eL = evtConfig.eventLabel || 'Reserva'
  const eLower = eL.toLowerCase()
  const demoByType: Record<string, { name: string; sub: string; consultaSub: string }> = {
    'Cita':    { name: 'Maria Lopez',   sub: 'Revision · 10:30',              consultaSub: 'Paciente pregunto por horarios disponibles' },
    'Sesion':  { name: 'Ana Garcia',    sub: 'Sesion individual · 17:00',     consultaSub: 'Cliente pregunto por disponibilidad' },
    'Clase':   { name: 'Roberto Diaz',  sub: 'Spinning · 19:00',             consultaSub: 'Socio pregunto por horarios de clases' },
    'Visita':  { name: 'Elena Mora',    sub: 'Piso 2 hab. centro · 17:00',   consultaSub: 'Cliente pregunto por pisos disponibles' },
    'Pedido':  { name: 'Luis Fernandez',sub: '3 productos · 45.90EUR',       consultaSub: 'Cliente pregunto por estado de envio' },
  }
  const demo = demoByType[eL] || { name: 'Maria Lopez', sub: '4 personas · 21:00', consultaSub: 'Cliente pregunto por opciones vegetarianas' }
  return [
    { type: 'call_incoming', icon: '📞', color: C.teal, title: `${_t('Llamada entrante')} — +34 612 345 678`, sub: `📅 ${eL} detectada`, priority: 'high', demo: true },
    { type: 'reservation', icon: '📅', color: C.teal, title: `Nueva ${eLower} — ${demo.name}`, sub: demo.sub, priority: 'high', demo: true },
    { type: 'call_ended', icon: '✅', color: C.green, title: `${_t('Llamada finalizada')} — Carlos Ruiz`, sub: `${eL} confirmada para manana`, demo: true },
    { type: 'system', icon: '💬', color: C.text2, title: _t('Consulta atendida'), sub: demo.consultaSub, demo: true },
    { type: 'call_incoming', icon: '📞', color: C.teal, title: `${_t('Llamada entrante')} — +34 698 765 432`, sub: `💬 ${_t('Consulta detectada')}`, demo: true },
  ]
}

// ══════════════════════════════════════════════════
// SECTION: Needs Attention - shows actionable items at the very top
// ══════════════════════════════════════════════════
function NeedsAttentionSection({ items, lang='es' }: { items: { id: string; icon: string; color: string; title: string; sub: string; action: string; href: string; urgency: 'critical'|'warning'|'info' }[]; lang?: string }) {
  const _tx = (s:string) => tx(s, lang)
  if (items.length === 0) return null
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.surface}, ${C.surface2})`, border: `1px solid ${C.amber}20`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, background: `${C.amber}06` }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.amber, animation: 'rz-pulse 1.5s ease-in-out infinite' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{_tx('Necesita tu atencion')}</span>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: C.amberDim, color: C.amber, fontWeight: 700, marginLeft: 'auto' }}>{items.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item, i) => (
          <Link key={item.id} href={item.href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', transition: 'background 0.12s', background: item.urgency === 'critical' ? `${C.red}06` : 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.surface2 }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = item.urgency === 'critical' ? `${C.red}06` : 'transparent' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
              {item.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{item.title}</p>
              <p style={{ fontSize: 11, color: C.text2 }}>{item.sub}</p>
            </div>
            <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: `${item.color}15`, color: item.color, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>{item.action}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
// SECTION: Quick Actions - common tasks one click away
// ══════════════════════════════════════════════════
function QuickActions({ actions, lang='es' }: { actions: { id: string; icon: string; label: string; href: string; color?: string }[]; lang?: string }) {
  const _tx = (s:string) => tx(s, lang)
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {actions.map(a => (
        <Link key={a.id} href={a.href} style={{
          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 14px', borderRadius: 10,
          background: C.surface, border: `1px solid ${C.border}`,
          fontSize: 12, fontWeight: 600, color: C.text2,
          transition: 'all 0.15s', whiteSpace: 'nowrap',
        }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = C.surface2; el.style.borderColor = (a.color || C.amber) + '40'; el.style.color = a.color || C.amber }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = C.surface; el.style.borderColor = C.border; el.style.color = C.text2 }}>
          <span style={{ fontSize: 14 }}>{a.icon}</span>
          {a.label}
        </Link>
      ))}
    </div>
  )
}


// ── Live Feed Component
function LiveFeed({ events, demoMode, onToggleDemo, lang='es' }: { events:LiveEvent[], demoMode:boolean, onToggleDemo:()=>void, lang?:string }) {
  const _tx = (s:string) => tx(s, lang)
  const display = events.slice(0, 12)

  return (
    <div className="rz-card-premium" style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.015)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="rz-status-online"/>
          <span style={{ fontSize:14, fontWeight:700, color:C.text, letterSpacing:'-0.01em' }}>{_tx(ACTIVE_CALL_LABEL)}</span>
          {demoMode && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(251,181,63,0.15)', color:C.yellow, fontWeight:700, letterSpacing:'0.04em' }}>DEMO</span>}
        </div>
        <button onClick={onToggleDemo} style={{
          fontSize:11, padding:'4px 12px', borderRadius:8, border:`1px solid ${demoMode?C.yellow+'40':C.border}`,
          background:demoMode?'rgba(251,181,63,0.08)':'rgba(255,255,255,0.03)',
          color:demoMode?C.yellow:C.text3, cursor:'pointer', fontFamily:'inherit', fontWeight:600, transition:'all 0.15s'
        }}>
          {demoMode ? _tx('Salir demo') : _tx('Modo demo')}
        </button>
      </div>

      {/* Events */}
      <div style={{ maxHeight:300, overflowY:'auto', scrollbarWidth:'none' }}>
        {display.length === 0 ? (
          <div style={{ padding:'32px 20px', textAlign:'center' }}>
            <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(45,212,191,0.08)', border:'1px solid rgba(45,212,191,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:18 }}>⚡</div>
            <p style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>{_tx('El sistema esta listo')}</p>
            <p style={{ fontSize:11, color:C.text3, lineHeight:1.6, maxWidth:240, margin:'0 auto' }}>{_tx('Tu recepcionista esta activa y preparada. Los eventos apareceran aqui en tiempo real.')}</p>
            <button onClick={onToggleDemo} style={{ marginTop:12, padding:'6px 14px', fontSize:11, fontWeight:700, borderRadius:8, border:`1px solid ${C.amber}40`, background:C.amberDim, color:C.amber, cursor:'pointer', fontFamily:'inherit' }}>
              {_tx('Ver demo')}
            </button>
          </div>
        ) : display.map((evt, i) => (
          <div key={evt.id} style={{
            display:'flex', gap:12, padding:'10px 18px',
            borderBottom: i < display.length-1 ? `1px solid ${C.border}` : 'none',
            background: evt.priority==='high' ? `${evt.color}05` : 'transparent',
            animation: i===0 ? 'rzSlideIn 0.35s ease' : 'none',
            transition:'background 0.15s',
          }}>
            <div style={{ width:30, height:30, borderRadius:8, background:`${evt.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
              {evt.icon}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:1 }}>
                <p style={{ fontSize:12, fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{evt.title}</p>
                {evt.priority==='high' && <div style={{ width:5, height:5, borderRadius:'50%', background:evt.color, flexShrink:0 }}/>}
              </div>
              {evt.sub && <p style={{ fontSize:11, color:C.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{evt.sub}</p>}
            </div>
            <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
              <span style={{ fontSize:10, color:C.text3, whiteSpace:'nowrap' }}>{timeAgo(evt.ts, lang)}</span>
              {evt.demo && <span style={{ fontSize:8, color:C.yellow, fontWeight:700 }}>DEMO</span>}
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
      background: accent ? `linear-gradient(135deg,${color}14,transparent 70%)` : C.surface,
      border:`1px solid ${accent?color+'22':C.border}`, borderRadius:14, padding:'16px 18px',
      position:'relative', overflow:'hidden', cursor:href?'pointer':'default',
    }}>
      {accent && <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${color},transparent)`,borderRadius:'14px 14px 0 0' }}/>}
      <div style={{ position:'absolute',top:'-30%',right:'-10%',width:100,height:100,background:`radial-gradient(circle,${color}08,transparent 70%)`,pointerEvents:'none' }}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'relative' }}>
        <div>
          <p style={{ fontFamily:'var(--rz-mono)',fontSize:28,fontWeight:800,color,letterSpacing:'-0.03em',lineHeight:1,marginBottom:4 }}>{value}</p>
          <p style={{ fontSize:11,color:C.text2,fontWeight:500 }}>{label}</p>
          {sub && <p style={{ fontSize:10,color:C.text3,marginTop:2 }}>{sub}</p>}
        </div>
        {icon && <div style={{ width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${color}18,${color}08)`,border:`1px solid ${color}20`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          <span style={{ fontSize:15 }}>{icon}</span>
        </div>}
      </div>
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration:'none' }}>{inner}</Link> : inner
}

// ── Active call block
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
    <div style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:C.surface2,borderRadius:11,border:`1px solid ${color}25` }}>
      <div style={{ width:34,height:34,borderRadius:'50%',background:`${color}18`,border:`1.5px solid ${color}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill={color}><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{call.caller_phone||_tx('Numero oculto')}</p>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <div style={{ width:5,height:5,borderRadius:'50%',background:color,animation:'rz-pulse 1.5s ease-in-out infinite' }}/>
          <span style={{ fontSize:11,color,fontWeight:500 }}>{_tx(stateInfo.label)}</span>
        </div>
      </div>
      <span style={{ fontFamily:'var(--rz-mono)',fontSize:12,color:C.text3,flexShrink:0 }}>{dur}</span>
    </div>
  )
}

// ── Call row
function CallRow({ call, idx, businessType, lang='es', eventLabel }:{ call:any; idx:number; businessType:string; lang?:string; eventLabel?:string }) {
  const _tx = (s:string) => tx(s, lang)
  const schemaType = INTENT_MAP[call.intent] || 'inquiry'
  const schema = getSchemaMap(eventLabel)[schemaType]
  const status = call.status||'completada'
  const done = ['completada','completed'].includes(status)
  const phone = call.caller_phone||call.from_number||_tx('Numero oculto')
  const dur = call.duration_seconds ? (call.duration_seconds>=60?`${Math.round(call.duration_seconds/60)}m`:`${call.duration_seconds}s`) : null
  const loc = lang==='es'?'es-ES':lang==='en'?'en-GB':lang==='fr'?'fr-FR':lang==='pt'?'pt-PT':'ca-ES'
  const time = call.started_at ? new Date(call.started_at).toLocaleTimeString(loc,{hour:'2-digit',minute:'2-digit'}) : ''
  const ic = schema?.color || C.text3
  const intentLabel = schema?.label || call.intent
  return (
    <div style={{ display:'flex',alignItems:'flex-start',gap:12,padding:'11px 18px',borderTop:idx>0?`1px solid ${C.border}`:'none',transition:'background 0.12s' }}
      onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
      <div style={{ width:30,height:30,borderRadius:'50%',background:done?C.greenDim:C.redDim,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill={done?C.green:C.red}><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
          <p style={{ fontSize:12,fontWeight:600,color:C.text }}>{phone}</p>
          {schema && call.intent && <span style={{ fontSize:9,padding:'1px 6px',borderRadius:8,background:`${ic}18`,color:ic,fontWeight:600 }}>{schema.icon} {_tx(intentLabel)}</span>}
          {done && <span style={{ fontSize:9,padding:'1px 6px',borderRadius:8,background:C.greenDim,color:C.green,fontWeight:600 }}>{_tx('Completada')}</span>}
        </div>
        {call.summary ? <p style={{ fontSize:11,color:C.text2,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as const,overflow:'hidden' }}>{call.summary}</p>
          : <p style={{ fontSize:11,color:C.text3 }}>{_tx('Sin resumen')}</p>}
      </div>
      <div style={{ flexShrink:0,textAlign:'right' as const }}>
        <p style={{ fontSize:10,color:C.text3 }}>{time}</p>
        {dur && <p style={{ fontFamily:'var(--rz-mono)',fontSize:10,color:C.text3,marginTop:2 }}>{dur}</p>}
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
        <span style={{ fontSize:12,fontWeight:600,color:agentOn?C.teal:C.red }}>{agentOn?(agentName||'Sofia')+' '+_tx('activa'):_tx('Sin numero asignado')}</span>
      </div>
      {!agentOn && <Link href="/configuracion" style={{ padding:'6px 14px',fontSize:12,fontWeight:600,color:'#0C1018',background:C.amber,borderRadius:8,textDecoration:'none' }}>{_tx('Configurar')} →</Link>}
    </div>
  )
}

// ── Insights Panel
function InsightsPanel({ insights, headerLabel, lang='es', agentName='Sofia' }: { insights: any[]; headerLabel?: string; lang?:string; agentName?:string }) {
  const _tx = (s:string) => tx(s, lang)
  if (insights.length === 0) return null
  const priorityOrder = { high: 0, normal: 1, low: 2 }
  const sorted = [...insights].sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] || 1) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 1))

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, background:'rgba(255,255,255,0.015)' }}>
        <div className="rz-status-busy"/>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{headerLabel || (agentName + ' ' + _tx('ha detectado'))}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sorted.slice(0, 4).map((insight, i) => (
          <div key={insight.id} style={{
            padding: '10px 18px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
            background: insight.priority === 'high' ? 'rgba(240,168,78,0.04)' : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{insight.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>{insight.title}</p>
                <p style={{ fontSize: 11, color: C.text2, lineHeight: 1.5 }}>{insight.body}</p>
                {insight.action && insight.actionHref && (
                  <a href={insight.actionHref} style={{ fontSize: 11, color: C.amber, fontWeight: 600, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
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

// ── Forecast Chart
function ForecastChart({ data, forecastLabel, lang='es' }: { data: { hour: string; predicted: number; actual: number; level: string; color: string }[]; forecastLabel?: string; lang?:string }) {
  const _tx = (s:string) => tx(s, lang)
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.predicted), 1)
  const nowHour = new Date().getHours()
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:'16px 18px', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <span style={{ fontSize:14 }}>📊</span>
        <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{forecastLabel || _tx('Asi pinta hoy')}</span>
      </div>
      <div style={{ display:'flex', gap:3, alignItems:'flex-end', height:60 }}>
        {data.map(d => {
          const h = Math.max(4, Math.round((d.predicted / max) * 60))
          const isNow = parseInt(d.hour) === nowHour
          return (
            <div key={d.hour} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
              <div style={{ width:'100%', height:h, background:d.color, borderRadius:3, opacity: isNow ? 1 : 0.7, border: isNow ? '2px solid #E8EEF6' : 'none', transition:'height 0.3s' }}/>
              <span style={{ fontSize:8, color: isNow ? C.text : C.text3, fontWeight: isNow ? 700 : 400 }}>{d.hour.slice(0,2)}</span>
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:10, marginTop:10, flexWrap:'wrap' }}>
        {[{l:_tx('Tranquilo'),c:'#34D399'},{l:_tx('Normal'),c:'#F0A84E'},{l:_tx('Fuerte'),c:'#FB923C'},{l:_tx('A tope'),c:'#F87171'}].map(x => (
          <div key={x.l} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:7, height:7, borderRadius:2, background:x.c }}/>
            <span style={{ fontSize:9, color:C.text3 }}>{x.l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
// SECTION: Today's Schedule Timeline
// ══════════════════════════════════════════════════
function TodayTimeline({ reservas, label, lang='es' }: { reservas: any[]; label: string; lang?: string }) {
  const _tx = (s:string) => tx(s, lang)
  const now = new Date()
  const currentHour = now.getHours()
  const currentMin = now.getMinutes()

  // Group by hour
  const byHour = new Map<number, any[]>()
  for (const r of reservas) {
    const t = r.time || r.reservation_time || ''
    const h = parseInt(t.slice(0, 2))
    if (!isNaN(h)) {
      if (!byHour.has(h)) byHour.set(h, [])
      byHour.get(h)!.push(r)
    }
  }

  // Show hours from earliest to latest, min 8h window
  const hours = [...byHour.keys()].sort((a,b) => a - b)
  const minH = hours.length > 0 ? Math.min(hours[0], currentHour) : currentHour
  const maxH = hours.length > 0 ? Math.max(hours[hours.length - 1], currentHour + 2) : currentHour + 4
  const range: number[] = []
  for (let h = minH; h <= maxH; h++) range.push(h)

  if (reservas.length === 0) return null

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🕐</span>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{_tx('Horario de hoy')}</h2>
          <span style={{ fontSize: 11, color: C.text3 }}>{reservas.length} {label.toLowerCase()}</span>
        </div>
        <Link href="/reservas" style={{ fontSize: 11, color: C.amber, fontWeight: 600, textDecoration: 'none' }}>{_tx('Ver todas')} →</Link>
      </div>
      <div style={{ padding: '8px 0', maxHeight: 260, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {range.map(h => {
          const hourRes = byHour.get(h) || []
          const isPast = h < currentHour
          const isCurrent = h === currentHour
          return (
            <div key={h} style={{ display: 'flex', gap: 0, minHeight: hourRes.length > 0 ? 'auto' : 28 }}>
              {/* Time label */}
              <div style={{ width: 52, flexShrink: 0, textAlign: 'right', paddingRight: 12, paddingTop: 4 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--rz-mono)', color: isCurrent ? C.amber : isPast ? C.text3 : C.text2, fontWeight: isCurrent ? 700 : 400 }}>
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
              {/* Timeline line */}
              <div style={{ width: 1, background: isCurrent ? C.amber : C.border, position: 'relative', flexShrink: 0 }}>
                {isCurrent && <div style={{ position: 'absolute', top: `${Math.round((currentMin / 60) * 100)}%`, left: -3, width: 7, height: 7, borderRadius: '50%', background: C.amber, border: `2px solid ${C.bg}` }} />}
              </div>
              {/* Events */}
              <div style={{ flex: 1, padding: '2px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {hourRes.map(r => {
                  const statusColor = r.status === 'confirmada' ? C.green : r.status === 'cancelada' ? C.red : C.yellow
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 8, background: `${statusColor}08`, borderLeft: `3px solid ${statusColor}`, opacity: isPast ? 0.6 : 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.customer_name || _tx('Sin nombre')}</span>
                      <span style={{ fontSize: 10, color: C.text3 }}>{(r.time || r.reservation_time || '').slice(0, 5)}</span>
                      <span style={{ fontSize: 10, color: C.text3 }}>{r.people || r.party_size || 1}p</span>
                      {r.source === 'voice_agent' && <span style={{ fontSize: 9, color: C.violet, fontWeight: 600 }}>AI</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
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
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [pendingNotifs, setPendingNotifs] = useState(0)
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
    const [{ data:t },{ data:c },{ data:r },{ data:cl },{ data:ac },{ data:ao },{ data:ac2 },{ data:notifs }] = await Promise.all([
      supabase.from('tenants').select('id,name,slug,type,plan,agent_name,agent_phone,free_calls_used,free_calls_limit,plan_calls_used,plan_calls_included,reservation_config,agent_config,language').eq('id',tid).maybeSingle(),
      supabase.from('calls').select('id,call_sid,status,intent,summary,started_at,duration_seconds,caller_phone,customer_name,from_number,decision_status,decision_flags,decision_confidence,session_state').eq('tenant_id',tid).order('started_at',{ascending:false}).limit(8),
      supabase.from('reservations').select('id,customer_name,customer_phone,date,time,reservation_time,people,party_size,status,source,notes').eq('tenant_id',tid).eq('date',today).order('time'),
      supabase.from('customers').select('id').eq('tenant_id',tid),
      supabase.from('calls').select('id,call_sid,caller_phone,session_state,started_at').eq('tenant_id',tid).eq('status','activa').order('started_at',{ascending:false}).limit(8),
      supabase.from('order_events').select('*').eq('tenant_id',tid).eq('status','collecting').order('created_at',{ascending:false}).limit(5),
      supabase.from('consultation_events').select('*').eq('tenant_id',tid).eq('status','collecting').order('created_at',{ascending:false}).limit(5),
      supabase.from('notifications').select('id', { count: 'exact' }).eq('tenant_id',tid).eq('read',false),
    ])
    setTenant(t); setCalls(c||[]); setReservas(r||[]); setClientes(cl||[]); setActiveCalls(ac||[])
    setActiveOrders(ao||[]); setActiveConsultations(ac2||[])
    setPendingNotifs(notifs?.length || 0)
    setLoading(false)

    // Load insights + forecast + yesterday's summary after main data
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const headers = { 'Authorization': 'Bearer ' + token }
    fetch('/api/insights', { headers }).then(r => r.json()).then(d => setInsights(d.insights || [])).catch(() => {})
    fetch('/api/peak-prediction', { headers }).then(r => r.json()).then(d => setForecast(d.forecast || [])).catch(() => {})

    // Load yesterday's summary
    const yd = new Date(); yd.setDate(yd.getDate() - 1)
    const ydStr = yd.toISOString().slice(0, 10)
    supabase.from('daily_summaries')
      .select('*').eq('tenant_id', tid).eq('date', ydStr).maybeSingle()
      .then(({ data }) => { if (data) setDaySummary(data) })
  }, [router])

  useEffect(() => { load() }, [load])

  // Real-time subscription
  const rtKey = tenant ? `${tenant.id}::${tenant.type||'otro'}` : null

  useEffect(() => {
    if (!rtKey || !tenant) return
    const tenantId   = tenant.id
    const tenantType = tenant.type || 'otro'
    const rtLang = tenant.language || 'es'
    const _rtx = (s:string) => tx(s, rtLang)
    const rtEvt = getEventConfig(tenantType)
    const rtSM = getSchemaMap(rtEvt.eventLabel)
    if (rtChannelRef.current) {
      supabase.removeChannel(rtChannelRef.current)
      rtChannelRef.current = null
    }
    const ch = supabase.channel('panel-rt-v5-' + tenantId)
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'calls', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const c = payload.new as any
        const schType = INTENT_MAP[c.intent||'otro'] || 'inquiry'
        const sch = rtSM[schType]
        pushEvent({ type:'call_incoming' as any, icon:'📞', color:C.teal, title:`${_rtx('Llamada entrante')} — ${c.caller_phone||_rtx('Numero oculto')}`, sub: sch ? `${sch.icon} ${_rtx(sch.label)} ${_rtx('detectada')}` : '', priority:'high' })
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
        setPendingNotifs(prev => prev + 1)
      })
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'order_events', filter:`tenant_id=eq.${tenantId}` }, payload => {
        const o = payload.new as any
        setActiveOrders(prev => [o, ...prev.filter(x => x.id !== o.id)].slice(0,5))
        const itemList = Array.isArray(o.items) && o.items.length > 0
          ? o.items.map((i:any)=>`${i.quantity||1}x ${i.name}`).join(', ')
          : _rtx('tomando pedido...')
        pushEvent({ type:'order' as any, icon:'🛍️', color:C.violet,
          title:`${_rtx('Nuevo pedido')} — ${o.customer_name||o.customer_phone||_rtx('Cliente')}`,
          sub:`${itemList} · ${_rtx(o.order_type||'recoger')}`, priority:'high' })
        const alertMode = tenant?.agent_config?.order_alert_mode || 'banner'
        if (alertMode !== 'none') {
          try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZiYl5OSjYeFgoB/f4GDhYmNkJKUlZWUko+MiIWCf31+f4GDhYmMj5GTlJWVlJKQjYmGg4B+fX5/gYSHioyPkZOUlZWUkpCNiYaDgH5+fn+BhIeKjI+Rk5SVlZSSkI2JhoOAfn5+f4GEh4qMj5GTlJWVlJKQjYmGg4B+fn5/gYSHioyPkZOUlZWUkpCNiYaDgH5+fn+BhIeKjI+Rk5SVlQ==').play() } catch {}
          if (alertMode === 'redirect') {
            window.location.href = '/pedidos'
          } else {
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
              ? o.items.map((i:any)=>`${i.quantity||1}x ${i.name}`).join(', ')
              : 'pedido'
            pushEvent({ type:'order' as any, icon:'✅', color:C.green,
              title:`${_rtx('Pedido confirmado')} — ${o.customer_name||_rtx('Cliente')}`,
              sub:itemList, priority:'high' })
          }
        }
      })
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
              sub: ce.symptoms?.slice(0,60) || _rtx('Requiere atencion inmediata'),
              priority:'high' })
          }
        }
      })
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
            sub: 'Nueva conversacion entrante',
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
      .subscribe()
    rtChannelRef.current = ch
    return () => {
      if (rtChannelRef.current) {
        supabase.removeChannel(rtChannelRef.current)
        rtChannelRef.current = null
      }
    }
  }, [rtKey]) // eslint-disable-line

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
  const greeting  = hour<13?_tx('Buenos dias'):hour<20?_tx('Buenas tardes'):_tx('Buenas noches')
  const todayCalls= calls.filter(c=>c.started_at?.slice(0,10)===new Date().toISOString().split('T')[0])
  const agentName = tenant.agent_name || 'Sofia'

  // ── Build "Needs Attention" items from real data
  const attentionItems: { id: string; icon: string; color: string; title: string; sub: string; action: string; href: string; urgency: 'critical'|'warning'|'info' }[] = []

  // Missed calls that need callback
  const missedCalls = calls.filter(c => (c.status === 'perdida' || c.status === 'no-answer') && c.caller_phone && c.caller_phone !== 'anonymous')
  if (missedCalls.length > 0) {
    attentionItems.push({
      id: 'missed-calls', icon: '📞', color: C.red, urgency: 'critical',
      title: `${missedCalls.length} ${_tx(missedCalls.length !== 1 ? 'llamadas perdidas' : 'llamada perdida')}`,
      sub: missedCalls[0].caller_phone + (missedCalls.length > 1 ? ` ${_tx('y')} ${missedCalls.length - 1} ${_tx('mas')}` : ''),
      action: _tx('Devolver llamada'), href: '/llamadas',
    })
  }

  // Pending reservations needing confirmation
  const pendingRes = reservas.filter(r => r.status === 'pendiente' || r.status === 'pending' || r.status === 'pending_review')
  if (pendingRes.length > 0) {
    attentionItems.push({
      id: 'pending-res', icon: '📅', color: C.yellow, urgency: 'warning',
      title: `${pendingRes.length} ${L.reservas.toLowerCase()} ${_tx('por confirmar')}`,
      sub: pendingRes.map(r => r.customer_name || _tx('Sin nombre')).slice(0, 2).join(', ') + (pendingRes.length > 2 ? '...' : ''),
      action: _tx('Revisar'), href: '/reservas',
    })
  }

  // Calls needing human attention
  const needsAttention = calls.filter(c => c.decision_status === 'needs_human_attention' || c.decision_status === 'pending_review')
  if (needsAttention.length > 0) {
    attentionItems.push({
      id: 'needs-review', icon: '⚠️', color: C.amber, urgency: 'warning',
      title: `${needsAttention.length} ${_tx(needsAttention.length !== 1 ? 'llamadas requieren tu revision' : 'llamada requiere tu revision')}`,
      sub: agentName + ' ' + _tx('no pudo resolverlo automaticamente'),
      action: _tx('Ver detalle'), href: '/llamadas',
    })
  }

  // Active consultations with urgency
  const urgentConsultations = activeConsultations.filter((c: any) => c.is_urgency)
  if (urgentConsultations.length > 0) {
    attentionItems.push({
      id: 'urgent-consult', icon: '🚨', color: C.red, urgency: 'critical',
      title: `${urgentConsultations.length} ${_tx('urgencia detectada')}`,
      sub: urgentConsultations[0].patient_name || _tx('Paciente'),
      action: _tx('Atender'), href: '/reservas',
    })
  }

  // Trial running out
  if (isTrial && callsLeft <= 3 && callsLeft > 0) {
    attentionItems.push({
      id: 'trial-low', icon: '⚡', color: C.amber, urgency: 'info',
      title: `${_tx('Solo quedan')} ${callsLeft} ${_tx('llamadas del trial')}`,
      sub: _tx('Activa un plan para no perder llamadas'),
      action: _tx('Ver planes'), href: '/precios',
    })
  }

  // ── Build Quick Actions based on business type
  const quickActions: { id: string; icon: string; label: string; href: string; color?: string }[] = [
    { id: 'new-res', icon: '📅', label: `${_tx('Nueva')} ${L.reserva?.toLowerCase() || _tx('reserva')}`, href: '/reservas/nueva', color: C.teal },
    { id: 'view-calls', icon: '📞', label: _tx('Ver llamadas'), href: '/llamadas', color: C.amber },
    { id: 'messages', icon: '💬', label: _tx('Mensajes'), href: '/mensajes', color: C.blue },
    { id: 'clients', icon: '👥', label: L.clientes || _tx('Clientes'), href: '/clientes', color: C.violet },
  ]
  if (tenant.type === 'restaurante' || tenant.type === 'bar' || tenant.type === 'cafeteria') {
    quickActions.push({ id: 'orders', icon: '🛍️', label: _tx('Pedidos'), href: '/pedidos', color: C.violet })
  }
  quickActions.push({ id: 'agent', icon: '🤖', label: agentName, href: '/agente', color: C.teal })

  // Confirmed reservations count
  const confirmedRes = reservas.filter(r => r.status === 'confirmada' || r.status === 'confirmed').length
  // Next upcoming reservation
  const now = new Date()
  const upcoming = reservas.filter(r => {
    const t = r.time || r.reservation_time || ''
    const [h, m] = t.split(':').map(Number)
    return (r.status === 'confirmada' || r.status === 'pendiente') && (h > now.getHours() || (h === now.getHours() && m > now.getMinutes()))
  })
  const nextRes = upcoming[0]

  return (
    <div style={{ minHeight:'100vh',background:C.bg,fontFamily:'var(--rz-font)' }}>
      <style>{`
        @keyframes rzSlideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rz-pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .rz-live-dot{width:8px;height:8px;border-radius:50%;background:#34D399;animation:rz-pulse 1.5s ease-in-out infinite}
      `}</style>

      {/* ── Header ── */}
      <div style={{ background:'rgba(19,25,32,0.85)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',borderBottom:`1px solid ${C.border}`,padding:'12px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:20 }}>
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
            {attentionItems.length > 0 && activeCalls.length === 0 && (
              <div style={{ display:'flex',alignItems:'center',gap:5,padding:'3px 10px',background:C.amberDim,borderRadius:20,border:`1px solid ${C.amber}30` }}>
                <span style={{ fontSize:11,fontWeight:600,color:C.amber }}>{attentionItems.length} {_tx('pendiente' + (attentionItems.length !== 1 ? 's' : ''))}</span>
              </div>
            )}
          </div>
          <p style={{ fontSize:11,color:C.text3,marginTop:1,textTransform:'capitalize' }}>{new Date().toLocaleDateString(lang==='es'?'es-ES':lang==='en'?'en-GB':lang==='fr'?'fr-FR':lang==='pt'?'pt-PT':'ca-ES',{weekday:'long',day:'numeric',month:'long'})}</p>
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
            <p style={{ fontSize:15, fontWeight:700, color:'white' }}>{_tx('Nuevo pedido de')} {orderAlert.name}</p>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.8)' }}>{_tx('Para')} {orderAlert.type} · {_tx('Toca para ver en pedidos')}</p>
          </div>
          <span style={{ fontSize:13, color:'rgba(255,255,255,0.6)', marginLeft:'auto' }}>{_tx('Ver pedidos')} →</span>
          <button onClick={e => { e.stopPropagation(); setOrderAlert(null) }} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8, padding:'4px 10px', color:'white', cursor:'pointer', fontSize:14, marginLeft:8 }} aria-label="Cerrar">✕</button>
        </div>
      )}

      <div className="rz-page-enter" style={{ maxWidth:1200,margin:'0 auto',padding:'20px 28px',display:'flex',flexDirection:'column',gap:14 }}>

        {/* ══ SECTION 1: Quick Actions ══ */}
        <QuickActions actions={quickActions} lang={lang} />

        {/* ══ SECTION 2: Needs Attention (only if items exist) ══ */}
        <NeedsAttentionSection items={attentionItems} lang={lang} />

        {/* ══ SECTION 3: Active calls / orders / consultations — LIVE ══ */}
        {activeCalls.length > 0 && (
          <div style={{ background:`linear-gradient(135deg,${C.surface},${C.surface2})`,border:`1px solid ${C.teal}25`,borderRadius:16,padding:'16px 18px',position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.teal}50,transparent)` }}/>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
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

        {activeOrders.length > 0 && (
          <div style={{ background:`linear-gradient(135deg,${C.surface},${C.surface2})`,border:`1px solid ${C.violet}25`,borderRadius:16,padding:'16px 18px',position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.violet}50,transparent)` }}/>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <div style={{ width:8,height:8,borderRadius:'50%',background:C.violet,animation:'rz-pulse 1.5s ease-in-out infinite' }}/>
                <span style={{ fontSize:14,fontWeight:700,color:C.text }}>🛍️ {activeOrders.length} {_tx(activeOrders.length!==1?'pedidos en curso':'pedido en curso')}</span>
              </div>
              <Link href="/pedidos" style={{ fontSize:11,color:C.violet,fontWeight:600,textDecoration:'none' }}>{_tx('Ver pedidos')} →</Link>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {activeOrders.map(order=>{
                const items = Array.isArray(order.items) ? order.items : []
                const itemStr = items.map((i:any)=>`${i.quantity||1}x ${i.name}`).join(', ')
                return (
                  <div key={order.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:C.surface2,borderRadius:11,border:`1px solid ${C.violet}20` }}>
                    <div style={{ width:32,height:32,borderRadius:'50%',background:`${C.violet}18`,border:`1.5px solid ${C.violet}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14 }}>🛍️</div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <p style={{ fontSize:12,fontWeight:600,color:C.text,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                        {order.customer_name||order.customer_phone||'Cliente'}
                        <span style={{ fontSize:9,color:C.violet,marginLeft:8,padding:'1px 6px',borderRadius:8,background:`${C.violet}15`,fontWeight:600 }}>{order.order_type}</span>
                      </p>
                      <p style={{ fontSize:11,color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                        {itemStr||_tx('Tomando pedido...')}{order.pickup_time?` · ${_tx('Recogida')} ${order.pickup_time}`:''}
                      </p>
                    </div>
                    {order.total_estimate && <span style={{ fontFamily:'var(--rz-mono)',fontSize:12,color:C.violet,flexShrink:0 }}>{order.total_estimate.toFixed(2)}EUR</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeConsultations.length > 0 && (
          <div style={{ background:`linear-gradient(135deg,${C.surface},${C.surface2})`,border:`1px solid ${C.teal}25`,borderRadius:16,padding:'16px 18px',position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.teal}50,transparent)` }}/>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <div style={{ width:8,height:8,borderRadius:'50%',background:C.teal,animation:'rz-pulse 1.5s ease-in-out infinite' }}/>
                <span style={{ fontSize:14,fontWeight:700,color:C.text }}>⚕️ {activeConsultations.length} {_tx(activeConsultations.length!==1?'consultas en curso':'consulta en curso')}</span>
              </div>
              <Link href="/reservas" style={{ fontSize:11,color:C.teal,fontWeight:600,textDecoration:'none' }}>{_tx('Ver citas')} →</Link>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {activeConsultations.map((ce: any) => {
                const isUrgent = ce.is_urgency
                const borderCol = isUrgent ? C.red : C.teal
                const bgIcon = isUrgent ? C.red : C.teal
                return (
                  <div key={ce.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:C.surface2,borderRadius:11,border:`1px solid ${borderCol}20` }}>
                    <div style={{ width:32,height:32,borderRadius:'50%',background:`${bgIcon}18`,border:`1.5px solid ${bgIcon}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14 }}>
                      {isUrgent ? '🚨' : '⚕️'}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                        <p style={{ fontSize:12,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                          {ce.patient_name||ce.patient_phone||'Paciente'}
                        </p>
                        {isUrgent && <span style={{ fontSize:9,color:C.red,fontWeight:700,padding:'1px 6px',borderRadius:8,background:`${C.red}15`,flexShrink:0 }}>{_tx('URGENTE')}</span>}
                        {!isUrgent && ce.consultation_type && <span style={{ fontSize:9,color:C.teal,padding:'1px 6px',borderRadius:8,background:`${C.teal}15`,fontWeight:600,flexShrink:0 }}>{ce.consultation_type}</span>}
                      </div>
                      <p style={{ fontSize:11,color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                        {ce.symptoms ? ce.symptoms.slice(0,60) : `${ce.duration_minutes||20}min${ce.is_new_patient?' · '+_tx('Primera visita'):''}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ SECTION 4: KPIs — compact row ══ */}
        <div className="rz-grid-4col" style={{ gap:10 }}>
          <KpiCard value={todayCalls.length} label={_tx('Llamadas hoy')} icon="📞" color={C.amber} accent href="/llamadas"/>
          <KpiCard value={reservas.length} label={`${L.reservas} ${_tx('hoy')}`} sub={`${confirmedRes} ${_tx('confirmadas')}${nextRes ? ` · ${_tx('prox')}: ${(nextRes.time||nextRes.reservation_time||'').slice(0,5)}` : ''}`} icon="📅" color={C.teal} accent href="/reservas"/>
          <KpiCard value={clientes.length} label={L.clientes} icon="👥" color={C.violet} href="/clientes"/>
          <KpiCard value={isTrial?callsLeft:`${callsUsed}/${callsLimit}`} label={isTrial?_tx('Llamadas restantes'):_tx('Uso del plan')} sub={planLabel} icon={isTrial?'⚡':'📊'} color={callsLeft<=3?C.red:planColor} accent={isTrial} href="/facturacion"/>
        </div>

        {/* ══ SECTION 5: Yesterday's summary (collapsed by default) ══ */}
        {daySummary && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <button onClick={() => setSummaryOpen(!summaryOpen)} style={{
              width: '100%', padding: '12px 18px', border: 'none', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>📊</span>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{_tx('Resumen de ayer')}</span>
                {daySummary.highlights?.length > 0 && (
                  <span style={{ fontSize: 11, color: C.text3 }}>— {daySummary.highlights[0]?.title}</span>
                )}
              </div>
              <span style={{ color: C.text3, fontSize: 11, transform: summaryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
            </button>
            {summaryOpen && (
              <div style={{ padding: '0 18px 14px', borderTop: `1px solid ${C.border}` }}>
                {daySummary.channel_breakdown && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                    {Object.entries(daySummary.channel_breakdown as Record<string, any>).map(([ch, data]: [string, any]) => (
                      <div key={ch} style={{ padding: '6px 12px', borderRadius: 8, background: C.surface2, border: `1px solid ${C.border}`, minWidth: 80 }}>
                        <div style={{ fontSize: 10, color: C.text3, fontWeight: 600 }}>
                          {ch === 'voice' ? 'Llamadas' : ch === 'whatsapp' ? 'WhatsApp' : ch === 'email' ? 'Email' : 'SMS'}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 2 }}>{data.count}</div>
                        {data.escalated > 0 && <div style={{ fontSize: 9, color: C.red, marginTop: 2 }}>{data.escalated} escaladas</div>}
                      </div>
                    ))}
                  </div>
                )}
                {daySummary.highlights?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {(daySummary.highlights as any[]).map((h: any, i: number) => (
                      <div key={i} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: h.type === 'positive' ? C.green : h.type === 'warning' ? C.yellow : C.blue }} />
                        <span style={{ fontSize: 12, color: C.text }}>{h.title}</span>
                        <span style={{ fontSize: 11, color: C.text3 }}>{h.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                {daySummary.pending_actions?.length > 0 && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: C.amberDim, borderRadius: 8, border: `1px solid ${C.amber}20` }}>
                    <div style={{ fontSize: 10, color: C.amber, fontWeight: 700, marginBottom: 3 }}>{_tx('Pendiente')}</div>
                    {(daySummary.pending_actions as string[]).map((a: string, i: number) => (
                      <div key={i} style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>• {a}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ SECTION 6: Main grid — 3 columns on desktop ══ */}
        <div className="rz-grid-2col" style={{ gap: 14 }}>

          {/* LEFT: Calls + Schedule */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Recent calls */}
            <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden' }}>
              <div style={{ padding:'12px 18px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <h2 style={{ fontSize:13,fontWeight:700,color:C.text }}>{cs.recentCalls}</h2>
                <Link href="/llamadas" style={{ fontSize:11,color:C.amber,fontWeight:600,textDecoration:'none' }}>{cs.viewAll}</Link>
              </div>
              {calls.length===0 ? (
                <div style={{ padding:'40px 18px',textAlign:'center' }}>
                  <div style={{ width:48,height:48,borderRadius:'50%',background:'rgba(45,212,191,0.08)',border:'1px solid rgba(45,212,191,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:20 }}>📞</div>
                  <p style={{ fontSize:14,fontWeight:700,color:C.text,marginBottom:6 }}>{agentOn ? agentName + ' ' + _tx('esta lista') : _tx('Configura tu agente')}</p>
                  <p style={{ fontSize:12,color:C.text3,lineHeight:1.6,maxWidth:260,margin:'0 auto' }}>
                    {agentOn ? _tx('Las llamadas apareceran aqui en tiempo real.') : _tx('Configura tu numero de telefono para empezar.')}
                  </p>
                  {!agentOn && <Link href="/configuracion" style={{ display:'inline-block',marginTop:14,padding:'8px 18px',fontSize:12,fontWeight:600,color:'#0C1018',background:C.amber,borderRadius:8,textDecoration:'none' }}>{_tx('Configurar')} →</Link>}
                </div>
              ) : calls.map((call,i)=><CallRow key={call.id} call={call} idx={i} businessType={tenant.type||'otro'} lang={lang} eventLabel={evtCfg.eventLabel}/>)}
            </div>

            {/* Today's schedule timeline */}
            <TodayTimeline reservas={reservas} label={L.reservas} lang={lang} />

            {/* Forecast */}
            {forecast.length > 0 && <ForecastChart data={forecast} forecastLabel={cs.forecast} lang={lang}/>}
          </div>

          {/* RIGHT: Live feed + Insights + Messages */}
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>

            {/* Live feed */}
            <LiveFeed events={events} demoMode={demoMode} onToggleDemo={toggleDemo} lang={lang}/>

            {/* Agent insights */}
            <InsightsPanel insights={insights} headerLabel={panelT.insights.detected} lang={lang} agentName={agentName}/>

            {/* Multichannel quick access */}
            <Link href="/mensajes" style={{ textDecoration:'none' }}>
              <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',transition:'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderMd; (e.currentTarget as HTMLElement).style.background = C.surface2 }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.background = C.surface }}>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <span style={{ fontSize:16 }}>💬</span>
                  <div>
                    <span style={{ fontSize:13,fontWeight:700,color:C.text }}>{_tx('Mensajes')}</span>
                    <p style={{ fontSize:10,color:C.text3,marginTop:1 }}>WhatsApp · Email · SMS</p>
                  </div>
                </div>
                <span style={{ fontSize:11,color:C.amber,fontWeight:600 }}>→</span>
              </div>
            </Link>

            {/* Trial usage */}
            {isTrial && (
              <div style={{ background:C.surface,border:`1px solid ${callsLeft<=3?C.red+'30':C.border}`,borderRadius:12,padding:'14px 16px' }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 }}>
                  <span style={{ fontSize:12,fontWeight:600,color:C.text }}>{_tx('Trial gratuito')}</span>
                  <span style={{ fontFamily:'var(--rz-mono)',fontSize:12,fontWeight:600,color:callsLeft<=3?C.red:C.text }}>{callsUsed}<span style={{ color:C.text3 }}> / {callsLimit}</span></span>
                </div>
                <div style={{ height:4,background:'rgba(255,255,255,0.05)',borderRadius:3,overflow:'hidden',marginBottom:6 }}>
                  <div style={{ height:'100%',width:`${Math.min(100,Math.round(callsUsed/callsLimit*100))}%`,background:callsLeft<=3?C.red:callsUsed/callsLimit>0.7?C.yellow:C.amber,borderRadius:3,transition:'width 0.6s ease' }}/>
                </div>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <p style={{ fontSize:10,color:C.text3 }}>{callsLeft} {_tx('llamadas restantes')}</p>
                  <Link href="/precios" style={{ fontSize:10,color:C.amber,fontWeight:700,textDecoration:'none' }}>{_tx('Activar plan')} →</Link>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  )
}
