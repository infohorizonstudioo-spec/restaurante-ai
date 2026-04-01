'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader, PageSkeleton } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { getCommonStrings } from '@/lib/i18n'
import VetClientesView from './VetClientesView'
import FisioClientesView from './FisioClientesView'
import PsicoClientesView from './PsicoClientesView'
import InmoClientesView from './InmoClientesView'
import AsesorClientesView from './AsesorClientesView'
import AcademiaAlumnosView from './AcademiaAlumnosView'
import BarbeClientesView from './BarbeClientesView'
import EcomClientesView from './EcomClientesView'
import { C } from '@/lib/colors'
import { useToast } from '@/components/NotificationToast'

// Router — decide qué vista mostrar según el tipo de negocio
export default function ClientesPage() {
  const { tenant } = useTenant()
  const type = tenant?.type

  if (type === 'veterinaria')  return <VetClientesView />
  if (type === 'fisioterapia') return <FisioClientesView />
  if (type === 'psicologia')   return <PsicoClientesView />
  if (type === 'inmobiliaria') return <InmoClientesView />
  if (type === 'asesoria' || type === 'seguros') return <AsesorClientesView />
  if (type === 'academia')     return <AcademiaAlumnosView />
  if (type === 'barberia')     return <BarbeClientesView />
  if (type === 'ecommerce')    return <EcomClientesView />

  // Vista por defecto: restaurante / hostelería / otros
  return <DefaultClientesView />
}

