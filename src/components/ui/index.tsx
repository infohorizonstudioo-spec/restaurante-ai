'use client'
import{ReactNode,ButtonHTMLAttributes,InputHTMLAttributes,SelectHTMLAttributes,TextareaHTMLAttributes,forwardRef}from'react'
import{useTenant}from'@/contexts/TenantContext'
import NotificationBell from'@/components/NotificationBell'

const RZ = {
  amber:'#F0A84E', amberDim:'rgba(240,168,78,0.10)',
  green:'#34D399', greenDim:'rgba(52,211,153,0.10)',
  red:'#F87171', redDim:'rgba(248,113,113,0.10)',
  violet:'#A78BFA', yellow:'#FBB53F',
  text:'#E8EEF6', text2:'#8895A7', text3:'#49566A',
  bg:'#0C1018', surface:'#131920', surface2:'#1A2230',
  border:'rgba(255,255,255,0.07)', borderMd:'rgba(255,255,255,0.11)',
}

export function Spinner({size=16,color=RZ.amber}:{size?:number;color?:string}){
  return(<svg width={size} height={size} viewBox='0 0 24 24' fill='none' style={{animation:'rz-spin 0.7s linear infinite'}}><circle cx='12' cy='12' r='10' stroke={color} strokeWidth='3' strokeOpacity='0.15'/><path d='M12 2a10 10 0 0 1 10 10' stroke={color} strokeWidth='3' strokeLinecap='round'/><style>{'@keyframes rz-spin{to{transform:rotate(360deg)}}'}</style></svg>)
}

export function PageLoader({text='Cargando...'}:{text?:string}){
  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:RZ.bg,gap:14}}>
      <Spinner size={28} color={RZ.amber}/>
      <p style={{fontSize:13,color:RZ.text3,fontFamily:'var(--rz-font,sans-serif)'}}>{text}</p>
    </div>
  )
}

const BG={primary:`linear-gradient(135deg,${RZ.amber},#E8923A)`,secondary:RZ.surface2,ghost:'transparent',danger:RZ.redDim}
const BC={primary:'#0C1018',secondary:RZ.text,ghost:RZ.text2,danger:RZ.red}
const BBB={primary:'none',secondary:`1px solid ${RZ.border}`,ghost:'none',danger:`1px solid ${RZ.red}40`}
const BP={sm:'5px 10px',md:'9px 16px',lg:'12px 22px'}
const BF={sm:'12px',md:'13px',lg:'15px'}

export const Button=forwardRef<HTMLButtonElement,any>(({variant='primary',size='md',loading,icon,children,disabled,style,...p},ref)=>(
  <button ref={ref} {...p} disabled={disabled||loading} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,fontFamily:'inherit',fontSize:BF[size],fontWeight:700,padding:BP[size],background:BG[variant],color:BC[variant],border:BBB[variant],borderRadius:9,cursor:(disabled||loading)?'not-allowed':'pointer',opacity:(disabled||loading)?0.55:1,transition:'all 0.15s',whiteSpace:'nowrap',textDecoration:'none',letterSpacing:'-0.01em',boxShadow:variant==='primary'?'0 2px 12px rgba(240,168,78,0.25)':'none',...style}}
    onMouseEnter={e=>{if(!disabled&&!loading&&variant==='primary'){(e.currentTarget as HTMLElement).style.transform='translateY(-1px)';(e.currentTarget as HTMLElement).style.boxShadow='0 4px 20px rgba(240,168,78,0.38)'}}}
    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='';(e.currentTarget as HTMLElement).style.boxShadow=variant==='primary'?'0 2px 12px rgba(240,168,78,0.25)':''}}>
    {loading?<Spinner size={14} color={variant==='primary'?'#0C1018':RZ.amber}/>:icon}{children&&<span>{children}</span>}
  </button>
))
Button.displayName='Button'

export const Input=forwardRef<HTMLInputElement,any>(({label,hint,error,icon,iconRight,style,...p},ref)=>(
  <div style={{width:'100%'}}>
    {label&&<label style={{display:'block',fontSize:11,fontWeight:600,color:RZ.text2,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</label>}
    <div style={{position:'relative'}}>
      {icon&&<span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:RZ.text3,display:'flex',pointerEvents:'none'}}>{icon}</span>}
      <input ref={ref} {...p} style={{width:'100%',fontFamily:'inherit',fontSize:14,color:RZ.text,background:'rgba(255,255,255,0.05)',border:error?`1px solid ${RZ.red}60`:`1px solid ${RZ.borderMd}`,borderRadius:9,padding:`10px ${iconRight?'36px':'14px'} 10px ${icon?'36px':'14px'}`,outline:'none',transition:'all 0.15s',...style}} onFocus={e=>{e.target.style.borderColor=RZ.amber;e.target.style.boxShadow=`0 0 0 3px ${RZ.amberDim}`}} onBlur={e=>{e.target.style.borderColor=error?`${RZ.red}60`:RZ.borderMd;e.target.style.boxShadow='none'}}/>
      {iconRight&&<span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:RZ.text3,display:'flex'}}>{iconRight}</span>}
    </div>
    {hint&&!error&&<p style={{fontSize:12,color:RZ.text3,marginTop:4}}>{hint}</p>}
    {error&&<p style={{fontSize:12,color:RZ.red,marginTop:4}}>{error}</p>}
  </div>
))
Input.displayName='Input'

