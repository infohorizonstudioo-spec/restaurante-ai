'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'

const DAYS = ['DO','LU','MA','MI','JU','VI','SA']
const STATUS_STYLES:Record<string,{bg:string;color:string;label:string}> = {
  confirmada: {bg:'#f0fdf4',color:'#059669',label:'Confirmada'},
  confirmed:  {bg:'#f0fdf4',color:'#059669',label:'Confirmada'},
  pendiente:  {bg:'#fffbeb',color:'#d97706',label:'Pendiente'},
  pending:    {bg:'#fffbeb',color:'#d97706',label:'Pendiente'},
  cancelada:  {bg:'#fef2f2',color:'#dc2626',label:'Cancelada'},
  cancelled:  {bg:'#fef2f2',color:'#dc2626',label:'Cancelada'},
  completada: {bg:'#eff6ff',color:'#1d4ed8',label:'Completada'},
  completed:  {bg:'#eff6ff',color:'#1d4ed8',label:'Completada'},
}

function getWeek(base: Date) {
  const d = new Date(base)
  // Semana empieza en LUNES (1), no domingo (0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // domingo → -6, resto → 1-day
  d.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d); dd.setDate(d.getDate() + i)
    return dd
  })
}

export default function ReservasPage() {
  const [base,setBase]       = useState(new Date())
  const [selected,setSelected] = useState(new Date().toISOString().slice(0,10))
  const [reservas,setReservas] = useState<any[]>([])
  const [loading,setLoading] = useState(true)
  const [tid,setTid]         = useState<string|null>(null)
  const [modal,setModal]     = useState<any|null>(null)
  const [search,setSearch]   = useState('')

  const load = useCallback(async (tenantId:string) => {
    const week = getWeek(base)
    const from = week[0].toISOString().slice(0,10)
    const to   = week[6].toISOString().slice(0,10)
    const {data} = await supabase.from('reservations')
      .select('*').eq('tenant_id',tenantId)
      .gte('date',from).lte('date',to)
      .order('date').order('time')
    setReservas(data||[])
    setLoading(false)
  },[base])

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
      if (!p?.tenant_id) return
      setTid(p.tenant_id); await load(p.tenant_id)
    })()
  },[load])

  useEffect(()=>{
    if (!tid) return
    const ch = supabase.channel('res-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'reservations',filter:'tenant_id=eq.'+tid},()=>load(tid))
      .subscribe()
    return ()=>{ supabase.removeChannel(ch) }
  },[tid,load])

  if (loading) return <PageLoader/>

  const week    = getWeek(base)
  const dayRes  = reservas.filter(r => (r.date||r.reservation_date)===selected)
  const filtered = search ? dayRes.filter(r =>
    (r.customer_name||'').toLowerCase().includes(search.toLowerCase()) ||
    (r.customer_phone||'').includes(search)
  ) : dayRes
  const today = new Date().toISOString().slice(0,10)

  async function updateStatus(id:string, status:string) {
    await supabase.from('reservations').update({status}).eq('id',id)
    if (tid) load(tid)
    setModal(null)
  }

  return (
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>Reservas</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:1}}>{dayRes.length} para el {new Date(selected+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar citas..." style={{padding:'7px 12px',fontSize:13,border:'1px solid #e2e8f0',borderRadius:8,outline:'none',width:180}}/>
        </div>
      </div>

      {/* Week nav */}
      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'0 24px',display:'flex',alignItems:'stretch',gap:0}}>
        <button onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()-7);return n})} style={{padding:'12px',background:'none',border:'none',cursor:'pointer',color:'#64748b',fontSize:18}}>‹</button>
        {week.map(d => {
          const iso = d.toISOString().slice(0,10)
          const count = reservas.filter(r=>(r.date||r.reservation_date)===iso).length
          const isSel = iso===selected, isToday = iso===today
          return (
            <button key={iso} onClick={()=>setSelected(iso)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'10px 4px',background:'none',border:'none',cursor:'pointer',borderBottom:isSel?'2px solid #1d4ed8':'2px solid transparent',transition:'all 0.12s'}}>
              <span style={{fontSize:10,color:isToday?'#1d4ed8':'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{DAYS[d.getDay()]}</span>
              <span style={{fontSize:17,fontWeight:isSel?700:500,color:isSel?'#1d4ed8':isToday?'#1d4ed8':'#374151',marginTop:1}}>{d.getDate()}</span>
              {count>0&&<span style={{width:18,height:18,borderRadius:'50%',background:isSel?'#1d4ed8':'#e2e8f0',color:isSel?'white':'#374151',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',marginTop:2}}>{count}</span>}
            </button>
          )
        })}
        <button onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()+7);return n})} style={{padding:'12px',background:'none',border:'none',cursor:'pointer',color:'#64748b',fontSize:18}}>›</button>
      </div>

      {/* List */}
      <div style={{maxWidth:760,margin:'0 auto',padding:'20px 24px'}}>
        {filtered.length===0 ? (
          <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,padding:'60px 24px',textAlign:'center'}}>
            <div style={{fontSize:36,marginBottom:10}}>📅</div>
            <p style={{fontSize:15,fontWeight:600,color:'#374151',marginBottom:4}}>Sin citas este día</p>
            <p style={{fontSize:13,color:'#94a3b8'}}>No hay reservas para el día seleccionado.</p>
          </div>
        ) : filtered.map((r,i)=>{
          const ss = STATUS_STYLES[r.status]||STATUS_STYLES.pendiente
          const time = r.time||r.reservation_time||''
          const name = r.customer_name||'Sin nombre'
          const people = r.people||r.party_size||1
          return (
            <div key={r.id} onClick={()=>setModal(r)} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 16px',marginBottom:10,cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'all 0.12s',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'}>
              <div style={{width:42,height:42,borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#1d4ed8',flexShrink:0}}>
                {name[0]?.toUpperCase()||'?'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:14,fontWeight:600,color:'#0f172a'}}>{name}</p>
                <p style={{fontSize:12,color:'#64748b',marginTop:1}}>
                  {time.slice(0,5)} · {people} persona{people!==1?'s':''}
                  {r.table_name?' · '+r.table_name:''}
                  {r.notes?' · '+r.notes.slice(0,40)+(r.notes.length>40?'...':''):''}
                </p>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
                <span style={{fontSize:11,padding:'3px 9px',borderRadius:8,background:ss.bg,color:ss.color,fontWeight:700,flexShrink:0}}>{ss.label}</span>
                {r.customer_phone&&<p style={{fontSize:11,color:'#94a3b8'}}>{r.customer_phone}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}} onClick={()=>setModal(null)}>
          <div style={{background:'white',borderRadius:16,padding:24,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
              <div>
                <p style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>{modal.customer_name||'Sin nombre'}</p>
                <p style={{fontSize:13,color:'#64748b',marginTop:2}}>
                  {(modal.date||modal.reservation_date)?.slice(0,10)} · {(modal.time||modal.reservation_time||'').slice(0,5)} · {modal.people||modal.party_size} persona{(modal.people||modal.party_size)!==1?'s':''}
                </p>
              </div>
              <button onClick={()=>setModal(null)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#94a3b8'}}>×</button>
            </div>
            {modal.customer_phone&&<p style={{fontSize:13,color:'#374151',marginBottom:8}}>📞 {modal.customer_phone}</p>}
            {modal.table_name&&<p style={{fontSize:13,color:'#374151',marginBottom:8}}>🪑 {modal.table_name}</p>}
            {modal.notes&&<p style={{fontSize:13,color:'#374151',marginBottom:16}}>📝 {modal.notes}</p>}
            {modal.source==='voice_agent'&&<p style={{fontSize:12,color:'#7c3aed',marginBottom:16,background:'#f5f3ff',padding:'6px 10px',borderRadius:8}}>📞 Reserva creada por el agente de voz</p>}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              {['confirmada','pendiente','cancelada','completada'].map(s=>(
                <button key={s} onClick={()=>updateStatus(modal.id,s)}
                  style={{padding:'7px 14px',fontSize:12,fontWeight:600,borderRadius:8,border:'1px solid',
                    borderColor: STATUS_STYLES[s]?.color||'#e2e8f0',
                    background: modal.status===s ? STATUS_STYLES[s]?.bg||'#f1f5f9' : 'white',
                    color: STATUS_STYLES[s]?.color||'#374151',cursor:'pointer'}}>
                  {STATUS_STYLES[s]?.label||s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}