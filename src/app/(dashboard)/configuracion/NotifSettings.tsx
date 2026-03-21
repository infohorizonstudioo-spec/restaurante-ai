'use client'
import { useEffect, useState } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const C = {
  amber:'#F0A84E', amberDim:'rgba(240,168,78,0.10)', amberBorder:'rgba(240,168,78,0.25)',
  green:'#4ADE80', greenDim:'rgba(74,222,128,0.10)',
  red:'#F87171', redDim:'rgba(248,113,113,0.10)',
  text:'#E8EEF6', text2:'#8895A7', text3:'#49566A',
  surface:'#131920', surface2:'#1A2230',
  border:'rgba(255,255,255,0.07)',
}

function Toggle({ on, onChange, label, desc }: { on:boolean; onChange:(v:boolean)=>void; label:string; desc?:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'11px 0', borderBottom:`1px solid ${C.border}` }}>
      <div>
        <p style={{ fontSize:13, fontWeight:600, color:C.text }}>{label}</p>
        {desc && <p style={{ fontSize:11, color:C.text3, marginTop:2 }}>{desc}</p>}
      </div>
      <button onClick={()=>onChange(!on)} style={{
        width:40, height:22, borderRadius:11, border:'none', cursor:'pointer', flexShrink:0,
        background: on ? C.amber : 'rgba(255,255,255,0.08)', position:'relative', transition:'background 0.2s',
      }}>
        <div style={{ position:'absolute', top:3, left: on ? 20 : 3, width:16, height:16, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }}/>
      </button>
    </div>
  )
}

const PREF_KEY = 'rz-notif-prefs'
const DEFAULT_PREFS = { calls:true, reservas:true, pedidos:true, incidencias:true, pendientes:true, sound:true }

export default function NotifSettings() {
  const { status, requestPermission, sendTest } = usePushNotifications()
  const [prefs, setPrefs] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS
    try {
      const stored = localStorage.getItem(PREF_KEY)
      if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) }
    } catch {}
    return DEFAULT_PREFS
  })
  const [saved, setSaved] = useState(false)

  function setPref(k: keyof typeof DEFAULT_PREFS, v: boolean) {
    const next = { ...prefs, [k]: v }
    setPrefs(next)
    localStorage.setItem(PREF_KEY, JSON.stringify(next))
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }

  async function handlePushToggle() {
    if (status === 'granted') return
    await requestPermission()
  }

  const pushLabel = { unsupported:'No disponible en este navegador', denied:'Bloqueado — activa en ajustes del navegador', default:'Activar notificaciones push', granted:'✓ Push activado' }[status]
  const pushColor = status === 'granted' ? C.green : status === 'denied' ? C.red : C.amber

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', marginTop:8 }}>
      <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}` }}>
        <p style={{ fontSize:14, fontWeight:700, color:C.text }}>Notificaciones</p>
        <p style={{ fontSize:12, color:C.text3, marginTop:2 }}>Elige cómo y cuándo quieres recibir avisos</p>
      </div>
      <div style={{ padding:'4px 20px 16px' }}>
        {/* Push permission */}
        <div style={{ padding:'14px 0', borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:8 }}>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Notificaciones push en este dispositivo</p>
              <p style={{ fontSize:11, color:C.text3, marginTop:2 }}>Recibirás avisos aunque tengas otra pestaña abierta</p>
            </div>
            <div style={{ width:10, height:10, borderRadius:'50%', background:pushColor, flexShrink:0 }}/>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {status !== 'granted' && status !== 'denied' && (
              <button onClick={handlePushToggle} style={{ padding:'7px 16px', fontSize:12, fontWeight:700, borderRadius:8, border:'none', background:C.amber, color:'#0A0D14', cursor:'pointer', fontFamily:'inherit' }}>
                Activar push
              </button>
            )}
            {status === 'granted' && (
              <button onClick={()=>sendTest('info')} style={{ padding:'7px 16px', fontSize:12, fontWeight:600, borderRadius:8, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.04)', color:C.text2, cursor:'pointer', fontFamily:'inherit' }}>
                Enviar prueba
              </button>
            )}
            <span style={{ fontSize:12, color:pushColor, display:'flex', alignItems:'center' }}>{pushLabel}</span>
          </div>
        </div>

        {/* Tipos */}
        <Toggle on={prefs.calls}       onChange={v=>setPref('calls',v)}       label="Llamadas"              desc="Nueva llamada, llamada activa, perdida"/>
        <Toggle on={prefs.reservas}    onChange={v=>setPref('reservas',v)}    label="Reservas"              desc="Nueva reserva, pendiente de revisión"/>
        <Toggle on={prefs.pedidos}     onChange={v=>setPref('pedidos',v)}     label="Pedidos"               desc="Nuevo pedido recibido"/>
        <Toggle on={prefs.incidencias} onChange={v=>setPref('incidencias',v)} label="Incidencias"           desc="Alertas importantes y problemas"/>
        <div style={{ paddingBottom:4 }}>
          <Toggle on={prefs.pendientes} onChange={v=>setPref('pendientes',v)} label="Pendientes de revisión" desc="Llamadas o reservas que necesitan atención"/>
        </div>
        <Toggle on={prefs.sound} onChange={v=>setPref('sound',v)} label="Sonido al recibir avisos" desc="Reproducir un tono suave con cada notificación"/>

        {saved && <p style={{ fontSize:11, color:C.green, marginTop:10, fontWeight:600 }}>✓ Preferencias guardadas</p>}
      </div>
    </div>
  )
}