export const Select=forwardRef<HTMLSelectElement,any>(({label,error,children,style,...p},ref)=>(
  <div style={{width:'100%'}}>
    {label&&<label style={{display:'block',fontSize:11,fontWeight:600,color:RZ.text2,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</label>}
    <select ref={ref} {...p} style={{width:'100%',fontFamily:'inherit',fontSize:14,color:RZ.text,background:RZ.surface2,border:error?`1px solid ${RZ.red}60`:`1px solid ${RZ.borderMd}`,borderRadius:9,padding:'10px 14px',outline:'none',cursor:'pointer',...style}}>{children}</select>
    {error&&<p style={{fontSize:12,color:RZ.red,marginTop:4}}>{error}</p>}
  </div>
))
Select.displayName='Select'

export const Textarea=forwardRef<HTMLTextAreaElement,any>(({label,error,style,...p},ref)=>(
  <div style={{width:'100%'}}>
    {label&&<label style={{display:'block',fontSize:11,fontWeight:600,color:RZ.text2,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</label>}
    <textarea ref={ref} {...p} style={{width:'100%',fontFamily:'inherit',fontSize:14,color:RZ.text,background:RZ.surface2,border:error?`1px solid ${RZ.red}60`:`1px solid ${RZ.borderMd}`,borderRadius:9,padding:'10px 14px',outline:'none',resize:'none',...style}}/>
    {error&&<p style={{fontSize:12,color:RZ.red,marginTop:4}}>{error}</p>}
  </div>
))
Textarea.displayName='Textarea'

const BB2:Record<string,string>={green:RZ.greenDim,amber:RZ.amberDim,red:RZ.redDim,blue:'rgba(96,165,250,0.12)',slate:RZ.surface2,indigo:'rgba(99,102,241,0.12)',purple:'rgba(167,139,250,0.12)'}
const BC2:Record<string,string>={green:RZ.green,amber:RZ.amber,red:RZ.red,blue:'#60A5FA',slate:RZ.text2,indigo:'#818CF8',purple:RZ.violet}
export function Badge({variant='slate',children,dot}:{variant?:string;children:ReactNode;dot?:boolean}){
  return(<span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:20,background:BB2[variant]||RZ.surface2,color:BC2[variant]||RZ.text2,whiteSpace:'nowrap',letterSpacing:'0.04em'}}>{dot&&<span style={{width:5,height:5,borderRadius:'50%',background:'currentColor',flexShrink:0}}/>}{children}</span>)
}

export function Card({children,hoverable,onClick,style}:{children:ReactNode;hoverable?:boolean;onClick?:()=>void;style?:any}){
  return(<div onClick={onClick} style={{background:RZ.surface,border:`1px solid ${RZ.border}`,borderRadius:12,cursor:hoverable?'pointer':'default',transition:'all 0.15s',...style}} onMouseEnter={hoverable?e=>{const el=e.currentTarget;el.style.background=RZ.surface2;el.style.borderColor=RZ.borderMd}:undefined} onMouseLeave={hoverable?e=>{const el=e.currentTarget;el.style.background=RZ.surface;el.style.borderColor=RZ.border}:undefined}>{children}</div>)
}

export function CardHeader({title,subtitle,action,icon}:{title:string;subtitle?:string;action?:ReactNode;icon?:ReactNode}){
  return(<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:`1px solid ${RZ.border}`}}><div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>{icon&&<span style={{color:RZ.text3,display:'flex',flexShrink:0}}>{icon}</span>}<div style={{minWidth:0}}><p style={{fontSize:14,fontWeight:700,color:RZ.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</p>{subtitle&&<p style={{fontSize:12,color:RZ.text3,marginTop:1}}>{subtitle}</p>}</div></div>{action&&<div style={{marginLeft:12,flexShrink:0}}>{action}</div>}</div>)
}

export function EmptyState({icon,title,description,action}:{icon:ReactNode;title:string;description?:string;action?:ReactNode}){
  return(<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'56px 24px',textAlign:'center'}}><div style={{width:52,height:52,background:RZ.amberDim,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,color:RZ.amber,fontSize:22}}>{icon}</div><p style={{fontSize:14,fontWeight:600,color:RZ.text,marginBottom:6}}>{title}</p>{description&&<p style={{fontSize:13,color:RZ.text3,marginBottom:20,maxWidth:280}}>{description}</p>}{action}</div>)
}