// Helpers de tier/riesgo
const TIER_COLORS: Record<string,{color:string,bg:string,label:string}> = {
  excelente: { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Excelente' },
  bueno:     { color: '#2DD4BF', bg: 'rgba(45,212,191,0.12)', label: 'Bueno' },
  normal:    { color: '#8895A7', bg: 'rgba(136,149,167,0.10)', label: 'Normal' },
  atencion:  { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Atenci\u00f3n' },
}
const RISK_COLORS: Record<string,{color:string,bg:string,label:string}> = {
  high:   { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Riesgo alto' },
  medium: { color: '#F0A84E', bg: 'rgba(240,168,78,0.12)', label: 'Riesgo medio' },
}
const SEVERITY_BORDER: Record<string,string> = {
  critical: '#F87171', warning: '#F0A84E', info: '#60A5FA',
}
const MEMORY_ICONS: Record<string,string> = {
  preference: '\u2605', context: '\u2139', interaction: '\u21BB', behavior: '\u26A0',
  suggestion: '\u2728', alert: '\u26A0', relationship: '\u2764', feedback: '\u2709',
}
const EVENT_ICONS: Record<string,{icon:string,color:string}> = {
  visit:                    { icon: '\u2713', color: '#34D399' },
  no_show:                  { icon: '\u2717', color: '#F87171' },
  late_arrival:             { icon: '\u23F1', color: '#F0A84E' },
  call:                     { icon: '\uD83D\uDCDE', color: '#60A5FA' },
  reservation:              { icon: '\uD83D\uDCC5', color: '#2DD4BF' },
  reservation_confirmed:    { icon: '\u2713', color: '#34D399' },
  reservation_cancelled:    { icon: '\u2717', color: '#F87171' },
  order:                    { icon: '\uD83D\uDCE6', color: '#A78BFA' },
  complaint:                { icon: '\u26A0', color: '#F87171' },
  compliment:               { icon: '\u2764', color: '#34D399' },
  whatsapp:                 { icon: '\uD83D\uDCAC', color: '#34D399' },
  sms:                      { icon: '\u2709', color: '#60A5FA' },
  email:                    { icon: '\u2709', color: '#A78BFA' },
}

// Scoring bar
function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
      <span style={{fontSize:10,color:C.text3,width:68,flexShrink:0}}>{label}</span>
      <div style={{flex:1,height:4,background:C.surface2,borderRadius:2,overflow:'hidden'}}>
        <div style={{width:`${(value/max)*100}%`,height:'100%',background:color,borderRadius:2,transition:'width 0.3s'}}/>
      </div>
      <span style={{fontFamily:'var(--rz-mono)',fontSize:10,color:C.text2,width:20,textAlign:'right' as const}}>{value}</span>
    </div>
  )
}

// Vista por defecto — hostelería y tipos sin vista específica
function DefaultClientesView() {
  const [clientes,setClientes] = useState<any[]>([])
  const [loading,setLoading]   = useState(true)
  const [search,setSearch]     = useState('')
  const [selected,setSelected] = useState<any|null>(null)
  const [historial,setHistorial] = useState<any[]>([])
  const [loadingH,setLoadingH] = useState(false)
  const [editNotes,setEditNotes] = useState('')
  const [editVip,setEditVip] = useState(false)
  const [scores,setScores] = useState<Record<string,any>>({})
  const [memoryData,setMemoryData] = useState<any>(null)
  const { template, t, tx } = useTenant()
  const toast = useToast()
  const cs = getCommonStrings(t.locale)

  const L = template?.labels
  const clientesLabel = L?.clientes || tx('Clientes')

  const load = useCallback(async (tenantId:string) => {
    const {data} = await supabase.from('customers').select('*')
      .eq('tenant_id',tenantId).order('created_at',{ascending:false})
    setClientes(data||[])
    setLoading(false)
  },[])

  useEffect(()=>{
    ;(async()=>{
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle()
      if (!p?.tenant_id) return
      await load(p.tenant_id)
      const sess = await supabase.auth.getSession()
      if (sess.data.session) {
        fetch('/api/customer-scores', { headers: { 'Authorization': 'Bearer ' + sess.data.session.access_token } })
          .then(r => r.json()).then(d => setScores(d.scores || {})).catch(() => {})
      }
    })()
  },[load])

  async function saveCustomerNotes() {
    if (!selected) return
    await supabase.from('customers').update({ notes: editNotes, vip: editVip }).eq('id', selected.id)
    setSelected((prev: any) => prev ? { ...prev, notes: editNotes, vip: editVip } : null)
    setClientes(prev => prev.map(c => c.id === selected.id ? { ...c, notes: editNotes, vip: editVip } : c))
  }

  async function openClient(c:any) {
    setSelected(c); setLoadingH(true); setHistorial([]); setMemoryData(null)
    setEditNotes(c.notes || ''); setEditVip(c.vip || false)
    const [resR, callR] = await Promise.all([
      supabase.from('reservations').select('*').eq('tenant_id',c.tenant_id).eq('customer_id',c.id).order('date',{ascending:false}).limit(10),
      supabase.from('calls').select('*').eq('tenant_id',c.tenant_id).eq('caller_phone',c.phone).order('started_at',{ascending:false}).limit(5),
    ])
    setHistorial([
      ...(resR.data||[]).map(r=>({...r,_type:'reserva'})),
      ...(callR.data||[]).map(c=>({...c,_type:'llamada'})),
    ].sort((a,b)=>{
      const da = a.date||a.reservation_date||a.started_at||''
      const db = b.date||b.reservation_date||b.started_at||''
      return db.localeCompare(da)
    }))
    setLoadingH(false)
    // Load customer memory data
    const sess = await supabase.auth.getSession()
    if (sess.data.session) {
      fetch(`/api/customer-memory?customer_id=${c.id}`, {
        headers: { 'Authorization': 'Bearer ' + sess.data.session.access_token },
      }).then(r => r.json()).then(d => {
        if (!d.error) setMemoryData(d)
      }).catch(() => {})
    }
  }

  if (loading) return <PageSkeleton variant="list"/>

  const filtered = search
    ? clientes.filter(c => (c.name||'').toLowerCase().includes(search.toLowerCase()) || (c.phone||'').includes(search) || (c.email||'').includes(search))
    : clientes

  const tierInfo = memoryData?.scoring ? TIER_COLORS[memoryData.scoring.loyalty_tier] || TIER_COLORS.normal : null
  const riskInfo = memoryData?.scoring?.risk_level ? RISK_COLORS[memoryData.scoring.risk_level] : null
  const memories = (memoryData?.memories || []).filter((m:any) => m.confidence >= 0.5)
  const alerts = memoryData?.alerts || []
  const events = memoryData?.events || []

  return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{background:C.surface,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',borderBottom:`1px solid ${C.border}`,padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,position:'sticky',top:0,zIndex:20}}>
        <div>
          <h1 style={{fontSize:16,fontWeight:700,color:C.text,letterSpacing:'-0.02em'}}>{clientesLabel}</h1>
          <p style={{fontSize:11,color:C.text3,marginTop:2}}>{clientes.length} {tx('registrados')}</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tx('Buscar')+' '+clientesLabel.toLowerCase()+'\u2026'}
            style={{padding:'8px 14px',fontSize:13,border:`1px solid ${C.borderMd}`,borderRadius:9,outline:'none',width:220,background:C.surface2,color:C.text,fontFamily:'inherit'}}/>
          <NotifBell/>
        </div>
      </div>

      <div className="rz-panel-split rz-page-enter" style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* ── LISTA ── */}
        <div className="rz-panel-list" style={{width:320,flexShrink:0,overflowY:'auto',borderRight:`1px solid ${C.border}`,background:C.surface}}>
          {filtered.length===0 ? (
            <div style={{padding:'64px 24px',textAlign:'center'}}>
              <div style={{position:'relative',display:'inline-block',marginBottom:20}}>
                <div style={{width:64,height:64,borderRadius:18,background:`linear-gradient(135deg,${C.amberDim},rgba(240,168,78,0.04))`,border:`1px solid rgba(240,168,78,0.12)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>\uD83D\uDC65</div>
                <div style={{position:'absolute',inset:-8,borderRadius:24,border:'1px dashed rgba(240,168,78,0.12)',pointerEvents:'none'}}/>
              </div>
              <p style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:8}}>{cs.noClients}</p>
              <p style={{fontSize:13,color:C.text2,lineHeight:1.6,maxWidth:260,margin:'0 auto'}}>{clientesLabel} {tx('se mostrar\u00e1n autom\u00e1ticamente cuando entren.')}</p>
            </div>
          ) : filtered.map(c => {
            const cTier = c.loyalty_tier && c.loyalty_tier !== 'normal' ? TIER_COLORS[c.loyalty_tier] : null
            return (
            <div key={c.id} onClick={()=>openClient(c)} style={{padding:'12px 16px',cursor:'pointer',borderBottom:`1px solid ${C.border}`,background:selected?.id===c.id?C.surface2:'transparent',transition:'background 0.1s'}}
              onMouseEnter={e=>{if(selected?.id!==c.id)(e.currentTarget as HTMLElement).style.background=C.surface2}}
              onMouseLeave={e=>{if(selected?.id!==c.id)(e.currentTarget as HTMLElement).style.background='transparent'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:c.vip?C.yellowDim:C.amberDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:c.vip?C.yellow:C.amber,flexShrink:0}}>
                  {c.name?.[0]?.toUpperCase()||'?'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                    <p style={{fontSize:13,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</p>
                    {c.vip&&<span style={{fontSize:9,fontWeight:700,color:C.yellow,background:C.yellowDim,padding:'1px 5px',borderRadius:4}}>{t.clients.vip}</span>}
                    {cTier&&<span style={{fontSize:9,fontWeight:700,color:cTier.color,background:cTier.bg,padding:'1px 5px',borderRadius:4}}>{cTier.label}</span>}
                    {(c.no_show_count||0)>=3&&<span style={{fontSize:9,fontWeight:700,color:'#F87171',background:'rgba(248,113,113,0.12)',padding:'1px 5px',borderRadius:4}}>{c.no_show_count} NS</span>}
                    {scores[c.id]&&<span style={{fontSize:9,fontWeight:700,color:scores[c.id].color,background:scores[c.id].color+'18',padding:'1px 5px',borderRadius:4}}>{scores[c.id].score}</span>}
                  </div>
                  <p style={{fontSize:11,color:C.text3,marginTop:1}}>{c.phone||c.email||tx('Sin contacto')}</p>
                </div>
                <div style={{textAlign:'right' as const,flexShrink:0}}>
                  <p style={{fontFamily:'var(--rz-mono)',fontSize:11,fontWeight:600,color:scores[c.id]?.color||C.text2}}>{c.total_reservations||c.total_visits||0}</p>
                  {c.last_visit&&<p style={{fontSize:10,color:C.text3,marginTop:1}}>{new Date(c.last_visit).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</p>}
                </div>
              </div>
            </div>
          )})}
        </div>

        {/* ── DETALLE ── */}
        <div className="rz-panel-detail" style={{flex:1,overflowY:'auto',padding:24,background:C.bg}}>
          {!selected ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:C.text3}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:C.amberDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,marginBottom:14}}>\uD83D\uDC64</div>
              <p style={{fontSize:14,color:C.text3}}>{tx('Selecciona un cliente para ver su historial')}</p>
            </div>
          ) : (
            <>
              {/* Card principal */}
              <div className="rz-card-interactive" style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
                  <div style={{width:50,height:50,borderRadius:'50%',background:selected.vip?C.yellowDim:C.amberDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:selected.vip?C.yellow:C.amber}}>
                    {selected.name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <p style={{fontSize:17,fontWeight:700,color:C.text}}>{selected.name}</p>
                      {tierInfo&&tierInfo.label!=='Normal'&&<span style={{fontSize:10,fontWeight:700,color:tierInfo.color,background:tierInfo.bg,padding:'2px 8px',borderRadius:5}}>{tierInfo.label}</span>}
                      {riskInfo&&<span style={{fontSize:10,fontWeight:700,color:riskInfo.color,background:riskInfo.bg,padding:'2px 8px',borderRadius:5}}>{riskInfo.label}</span>}
                      {selected.preferred_language&&selected.preferred_language!=='es'&&<span style={{fontSize:10,fontWeight:600,color:C.text2,background:C.surface2,padding:'2px 6px',borderRadius:4}}>{selected.preferred_language.toUpperCase()}</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:3}}>
                      <p style={{fontSize:13,color:C.text2}}>{selected.phone}{selected.email?' \u00b7 '+selected.email:''}</p>
                      {selected.phone && (
                        <button onClick={async () => {
                          try {
                            const sess = await supabase.auth.getSession()
                            if (!sess.data.session) return
                            const res = await fetch('/api/voice/outbound', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sess.data.session.access_token },
                              body: JSON.stringify({ phone_number: selected.phone, reason: 'callback', customer_name: selected.name })
                            })
                            if (!res.ok) throw new Error()
                            toast.push({ title: tx('Llamando...'), body: selected.name, type: 'call', priority: 'info', icon: '\uD83D\uDCDE' })
                          } catch {
                            toast.push({ title: tx('Error'), body: tx('No se pudo realizar la llamada'), type: 'call', priority: 'critical', icon: '\u26A0\uFE0F' })
                          }
                        }}
                        style={{fontSize:11, padding:'3px 10px', borderRadius:7, border:`1px solid rgba(45,212,191,0.25)`, background:'rgba(45,212,191,0.10)', color:'#2DD4BF', cursor:'pointer', fontFamily:'inherit', fontWeight:500, flexShrink:0}}>
                          \uD83D\uDCDE {tx('Llamar')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats grid — 6 cards */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10,marginBottom:14}}>
                  {[
                    {label:tx('Visitas'),value:selected.visit_count||selected.total_reservations||selected.total_visits||0,color:C.text},
                    {label:tx('\u00daltima visita'),value:selected.last_visit?new Date(selected.last_visit).toLocaleDateString(undefined,{day:'numeric',month:'short'}):'\u2014',color:C.text},
                    {label:tx('Total gastado'),value:selected.total_spend||selected.total_spent?`${selected.total_spend||selected.total_spent}\u20AC`:'\u2014',color:C.text},
                    {label:tx('No-shows'),value:selected.no_show_count||0,color:(selected.no_show_count||0)>=2?'#F87171':C.text},
                    {label:tx('Cancelaciones'),value:selected.cancel_count||0,color:(selected.cancel_count||0)>=3?'#F0A84E':C.text},
                    {label:tx('Retrasos'),value:selected.late_count||0,color:(selected.late_count||0)>=2?'#F0A84E':C.text},
                  ].map(m=>(
                    <div key={m.label} style={{background:C.surface2,borderRadius:9,padding:'8px 12px'}}>
                      <p style={{fontSize:9,color:C.text3,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:2}}>{m.label}</p>
                      <p style={{fontFamily:'var(--rz-mono)',fontSize:16,fontWeight:700,color:m.color}}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Scoring breakdown */}
                {memoryData?.scoring && (
                  <div style={{background:C.surface2,borderRadius:9,padding:'10px 14px',marginBottom:14}}>
                    <p style={{fontSize:9,fontWeight:700,color:C.text3,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:8}}>{tx('Scoring')}</p>
                    <ScoreBar label={tx('Frecuencia')} value={memoryData.scoring.frequency} max={30} color="#2DD4BF"/>
                    <ScoreBar label={tx('Fiabilidad')} value={memoryData.scoring.reliability} max={30} color="#34D399"/>
                    <ScoreBar label={tx('Recencia')} value={memoryData.scoring.recency} max={20} color="#60A5FA"/>
                    <ScoreBar label={tx('Engagement')} value={memoryData.scoring.engagement} max={10} color="#A78BFA"/>
                  </div>
                )}

                {/* Notes + VIP */}
                <div style={{background:C.surface2,borderRadius:9,padding:14}}>
                  <label style={{fontSize:10,fontWeight:700,color:C.text3,textTransform:'uppercase' as const,letterSpacing:'0.06em',display:'block',marginBottom:6}}>{tx('Notas')}</label>
                  <textarea value={editNotes} onChange={e=>setEditNotes(e.target.value)} placeholder={tx('A\u00f1adir notas sobre este cliente\u2026')}
                    style={{width:'100%',minHeight:50,resize:'vertical',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:7,padding:'8px 10px',color:C.text,fontSize:13,fontFamily:'inherit',outline:'none'}}/>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:10}}>
                    <button onClick={()=>setEditVip(!editVip)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:7,border:`1px solid ${editVip?C.yellow:C.border}`,background:editVip?C.yellowDim:'transparent',color:editVip?C.yellow:C.text3,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s'}}>
                      {editVip?`\u2B50 ${t.clients.vip}`:`\u2606 ${t.clients.vip}`}
                    </button>
                    <button onClick={saveCustomerNotes} style={{padding:'6px 16px',borderRadius:7,border:'none',background:C.amber,color:C.bg,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                      {t.common.save}
                    </button>
                  </div>
                </div>
              </div>

              {/* Alertas activas */}
              {alerts.length > 0 && (
                <div style={{marginBottom:16}}>
                  <p style={{fontSize:10,fontWeight:700,color:C.text3,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:8}}>{tx('Alertas activas')} <span style={{color:'#F87171'}}>({alerts.length})</span></p>
                  {alerts.map((a:any,i:number) => (
                    <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${SEVERITY_BORDER[a.severity]||C.border}`,borderRadius:10,padding:'10px 14px',marginBottom:6}}>
                      <p style={{fontSize:13,fontWeight:600,color:C.text}}>{a.title}</p>
                      <p style={{fontSize:12,color:C.text2,marginTop:2}}>{a.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Memoria del cliente */}
              {memories.length > 0 && (
                <div style={{marginBottom:16}}>
                  <p style={{fontSize:10,fontWeight:700,color:C.text3,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:8}}>{tx('Memoria del cliente')}</p>
                  {memories.map((m:any,i:number) => (
                    <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 14px',marginBottom:6,display:'flex',gap:10,alignItems:'flex-start'}}>
                      <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{MEMORY_ICONS[m.memory_type]||'\u2022'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:13,fontWeight:500,color:C.text}}>{m.memory_value}</p>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                          <div style={{flex:1,maxWidth:80,height:3,background:C.surface2,borderRadius:2,overflow:'hidden'}}>
                            <div style={{width:`${m.confidence*100}%`,height:'100%',background:m.confidence>=0.8?'#34D399':m.confidence>=0.6?'#2DD4BF':'#8895A7',borderRadius:2}}/>
                          </div>
                          {(m.reinforced_count||0)>1&&<span style={{fontSize:10,color:C.text3,fontFamily:'var(--rz-mono)'}}>x{m.reinforced_count}</span>}
                          <span style={{fontSize:10,color:C.text3}}>{m.source==='post_call'?'llamada':m.source==='owner'?'manual':m.source==='reservation_system'?'reserva':m.source||'sistema'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline: historial + eventos */}
              <p style={{fontSize:10,fontWeight:700,color:C.text3,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:8}}>{tx('Historial')}</p>
              {loadingH ? <div style={{textAlign:'center' as const,padding:20,color:C.text3}}>{tx('Cargando...')}</div>
              : (historial.length===0 && events.length===0) ? <p style={{fontSize:13,color:C.text3,padding:'20px 0'}}>{cs.noActivity}</p>
              : (() => {
                // Merge historial (reservas+calls) with memory events, sorted desc
                const allItems = [
                  ...historial.map(h => ({
                    ...h,
                    _sortDate: h.date || h.reservation_date || h.started_at || '',
                    _source: 'historial' as const,
                  })),
                  ...events.map((e:any) => ({
                    ...e,
                    _sortDate: e.created_at || '',
                    _source: 'event' as const,
                  })),
                ].sort((a,b) => (b._sortDate||'').localeCompare(a._sortDate||''))

                // Deduplicate by keeping unique combos
                const seen = new Set<string>()
                const unique = allItems.filter(item => {
                  const key = item._source === 'historial'
                    ? `h-${item.id||item._sortDate}`
                    : `e-${item.event_type}-${item._sortDate?.slice(0,16)}`
                  if (seen.has(key)) return false
                  seen.add(key)
                  return true
                })

                return unique.slice(0, 25).map((item, i) => {
                  if (item._source === 'historial') {
                    const h = item as any
                    const isReserva = h._type === 'reserva'
                    const statusColor = h.status === 'no_show' ? '#F87171' : h.status === 'cancelada' ? '#F87171' : h.status === 'completada' ? '#34D399' : C.text3
                    return (
                      <div key={`h-${i}`} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 14px',marginBottom:6,display:'flex',gap:10,transition:'background 0.12s'}}
                        onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)} onMouseLeave={e=>(e.currentTarget.style.background=C.surface)}>
                        <span style={{fontSize:14,flexShrink:0}}>{isReserva?'\uD83D\uDCC5':'\uD83D\uDCDE'}</span>
                        <div style={{flex:1}}>
                          {isReserva ? (
                            <>
                              <p style={{fontSize:13,fontWeight:500,color:C.text}}>{(h.date||h.reservation_date)?.slice(0,10)} {tx('a las')} {(h.time||h.reservation_time||'').slice(0,5)}{h.people>1?` \u00b7 ${h.people}p`:''}</p>
                              <p style={{fontSize:11,color:statusColor,marginTop:1,fontWeight:h.status==='no_show'?600:400}}>{h.status}{h.table_name?` \u00b7 ${h.table_name}`:''}</p>
                            </>
                          ) : (
                            <>
                              <p style={{fontSize:13,fontWeight:500,color:C.text}}>{h.summary||tx('Llamada')}</p>
                              <p style={{fontSize:11,color:C.text3,marginTop:1}}>{(h.started_at||'').slice(0,10)}</p>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  }
                  // Event from customer_events
                  const ev = item as any
                  const evInfo = EVENT_ICONS[ev.event_type] || { icon:'\u2022', color:C.text3 }
                  return (
                    <div key={`e-${i}`} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 14px',marginBottom:6,display:'flex',gap:10,transition:'background 0.12s'}}
                      onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)} onMouseLeave={e=>(e.currentTarget.style.background=C.surface)}>
                      <span style={{fontSize:14,flexShrink:0,color:evInfo.color}}>{evInfo.icon}</span>
                      <div style={{flex:1}}>
                        <p style={{fontSize:13,fontWeight:500,color:C.text}}>{ev.summary || ev.event_type.replace(/_/g,' ')}</p>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:1}}>
                          <p style={{fontSize:11,color:C.text3}}>{(ev.created_at||'').slice(0,10)}</p>
                          {ev.channel&&<span style={{fontSize:10,color:C.text3,background:C.surface2,padding:'0 4px',borderRadius:3}}>{ev.channel}</span>}
                          {ev.sentiment==='negative'&&<span style={{fontSize:10,color:'#F87171'}}>\u25CF</span>}
                          {ev.sentiment==='positive'&&<span style={{fontSize:10,color:'#34D399'}}>\u25CF</span>}
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
