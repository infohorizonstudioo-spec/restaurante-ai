'use client'
export const dynamic='force-dynamic'
import{useEffect,useState,useMemo}from'react'
import{supabase}from'@/lib/supabase'
import{Users,Search,Phone,Calendar,Mail,TrendingUp}from'lucide-react'
import{PageLoader,PageHeader,Card,EmptyState,Input,Select,Badge}from'@/components/ui'

export default function ClientesPage(){
  const[customers,setCustomers]=useState<any[]>([])
  const[loading,setLoading]=useState(true)
  const[search,setSearch]=useState('')
  const[sort,setSort]=useState('recent')

  useEffect(()=>{
    let mounted=true
    async function load(){
      const{data:{user}}=await supabase.auth.getUser()
      if(!user)return
      const{data:p}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
      if(!p?.tenant_id)return
      const{data:c}=await supabase.from('customers').select('*').eq('tenant_id',(p as any).tenant_id).order('created_at',{ascending:false})
      if(mounted){setCustomers(c||[]);setLoading(false)}
    }
    load()
    return()=>{mounted=false}
  },[])

  const filtered=useMemo(()=>{
    let list=customers.filter(c=>{
      if(!search)return true
      const q=search.toLowerCase()
      return c.name?.toLowerCase().includes(q)||c.phone?.includes(search)||c.email?.toLowerCase().includes(q)
    })
    if(sort==='name')list=[...list].sort((a,b)=>(a.name||'').localeCompare(b.name||''))
    if(sort==='visits')list=[...list].sort((a,b)=>(b.total_reservations||0)-(a.total_reservations||0))
    return list
  },[customers,search,sort])

  if(loading)return<PageLoader/>
  const total=customers.length
  const thisMonth=customers.filter(c=>{if(!c.created_at)return false;const d=new Date(c.created_at),n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()}).length

  return(
    <div style={{background:'var(--color-bg)',minHeight:'100vh'}}>
      <PageHeader title="Clientes" subtitle={`${total} registrados`}/>
      <div style={{maxWidth:'var(--content-max)',margin:'0 auto',padding:'var(--content-pad)'}}>
        {total>0&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
            {[{label:'Total',value:total,icon:<Users size={15}/>},{label:'Este mes',value:thisMonth,icon:<TrendingUp size={15}/>},{label:'Visitas totales',value:customers.reduce((s,c)=>s+(c.total_reservations||0),0),icon:<Calendar size={15}/>}].map(s=>(
              <div key={s.label} className="card" style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:34,height:34,borderRadius:10,background:'var(--color-brand-muted)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--color-brand)',flexShrink:0}}>{s.icon}</div>
                <div><p style={{fontSize:18,fontWeight:700,letterSpacing:'-0.02em'}}>{s.value}</p><p className="text-body-sm" style={{color:'var(--color-text-muted)'}}>{s.label}</p></div>
              </div>
            ))}
          </div>
        )}
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <Input icon={<Search size={14}/>} placeholder="Buscar por nombre, teléfono o email..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <Select value={sort} onChange={e=>setSort(e.target.value)} style={{maxWidth:180,flexShrink:0}}>
            <option value="recent">Más recientes</option>
            <option value="name">Por nombre</option>
            <option value="visits">Más visitas</option>
          </Select>
        </div>
        {filtered.length===0
          ? <div className="card"><EmptyState icon={<Users size={22}/>} title={search?'Sin resultados':'Sin clientes aún'} description={search?'No hay clientes que coincidan':'Los clientes se añaden automáticamente con cada reserva'}/></div>
          : <div className="card" style={{overflow:'hidden'}}>
              <table className="table-pro" style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  <th>Cliente</th>
                  <th className="hidden sm:table-cell">Teléfono</th>
                  <th className="hidden md:table-cell">Email</th>
                  <th className="hidden sm:table-cell" style={{width:80,textAlign:'center'}}>Visitas</th>
                  <th className="hidden lg:table-cell" style={{width:140}}>Alta</th>
                </tr></thead>
                <tbody>
                  {filtered.map(c=>(
                    <tr key={c.id}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:34,height:34,borderRadius:'50%',background:`hsl(${(c.name?.charCodeAt(0)||0)*7%360},60%,90%)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:`hsl(${(c.name?.charCodeAt(0)||0)*7%360},50%,35%)`,flexShrink:0}}>
                            {c.name?.[0]?.toUpperCase()||'?'}
                          </div>
                          <p className="text-body" style={{fontWeight:500}}>{c.name}</p>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell">
                        {c.phone?<a href={`tel:${c.phone}`} style={{display:'flex',alignItems:'center',gap:5,color:'var(--color-text-secondary)',textDecoration:'none',fontSize:13}}><Phone size={12} style={{color:'var(--color-text-muted)'}}/>{c.phone}</a>:<span style={{color:'var(--color-text-disabled)'}}>—</span>}
                      </td>
                      <td className="hidden md:table-cell">
                        {c.email?<a href={`mailto:${c.email}`} style={{display:'flex',alignItems:'center',gap:5,color:'var(--color-text-secondary)',textDecoration:'none',fontSize:13,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><Mail size={12} style={{color:'var(--color-text-muted)'}}/>{c.email}</a>:<span style={{color:'var(--color-text-disabled)'}}>—</span>}
                      </td>
                      <td className="hidden sm:table-cell" style={{textAlign:'center'}}>
                        <span style={{fontWeight:600,color:(c.total_reservations||0)>3?'var(--color-success)':'var(--color-text-secondary)'}}>{c.total_reservations||0}</span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-body-sm" style={{color:'var(--color-text-muted)'}}>{c.created_at?new Date(c.created_at).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}):'—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  )
}