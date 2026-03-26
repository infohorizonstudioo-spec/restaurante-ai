'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSessionTenant } from '@/lib/session-cache'
import { PageLoader, PageSkeleton } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { getCommonStrings, getStatusLabel } from '@/lib/i18n'

// ── Traducciones humanas de estados ──────────────────────────────────────
function getDecisionLabel(status: string, name: string, txFn: (s:string)=>string): string {
  const map: Record<string,string> = {
    confirmed: name + ' ' + txFn('lo confirmó'),
    pending_review: txFn('Revísalo tú'),
    modified: txFn('Modificada'),
    cancelled: txFn('Cancelada'),
    rejected: txFn('No podía atenderse'),
    needs_human_attention: txFn('Necesita tu atención'),
    incomplete: txFn('Sin información suficiente'),
  }
  return map[status] || status
}
const DECISION_CFG: Record<string,{color:string;bg:string;icon:string}> = {
  confirmed:             {color:'#4ADE80', bg:'rgba(74,222,128,0.10)',  icon:'✅'},
  pending_review:        {color:'#FBB53F', bg:'rgba(251,181,63,0.10)',  icon:'👁'},
  modified:              {color:'#60A5FA', bg:'rgba(96,165,250,0.10)',  icon:'✏️'},
  cancelled:             {color:'#F87171', bg:'rgba(248,113,113,0.10)', icon:'✕'},
  rejected:              {color:'#F87171', bg:'rgba(248,113,113,0.10)', icon:'✕'},
  needs_human_attention: {color:'#F0A84E', bg:'rgba(240,168,78,0.12)',  icon:'⚠️'},
  incomplete:            {color:'#8895A7', bg:'rgba(136,149,167,0.10)', icon:'❓'},
}
function getFlagLabel(flag: string, name: string, txFn: (s:string)=>string): string {
  const map: Record<string,string> = {
    large_group: txFn('Grupo grande'),
    allergy_note: txFn('Mencionó alergias o restricciones'),
    specific_table_request: txFn('Petición específica de espacio'),
    low_confidence: name + ' ' + txFn('tuvo dudas'),
    no_availability: txFn('No había hueco'),
    modification_request: txFn('Quería cambiar algo'),
    cancellation_request: txFn('Quería cancelar'),
    special_occasion: txFn('Ocasión especial'),
    accessibility_need: txFn('Necesidades especiales'),
    late_arrival_notice: txFn('Avisó que llega tarde'),
    out_of_policy: txFn('Pedía algo que no ofrecemos'),
    confused_customer: txFn('Tenía dudas'),
    repeat_pattern: txFn('Patrón repetido'),
    urgency: txFn('Urgencia detectada'),
    crisis: txFn('Situación de crisis'),
    first_visit_complex: txFn('Primera visita compleja'),
    surgery: txFn('Cirugía programada'),
    long_stay: txFn('Estancia larga'),
    high_value_order: txFn('Pedido de alto valor'),
    tow_required: txFn('Necesita grúa'),
    return_request: txFn('Solicitud de devolución'),
  }
  return map[flag] || flag.replace(/_/g, ' ')
}
const FLAG_LABELS: Record<string,string> = {
  large_group:'Grupo grande', allergy_note:'Alergias/restricciones', specific_table_request:'Petición de espacio',
  low_confidence:'Tuvo dudas', no_availability:'No había hueco',
  modification_request:'Quería cambiar algo', cancellation_request:'Quería cancelar',
  special_occasion:'Ocasión especial', accessibility_need:'Necesidades especiales',
  late_arrival_notice:'Avisó que llega tarde', out_of_policy:'Fuera de política',
  confused_customer:'Tenía dudas', repeat_pattern:'Patrón repetido',
  urgency:'Urgencia', crisis:'Crisis', first_visit_complex:'Primera visita compleja',
  surgery:'Cirugía', long_stay:'Estancia larga', high_value_order:'Alto valor',
  tow_required:'Necesita grúa', return_request:'Devolución',
}
// Opciones en lenguaje humano para corregir lo que hizo Sofía
const CORRECTION_OPTIONS = [
  {value:'confirmed',             label:'✅ Sí, quedó bien confirmado'},
  {value:'pending_review',        label:'👁 Quiero revisarlo yo'},
  {value:'cancelled',             label:'✕ El cliente canceló'},
  {value:'needs_human_attention', label:'⚠️ Necesita mi atención urgente'},
]
// Traducción de intenciones detectadas
const INTENT_LABELS: Record<string,string> = {
  reserva: 'hacer una reserva', pedido: 'hacer un pedido',
  cancelacion: 'cancelar', consulta: 'preguntar algo', otro: 'otro asunto',
}

