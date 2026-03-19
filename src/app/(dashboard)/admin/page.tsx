'use client'
import NotifBell from '@/components/NotifBell'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const C = {
  amber:'#F0A84E', amberDim:'rgba(240,168,78,0.10)', amberBorder:'rgba(240,168,78,0.25)',
  teal:'#2DD4BF', tealDim:'rgba(45,212,191,0.10)',
  green:'#4ADE80', greenDim:'rgba(74,222,128,0.10)',
  red:'#F87171', redDim:'rgba(248,113,113,0.10)',
  violet:'#A78BFA', violetDim:'rgba(167,139,250,0.12)',
  text:'#E8EEF6', text2:'#8895A7', text3:'#49566A',
  bg:'#090C13', surface:'#0F141E', surface2:'#151D2B', surface3:'#1A2235',
  border:'rgba(255,255,255,0.06)', borderMd:'rgba(255,255,255,0.10)',
}
const PLANS: Record<string,{label:string;price:number;calls:number;color:string;bg:string}> = {
  trial:    {label:'Trial',    price:0,   calls:10,  color:'rgba(255,255,255,0.35)', bg:'rgba(255,255,255,0.04)'},
  free:     {label:'Trial',    price:0,   calls:10,  color:'rgba(255,255,255,0.35)', bg:'rgba(255,255,255,0.04)'},
  starter:  {label:'Starter',  price:149, calls:150, color:'#60A5FA', bg:'rgba(96,165,250,0.10)'},
  pro:      {label:'Pro',      price:299, calls:600, color:C.violet, bg:C.violetDim},
  business: {label:'Business', price:499, calls:600, color:C.green,  bg:C.greenDim},
  enterprise:{label:'Business',price:499, calls:600, color:C.green,  bg:C.greenDim},
}
const TYPES: Record<string,string> = {
  restaurante:'🍽️ Restaurante', bar:'🍺 Bar', cafeteria:'☕ Cafetería',
  peluqueria:'✂️ Peluquería', clinica_dental:'🦷 Dental', clinica_medica:'🏥 Clínica',
  asesoria:'💼 Asesoría', seguros:'🛡️ Seguros', inmobiliaria:'🏠 Inmobiliaria',
  taller:'🔧 Taller', gimnasio:'🏋️ Gimnasio', otro:'◻ Otro',
}
const emptyTenant = { name:'', slug:'', type:'restaurante', email:'', phone:'' }
const emptyUser   = { name:'', email:'', password:'', tenantId:'' }

