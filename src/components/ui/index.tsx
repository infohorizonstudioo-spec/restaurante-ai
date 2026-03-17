'use client'
import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

export function PageLoader({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'var(--color-bg)'}}>
      <div className="flex flex-col items-center gap-3">
        <Spinner size={28} style={{color:'var(--color-brand)'}} />
        <p className="text-body-sm" style={{color:'var(--color-text-muted)'}}>{text}</p>
      </div>
    </div>
  )
}

type BtnVariant = 'primary'|'secondary'|'ghost'|'danger'
type BtnSize = 'sm'|'md'|'lg'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant; size?: BtnSize; loading?: boolean; icon?: ReactNode; iconRight?: ReactNode
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({variant='primary',size='md',loading,icon,iconRight,children,disabled,className='', ...props},ref) => (
    <button ref={ref} {...props} disabled={disabled||loading} className={`btn btn-${variant} btn-${size} ${className}`}>
      {loading ? <Spinner size={14}/> : icon}
      {children && <span>{children}</span>}
      {iconRight}
    </button>
  )
)
Button.displayName='Button'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string; hint?: string; error?: string; icon?: ReactNode; iconRight?: ReactNode
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({label,hint,error,icon,iconRight,className='', ...props},ref) => (
    <div className="w-full">
      {label && <label className="text-label mb-1.5 block" style={{color:'var(--color-text-muted)'}}>{label}</label>}
      <div style={{position:'relative'}}>
        {icon && <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--color-text-muted)',pointerEvents:'none',display:'flex'}}>{icon}</span>}
        <input ref={ref} {...props} className={`input-base ${icon?'pl-9':''} ${iconRight?'pr-9':''} ${error?'!border-red-500':''} ${className}`}/>
        {iconRight && <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'var(--color-text-muted)',display:'flex'}}>{iconRight}</span>}
      </div>
      {hint&&!error && <p className="text-xs mt-1" style={{color:'var(--color-text-muted)'}}>{hint}</p>}
      {error && <p className="text-xs mt-1 flex items-center gap-1" style={{color:'var(--color-danger)'}}><AlertCircle size={11}/>{error}</p>}
    </div>
  )
)
Input.displayName='Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; error?: string }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(({label,error,className='',children,...props},ref) => (
  <div className="w-full">
    {label && <label className="text-label mb-1.5 block" style={{color:'var(--color-text-muted)'}}>{label}</label>}
    <select ref={ref} {...props}
      className={`input-base cursor-pointer ${error?'!border-red-500':''} ${className}`}
      style={{appearance:'none',backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'right 10px center',paddingRight:36}}>
      {children}
    </select>
    {error && <p className="text-xs mt-1" style={{color:'var(--color-danger)'}}>{error}</p>}
  </div>
))
Select.displayName='Select'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; error?: string }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({label,error,className='',...props},ref) => (
  <div className="w-full">
    {label && <label className="text-label mb-1.5 block" style={{color:'var(--color-text-muted)'}}>{label}</label>}
    <textarea ref={ref} {...props} className={`input-base resize-none ${error?'!border-red-500':''} ${className}`}/>
    {error && <p className="text-xs mt-1" style={{color:'var(--color-danger)'}}>{error}</p>}
  </div>
))
Textarea.displayName='Textarea'

type BadgeVariant='green'|'amber'|'red'|'blue'|'slate'|'indigo'
export function Badge({variant='slate',children,dot,className=''}:{variant?:BadgeVariant;children:ReactNode;dot?:boolean;className?:string}) {
  return <span className={`badge badge-${variant} ${className}`}>{dot&&<span style={{width:6,height:6,borderRadius:'50%',background:'currentColor',opacity:0.7,flexShrink:0}}/>}{children}</span>
}

export function Card({children,className='',hoverable,onClick}:{children:ReactNode;className?:string;hoverable?:boolean;onClick?:()=>void}) {
  return <div onClick={onClick} className={`card ${hoverable?'card-hover cursor-pointer':''} ${className}`}>{children}</div>
}

export function CardHeader({title,subtitle,action,icon}:{title:string;subtitle?:string;action?:ReactNode;icon?:ReactNode}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid var(--color-border-light)'}}>
      <div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>
        {icon && <span style={{color:'var(--color-text-muted)',flexShrink:0,display:'flex'}}>{icon}</span>}
        <div style={{minWidth:0}}>
          <p className="text-title-sm" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</p>
          {subtitle && <p className="text-xs" style={{color:'var(--color-text-muted)',marginTop:2}}>{subtitle}</p>}
        </div>
      </div>
      {action && <div style={{marginLeft:12,flexShrink:0}}>{action}</div>}
    </div>
  )
}

