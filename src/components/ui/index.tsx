'use client'
import{ReactNode,ButtonHTMLAttributes,InputHTMLAttributes,SelectHTMLAttributes,TextareaHTMLAttributes,forwardRef}from'react'

const RZ = {
  amber:'#F0A84E', amberDim:'rgba(240,168,78,0.10)',
  green:'#34D399', greenDim:'rgba(52,211,153,0.10)',
  red:'#F87171', redDim:'rgba(248,113,113,0.10)',
  violet:'#A78BFA', yellow:'#FBB53F',
  text:'#E8EEF6', text2:'#8895A7', text3:'#49566A',
  bg:'#0C1018', surface:'#131920', surface2:'#1A2230',
  border:'rgba(255,255,255,0.07)', borderMd:'rgba(255,255,255,0.11)',
}

const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)'

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

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; icon?: ReactNode }

export const Button=forwardRef<HTMLButtonElement,ButtonProps>(({variant='primary',size='md',loading,icon,children,disabled,style,...p},ref)=>(
  <button ref={ref} {...p} disabled={disabled||loading} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,fontFamily:'inherit',fontSize:BF[size],fontWeight:700,padding:BP[size],background:BG[variant],color:BC[variant],border:BBB[variant],borderRadius:9,cursor:(disabled||loading)?'not-allowed':'pointer',opacity:(disabled||loading)?0.55:1,filter:(disabled||loading)?'saturate(0.5)':'none',transition:`all 0.2s ${EASE}`,whiteSpace:'nowrap',textDecoration:'none',letterSpacing:'-0.01em',boxShadow:variant==='primary'?`0 2px 12px rgba(240,168,78,0.25), 0 0 20px rgba(240,168,78,0.08)`:'none',...style}}
    onMouseEnter={(e: React.MouseEvent)=>{if(!disabled&&!loading){const el=e.currentTarget as HTMLElement;el.style.transform='translateY(-2px)';if(variant==='primary'){el.style.boxShadow='0 6px 24px rgba(240,168,78,0.4), 0 0 40px rgba(240,168,78,0.12)'}else if(variant==='secondary'){el.style.background=RZ.surface;el.style.borderColor=RZ.borderMd}else if(variant==='ghost'){el.style.background='rgba(255,255,255,0.04)'}}}}
    onMouseLeave={(e: React.MouseEvent)=>{if(!disabled&&!loading){const el=e.currentTarget as HTMLElement;el.style.transform='';if(variant==='primary'){el.style.boxShadow='0 2px 12px rgba(240,168,78,0.25), 0 0 20px rgba(240,168,78,0.08)'}else if(variant==='secondary'){el.style.background=RZ.surface2;el.style.borderColor=RZ.border}else if(variant==='ghost'){el.style.background='transparent'}}}}
    onMouseDown={(e: React.MouseEvent)=>{if(!disabled&&!loading){(e.currentTarget as HTMLElement).style.transform='scale(0.97)'}}}
    onMouseUp={(e: React.MouseEvent)=>{if(!disabled&&!loading){(e.currentTarget as HTMLElement).style.transform='translateY(-2px)'}}}>
    {loading?<Spinner size={14} color={variant==='primary'?'#0C1018':RZ.amber}/>:icon}{children&&<span>{children}</span>}
  </button>
))
Button.displayName='Button'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; hint?: string; error?: string; icon?: ReactNode; iconRight?: ReactNode }
export const Input=forwardRef<HTMLInputElement,InputProps>(({label,hint,error,icon,iconRight,style,...p},ref)=>(
  <div style={{width:'100%'}}>
    {label&&<label style={{display:'block',fontSize:11,fontWeight:600,color:RZ.text2,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</label>}
    <div style={{position:'relative'}}>
      {icon&&<span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:RZ.text3,display:'flex',pointerEvents:'none',transition:`color 0.2s ${EASE}`}}>{icon}</span>}
      <input ref={ref} {...p} style={{width:'100%',fontFamily:'inherit',fontSize:14,color:RZ.text,background:'rgba(255,255,255,0.04)',border:error?`1.5px solid ${RZ.red}70`:`1px solid ${RZ.borderMd}`,borderRadius:9,padding:`10px ${iconRight?'36px':'14px'} 10px ${icon?'36px':'14px'}`,outline:'none',transition:`all 0.25s ${EASE}`,...style}}
        onFocus={e=>{e.target.style.borderColor=error?RZ.red:RZ.amber;e.target.style.boxShadow=error?`0 0 0 3px ${RZ.redDim}`:`0 0 0 3px ${RZ.amberDim}`;e.target.style.background='rgba(255,255,255,0.06)';const ic=e.target.parentElement?.querySelector('[data-input-icon]') as HTMLElement|null;if(ic)ic.style.color=RZ.amber}}
        onBlur={e=>{e.target.style.borderColor=error?`${RZ.red}70`:RZ.borderMd;e.target.style.boxShadow='none';e.target.style.background='rgba(255,255,255,0.04)';const ic=e.target.parentElement?.querySelector('[data-input-icon]') as HTMLElement|null;if(ic)ic.style.color=RZ.text3}}/>
      {iconRight&&<span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:RZ.text3,display:'flex'}}>{iconRight}</span>}
    </div>
    {hint&&!error&&<p style={{fontSize:12,color:RZ.text3,marginTop:4}}>{hint}</p>}
    {error&&<p style={{fontSize:12,color:RZ.red,marginTop:4,display:'flex',alignItems:'center',gap:4}}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={RZ.red} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {error}
    </p>}
  </div>
))
Input.displayName='Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; error?: string }
export const Select=forwardRef<HTMLSelectElement,SelectProps>(({label,error,children,style,...p},ref)=>(
  <div style={{width:'100%'}}>
    {label&&<label style={{display:'block',fontSize:11,fontWeight:600,color:RZ.text2,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</label>}
    <select ref={ref} {...p} style={{width:'100%',fontFamily:'inherit',fontSize:14,color:RZ.text,background:RZ.surface2,border:error?`1px solid ${RZ.red}60`:`1px solid ${RZ.borderMd}`,borderRadius:9,padding:'10px 14px',outline:'none',cursor:'pointer',transition:`all 0.25s ${EASE}`,...style}}>{children}</select>
    {error&&<p style={{fontSize:12,color:RZ.red,marginTop:4}}>{error}</p>}
  </div>
))
Select.displayName='Select'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; error?: string }
export const Textarea=forwardRef<HTMLTextAreaElement,TextareaProps>(({label,error,style,...p},ref)=>(
  <div style={{width:'100%'}}>
    {label&&<label style={{display:'block',fontSize:11,fontWeight:600,color:RZ.text2,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</label>}
    <textarea ref={ref} {...p} style={{width:'100%',fontFamily:'inherit',fontSize:14,color:RZ.text,background:'rgba(255,255,255,0.04)',border:error?`1px solid ${RZ.red}60`:`1px solid ${RZ.borderMd}`,borderRadius:9,padding:'10px 14px',outline:'none',resize:'none',transition:`all 0.25s ${EASE}`,...style}}/>
    {error&&<p style={{fontSize:12,color:RZ.red,marginTop:4}}>{error}</p>}
  </div>
))
Textarea.displayName='Textarea'

const BB2:Record<string,string>={green:RZ.greenDim,amber:RZ.amberDim,red:RZ.redDim,blue:'rgba(96,165,250,0.12)',slate:RZ.surface2,indigo:'rgba(99,102,241,0.12)',purple:'rgba(167,139,250,0.12)'}
const BC2:Record<string,string>={green:RZ.green,amber:RZ.amber,red:RZ.red,blue:'#60A5FA',slate:RZ.text2,indigo:'#818CF8',purple:RZ.violet}
export function Badge({variant='slate',children,dot}:{variant?:string;children:ReactNode;dot?:boolean}){
  return(<span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,padding:'2px 10px',borderRadius:20,background:BB2[variant]||RZ.surface2,color:BC2[variant]||RZ.text2,whiteSpace:'nowrap',letterSpacing:'0.06em',textTransform:'uppercase'}}>
    {dot&&<span style={{width:6,height:6,borderRadius:'50%',background:'currentColor',flexShrink:0,boxShadow:`0 0 6px currentColor`,animation:'rz-badge-pulse 2s ease-in-out infinite'}}/>}
    {children}
    <style>{'@keyframes rz-badge-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(0.85)}}'}</style>
  </span>)
}

export function Card({children,hoverable,onClick,style}:{children:ReactNode;hoverable?:boolean;onClick?:()=>void;style?:any}){
  return(<div onClick={onClick} style={{background:RZ.surface,border:`1px solid ${RZ.border}`,borderRadius:12,cursor:hoverable?'pointer':'default',transition:`all 0.25s ${EASE}`,...style}}
    onMouseEnter={hoverable?e=>{const el=e.currentTarget;el.style.background=RZ.surface2;el.style.borderColor='rgba(240,168,78,0.15)';el.style.transform='scale(1.005)';el.style.boxShadow='0 4px 24px rgba(0,0,0,0.2), 0 0 0 1px rgba(240,168,78,0.06)'}:undefined}
    onMouseLeave={hoverable?e=>{const el=e.currentTarget;el.style.background=RZ.surface;el.style.borderColor=RZ.border;el.style.transform='scale(1)';el.style.boxShadow='none'}:undefined}>{children}</div>)
}

export function CardHeader({title,subtitle,action,icon}:{title:string;subtitle?:string;action?:ReactNode;icon?:ReactNode}){
  return(<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:`1px solid ${RZ.border}`}}><div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>{icon&&<span style={{color:RZ.text3,display:'flex',flexShrink:0}}>{icon}</span>}<div style={{minWidth:0}}><p style={{fontSize:14,fontWeight:700,color:RZ.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</p>{subtitle&&<p style={{fontSize:12,color:RZ.text3,marginTop:1}}>{subtitle}</p>}</div></div>{action&&<div style={{marginLeft:12,flexShrink:0}}>{action}</div>}</div>)
}

export function EmptyState({icon,title,description,action}:{icon:ReactNode;title:string;description?:string;action?:ReactNode}){
  return(<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'64px 24px',textAlign:'center'}}>
    <div style={{position:'relative',marginBottom:24}}>
      <div style={{width:72,height:72,background:`linear-gradient(145deg,rgba(240,168,78,0.14),rgba(240,168,78,0.03))`,borderRadius:22,display:'flex',alignItems:'center',justifyContent:'center',color:RZ.amber,fontSize:28,border:`1px solid rgba(240,168,78,0.15)`,boxShadow:'0 8px 32px rgba(240,168,78,0.08)',animation:'rz-empty-float 4s ease-in-out infinite'}}>{icon}</div>
      <div style={{position:'absolute',inset:-10,borderRadius:28,border:`1px dashed rgba(240,168,78,0.10)`,pointerEvents:'none',animation:'rz-empty-ring 8s linear infinite'}}/>
    </div>
    <p style={{fontSize:17,fontWeight:700,color:RZ.text,marginBottom:8,letterSpacing:'-0.02em'}}>{title}</p>
    {description&&<p style={{fontSize:13,color:RZ.text2,marginBottom:24,maxWidth:340,lineHeight:1.7}}>{description}</p>}
    {action}
    <style>{'@keyframes rz-empty-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes rz-empty-ring{to{transform:rotate(360deg)}}'}</style>
  </div>)
}

