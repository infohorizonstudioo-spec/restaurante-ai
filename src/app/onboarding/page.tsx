'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { resolveTemplate } from '@/lib/templates'

const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const DEFAULT_HOURS = { open: '09:00', close: '21:00', closed: false }

// ─── estilos inline base ───────────────────────────────────────────────────
const card = { background:'rgba(30,41,59,0.8)', border:'1px solid #334155', borderRadius:24, padding:32 }
const btn  = { padding:'14px 24px', borderRadius:14, fontWeight:700, fontSize:15, cursor:'pointer', width:'100%', fontFamily:'inherit', transition:'all 0.15s' }
const inp  = { width:'100%', background:'#1e293b', border:'1px solid #475569', borderRadius:12, padding:'11px 14px', color:'white', fontSize:14, outline:'none', fontFamily:'inherit' }

export default function OnboardingPage() {
  const [tenant, setTenant] = useState<any>(null)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1 — agente
  const [agentName, setAgentName] = useState('Sofía')
  const [language,  setLanguage]  = useState('es')
  const [hours, setHours] = useState(() =>
    Object.fromEntries(DAYS.map((d, i) => [d, { ...DEFAULT_HOURS, closed: i >= 5 }]))
  )

  // Step 2 — espacios
  const [zones, setZones] = useState([
    { name: 'Interior', tables: 8 },
    { name: 'Terraza',  tables: 6 },
  ])

  // Step 3 — número
  const [phoneOption, setPhoneOption] = useState<'dedicated'|'own'|null>(null)
  const [ownPhone, setOwnPhone] = useState('')
  const [phoneWarningAck, setPhoneWarningAck] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!profile?.tenant_id) return
      const { data: t } = await supabase.from('tenants').select('*').eq('id', (profile as any).tenant_id).single()
      if (t?.onboarding_complete) { window.location.href = '/panel'; return }
      setTenant(t)
      if (t?.agent_name) setAgentName(t.agent_name)
      if (t?.agent_phone) { setOwnPhone(t.agent_phone); setPhoneOption('own') }
    }
    load()
  }, [])

  const tmpl       = tenant ? resolveTemplate(tenant.type || 'otro') : null
  const hasSpaces  = tmpl?.hasSpaces ?? false
  const unitLabel  = tmpl?.labels?.unit?.plural || 'Mesas'
  const zoneLabel  = tmpl?.labels?.unit?.zoneLabel || 'Zona'

  // Pasos: 1=agente, 2=espacios(opt), 3=número, 4=listo
  const allSteps = hasSpaces
    ? ['Agente', unitLabel, 'Número', '¡Listo!']
    : ['Agente', 'Número', '¡Listo!']
  const totalSteps = allSteps.length

  // Mapear step lógico → índice de allSteps (1-based)
  const stepToIndex = (s: number) => s  // ya es 1-based
  const stepLabel   = allSteps[step - 1] || ''

  // Step "número" y "listo" dependen de si hay espacios
  const stepNumero = hasSpaces ? 3 : 2
  const stepListo  = hasSpaces ? 4 : 3

  async function saveStep1() {
    setSaving(true)
    await supabase.from('tenants').update({ agent_name: agentName, language, business_hours: hours, onboarding_step: 2 }).eq('id', tenant.id)
    setSaving(false)
    setStep(2)
  }

  async function saveStep2Spaces() {
    setSaving(true)
    for (const zone of zones) {
      if (!zone.name || zone.tables < 1) continue
      const { data: z } = await supabase.from('zones').insert({ tenant_id: tenant.id, name: zone.name, active: true }).select().single()
      if (z) {
        const rows = Array.from({ length: zone.tables }, (_, i) => ({
          tenant_id: tenant.id, zone_id: z.id, zone: z.id,
          number: String(i+1), name: `${zone.name} ${i+1}`,
          capacity: 4, min_capacity: 1, status: 'libre', shape: 'rectangle', combinable: false
        }))
        await supabase.from('tables').insert(rows)
      }
    }
    await supabase.from('tenants').update({ onboarding_step: stepNumero }).eq('id', tenant.id)
    setSaving(false)
    setStep(stepNumero)
  }

  async function saveStepNumero() {
    setSaving(true)
    const phone = phoneOption === 'own' ? ownPhone.trim() : null
    // Si eligió 'own' guardamos el número; si eligió 'dedicated' lo dejamos vacío (soporte lo asigna)
    await supabase.from('tenants').update({
      agent_phone: phone || null,
      onboarding_step: stepListo
    }).eq('id', tenant.id)
    setSaving(false)
    setStep(stepListo)
  }

  async function completeOnboarding() {
    setSaving(true)
    await supabase.from('tenants').update({ onboarding_complete: true, onboarding_step: totalSteps }).eq('id', tenant.id)
    setSaving(false)
    window.location.href = '/panel'
  }

  if (!tenant) return (
    <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:40, height:40, border:'4px solid #4f46e5', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 16px', fontFamily:"'DM Sans',-apple-system,sans-serif", overflowY:'auto' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fadein{animation:fadeUp 0.35s ease forwards}
        .inp:focus{border-color:#6366f1!important;box-shadow:0 0 0 3px rgba(99,102,241,0.2)!important}
        .opt-card{border:2px solid #334155;border-radius:16px;padding:18px;cursor:pointer;transition:all 0.15s;background:rgba(30,41,59,0.5)}
        .opt-card:hover{border-color:#6366f1;background:rgba(99,102,241,0.08)}
        .opt-card.sel{border-color:#6366f1;background:rgba(99,102,241,0.12)}
        .btn-primary{background:linear-gradient(135deg,#4f46e5,#6366f1);color:white;border:none}
        .btn-primary:hover:not(:disabled){background:linear-gradient(135deg,#4338ca,#4f46e5)}
        .btn-primary:disabled{opacity:0.55;cursor:default}
        .btn-ghost{background:transparent;color:#94a3b8;border:1px solid #334155}
        .btn-ghost:hover{border-color:#64748b;color:#cbd5e1}
        .time-inp{background:#1e293b;border:1px solid #475569;border-radius:8px;padding:6px 8px;color:white;font-size:12px;outline:none;font-family:inherit}
      `}</style>

      <div style={{ width:'100%', maxWidth:560 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:52,height:52,background:'linear-gradient(135deg,#4f46e5,#818cf8)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',boxShadow:'0 8px 24px rgba(99,102,241,0.35)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
          </div>
          <h1 style={{ fontSize:22,fontWeight:800,color:'white',letterSpacing:'-0.02em' }}>Reservo.AI</h1>
          <p style={{ fontSize:13,color:'#64748b',marginTop:3 }}>Configura tu recepcionista para <strong style={{color:'#94a3b8'}}>{tenant.name}</strong></p>
        </div>

        {/* Progress */}
        <div style={{ display:'flex',alignItems:'center',gap:0,marginBottom:24 }}>
          {allSteps.map((label, i) => {
            const idx = i + 1
            const done = step > idx
            const active = step === idx
            return (
              <div key={i} style={{ display:'flex',alignItems:'center',flex:i<allSteps.length-1?1:'none' }}>
                <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
                  <div style={{ width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,
                    background: done?'#22c55e':active?'#6366f1':'#1e293b',
                    color: done||active?'white':'#475569',
                    border: active?'2px solid #818cf8':done?'none':'2px solid #334155',
                    transition:'all 0.2s'
                  }}>{done?'✓':idx}</div>
                  <span style={{ fontSize:10,color:active?'#a5b4fc':done?'#4ade80':'#475569',fontWeight:active?600:400,whiteSpace:'nowrap' }}>{label}</span>
                </div>
                {i < allSteps.length - 1 && (
                  <div style={{ flex:1,height:2,background:done?'#22c55e':'#1e293b',margin:'0 6px',marginBottom:16,transition:'background 0.3s' }}/>
                )}
              </div>
            )
          })}
        </div>

        {/* Tarjeta de contenido */}
        <div style={card} className="fadein" key={step}>

          {/* ══ STEP 1: AGENTE ══════════════════════════════════════════════ */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize:20,fontWeight:800,color:'white',marginBottom:4 }}>Configura tu recepcionista</h2>
              <p style={{ fontSize:13,color:'#64748b',marginBottom:24 }}>Elige cómo se llama y cuándo trabaja</p>

              <div style={{ display:'flex',flexDirection:'column',gap:18 }}>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:7 }}>Nombre del asistente</label>
                  <input className="inp" style={inp} value={agentName} onChange={e => setAgentName(e.target.value)}
                    placeholder="Ej: Sofía, Lucía, Carmen…"/>
                  <p style={{ fontSize:12,color:'#64748b',marginTop:5 }}>Al contestar dirá: <em style={{color:'#a5b4fc'}}>"Hola, soy {agentName||'…'} de {tenant.name}"</em></p>
                </div>

                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:7 }}>Idioma principal</label>
                  <select className="inp" style={{...inp,appearance:'auto'}} value={language} onChange={e => setLanguage(e.target.value)}>
                    <option value="es">🇪🇸 Español</option>
                    <option value="ca">Català</option>
                    <option value="eu">Euskera</option>
                    <option value="en">🇬🇧 English</option>
                    <option value="fr">🇫🇷 Français</option>
                  </select>
                </div>

                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:7 }}>Horario de atención</label>
                  <p style={{ fontSize:12,color:'#64748b',marginBottom:8 }}>El asistente indicará al cliente si está fuera de horario</p>
                  <div style={{ display:'flex',flexDirection:'column',gap:4,maxHeight:240,overflowY:'auto',paddingRight:2 }}>
                    {DAYS.map(day => (
                      <div key={day} style={{ display:'flex',alignItems:'center',gap:10,background:'rgba(30,41,59,0.6)',borderRadius:10,padding:'8px 12px' }}>
                        <span style={{ fontSize:12,color:'#94a3b8',width:75,flexShrink:0 }}>{day}</span>
                        <label style={{ display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:'#64748b',flexShrink:0 }}>
                          <input type="checkbox" checked={!hours[day].closed}
                            onChange={e => setHours(h => ({...h,[day]:{...h[day],closed:!e.target.checked}}))}
                            style={{ accentColor:'#6366f1' }}/>
                          <span style={{ color: hours[day].closed?'#475569':'#22c55e' }}>{hours[day].closed?'Cerrado':'Abierto'}</span>
                        </label>
                        {!hours[day].closed && (
                          <>
                            <input type="time" className="time-inp" value={hours[day].open}
                              onChange={e => setHours(h => ({...h,[day]:{...h[day],open:e.target.value}}))}/>
                            <span style={{ color:'#475569',fontSize:11 }}>—</span>
                            <input type="time" className="time-inp" value={hours[day].close}
                              onChange={e => setHours(h => ({...h,[day]:{...h[day],close:e.target.value}}))}/>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button className="btn-primary" style={{...btn,marginTop:24}} onClick={saveStep1} disabled={saving||!agentName.trim()}>
                {saving ? 'Guardando…' : 'Continuar →'}
              </button>
            </div>
          )}

          {/* ══ STEP 2: ESPACIOS (opcional) ═════════════════════════════════ */}
          {step === 2 && hasSpaces && (
            <div>
              <h2 style={{ fontSize:20,fontWeight:800,color:'white',marginBottom:4 }}>Configura {unitLabel.toLowerCase()}</h2>
              <p style={{ fontSize:13,color:'#64748b',marginBottom:24 }}>El asistente sabrá cuántas {unitLabel.toLowerCase()} tienes para gestionar reservas</p>

              <div style={{ display:'flex',flexDirection:'column',gap:10,marginBottom:16 }}>
                {zones.map((zone, i) => (
                  <div key={i} style={{ background:'rgba(30,41,59,0.6)',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:10 }}>
                    <input className="inp" style={{...inp,flex:1}} value={zone.name}
                      onChange={e => { const z=[...zones]; z[i].name=e.target.value; setZones(z) }}
                      placeholder={`Nombre (ej: ${zoneLabel} ${i+1})`}/>
                    <div style={{ display:'flex',alignItems:'center',gap:6,flexShrink:0 }}>
                      <span style={{ fontSize:12,color:'#64748b' }}>{unitLabel}:</span>
                      <input type="number" className="inp" style={{...inp,width:58,textAlign:'center'}} min={1} max={50}
                        value={zone.tables} onChange={e => { const z=[...zones]; z[i].tables=parseInt(e.target.value)||1; setZones(z) }}/>
                    </div>
                    {zones.length > 1 && (
                      <button onClick={() => setZones(zones.filter((_,j)=>j!==i))}
                        style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:18,padding:'0 2px' }}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={() => setZones([...zones,{name:'',tables:4}])}
                style={{ width:'100%',border:'2px dashed #334155',background:'transparent',color:'#64748b',borderRadius:12,padding:'11px',cursor:'pointer',fontSize:13,fontFamily:'inherit',marginBottom:20 }}>
                + Añadir {zoneLabel.toLowerCase()}
              </button>

              <div style={{ display:'flex',gap:10 }}>
                <button className="btn-ghost" style={{...btn,width:'auto',padding:'12px 20px'}} onClick={() => setStep(1)}>← Atrás</button>
                <button className="btn-primary" style={{...btn,flex:1}} onClick={saveStep2Spaces} disabled={saving}>
                  {saving ? `Creando ${unitLabel.toLowerCase()}…` : 'Continuar →'}
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 3: NÚMERO DE TELÉFONO ══════════════════════════════════ */}
          {step === stepNumero && (
            <div>
              <h2 style={{ fontSize:20,fontWeight:800,color:'white',marginBottom:4 }}>Número de teléfono</h2>
              <p style={{ fontSize:13,color:'#64748b',marginBottom:22 }}>El asistente responderá las llamadas que lleguen a este número</p>

              {/* Cómo funciona */}
              <div style={{ background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:12,padding:'12px 16px',marginBottom:22,display:'flex',gap:10,alignItems:'flex-start' }}>
                <span style={{ fontSize:20,flexShrink:0 }}>💡</span>
                <p style={{ fontSize:12,color:'#a5b4fc',lineHeight:1.6,margin:0 }}>
                  Cuando alguien llame a tu número, <strong>el asistente contestará automáticamente</strong>, gestionará la reserva y tú lo verás en el panel en tiempo real. Sin perderte ninguna llamada.
                </p>
              </div>

              <p style={{ fontSize:12,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12 }}>Elige una opción</p>

              <div style={{ display:'flex',flexDirection:'column',gap:12,marginBottom:20 }}>

                {/* Opción 1: número exclusivo (RECOMENDADA) */}
                <div className={`opt-card${phoneOption==='dedicated'?' sel':''}`}
                  onClick={() => { setPhoneOption('dedicated'); setPhoneWarningAck(false) }}
                  style={{ position:'relative' }}>
                  <div style={{ position:'absolute',top:-10,right:14,background:'linear-gradient(135deg,#22c55e,#16a34a)',color:'white',fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,letterSpacing:'0.04em' }}>
                    RECOMENDADO
                  </div>
                  <div style={{ display:'flex',gap:12,alignItems:'flex-start' }}>
                    <div style={{ width:36,height:36,background:'rgba(34,197,94,0.15)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>📱</div>
                    <div>
                      <p style={{ fontSize:14,fontWeight:700,color:'white',marginBottom:4 }}>Número exclusivo para el negocio</p>
                      <p style={{ fontSize:12,color:'#64748b',lineHeight:1.6 }}>
                        Te asignamos un número propio para tu negocio. El asistente gestiona todas las llamadas sin interferir con tu teléfono personal.
                      </p>
                      <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginTop:8 }}>
                        {['✓ Profesional','✓ Sin mezclar personal y negocio','✓ Fácil de escalar'].map(t=>(
                          <span key={t} style={{ fontSize:11,color:'#22c55e',background:'rgba(34,197,94,0.1)',padding:'2px 8px',borderRadius:20 }}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ width:20,height:20,borderRadius:'50%',border:'2px solid',borderColor:phoneOption==='dedicated'?'#6366f1':'#475569',background:phoneOption==='dedicated'?'#6366f1':'transparent',flexShrink:0,marginLeft:'auto',display:'flex',alignItems:'center',justifyContent:'center' }}>
                      {phoneOption==='dedicated'&&<div style={{width:8,height:8,borderRadius:'50%',background:'white'}}/>}
                    </div>
                  </div>
                </div>

                {/* Opción 2: número propio */}
                <div className={`opt-card${phoneOption==='own'?' sel':''}`}
                  onClick={() => setPhoneOption('own')}>
                  <div style={{ display:'flex',gap:12,alignItems:'flex-start' }}>
                    <div style={{ width:36,height:36,background:'rgba(251,191,36,0.12)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>📞</div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:14,fontWeight:700,color:'white',marginBottom:4 }}>Usar mi número actual</p>
                      <p style={{ fontSize:12,color:'#64748b',lineHeight:1.6 }}>
                        Configura tu número personal o de negocio ya existente.
                      </p>
                      {phoneOption==='own' && (
                        <div style={{ marginTop:12 }}>
                          {/* Advertencia */}
                          <div style={{ background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.3)',borderRadius:10,padding:'10px 12px',marginBottom:12 }}>
                            <p style={{ fontSize:12,color:'#fbbf24',fontWeight:600,marginBottom:4 }}>⚠ Importante antes de continuar</p>
                            <ul style={{ fontSize:11,color:'#d97706',lineHeight:1.7,margin:0,paddingLeft:14 }}>
                              <li>El asistente responderá <strong>todas</strong> las llamadas a ese número</li>
                              <li>Las llamadas personales también serán gestionadas por el bot</li>
                              <li>No podrás usarlo normalmente mientras esté activo el asistente</li>
                            </ul>
                            <label style={{ display:'flex',alignItems:'flex-start',gap:8,marginTop:10,cursor:'pointer' }}>
                              <input type="checkbox" checked={phoneWarningAck} onChange={e=>setPhoneWarningAck(e.target.checked)} style={{ accentColor:'#f59e0b',marginTop:2,flexShrink:0 }}/>
                              <span style={{ fontSize:11,color:'#94a3b8',lineHeight:1.5 }}>Entiendo que este número dejará de recibir llamadas personales normales</span>
                            </label>
                          </div>
                          <input className="inp" style={inp} value={ownPhone} onChange={e => setOwnPhone(e.target.value)}
                            placeholder="+34 600 000 000"/>
                          <p style={{ fontSize:11,color:'#475569',marginTop:5 }}>Introduce el número en formato internacional (+34...)</p>
                        </div>
                      )}
                    </div>
                    <div style={{ width:20,height:20,borderRadius:'50%',border:'2px solid',borderColor:phoneOption==='own'?'#6366f1':'#475569',background:phoneOption==='own'?'#6366f1':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
                      {phoneOption==='own'&&<div style={{width:8,height:8,borderRadius:'50%',background:'white'}}/>}
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA info */}
              {phoneOption==='dedicated' && (
                <div style={{ background:'rgba(30,41,59,0.6)',borderRadius:10,padding:'10px 14px',marginBottom:20,fontSize:12,color:'#64748b',lineHeight:1.6 }}>
                  Al continuar, quedará registrado que necesitas un número. Nuestro equipo te lo asignará en menos de 24h y te notificará por email. Puedes empezar a usar el panel ahora mismo.
                </div>
              )}

              <div style={{ display:'flex',gap:10 }}>
                <button className="btn-ghost" style={{...btn,width:'auto',padding:'12px 20px'}} onClick={() => setStep(hasSpaces?2:1)}>← Atrás</button>
                <button className="btn-primary" style={{...btn,flex:1}}
                  disabled={saving || !phoneOption || (phoneOption==='own' && (!ownPhone.trim()||!phoneWarningAck))}
                  onClick={saveStepNumero}>
                  {saving ? 'Guardando…' : 'Continuar →'}
                </button>
              </div>
              <button onClick={() => { setPhoneOption(null); setStep(stepListo) }}
                style={{ width:'100%',marginTop:10,background:'none',border:'none',color:'#475569',fontSize:12,cursor:'pointer',fontFamily:'inherit',padding:'6px' }}>
                Saltar por ahora, lo configuro más tarde
              </button>
            </div>
          )}

          {/* ══ STEP FINAL: LISTO ═══════════════════════════════════════════ */}
          {step === stepListo && (
            <div style={{ textAlign:'center' }}>
              <div style={{ width:72,height:72,background:'rgba(34,197,94,0.15)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:40 }}>
                🎉
              </div>
              <h2 style={{ fontSize:24,fontWeight:800,color:'white',marginBottom:8,letterSpacing:'-0.02em' }}>¡Todo listo!</h2>
              <p style={{ fontSize:14,color:'#64748b',marginBottom:24,lineHeight:1.6 }}>
                Tu recepcionista <strong style={{color:'white'}}>{agentName}</strong> está configurada para <strong style={{color:'white'}}>{tenant.name}</strong>
              </p>

              {/* Resumen */}
              <div style={{ background:'rgba(30,41,59,0.6)',border:'1px solid #1e293b',borderRadius:14,padding:18,marginBottom:24,textAlign:'left' }}>
                {[
                  { icon:'✓', color:'#22c55e', text: `Agente configurado: ${agentName}` },
                  { icon:'✓', color:'#22c55e', text: 'Horario de atención guardado' },
                  hasSpaces && { icon:'✓', color:'#22c55e', text: `${zones.reduce((a,z)=>a+z.tables,0)} ${unitLabel.toLowerCase()} en ${zones.length} ${zoneLabel.toLowerCase()}s` },
                  phoneOption==='dedicated' && { icon:'⏳', color:'#f59e0b', text: 'Número exclusivo: asignación en proceso (<24h)' },
                  phoneOption==='own' && ownPhone && { icon:'✓', color:'#22c55e', text: `Número configurado: ${ownPhone}` },
                  !phoneOption && { icon:'⚠', color:'#f59e0b', text: 'Número pendiente — configúralo desde Configuración' },
                  { icon:'🎁', color:'#818cf8', text: '10 llamadas gratuitas disponibles para probar' },
                ].filter(Boolean).map((item: any, i) => (
                  <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:10,marginBottom:i<2?10:0 }}>
                    <span style={{ color:item.color,fontWeight:700,flexShrink:0,fontSize:14 }}>{item.icon}</span>
                    <span style={{ fontSize:13,color:'#94a3b8',lineHeight:1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>

              {/* Qué pasa ahora */}
              <div style={{ background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:12,padding:'12px 16px',marginBottom:24,textAlign:'left' }}>
                <p style={{ fontSize:12,fontWeight:700,color:'#a5b4fc',marginBottom:8 }}>¿Qué puedes hacer ahora?</p>
                <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                  {[
                    ['📊','Ver el panel y explorar el sistema'],
                    ['📅','Crear reservas manualmente'],
                    ['⚙️','Completar la configuración del número'],
                    ['📞','Hacer tu primera llamada de prueba'],
                  ].map(([icon,text])=>(
                    <div key={text as string} style={{ display:'flex',gap:8,alignItems:'center' }}>
                      <span style={{fontSize:14}}>{icon}</span>
                      <span style={{fontSize:12,color:'#64748b'}}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button className="btn-primary" style={{...btn,fontSize:16,padding:'16px'}} onClick={completeOnboarding} disabled={saving}>
                {saving ? 'Activando…' : 'Ir al centro de control →'}
              </button>
            </div>
          )}

        </div>{/* fin tarjeta */}
      </div>
    </div>
  )
}