const AS:Record<string,{bg:string;c:string}> = {
  info:{bg:'rgba(96,165,250,0.10)',c:'#60A5FA'},
  success:{bg:RZ.greenDim,c:RZ.green},
  warning:{bg:RZ.amberDim,c:RZ.amber},
  error:{bg:RZ.redDim,c:RZ.red}
}
export function Alert({variant='info',title,children,style}:{variant?:string;title?:string;children:ReactNode;style?:any}){
  const s=AS[variant]||AS.info
  return(<div style={{display:'flex',gap:10,padding:'12px 14px',borderRadius:10,background:s.bg,border:`1px solid ${s.c}30`,color:s.c,fontSize:13,...style}}><div>{title&&<p style={{fontWeight:700,marginBottom:2}}>{title}</p>}<p style={{opacity:.85}}>{children}</p></div></div>)
}

export function Modal({open,onClose,title,children,footer,size='md'}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;footer?:ReactNode;size?:string}){
  if(!open)return null
  const mw:{[k:string]:number}={sm:420,md:560,lg:760}
  return(<div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{background:RZ.surface,border:`1px solid ${RZ.borderMd}`,borderRadius:16,boxShadow:'0 25px 60px rgba(0,0,0,0.6)',width:'100%',maxWidth:mw[size]||560,maxHeight:'90vh',overflowY:'auto'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:`1px solid ${RZ.border}`}}><p style={{fontSize:15,fontWeight:700,color:RZ.text}}>{title}</p><button onClick={onClose} style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6,border:'none',background:'transparent',cursor:'pointer',fontSize:18,color:RZ.text3}}>&times;</button></div><div style={{padding:'20px 24px'}}>{children}</div>{footer&&<div style={{display:'flex',gap:10,padding:'14px 24px',borderTop:`1px solid ${RZ.border}`,background:RZ.surface2,borderRadius:'0 0 16px 16px'}}>{footer}</div>}</div></div>)
}

export function PageHeader({title,subtitle,actions}:{title:string;subtitle?:string;actions?:ReactNode}){
  const{tenant}=useTenant()
  return(
    <header style={{height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px 0 28px',background:RZ.surface,borderBottom:`1px solid ${RZ.border}`,position:'sticky',top:0,zIndex:40,gap:12}}>
      <div style={{minWidth:0}}>
        <h1 style={{fontSize:16,fontWeight:700,color:RZ.text,letterSpacing:'-0.02em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</h1>
        {subtitle&&<p style={{fontSize:12,color:RZ.text3}}>{subtitle}</p>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        {actions&&<div style={{display:'flex',alignItems:'center',gap:8}}>{actions}</div>}
        {tenant?.id&&<NotificationBell tenantId={tenant.id}/>}
      </div>
    </header>
  )
}

export function StatCard({label,value,icon,href,bg=RZ.amberDim,color=RZ.amber}:{label:string;value:ReactNode;icon?:ReactNode;href?:string;bg?:string;color?:string}){
  const Tag=href?'a':'div' as any
  return(<Tag href={href} style={{background:RZ.surface,border:`1px solid ${RZ.border}`,borderRadius:12,padding:'18px 20px',display:'flex',flexDirection:'column',gap:14,textDecoration:'none',transition:'all 0.15s'}} onMouseEnter={href?e=>{const el=(e.currentTarget as HTMLElement);el.style.background=RZ.surface2;el.style.borderColor=RZ.borderMd}:undefined} onMouseLeave={href?e=>{const el=(e.currentTarget as HTMLElement);el.style.background=RZ.surface;el.style.borderColor=RZ.border}:undefined}><div style={{width:36,height:36,borderRadius:10,background:bg,display:'flex',alignItems:'center',justifyContent:'center',color,flexShrink:0}}>{icon}</div><div><p style={{fontFamily:'var(--rz-mono,monospace)',fontSize:26,fontWeight:700,color:RZ.text,letterSpacing:'-0.03em',lineHeight:1}}>{value}</p><p style={{fontSize:12,color:RZ.text3,marginTop:4}}>{label}</p></div></Tag>)
}

export function Skeleton({style}:{style?:any}){
  return<div style={{background:`linear-gradient(90deg,${RZ.surface} 25%,${RZ.surface2} 50%,${RZ.surface} 75%)`,backgroundSize:'200% 100%',animation:'shimmer 1.5s infinite',borderRadius:6,...style}}/>
}