const ALERT_ICONS:Record<string,string> = {
  info:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.5 6v5m0 3v.01',
  success:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 10l2 2 4-4',
  warning:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v4m0 3v.01',
  error:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3 7l6 6m0-6l-6 6',
}
const AS:Record<string,{bg:string;c:string}> = {
  info:{bg:'rgba(96,165,250,0.10)',c:'#60A5FA'},
  success:{bg:RZ.greenDim,c:RZ.green},
  warning:{bg:RZ.amberDim,c:RZ.amber},
  error:{bg:RZ.redDim,c:RZ.red}
}
export function Alert({variant='info',title,children,style}:{variant?:string;title?:string;children:ReactNode;style?:any}){
  const s=AS[variant]||AS.info
  return(<div style={{display:'flex',gap:12,padding:'12px 16px',borderRadius:10,background:s.bg,border:`1px solid ${s.c}25`,borderLeft:`4px solid ${s.c}`,color:s.c,fontSize:13,...style}}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}><path d={ALERT_ICONS[variant]||ALERT_ICONS.info}/></svg>
    <div style={{flex:1}}>{title&&<p style={{fontWeight:700,marginBottom:3}}>{title}</p>}<p style={{opacity:.85,lineHeight:1.5}}>{children}</p></div>
  </div>)
}

