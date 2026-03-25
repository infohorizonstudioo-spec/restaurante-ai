'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const HOURS = Array.from({length:30},(_,i)=>{
  const h = Math.floor(i/2)+8
  const m = i%2===0?'00':'30'
  return `${h.toString().padStart(2,'0')}:${m}`
})

export default function NuevaReservaPage() {
  const router = useRouter()
  const [tid, setTid]       = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [form, setForm]     = useState({
    customer_name: '', customer_phone: '',
    date: new Date().toISOString().slice(0,10),
    time: '13:00', people: '2', notes: ''
  })

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user) return
      supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle()
        .then(({data:p})=>{ if(p?.tenant_id) setTid(p.tenant_id) })
    })
  },[])

  const up = (k:string,v:string) => setForm(f=>({...f,[k]:v}))

  async function handleSubmit() {
    if(!form.customer_name.trim()) { setError('El nombre es obligatorio'); return }
    if(!tid) { setError('Sesión no válida'); return }
    setSaving(true); setError('')
    try {
      // Check availability first
      const checkRes = await fetch('/api/agent/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tid,
          date: form.date,
          time: form.time,
          party_size: parseInt(form.people) || 2,
        })
      })
      const availability = await checkRes.json()
      if (!availability.available) {
        if (availability.alternatives?.length) {
          setError(`No hay hueco a las ${form.time}. Alternativas: ${availability.alternatives.join(', ')}`)
        } else {
          setError(availability.message || 'No hay disponibilidad para esa fecha y hora')
        }
        setSaving(false)
        return
      }

      const { error: err } = await supabase.from('reservations').insert({
        tenant_id:     tid,
        customer_name: form.customer_name.trim(),
        customer_phone:form.customer_phone.trim()||null,
        date:          form.date,
        time:          form.time,
        people:        parseInt(form.people)||2,
        notes:         form.notes.trim()||null,
        status:        'confirmada',
        source:        'manual',
      })
      if(err) throw err
      router.push('/reservas')
    } catch(e:any) {
      setError(e.message||'Error al guardar')
    } finally { setSaving(false) }
  }


  const C = {
    bg:'#0C1018', card:'#131920', border:'rgba(255,255,255,0.07)',
    text:'#E8EEF6', muted:'#49566A', sub:'#8895A7', amber:'#F0A84E', red:'#F87171'
  }
  const inp = {
    width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`,
    borderRadius:10, padding:'11px 14px', color:C.text, fontSize:14,
    outline:'none', fontFamily:'inherit', transition:'border-color 0.15s'
  } as React.CSSProperties
  const label = { fontSize:12, fontWeight:600, color:C.sub, letterSpacing:'0.03em', display:'block', marginBottom:6 }

  return (
    <div style={{background:C.bg, minHeight:'100vh', fontFamily:"'Sora',-apple-system,sans-serif"}}>
      <style>{`
        *{box-sizing:border-box}
        .rz-inp:focus{border-color:${C.amber}!important; box-shadow:0 0 0 3px rgba(240,168,78,0.12)!important}
        .rz-inp::placeholder{color:${C.muted}}
      `}</style>

      {/* Header */}
      <div style={{background:C.card, borderBottom:`1px solid ${C.border}`, padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:20}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <Link href="/agenda" style={{display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32, borderRadius:8, border:`1px solid ${C.border}`, color:C.sub, textDecoration:'none', fontSize:16}}>←</Link>
          <div>
            <h1 style={{fontSize:17, fontWeight:700, color:C.text}}>Nueva reserva</h1>
            <p style={{fontSize:12, color:C.muted, marginTop:1}}>Añadir manualmente</p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div style={{maxWidth:520, margin:'32px auto', padding:'0 20px'}}>
        <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:28, display:'flex', flexDirection:'column', gap:20}}>

          {/* Nombre */}
          <div>
            <label style={label}>NOMBRE DEL CLIENTE *</label>
            <input className="rz-inp" style={inp} placeholder="Juan García" value={form.customer_name} onChange={e=>up('customer_name',e.target.value)} autoFocus/>
          </div>

          {/* Teléfono */}
          <div>
            <label style={label}>TELÉFONO</label>
            <input className="rz-inp" style={inp} placeholder="+34 600 000 000" value={form.customer_phone} onChange={e=>up('customer_phone',e.target.value)}/>
          </div>

          {/* Fecha + Hora */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
            <div>
              <label style={label}>FECHA *</label>
              <input type="date" className="rz-inp" style={{...inp, colorScheme:'dark'}} value={form.date} onChange={e=>up('date',e.target.value)}/>
            </div>
            <div>
              <label style={label}>HORA *</label>
              <select className="rz-inp" style={{...inp, appearance:'none', cursor:'pointer'}} value={form.time} onChange={e=>up('time',e.target.value)}>
                {HOURS.map(h=><option key={h} value={h} style={{background:C.card}}>{h}</option>)}
              </select>
            </div>
          </div>

          {/* Personas */}
          <div>
            <label style={label}>PERSONAS *</label>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {['1','2','3','4','5','6','7','8','10','12'].map(n=>(
                <button key={n} onClick={()=>up('people',n)} style={{
                  width:44, height:44, borderRadius:10, border:`1px solid`,
                  borderColor: form.people===n ? C.amber : C.border,
                  background: form.people===n ? 'rgba(240,168,78,0.12)' : 'transparent',
                  color: form.people===n ? C.amber : C.sub,
                  fontWeight:600, fontSize:14, cursor:'pointer', transition:'all 0.12s', fontFamily:'inherit'
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label style={label}>NOTAS <span style={{fontWeight:400, color:C.muted}}>(opcional)</span></label>
            <textarea className="rz-inp" style={{...inp, resize:'vertical', minHeight:80}} placeholder="Alergias, preferencias, ocasión especial..." value={form.notes} onChange={e=>up('notes',e.target.value)}/>
          </div>

          {/* Error */}
          {error && <p style={{fontSize:13, color:C.red, background:'rgba(248,113,113,0.08)', border:`1px solid rgba(248,113,113,0.2)`, borderRadius:8, padding:'10px 14px'}}>{error}</p>}

          {/* Botones */}
          <div style={{display:'flex', gap:10, marginTop:4}}>
            <Link href="/agenda" style={{flex:1, padding:'12px 0', textAlign:'center', background:'transparent', border:`1px solid ${C.border}`, borderRadius:10, color:C.sub, fontSize:14, fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center'}}>Cancelar</Link>
            <button onClick={handleSubmit} disabled={saving||!tid} style={{
              flex:2, padding:'12px 0', background: saving ? 'rgba(240,168,78,0.5)' : 'linear-gradient(135deg,#F0A84E,#E8923A)',
              border:'none', borderRadius:10, color:'#0C1018', fontSize:14, fontWeight:700,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'inherit', transition:'all 0.15s'
            }}>
              {saving ? 'Guardando...' : '✓ Confirmar reserva'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