import { C } from '@/lib/colors'
const SL:Record<string,string> = {
  completada:'Completada', completed:'Completada',
  activa:'En curso', 'in-progress':'En curso',
  fallida:'Fallida', failed:'Fallida', 'no-answer':'Perdida', perdida:'Perdida',
  pendiente:'Pendiente', pending:'Pendiente'
}
const SC:Record<string,string> = {
  completada:C.green, completed:C.green,
  activa:C.teal, 'in-progress':C.teal,
  fallida:C.red, failed:C.red, 'no-answer':C.red, perdida:C.red,
  pendiente:C.yellow, pending:C.yellow
}
const SB:Record<string,string> = {
  completada:C.greenDim, completed:C.greenDim,
  activa:C.tealDim, 'in-progress':C.tealDim,
  fallida:C.redDim, failed:C.redDim, 'no-answer':C.redDim, perdida:C.redDim,
  pendiente:'rgba(251,181,63,0.10)', pending:'rgba(251,181,63,0.10)'
}

function groupByDate(calls:any[]) {
  const m = new Map<string,any[]>()
  for (const c of calls) {
    const d = (c.started_at||c.created_at||'')?.slice(0,10) || 'Desconocida'
    if (!m.has(d)) m.set(d, []); m.get(d)!.push(c)
  }
  return [...m.entries()].sort((a,b) => b[0].localeCompare(a[0]))
}
function fmt(sec:number|null) {
  if (!sec) return null
  const m = Math.floor(sec/60), s = sec%60
  return m > 0 ? m+'m '+s+'s' : s+'s'
}