export function Modal({open,onClose,title,children,footer,size='md'}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;footer?:ReactNode;size?:string}){
  if(!open)return null
  const mw:{[k:string]:number}={sm:420,md:560,lg:760}
  return(<div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,animation:'rz-modal-backdrop 0.2s ease-out'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:RZ.surface,border:`1px solid ${RZ.borderMd}`,borderRadius:16,boxShadow:'0 25px 60px rgba(0,0,0,0.6), 0 0 80px rgba(0,0,0,0.3)',width:'100%',maxWidth:mw[size]||560,maxHeight:'90vh',overflowY:'auto',animation:`rz-modal-enter 0.25s ${EASE}`}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:`1px solid ${RZ.border}`}}>
        <p style={{fontSize:15,fontWeight:700,color:RZ.text}}>{title}</p>
        <button onClick={onClose} style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,border:`1px solid transparent`,background:'transparent',cursor:'pointer',fontSize:18,color:RZ.text3,transition:`all 0.2s ${EASE}`}} aria-label="Cerrar"
          onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='rgba(255,255,255,0.06)';el.style.borderColor=RZ.border;el.style.color=RZ.text}}
          onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='transparent';el.style.borderColor='transparent';el.style.color=RZ.text3}}>&times;</button>
      </div>
      <div style={{padding:'20px 24px'}}>{children}</div>
      {footer&&<div style={{display:'flex',gap:10,padding:'14px 24px',borderTop:`1px solid ${RZ.border}`,background:RZ.surface2,borderRadius:'0 0 16px 16px'}}>{footer}</div>}
    </div>
    <style>{`@keyframes rz-modal-backdrop{from{opacity:0}to{opacity:1}}@keyframes rz-modal-enter{from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
  </div>)
}

export function PageHeader({title,subtitle,actions}:{title:string;subtitle?:string;actions?:ReactNode}){
  return(
    <header style={{height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 28px',background:RZ.surface,backdropFilter:'blur(12px)',borderBottom:'none',position:'sticky',top:0,zIndex:40,gap:12}}>
      <div style={{minWidth:0}}>
        <h1 style={{fontSize:16,fontWeight:700,color:RZ.text,letterSpacing:'-0.02em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</h1>
        {subtitle&&<p style={{fontSize:12,color:RZ.text3}}>{subtitle}</p>}
      </div>
      {actions&&<div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>{actions}</div>}
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:1,background:`linear-gradient(90deg, transparent, ${RZ.border}, rgba(240,168,78,0.08), ${RZ.border}, transparent)`}}/>
    </header>
  )
}

export function StatCard({label,value,icon,href,bg=RZ.amberDim,color=RZ.amber}:{label:string;value:ReactNode;icon?:ReactNode;href?:string;bg?:string;color?:string}){
  const baseStyle: React.CSSProperties = {background:RZ.surface,border:`1px solid ${RZ.border}`,borderRadius:12,padding:'18px 20px',display:'flex',flexDirection:'column',gap:14,textDecoration:'none',transition:`all 0.25s ${EASE}`,position:'relative',overflow:'hidden'}
  const onEnter = href ? (e: React.MouseEvent) => {const el=e.currentTarget as HTMLElement;el.style.background=RZ.surface2;el.style.borderColor=RZ.borderMd;el.style.transform='translateY(-2px)';el.style.boxShadow='0 8px 24px rgba(0,0,0,0.2)'} : undefined
  const onLeave = href ? (e: React.MouseEvent) => {const el=e.currentTarget as HTMLElement;el.style.background=RZ.surface;el.style.borderColor=RZ.border;el.style.transform='';el.style.boxShadow=''} : undefined
  const gradOverlay = <div style={{position:'absolute',top:0,right:0,width:120,height:120,background:`radial-gradient(circle at top right, ${bg}, transparent 70%)`,opacity:0.4,pointerEvents:'none'}}/>
  const inner = <>{gradOverlay}<div style={{width:40,height:40,borderRadius:11,background:`linear-gradient(135deg, ${bg}, transparent)`,display:'flex',alignItems:'center',justifyContent:'center',color,flexShrink:0,border:`1px solid ${color}20`,position:'relative',zIndex:1}}>{icon}</div><div style={{position:'relative',zIndex:1}}><p style={{fontFamily:'var(--rz-mono,monospace)',fontSize:30,fontWeight:800,color:RZ.text,letterSpacing:'-0.04em',lineHeight:1}}>{value}</p><p style={{fontSize:12,color:RZ.text3,marginTop:5,letterSpacing:'0.01em'}}>{label}</p></div></>
  if (href) return(<a href={href} style={baseStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>{inner}</a>)
  return(<div style={baseStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>{inner}</div>)
}

export function Skeleton({style}:{style?:any}){
  return<div style={{background:`linear-gradient(90deg,${RZ.surface} 0%,${RZ.surface2} 20%,rgba(255,255,255,0.06) 40%,${RZ.surface2} 60%,${RZ.surface} 100%)`,backgroundSize:'300% 100%',animation:'rz-shimmer 2s ease-in-out infinite',borderRadius:6,...style}}/>
}

/** Skeleton screen for dashboard pages -- replaces blocking PageLoader */
export function PageSkeleton({variant='list'}:{variant?:'list'|'cards'|'detail'}){
  const rows = variant==='cards' ? 4 : variant==='detail' ? 1 : 5
  return(
    <div style={{minHeight:'100vh',background:RZ.bg}}>
      {/* Header skeleton */}
      <div style={{background:RZ.surface,borderBottom:`1px solid ${RZ.border}`,padding:'14px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',height:56}}>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          <Skeleton style={{width:140,height:16,borderRadius:8}}/>
          <Skeleton style={{width:200,height:10,borderRadius:5}}/>
        </div>
        <Skeleton style={{width:32,height:32,borderRadius:8}}/>
      </div>
      <div style={{maxWidth:960,margin:'0 auto',padding:'24px 28px'}}>
        {variant==='cards' ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
            {Array.from({length:rows}).map((_,i)=>(
              <div key={i} style={{background:RZ.surface,border:`1px solid ${RZ.border}`,borderRadius:14,padding:'20px',animation:`rz-skel-fade 0.4s ${EASE} ${i*0.08}s both`}}>
                <Skeleton style={{width:44,height:44,borderRadius:12,marginBottom:16}}/>
                <Skeleton style={{width:'60%',height:22,borderRadius:7,marginBottom:10}}/>
                <Skeleton style={{width:'80%',height:12,borderRadius:5}}/>
              </div>
            ))}
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {Array.from({length:rows}).map((_,i)=>(
              <div key={i} style={{background:RZ.surface,border:`1px solid ${RZ.border}`,borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,animation:`rz-skel-fade 0.4s ${EASE} ${i*0.06}s both`}}>
                <Skeleton style={{width:42,height:42,borderRadius:11,flexShrink:0}}/>
                <div style={{flex:1,display:'flex',flexDirection:'column',gap:7}}>
                  <Skeleton style={{width:'40%',height:14,borderRadius:6}}/>
                  <Skeleton style={{width:'65%',height:10,borderRadius:5}}/>
                </div>
                <Skeleton style={{width:64,height:24,borderRadius:7}}/>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes rz-shimmer{0%{background-position:300% 0}100%{background-position:-300% 0}}@keyframes rz-skel-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