export function EmptyState({icon,title,description,action}:{icon:ReactNode;title:string;description?:string;action?:ReactNode}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <p className="text-title-sm" style={{color:'var(--color-text-secondary)',marginBottom:4}}>{title}</p>
      {description && <p className="text-body-sm" style={{color:'var(--color-text-muted)',marginBottom:20,maxWidth:300}}>{description}</p>}
      {action}
    </div>
  )
}

const ALERT_ICON = {info:<Info size={16}/>,success:<CheckCircle2 size={16}/>,warning:<AlertTriangle size={16}/>,error:<AlertCircle size={16}/>}
const ALERT_CLS  = {info:'bg-blue-50 text-blue-700 border-blue-200',success:'bg-emerald-50 text-emerald-700 border-emerald-200',warning:'bg-amber-50 text-amber-700 border-amber-200',error:'bg-red-50 text-red-700 border-red-200'}

export function Alert({variant='info',title,children,className=''}:{variant?:'info'|'success'|'warning'|'error';title?:string;children:ReactNode;className?:string}) {
  return (
    <div className={`flex gap-3 p-3.5 rounded-xl border text-sm ${ALERT_CLS[variant]} ${className}`}>
      <span style={{flexShrink:0,marginTop:1}}>{ALERT_ICON[variant]}</span>
      <div>{title&&<p style={{fontWeight:600,marginBottom:2}}>{title}</p>}<p style={{opacity:.9}}>{children}</p></div>
    </div>
  )
}

export function Modal({open,onClose,title,children,footer,size='md'}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;footer?:ReactNode;size?:'sm'|'md'|'lg'}) {
  if(!open) return null
  const maxW={sm:'max-w-sm',md:'max-w-lg',lg:'max-w-2xl'}[size]
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`modal-box ${maxW} animate-fade-in`}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid var(--color-border)'}}>
          <p className="text-title-sm">{title}</p>
          <button onClick={onClose} style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6,border:'none',background:'transparent',cursor:'pointer',color:'var(--color-text-muted)'}}>
            <X size={15}/>
          </button>
        </div>
        <div style={{padding:'20px 24px'}}>{children}</div>
        {footer&&<div style={{display:'flex',gap:10,padding:'14px 24px',borderTop:'1px solid var(--color-border)',background:'var(--color-surface-2)',borderRadius:'0 0 var(--radius-xl) var(--radius-xl)'}}>{footer}</div>}
      </div>
    </div>
  )
}

export function PageHeader({title,subtitle,actions,breadcrumb}:{title:string;subtitle?:string;actions?:ReactNode;breadcrumb?:string}) {
  return (
    <header style={{height:'var(--header-height)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 var(--content-pad)',background:'var(--color-surface)',borderBottom:'1px solid var(--color-border)',position:'sticky',top:0,zIndex:'var(--z-header)',gap:12}}>
      <div style={{minWidth:0}}>
        {breadcrumb&&<p className="text-caption" style={{color:'var(--color-text-muted)',marginBottom:1}}>{breadcrumb}</p>}
        <h1 className="text-title-sm" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</h1>
        {subtitle&&<p className="text-xs" style={{color:'var(--color-text-muted)'}}>{subtitle}</p>}
      </div>
      {actions&&<div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>{actions}</div>}
    </header>
  )
}

export function StatCard({label,value,icon,href,colorClass='text-indigo-600 bg-indigo-50'}:{label:string;value:string|number;icon:ReactNode;href?:string;colorClass?:string}) {
  const Tag = href ? 'a' : 'div' as any
  return (
    <Tag href={href} className={`card ${href?'card-hover cursor-pointer':''}`} style={{padding:20,display:'flex',flexDirection:'column',gap:14,textDecoration:'none'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div className={`${colorClass}`} style={{width:36,height:36,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{icon}</div>
      </div>
      <div>
        <p style={{fontSize:24,fontWeight:700,letterSpacing:'-0.02em',lineHeight:1}}>{value}</p>
        <p className="text-body-sm" style={{color:'var(--color-text-muted)',marginTop:3}}>{label}</p>
      </div>
    </Tag>
  )
}

export function Skeleton({className=''}:{className?:string}) {
  return <div className={`skeleton ${className}`}/>
}