function Pill({label,color,bg}:{label:string;color:string;bg:string}) {
  return <span style={{fontSize:10,padding:'2px 9px',borderRadius:8,background:bg,color,fontWeight:700,flexShrink:0}}>{label}</span>
}
function UsageBar({used,total,color}:{used:number;total:number;color:string}) {
  const pct = total > 0 ? Math.min(100, Math.round(used/total*100)) : 0
  const barColor = pct > 90 ? C.red : pct > 70 ? C.amber : color
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:10,color:C.text3}}>{used} / {total} llamadas</span>
        <span style={{fontSize:10,color:barColor,fontWeight:600}}>{pct}%</span>
      </div>
      <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2}}>
        <div style={{height:'100%',width:pct+'%',background:barColor,borderRadius:2,transition:'width 0.4s'}}/>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [tenants, setTenants]       = useState<any[]>([])
  const [tab, setTab]               = useState<'tenants'|'users'|'planes'>('tenants')
  const [showModal, setShowModal]   = useState(false)
  const [tenantForm, setTenantForm] = useState(emptyTenant)
  const [userForm, setUserForm]     = useState(emptyUser)
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState('')
  const [search, setSearch]         = useState('')

  useEffect(() => { loadTenants() }, [])

  async function loadTenants() {
    const { data } = await supabase.from('tenants')
      .select('id,name,slug,type,plan,email,phone,active,created_at,agent_name,agent_phone,plan_calls_used,plan_calls_included,free_calls_used,free_calls_limit,call_count')
      .order('created_at', { ascending: false })
    setTenants(data || [])
  }

  async function createTenant() {
    if (!tenantForm.name || !tenantForm.slug) { setMsg('Nombre y slug obligatorios'); return }
    setSaving(true); setMsg('')
    const { data, error } = await supabase.from('tenants').insert({
      name: tenantForm.name, slug: tenantForm.slug.toLowerCase().replace(/\s+/g,'-'),
      type: tenantForm.type, email: tenantForm.email||null, phone: tenantForm.phone||null,
      plan:'trial', active:true,
    }).select().single()
    setSaving(false)
    if (error) { setMsg('Error: '+error.message); return }
    setTenants(prev=>[data,...prev]); setShowModal(false); setTenantForm(emptyTenant); setMsg('✅ Negocio creado')
  }

  async function createUser() {
    if (!userForm.email||!userForm.password||!userForm.tenantId) { setMsg('Campos obligatorios vacíos'); return }
    if (userForm.password.length < 8) { setMsg('Contraseña mínimo 8 caracteres'); return }
    setSaving(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/create-user', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(session?.access_token||'')},
      body:JSON.stringify({email:userForm.email,password:userForm.password,name:userForm.name||userForm.email,tenantId:userForm.tenantId,role:'client'})
    })
    const data = await res.json(); setSaving(false)
    if (!res.ok) { setMsg('Error: '+data.error); return }
    setUserForm(emptyUser); setMsg('✅ Acceso creado para '+userForm.email)
  }

  async function changePlan(tenantId:string, plan:string) {
    const {data:{session}} = await supabase.auth.getSession()
    const res = await fetch('/api/admin/update-plan',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+(session?.access_token||'')},
      body:JSON.stringify({tenantId,plan})
    })
    if (res.ok) { setTenants(prev=>prev.map(t=>t.id===tenantId?{...t,plan}:t)); setMsg('✅ Plan actualizado') }
  }

  async function toggleActive(tenantId:string, active:boolean) {
    await supabase.from('tenants').update({active}).eq('id',tenantId)
    setTenants(prev=>prev.map(t=>t.id===tenantId?{...t,active}:t))
  }

  const filtered = tenants.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase()))
  const mrr = tenants.reduce((s,t)=>s+(PLANS[t.plan]?.price||0),0)
  const paying = tenants.filter(t=>!['trial','free'].includes(t.plan)).length
  const totalCalls = tenants.reduce((s,t)=>s+(t.call_count||0),0)

  const inp = {width:'100%',background:C.surface3,border:`1px solid ${C.border}`,borderRadius:9,padding:'9px 12px',fontSize:13,color:C.text,fontFamily:'inherit',boxSizing:'border-box' as const}
  const sel = {...inp,cursor:'pointer'}

  return (
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:"'Sora',-apple-system,sans-serif",color:C.text}}>
      {/* HEADER */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'14px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:20}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:32,height:32,background:`linear-gradient(135deg,${C.amber},#E8943A)`,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,color:'#0A0D14'}}>H</div>
          <div>
            <p style={{fontSize:14,fontWeight:700,color:C.text,letterSpacing:'-0.02em'}}>Horizon Studio <span style={{color:C.amber}}>Admin</span></p>
            <p style={{fontSize:11,color:C.text3}}>{tenants.length} negocios · {paying} de pago</p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar negocio..." style={{...inp,width:200,padding:'6px 12px',fontSize:12}}/>
          <button onClick={()=>supabase.auth.signOut().then(()=>router.push('/login'))} style={{fontSize:12,color:C.text3,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>Salir →</button>
          <NotifBell/>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 24px 60px'}}>

        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          {[
            {label:'Facturado este mes', value:`${mrr.toLocaleString('es-ES')}€`, sub:'ingresos mensuales',       color:C.green,  bg:C.greenDim},
            {label:'Negocios',           value:tenants.length,                    sub:'total en la plataforma',  color:C.violet, bg:C.violetDim},
            {label:'Pagando',            value:paying,                            sub:'con plan mensual activo',  color:C.amber,  bg:C.amberDim},
            {label:'Llamadas',           value:totalCalls.toLocaleString('es-ES'),sub:'gestionadas en total',    color:C.teal,   bg:C.tealDim},
          ].map(k=>(
            <div key={k.label} style={{background:k.bg,border:`1px solid ${k.color}30`,borderRadius:14,padding:'16px 18px'}}>
              <p style={{fontSize:26,fontWeight:800,color:k.color,letterSpacing:'-0.04em'}}>{k.value}</p>
              <p style={{fontSize:12,fontWeight:600,color:C.text,marginTop:2}}>{k.label}</p>
              <p style={{fontSize:11,color:C.text3,marginTop:1}}>{k.sub}</p>
            </div>
          ))}
        </div>

        {msg&&<div style={{padding:'10px 16px',borderRadius:10,marginBottom:16,background:msg.startsWith('✅')?C.greenDim:C.redDim,border:`1px solid ${msg.startsWith('✅')?C.green:C.red}30`,fontSize:13,color:msg.startsWith('✅')?C.green:C.red,display:'flex',justifyContent:'space-between'}}>
          <span>{msg}</span><button onClick={()=>setMsg('')} style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontSize:16}}>✕</button>
        </div>}

        {/* TABS */}
        <div style={{display:'flex',gap:4,borderBottom:`1px solid ${C.border}`,marginBottom:20}}>
          {([['tenants','Mis negocios'],['users','Dar acceso'],['planes','Cambiar plan']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)}
              style={{padding:'9px 18px',fontSize:13,fontWeight:600,border:'none',borderBottom:`2px solid ${tab===k?C.amber:'transparent'}`,
                background:'none',color:tab===k?C.amber:C.text3,cursor:'pointer',fontFamily:'inherit',marginBottom:-1,transition:'color 0.15s'}}>
              {l}
            </button>
          ))}
        </div>

        {/* TAB: NEGOCIOS */}
        {tab==='tenants'&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <p style={{fontSize:13,fontWeight:700,color:C.text}}>Negocios registrados ({filtered.length})</p>
              <button onClick={()=>{setShowModal(true);setMsg('')}}
                style={{padding:'7px 16px',fontSize:12,fontWeight:700,background:C.amber,color:'#0A0D14',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}>
                + Nuevo negocio
              </button>
            </div>
            {filtered.length===0?(
              <div style={{padding:'48px 24px',textAlign:'center',color:C.text3,fontSize:13}}>Sin negocios{search?' que coincidan con la búsqueda':''}</div>
            ):filtered.map((t,i)=>{
              const pl   = PLANS[t.plan]||PLANS.trial
              const isTrial = ['trial','free'].includes(t.plan)
              const used = isTrial ? (t.free_calls_used||0) : (t.plan_calls_used||0)
              const total= isTrial ? (t.free_calls_limit||10) : (t.plan_calls_included||pl.calls)
              return (
                <div key={t.id} style={{borderTop:i>0?`1px solid ${C.border}`:'none',padding:'14px 20px',display:'grid',gridTemplateColumns:'1fr auto',gap:16,alignItems:'center'}}>
                  <div style={{display:'flex',gap:12,alignItems:'flex-start',minWidth:0}}>
                    <div style={{width:38,height:38,borderRadius:10,background:pl.bg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:pl.color,flexShrink:0}}>
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                        <p style={{fontSize:13,fontWeight:700,color:t.active?C.text:'rgba(255,255,255,0.3)'}}>{t.name}</p>
                        <Pill label={pl.label} color={pl.color} bg={pl.bg}/>
                        {!t.active&&<Pill label="Inactivo" color={C.red} bg={C.redDim}/>}
                        {t.agent_phone&&<Pill label="📞 IA activa" color={C.teal} bg={C.tealDim}/>}
                      </div>
                      <p style={{fontSize:11,color:C.text3,marginBottom:6}}>{TYPES[t.type]||t.type} · {t.email||t.slug} · Creado {new Date(t.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}</p>
                      <UsageBar used={used} total={total} color={pl.color}/>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0,flexDirection:'column',alignItems:'flex-end'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>{setUserForm(f=>({...f,tenantId:t.id}));setTab('users')}}
                        style={{fontSize:11,padding:'4px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:C.surface2,color:C.text2,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
                        Dar acceso
                      </button>
                      <button onClick={()=>toggleActive(t.id,!t.active)}
                        style={{fontSize:11,padding:'4px 10px',borderRadius:7,border:`1px solid ${t.active?C.border:C.amberBorder}`,background:t.active?C.surface2:C.amberDim,color:t.active?C.text3:C.amber,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
                        {t.active?'Pausar':'Activar'}
                      </button>
                    </div>
                    <p style={{fontSize:10,color:C.text3,fontWeight:600}}>{pl.price>0?pl.price+'€/mes':'Gratis'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TAB: CREAR CLIENTE */}
        {tab==='users'&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'24px',maxWidth:480}}>
            <p style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:20}}>Dar acceso a un cliente</p>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <p style={{fontSize:11,color:C.text3,marginBottom:6,fontWeight:600}}>NEGOCIO *</p>
                <select value={userForm.tenantId} onChange={e=>setUserForm(f=>({...f,tenantId:e.target.value}))} style={sel}>
                  <option value="">— Selecciona negocio —</option>
                  {tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {([{l:'NOMBRE DEL CONTACTO',k:'name',t:'text',p:'Fernando García'},{l:'EMAIL *',k:'email',t:'email',p:'cliente@negocio.com'},{l:'CONTRASEÑA *',k:'password',t:'password',p:'Mínimo 8 caracteres'}] as const).map(f=>(
                <div key={f.k}>
                  <p style={{fontSize:11,color:C.text3,marginBottom:6,fontWeight:600}}>{f.l}</p>
                  <input type={f.t} placeholder={f.p} value={(userForm as any)[f.k]} onChange={e=>setUserForm(p=>({...p,[f.k]:e.target.value}))} style={inp}/>
                </div>
              ))}
              <button onClick={createUser} disabled={saving}
                style={{padding:'12px',fontSize:13,fontWeight:700,background:saving?'rgba(240,168,78,0.4)':C.amber,color:'#0A0D14',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',opacity:saving?0.7:1,marginTop:4}}>
                {saving?'Creando...':'Crear acceso de cliente'}
              </button>
            </div>
          </div>
        )}

        {/* TAB: PLANES */}
        {tab==='planes'&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.border}`}}>
              <p style={{fontSize:13,fontWeight:700,color:C.text}}>Cambiar plan de cada negocio</p>
              <p style={{fontSize:11,color:C.text3,marginTop:2}}>Básico 149€ · Profesional 299€ · Completo 499€ al mes</p>
            </div>
            {tenants.map((t,i)=>{
              const pl=PLANS[t.plan]||PLANS.trial
              return (
                <div key={t.id} style={{borderTop:i>0?`1px solid ${C.border}`:'none',padding:'12px 20px',display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:34,height:34,borderRadius:9,background:pl.bg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:pl.color,fontSize:13,flexShrink:0}}>{t.name.charAt(0)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:600,color:C.text}}>{t.name}</p>
                    <p style={{fontSize:11,color:C.text3}}>{TYPES[t.type]||t.type}</p>
                  </div>
                  <select value={t.plan} onChange={e=>changePlan(t.id,e.target.value)}
                    style={{...sel,width:'auto',minWidth:180,padding:'6px 10px',fontSize:12}}>
                    <option value="trial">Prueba gratuita (10 llamadas)</option>
                    <option value="starter">Básico — 149€/mes · 150 llamadas</option>
                    <option value="pro">Profesional — 299€/mes · 600 llamadas</option>
                    <option value="business">Completo — 499€/mes · 600 llamadas</option>
                  </select>
                  <span style={{fontSize:12,fontWeight:700,color:pl.color,minWidth:60,textAlign:'right'}}>{pl.price>0?pl.price+'€':'Gratis'}</span>
                </div>
              )
            })}
          </div>
        )}

      </div>

      {/* MODAL NUEVO NEGOCIO */}
      {showModal&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setShowModal(false)}}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:16}}>
          <div style={{background:C.surface2,border:`1px solid ${C.borderMd}`,borderRadius:16,padding:'24px',width:'100%',maxWidth:440,display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <p style={{fontSize:15,fontWeight:700,color:C.text}}>Nuevo negocio</p>
              <button onClick={()=>setShowModal(false)} style={{background:'none',border:'none',color:C.text3,cursor:'pointer',fontSize:20}}>✕</button>
            </div>
            {([{l:'Nombre *',k:'name',t:'text'},{l:'Slug URL',k:'slug',t:'text'},{l:'Email',k:'email',t:'email'},{l:'Teléfono',k:'phone',t:'tel'}] as const).map(f=>(
              <div key={f.k}>
                <p style={{fontSize:11,color:C.text3,marginBottom:5,fontWeight:600}}>{f.l.toUpperCase()}</p>
                <input type={f.t} value={(tenantForm as any)[f.k]} onChange={e=>setTenantForm(p=>({...p,[f.k]:e.target.value}))} style={inp}/>
              </div>
            ))}
            <div>
              <p style={{fontSize:11,color:C.text3,marginBottom:5,fontWeight:600}}>TIPO DE NEGOCIO</p>
              <select value={tenantForm.type} onChange={e=>setTenantForm(p=>({...p,type:e.target.value}))} style={sel}>
                {Object.entries(TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:10,marginTop:4}}>
              <button onClick={()=>setShowModal(false)} style={{flex:1,padding:'11px',fontSize:13,borderRadius:9,border:`1px solid ${C.border}`,background:'transparent',color:C.text2,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={createTenant} disabled={saving}
                style={{flex:1,padding:'11px',fontSize:13,fontWeight:700,borderRadius:9,border:'none',background:saving?'rgba(240,168,78,0.4)':C.amber,color:'#0A0D14',cursor:'pointer',fontFamily:'inherit',opacity:saving?0.7:1}}>
                {saving?'Creando...':'Crear negocio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
