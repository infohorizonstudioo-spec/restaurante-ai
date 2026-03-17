'use client'
import{ReactNode,ButtonHTMLAttributes,InputHTMLAttributes,SelectHTMLAttributes,TextareaHTMLAttributes,forwardRef}from'react'

export function Spinner({size=16,color='#3b82f6'}){
  return(<svg width={size} height={size} viewBox='0 0 24 24' fill='none' style={{animation:'spin 0.7s linear infinite'}}><circle cx='12' cy='12' r='10' stroke={color} strokeWidth='3' strokeOpacity='0.2'/><path d='M12 2a10 10 0 0 1 10 10' stroke={color} strokeWidth='3' strokeLinecap='round'/><style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style></svg>)
}

export function PageLoader({text='Cargando...'}){
  return(<div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#f8fafc',gap:12}}><Spinner size={28}/><p style={{fontSize:13,color:'#94a3b8'}}>{text}</p></div>)
}

const BG={primary:'linear-gradient(135deg,#1e40af,#3b82f6)',secondary:'#ffffff',ghost:'transparent',danger:'#fef2f2'}
const BC={primary:'white',secondary:'#374151',ghost:'#374151',danger:'#dc2626'}
const BBB={primary:'none',secondary:'1px solid #d1d5db',ghost:'none',danger:'1px solid #fecaca'}
const BP={sm:'5px 10px',md:'9px 16px',lg:'12px 22px'}
const BF={sm:'12px',md:'13px',lg:'15px'}

export const Button=forwardRef(({variant='primary',size='md',loading,icon,children,disabled,style,...p},ref)=>(
  <button ref={ref} {...p} disabled={disabled||loading} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,fontFamily:'inherit',fontSize:BF[size],fontWeight:600,padding:BP[size],background:BG[variant],color:BC[variant],border:BBB[variant],borderRadius:9,cursor:(disabled||loading)?'not-allowed':'pointer',opacity:(disabled||loading)?0.6:1,transition:'all 0.15s',whiteSpace:'nowrap',textDecoration:'none',...style}}>
    {loading?<Spinner size={14} color={variant==='primary'?'white':'#3b82f6'}/>:icon}{children&&<span>{children}</span>}
  </button>
))
Button.displayName='Button'

export const Input=forwardRef(({label,hint,error,icon,iconRight,style,...p},ref)=>(
  <div style={{width:'100%'}}>
    {label&&<label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</label>}
    <div style={{position:'relative'}}>
      {icon&&<span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',display:'flex',pointerEvents:'none'}}>{icon}</span>}
      <input ref={ref} {...p} style={{width:'100%',fontFamily:'inherit',fontSize:14,color:'#0f172a',background:'#fafafa',border:error?'1px solid #fca5a5':'1px solid #d1d5db',borderRadius:9,padding:`9px ${iconRight?'36px':'12px'} 9px ${icon?'36px':'12px'}`,outline:'none',transition:'all 0.15s',...style}} onFocus={e=>{e.target.style.borderColor='#3b82f6';e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.15)'}} onBlur={e=>{e.target.style.borderColor=error?'#fca5a5':'#d1d5db';e.target.style.boxShadow='none'}}/>
      {iconRight&&<span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',display:'flex'}}>{iconRight}</span>}
    </div>
    {hint&&!error&&<p style={{fontSize:12,color:'#94a3b8',marginTop:4}}>{hint}</p>}
    {error&&<p style={{fontSize:12,color:'#dc2626',marginTop:4}}>{error}</p>}
  </div>
))
Input.displayName='Input'

export const Select=forwardRef(({label,error,children,style,...p},ref)=>(
  <div style={{width:'100%'}}>
    {label&&<label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</label>}
    <select ref={ref} {...p} style={{width:'100%',fontFamily:'inherit',fontSize:14,color:'#0f172a',background:'#fafafa',border:error?'1px solid #fca5a5':'1px solid #d1d5db',borderRadius:9,padding:'9px 12px',outline:'none',cursor:'pointer',...style}}>{children}</select>
    {error&&<p style={{fontSize:12,color:'#dc2626',marginTop:4}}>{error}</p>}
  </div>
))
Select.displayName='Select'

export const Textarea=forwardRef(({label,error,style,...p},ref)=>(
  <div style={{width:'100%'}}>
    {label&&<label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</label>}
    <textarea ref={ref} {...p} style={{width:'100%',fontFamily:'inherit',fontSize:14,color:'#0f172a',background:'#fafafa',border:error?'1px solid #fca5a5':'1px solid #d1d5db',borderRadius:9,padding:'9px 12px',outline:'none',resize:'none',...style}}/>
    {error&&<p style={{fontSize:12,color:'#dc2626',marginTop:4}}>{error}</p>}
  </div>
))
Textarea.displayName='Textarea'

const BB2={green:'#d1fae5',amber:'#fef3c7',red:'#fee2e2',blue:'#dbeafe',slate:'#f1f5f9',indigo:'#e0e7ff',purple:'#ede9fe'}
const BC2={green:'#065f46',amber:'#92400e',red:'#991b1b',blue:'#1e40af',slate:'#475569',indigo:'#3730a3',purple:'#5b21b6'}
export function Badge({variant='slate',children,dot}){
  return(<span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:BB2[variant],color:BC2[variant],whiteSpace:'nowrap'}}>{dot&&<span style={{width:5,height:5,borderRadius:'50%',background:'currentColor',flexShrink:0}}/>}{children}</span>)
}

export function Card({children,hoverable,onClick,style}){
  return(<div onClick={onClick} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,boxShadow:'0 1px 3px rgba(0,0,0,0.05)',cursor:hoverable?'pointer':'default',transition:'all 0.15s',...style}} onMouseEnter={hoverable?e=>{const el=e.currentTarget;el.style.borderColor='#bfdbfe';el.style.boxShadow='0 4px 12px rgba(0,0,0,0.07)'}:undefined} onMouseLeave={hoverable?e=>{const el=e.currentTarget;el.style.borderColor='#e2e8f0';el.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'}:undefined}>{children}</div>)
}

export function CardHeader({title,subtitle,action,icon}){
  return(<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid #f1f5f9'}}><div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>{icon&&<span style={{color:'#94a3b8',display:'flex',flexShrink:0}}>{icon}</span>}<div style={{minWidth:0}}><p style={{fontSize:14,fontWeight:600,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</p>{subtitle&&<p style={{fontSize:12,color:'#94a3b8',marginTop:1}}>{subtitle}</p>}</div></div>{action&&<div style={{marginLeft:12,flexShrink:0}}>{action}</div>}</div>)
}

export function EmptyState({icon,title,description,action}){
  return(<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'56px 24px',textAlign:'center'}}><div style={{width:48,height:48,background:'#f1f5f9',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,color:'#94a3b8'}}>{icon}</div><p style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:6}}>{title}</p>{description&&<p style={{fontSize:13,color:'#94a3b8',marginBottom:20,maxWidth:280}}>{description}</p>}{action}</div>)
}

