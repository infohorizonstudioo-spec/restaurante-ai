'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/components/NotificationToast'
import { C } from '@/lib/colors'

const HOURS = Array.from({length:30},(_,i)=>{
  const h = Math.floor(i/2)+8
  const m = i%2===0?'00':'30'
  return `${h.toString().padStart(2,'0')}:${m}`
})

export default function NuevaReservaPage() {
  const router = useRouter()
  const { template, tx } = useTenant()
  const toast = useToast()
  const L = template?.labels
  const [tid, setTid]       = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [form, setForm]     = useState({
    customer_name: '', customer_phone: '',
    date: new Date().toISOString().slice(0,10),
    time: '13:00', people: '2', notes: ''
  })

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user) { setLoading(false); return }
      supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle()
        .then(({data:p})=>{ if(p?.tenant_id) setTid(p.tenant_id); setLoading(false) })
    })
  },[])

  const up = (k:string,v:string) => setForm(f=>({...f,[k]:v}))

  async function handleSubmit() {
    if(!form.customer_name.trim()) { setError(tx('El nombre es obligatorio')); return }
    const phoneRegex = /^\+?[\d\s\-()]{9,}$/
    if (form.customer_phone && !phoneRegex.test(form.customer_phone)) { setError(tx('Teléfono no válido')); return }
    if(!tid) { setError(tx('Sesión no válida')); return }
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
          setError(`${tx('No hay hueco a las')} ${form.time}. ${tx('Alternativas:')} ${availability.alternatives.join(', ')}`)
        } else {
          setError(availability.message || tx('No hay disponibilidad para esa fecha y hora'))
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

      // Send SMS confirmation
      if (form.customer_phone) {
        const sess = await supabase.auth.getSession()
        if (sess.data.session) {
          const dateStr = new Date(form.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
          fetch('/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sess.data.session.access_token },
            body: JSON.stringify({
              to: form.customer_phone,
              message: `${form.customer_name}, confirmada tu ${(L?.reserva || 'reserva').toLowerCase()} para el ${dateStr} a las ${form.time}${Number(form.people) > 1 ? `, ${form.people} personas` : ''}. ¡Te esperamos!`
            })
          }).catch(() => {
            toast.push({ title: 'Reserva creada, pero no se pudo enviar el SMS', type: 'sms_error', priority: 'warning', icon: '⚠️' })
          })
        }
      }

      router.push('/reservas')
    } catch(e:any) {
      setError(e.message||tx('Error al guardar'))
    } finally { setSaving(false) }
  }


  const inp = {
    width:'100%', background:C.surface2, border:`1px solid ${C.border}`,
    borderRadius:10, padding:'11px 14px', color:C.text, fontSize:14,
    outline:'none', fontFamily:'inherit', transition:'border-color 0.15s'
  } as React.CSSProperties
  const label = { fontSize:12, fontWeight:600, color:C.text2, letterSpacing:'0.03em', display:'block', marginBottom:6 }

  if (loading) return <PageLoader/>

  return (
    <div style={{background:C.bg, minHeight:'100vh', fontFamily:"'Sora',-apple-system,sans-serif"}}>
      <style>{`
        *{box-sizing:border-box}
        .rz-inp:focus{border-color:${C.amber}!important; box-shadow:0 0 0 3px rgba(240,168,78,0.12)!important}
        .rz-inp::placeholder{color:${C.muted}}
      `}</style>

      {/* Header */}
      <div style={{background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:20}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <Link href="/agenda" style={{display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32, borderRadius:8, border:`1px solid ${C.border}`, color:C.text2, textDecoration:'none', fontSize:16}}>←</Link>
          <div>
            <h1 style={{fontSize:17, fontWeight:700, color:C.text}}>{tx('Nueva')} {L?.reserva?.toLowerCase() || tx('reserva')}</h1>
            <p style={{fontSize:12, color:C.muted, marginTop:1}}>{tx('Añadir manualmente')}</p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div style={{maxWidth:520, margin:'32px auto', padding:'0 20px'}}>
        <div style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:28, display:'flex', flexDirection:'column', gap:20}}>

          {/* Nombre */}
          <div>
            <label style={label}>{tx('NOMBRE DEL')} {(L?.cliente || tx('CLIENTE')).toUpperCase()} *</label>
            <input className="rz-inp" style={inp} placeholder="Juan García" value={form.customer_name} onChange={e=>up('customer_name',e.target.value)} autoFocus/>
          </div>

          {/* Teléfono */}
          <div>
            <label style={label}>{tx('TELÉFONO')}</label>
            <input className="rz-inp" style={inp} placeholder="+34 600 000 000" value={form.customer_phone} onChange={e=>up('customer_phone',e.target.value)}/>
          </div>

          {/* Fecha + Hora */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14}}>
            <div>
              <label style={label}>{tx('FECHA')} *</label>
              <input type="date" className="rz-inp" style={{...inp, colorScheme:'dark'}} value={form.date} min={new Date().toISOString().slice(0,10)} onChange={e=>up('date',e.target.value)}/>
            </div>
            <div>
              <label style={label}>{tx('HORA')} *</label>
              <select className="rz-inp" style={{...inp, appearance:'none', cursor:'pointer'}} value={form.time} onChange={e=>up('time',e.target.value)}>
                {HOURS.map(h=><option key={h} value={h} style={{background:C.surface}}>{h}</option>)}
              </select>
            </div>
          </div>

          {/* Personas */}
          <div>
            <label style={label}>{tx('PERSONAS')} *</label>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {['1','2','3','4','5','6','7','8','10','12'].map(n=>(
                <button key={n} onClick={()=>up('people',n)} style={{
                  width:44, height:44, borderRadius:10, border:`1px solid`,
                  borderColor: form.people===n ? C.amber : C.border,
                  background: form.people===n ? 'rgba(240,168,78,0.12)' : 'transparent',
                  color: form.people===n ? C.amber : C.text2,
                  fontWeight:600, fontSize:14, cursor:'pointer', transition:'all 0.12s', fontFamily:'inherit'
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label style={label}>{tx('NOTAS')} <span style={{fontWeight:400, color:C.muted}}>({tx('opcional')})</span></label>
            <textarea className="rz-inp" style={{...inp, resize:'vertical', minHeight:80}} placeholder="Alergias, preferencias, ocasión especial..." value={form.notes} onChange={e=>up('notes',e.target.value)}/>
          </div>

          {/* Error */}
          {error && <p style={{fontSize:13, color:C.red, background:'rgba(248,113,113,0.08)', border:`1px solid rgba(248,113,113,0.2)`, borderRadius:8, padding:'10px 14px'}}>{error}</p>}

          {/* Botones */}
          <div style={{display:'flex', gap:10, marginTop:4}}>
            <Link href="/agenda" style={{flex:1, padding:'12px 0', textAlign:'center', background:'transparent', border:`1px solid ${C.border}`, borderRadius:10, color:C.text2, fontSize:14, fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center'}}>{tx('Cancelar')}</Link>
            <button onClick={handleSubmit} disabled={saving||!tid} style={{
              flex:2, padding:'12px 0', background: saving ? 'rgba(240,168,78,0.5)' : `linear-gradient(135deg,${C.amber},#E8923A)`,
              border:'none', borderRadius:10, color:C.bg, fontSize:14, fontWeight:700,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'inherit', transition:'all 0.15s'
            }}>
              {saving ? tx('Guardando...') : `✓ ${tx('Confirmar')} ${L?.reserva?.toLowerCase() || tx('reserva')}`}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