export default function LlamadasPage() {
  const { t, tx, tenant: tenantCtx } = useTenant()
  const cs = getCommonStrings(t.locale)
  const agentName = tenantCtx?.agent_name || 'Sofía'
  const [calls,setCalls]       = useState<any[]>([])
  const [loading,setLoading]   = useState(true)
  const [loadingMore,setLoadingMore] = useState(false)
  const [hasMore,setHasMore]   = useState(false)
  const [page,setPage]         = useState(0)
  const PAGE_SIZE = 50
  const [open,setOpen]         = useState<Set<string>>(new Set())
  const [tid,setTid]           = useState<string|null>(null)
  const [filter,setFilter]     = useState<'all'|'completada'|'activa'|'fallida'|'perdida'>('all')
  const [correcting,setCorrecting] = useState<string|null>(null)   // call_sid en modo corrección
  const [feedbackNote,setFeedbackNote] = useState('')
  const [feedbackLoading,setFeedbackLoading] = useState(false)
  const [feedbackDone,setFeedbackDone] = useState<Set<string>>(new Set())
  const [suggestions,setSuggestions] = useState<any[]>([])

  const load = useCallback(async (tenantId:string, reset=true) => {
    if (reset) setLoading(true)
    const from = reset ? 0 : page * PAGE_SIZE
    const { data, count } = await supabase.from('calls').select('id,call_sid,tenant_id,status,intent,summary,started_at,duration_seconds,caller_phone,customer_name,from_number,decision_status,decision_flags,decision_confidence,reasoning_label,action_required,action_suggested,transcript',{count:'exact'})
      .eq('tenant_id',tenantId).order('started_at',{ascending:false})
      .range(from, from + PAGE_SIZE - 1)
    if (reset) { setCalls(data||[]); setPage(1) }
    else { setCalls(prev=>[...prev,...(data||[])]); setPage(p=>p+1) }
    setHasMore((count||0) > (reset ? PAGE_SIZE : (page+1)*PAGE_SIZE))
    setLoading(false); setLoadingMore(false)
  },[page])

  useEffect(() => {
    (async () => {
      const sess = await getSessionTenant(); if(!sess) return
      setTid(sess.tenantId)
    })()
  },[])

  useEffect(() => {
    if (!tid) { setLoading(false); return }
    load(tid, true)
    const ch = supabase.channel('calls-rt-' + tid)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'calls',filter:'tenant_id=eq.'+tid},()=>load(tid,true))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'calls',filter:'tenant_id=eq.'+tid},()=>load(tid,true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  },[tid]) // eslint-disable-line

  if (loading) return <PageSkeleton variant="list"/>

  const filtered = filter==='all' ? calls : calls.filter(c => {
    const s = c.status||''
    if (filter==='completada') return s==='completada'||s==='completed'
    if (filter==='activa')     return s==='activa'||s==='in-progress'
    if (filter==='fallida')    return s==='fallida'||s==='failed'
    if (filter==='perdida')    return s==='perdida'||s==='no-answer'||s==='busy'
    return true
  })
  const groups = groupByDate(filtered)
  const today = new Date().toISOString().slice(0,10)
  const toggle = (id:string) => setOpen(prev => { const n=new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n })

  const sendFeedback = async (callSid: string, correctedStatus: string) => {
    setFeedbackLoading(true)
    try {
      const res = await fetch('/api/voice/feedback', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ call_sid: callSid, corrected_status: correctedStatus, note: feedbackNote || undefined })
      })
      const data = await res.json()
      if (data.ok) {
        // Actualizar localmente sin recargar
        setCalls(prev => prev.map(c => c.call_sid===callSid || c.id===callSid
          ? {...c, decision_status: correctedStatus} : c
        ))
        setFeedbackDone(prev => new Set(prev).add(callSid))
        setCorrecting(null)
        setFeedbackNote('')
        if (data.suggestions?.length > 0) setSuggestions(data.suggestions)
      }
    } catch(e) {
        setFeedbackLoading(false)
      }
    finally { setFeedbackLoading(false) }
  }

  return (
    <div style={{background:C.bg, minHeight:'100vh'}}>
      {/* Header */}
      <div style={{background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, position:'sticky', top:0, zIndex:20}}>
        <div>
          <h1 style={{fontSize:16, fontWeight:700, color:C.text, letterSpacing:'-0.02em'}}>{t.nav.calls}</h1>
          <p style={{fontSize:11, color:C.text3, marginTop:2}}>{calls.length} {cs.callsTotal}</p>
        </div>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {([
            {k:'all',        label:t.common.all,              count:calls.length},
            {k:'completada', label:t.reservations.completed,  count:calls.filter(c=>c.status==='completada'||c.status==='completed').length},
            {k:'perdida',    label:t.agent.callMissed,        count:calls.filter(c=>c.status==='perdida'||c.status==='no-answer'||c.status==='busy').length},
            {k:'fallida',    label:tx('Fallidas'),                 count:calls.filter(c=>c.status==='fallida'||c.status==='failed').length},
          ] as const).map(f => (
            <button key={f.k} onClick={()=>setFilter(f.k as any)}
              style={{fontSize:11, padding:'4px 12px', borderRadius:10, border:'1px solid',
                borderColor: filter===f.k ? SC[f.k==='all'?'completada':f.k] : C.border,
                background:  filter===f.k ? SB[f.k==='all'?'completada':f.k] : 'transparent',
                color:       filter===f.k ? SC[f.k==='all'?'completada':f.k] : C.text3,
                fontWeight:600, cursor:'pointer', fontFamily:'inherit'}}>
              {f.label}{f.count>0&&<span> ({f.count})</span>}
            </button>
          ))}
          <button onClick={async()=>{const s=await supabase.auth.getSession();if(s.data.session)window.open('/api/export?type=calls','_blank')}} style={{padding:'4px 12px',fontSize:11,fontWeight:600,borderRadius:10,border:`1px solid ${C.border}`,background:'transparent',color:C.text3,cursor:'pointer',fontFamily:'inherit'}}>📥 {t.common.export}</button>
        </div>
      </div>

      <div style={{maxWidth:800, margin:'0 auto', padding:'20px 24px'}}>

        {/* Banner de sugerencias de aprendizaje */}
        {suggestions.length>0&&(
          <div style={{background:'rgba(240,168,78,0.08)',border:'1px solid rgba(240,168,78,0.25)',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'flex-start',gap:10}}>
            <span style={{fontSize:18,flexShrink:0}}>🧠</span>
            <div style={{flex:1}}>
              <p style={{fontSize:11, fontWeight:700, color:C.amber, marginBottom:4}}>{agentName + ' ' + tx('ha aprendido algo nuevo')}</p>
              {suggestions.map((s,i)=>(
                <p key={i} style={{fontSize:12,color:C.text2}}>
                  {tx('Ha corregido')} {s.count} {tx('veces llamadas similares')} → {tx('ahora sabrá manejarlas mejor')}
                </p>
              ))}
            </div>
            <button onClick={()=>setSuggestions([])} style={{background:'none',border:'none',color:C.text3,cursor:'pointer',fontSize:16,flexShrink:0}}>✕</button>
          </div>
        )}
        {groups.length===0 ? (
          <div style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'64px 24px', textAlign:'center'}}>
            <div style={{position:'relative',display:'inline-block',marginBottom:20}}>
              <div style={{width:64, height:64, borderRadius:18, background:`linear-gradient(135deg,${C.amberDim},rgba(240,168,78,0.04))`, border:`1px solid rgba(240,168,78,0.12)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26}}>📞</div>
              <div style={{position:'absolute',inset:-8,borderRadius:24,border:'1px dashed rgba(240,168,78,0.12)',pointerEvents:'none'}}/>
            </div>
            <p style={{fontSize:15, fontWeight:700, color:C.text, marginBottom:8}}>{cs.noCalls}</p>
            <p style={{fontSize:13, color:C.text2, lineHeight:1.6, maxWidth:320, margin:'0 auto'}}>{tx('Las llamadas de tus clientes aparecerán aquí en tiempo real con su resumen, intención y decisión del agente.')}</p>
          </div>
        ) : groups.map(([date,dayCalls]) => (
          <div key={date} style={{marginBottom:20}}>
            <p style={{fontSize:10, fontWeight:700, color:C.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10}}>
              {date===today ? tx('HOY') : new Date(date+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()}
              <span style={{marginLeft:8, fontWeight:400}}>({dayCalls.length})</span>
            </p>
            <div style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden'}}>
              {dayCalls.map((call,i) => {
                const expanded = open.has(call.id)
                const phone = call.caller_phone||call.from_number||tx('Número oculto')
                const status = call.status||'completed'
                const dur = fmt(call.duration_seconds||call.duration)
                return (
                  <div key={call.id} style={{borderTop:i>0?`1px solid ${C.border}`:'none'}}>
                    <div onClick={()=>toggle(call.id)} style={{display:'flex', alignItems:'center', gap:12, padding:'13px 16px', cursor:'pointer', transition:'background 0.12s'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=C.surface2}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <div style={{width:36, height:36, borderRadius:'50%', background:SB[status]||C.surface2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={SC[status]||C.text3}><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                      </div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:3}}>
                          <p style={{fontSize:13, fontWeight:600, color:C.text}}>{phone}</p>
                          <span style={{fontSize:10, padding:'2px 8px', borderRadius:8, background:SB[status], color:SC[status], fontWeight:700, flexShrink:0}}>{getStatusLabel(status, t.locale)}</span>
                          {call.intent&&call.intent!=='consulta'&&<span style={{fontSize:10, padding:'2px 8px', borderRadius:8, background:C.violetDim, color:C.violet, fontWeight:600, textTransform:'capitalize'}}>{call.intent}</span>}
                        </div>
                        {call.summary ? <p style={{fontSize:12, color:C.text2, lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{call.summary}</p> : <p style={{fontSize:12, color:C.text3}}>{tx('Sin resumen')}</p>}
                      </div>
                      <div style={{flexShrink:0, textAlign:'right'}}>
                        <p style={{fontSize:11, color:C.text3}}>{(call.started_at||call.created_at) ? new Date(call.started_at||call.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : ''}</p>
                        {dur&&<p style={{fontFamily:'var(--rz-mono)', fontSize:11, color:C.text3, marginTop:2}}>{dur}</p>}
                      </div>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2" style={{flexShrink:0, transform:expanded?'rotate(180deg)':'none', transition:'transform 0.2s'}}><path d="M19 9l-7 7-7-7"/></svg>
                    </div>
                    {expanded && (
                      <div style={{padding:'12px 16px 16px', borderTop:`1px solid ${C.border}`, background:C.surface2}}>
                        {/* Resumen */}
                        {call.summary&&<div style={{background:C.surface3, borderRadius:9, padding:'10px 14px', marginBottom:10}}><p style={{fontSize:10, fontWeight:700, color:C.text3, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em'}}>{tx('Resumen')}</p><p style={{fontSize:13, color:C.text, lineHeight:1.6}}>{call.summary}</p></div>}
                        {/* Acción requerida */}
                        {(call.action_suggested||call.action_required)&&<div style={{background:`${C.amber}10`, borderRadius:9, padding:'8px 14px', marginBottom:10, border:`1px solid ${C.amber}20`}}><p style={{fontSize:10, fontWeight:700, color:C.amber, marginBottom:2, textTransform:'uppercase', letterSpacing:'0.05em'}}>{tx('Acción')}</p><p style={{fontSize:13, color:C.amber}}>{call.action_suggested||call.action_required}</p></div>}

                        {/* Estado de decisión + flags — en lenguaje humano */}
                        {(call.decision_status||call.decision_flags?.length>0) && (
                          <div style={{background:C.surface3, borderRadius:9, padding:'10px 14px', marginBottom:10}}>
                            <p style={{fontSize:10, fontWeight:700, color:C.text3, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em'}}>{tx('Lo que hizo')} {agentName}</p>
                            <div style={{display:'flex', flexWrap:'wrap', gap:6, alignItems:'center'}}>
                              {call.decision_status&&(()=>{
                                const dcfg = DECISION_CFG[call.decision_status]
                                return dcfg ? (
                                  <span style={{fontSize:12, padding:'4px 12px', borderRadius:8, background:dcfg.bg, color:dcfg.color, fontWeight:700}}>
                                    {dcfg.icon} {getDecisionLabel(call.decision_status, agentName, tx)}
                                  </span>
                                ) : null
                              })()}
                              {/* Confianza traducida a lenguaje humano */}
                              {call.decision_confidence!=null&&(
                                <span style={{fontSize:11, color:C.text3}}>
                                  {call.decision_confidence>=0.8
                                    ? '✓ '+tx('Entendió bien la llamada')
                                    : call.decision_confidence>=0.55
                                    ? '~ '+tx('Tuvo algunas dudas')
                                    : '? '+tx('Tuvo dificultades para entender')}
                                </span>
                              )}
                              {/* Flags en lenguaje humano */}
                              {(call.decision_flags||[]).map((f:string)=>(
                                <span key={f} style={{fontSize:10, padding:'2px 8px', borderRadius:6, background:'rgba(167,139,250,0.12)', color:'#A78BFA', fontWeight:600}}>
                                  {getFlagLabel(f, agentName, tx)}
                                </span>
                              ))}
                            </div>
                            {/* Razón en lenguaje humano — ocultar jerga técnica */}
                            {call.reasoning_label && !call.reasoning_label.includes('_') && (
                              <p style={{fontSize:11, color:C.text3, marginTop:6, fontStyle:'italic'}}>
                                💭 {call.reasoning_label}
                              </p>
                            )}
                            {/* Detalles técnicos — ocultos por defecto, solo para curiosos */}
                            {(call.decision_trace?.length > 0) && (
                              <details style={{marginTop:8}}>
                                <summary style={{fontSize:10, color:C.text3, cursor:'pointer', userSelect:'none' as const}}>{tx('Ver detalles técnicos')}</summary>
                                <div style={{marginTop:6, display:'flex', flexDirection:'column', gap:4}}>
                                  {call.decision_trace.map((step:any,i:number)=>(
                                    <div key={i} style={{display:'flex', gap:8, alignItems:'baseline', fontSize:11}}>
                                      <span style={{color:C.text3, flexShrink:0}}>→</span>
                                      <span style={{color:C.text2, fontWeight:600}}>{step.label}:</span>
                                      <span style={{color:C.text}}>{step.result}</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )}

                        {/* Corrección — en lenguaje humano */}
                        <div style={{marginBottom:10}}>
                          {correcting===call.call_sid ? (
                            <div style={{background:'rgba(240,168,78,0.05)', border:'1px solid rgba(240,168,78,0.2)', borderRadius:10, padding:'12px 14px'}}>
                              <p style={{fontSize:12, fontWeight:700, color:C.amber, marginBottom:6}}>{tx('¿Qué pasó realmente con esta llamada?')}</p>
                              <p style={{fontSize:11, color:C.text3, marginBottom:10}}>{tx('Elige la opción correcta y') + ' ' + agentName + ' ' + tx('aprenderá para la próxima vez.')}</p>
                              <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:10}}>
                                {CORRECTION_OPTIONS.map(opt=>(
                                  <button key={opt.value} onClick={()=>sendFeedback(call.call_sid, opt.value)}
                                    disabled={feedbackLoading}
                                    style={{fontSize:12, padding:'7px 14px', borderRadius:9, border:'1px solid rgba(240,168,78,0.3)', background:'rgba(240,168,78,0.07)', color:C.amber, fontWeight:600, cursor:'pointer', fontFamily:'inherit', opacity:feedbackLoading?0.5:1}}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                              <input value={feedbackNote} onChange={e=>setFeedbackNote(e.target.value)}
                                placeholder={tx('Comentario opcional (ej: el cliente confirmó por teléfono)')}
                                style={{width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, padding:'7px 10px', fontSize:12, color:C.text, fontFamily:'inherit', boxSizing:'border-box' as const, marginBottom:8}}/>
                              <button onClick={()=>{setCorrecting(null);setFeedbackNote('')}}
                                style={{fontSize:11, color:C.text3, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit'}}>
                                {tx('Cancelar')}
                              </button>
                            </div>
                          ) : feedbackDone.has(call.call_sid) ? (
                            <p style={{fontSize:11, color:C.green}}>✓ {tx('Listo') + ' — ' + agentName + ' ' + tx('tendrá esto en cuenta la próxima vez')}</p>
                          ) : (
                            <div style={{display:'flex',alignItems:'center',gap:0}}>
                              {call.caller_phone && call.caller_phone !== 'Número oculto' && (
                                <button onClick={async () => {
                                  const sess = await supabase.auth.getSession()
                                  if (!sess.data.session) return
                                  await fetch('/api/voice/outbound', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sess.data.session.access_token },
                                    body: JSON.stringify({ phone_number: call.caller_phone, reason: 'callback', customer_name: call.customer_name })
                                  })
                                }}
                                style={{fontSize:11, padding:'5px 12px', borderRadius:7, border:`1px solid ${C.teal}40`, background:C.tealDim, color:C.teal, cursor:'pointer', fontFamily:'inherit', fontWeight:500, marginRight:8}}>
                                  📞 {cs.callBack}
                                </button>
                              )}
                              <button onClick={()=>{setCorrecting(call.call_sid);setFeedbackNote('')}}
                                style={{fontSize:11, padding:'5px 12px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', color:C.text3, cursor:'pointer', fontFamily:'inherit', fontWeight:500}}>
                                {tx('Esto no es correcto, quiero cambiarlo')}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Intención del cliente — en lenguaje humano */}
                        {call.intent && call.intent !== 'consulta' &&
                          <p style={{fontSize:12, color:C.text3, marginTop:4}}>
                            {tx('El cliente quería:')} <strong style={{color:C.text2}}>{INTENT_LABELS[call.intent]||call.intent}</strong>
                          </p>
                        }
                        {call.transcript&&<details style={{marginTop:8}}><summary style={{fontSize:12, color:C.text3, cursor:'pointer'}}>{tx('Ver la conversación completa')}</summary><p style={{fontSize:12, color:C.text2, lineHeight:1.6, marginTop:8, whiteSpace:'pre-wrap', background:C.surface3, padding:'10px', borderRadius:8}}>{call.transcript}</p></details>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {hasMore && filter==='all' && (
          <div style={{textAlign:'center', paddingTop:8}}>
            <button onClick={()=>{ setLoadingMore(true); if(tid) load(tid,false) }} disabled={loadingMore}
              style={{padding:'9px 24px', fontSize:13, fontWeight:600, color:C.amber, background:'transparent', border:`1px solid ${C.amber}40`, borderRadius:9, cursor:'pointer', fontFamily:'inherit', opacity:loadingMore?0.6:1}}>
              {loadingMore ? tx('Cargando...') : tx('Cargar más llamadas')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