export function Alert({variant='info',title,children}){
  const st={info:{bg:'#eff6ff',c:'#1d4ed8'},success:{bg:'#f0fdf4',c:'#166534'},warning:{bg:'#fffbeb',c:'#92400e'},error:{bg:'#fef2f2',c:'#991b1b'}}
  const s=st[variant]
  return(<div style={{display:'flex',gap:10,padding:'12px 14px',borderRadius:10,background:s.bg,color:s.c,fontSize:13}}><div>{title&&<p style={{fontWeight:600,marginBottom:2}}>{title}</p>}<p style={{opacity:.9}}>{children}</p></div></div>)
}

export function Modal({open,onClose,title,children,footer,size='md'}){
  if(!open)return null
  const mw={sm:420,md:560,lg:760}[size]
  return(<div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(15,23,42,0.5)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{background:'white',borderRadius:16,boxShadow:'0 25px 50px rgba(0,0,0,0.15)',width:'100%',maxWidth:mw,maxHeight:'90vh',overflowY:'auto'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid #e2e8f0'}}><p style={{fontSize:15,fontWeight:600,color:'#0f172a'}}>{title}</p><button onClick={onClose} style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6,border:'none',background:'transparent',cursor:'pointer',fontSize:18,color:'#94a3b8'}}>&times;</button></div><div style={{padding:'20px 24px'}}>{children}</div>{footer&&<div style={{display:'flex',gap:10,padding:'14px 24px',borderTop:'1px solid #e2e8f0',background:'#fafafa',borderRadius:'0 0 16px 16px'}}>{footer}</div>}</div></div>)
}

export function PageHeader({title,subtitle,actions}){
  return(<header style={{height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',background:'white',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:40,gap:12}}><div style={{minWidth:0}}><h1 style={{fontSize:15,fontWeight:600,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</h1>{subtitle&&<p style={{fontSize:12,color:'#94a3b8'}}>{subtitle}</p>}</div>{actions&&<div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>{actions}</div>}</header>)
}

export function StatCard({label,value,icon,href,bg='#eff6ff',color='#1d4ed8'}){
  const Tag=href?'a':'div'
  return(<Tag href={href} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:'18px 20px',display:'flex',flexDirection:'column',gap:14,textDecoration:'none',transition:'all 0.15s',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}} onMouseEnter={href?e=>{const el=e.currentTarget;el.style.borderColor='#bfdbfe';el.style.boxShadow='0 4px 12px rgba(0,0,0,0.07)'}:undefined} onMouseLeave={href?e=>{const el=e.currentTarget;el.style.borderColor='#e2e8f0';el.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'}:undefined}><div style={{width:36,height:36,borderRadius:10,background:bg,display:'flex',alignItems:'center',justifyContent:'center',color,flexShrink:0}}>{icon}</div><div><p style={{fontSize:26,fontWeight:700,color:'#0f172a',letterSpacing:'-0.02em',lineHeight:1}}>{value}</p><p style={{fontSize:12,color:'#94a3b8',marginTop:4}}>{label}</p></div></Tag>)
}

export function Skeleton({style}){
  return<div style={{background:'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',backgroundSize:'200% 100%',animation:'shimmer 1.5s infinite',borderRadius:6,...style}}/>
}