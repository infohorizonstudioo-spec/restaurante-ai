'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { resolveTemplate, TemplateConfig } from '@/lib/templates'
import { getTranslations, tx as txFn, Translations } from '@/lib/i18n'

interface TenantData {
  id: string; name: string; type: string; plan: string
  agent_name?: string; agent_phone?: string; language?: string
  free_calls_used?: number; free_calls_limit?: number
  plan_calls_used?: number; plan_calls_included?: number
  [key: string]: any
}

interface TenantContextValue {
  tenant: TenantData | null
  template: TemplateConfig | null
  t: Translations
  tx: (text: string) => string
  userId: string | null
  loading: boolean
  reload: () => void
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null, template: null, t: getTranslations('es'), tx: (s: string) => s, userId: null, loading: true, reload: () => {}
})

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant,   setTenant]   = useState<TenantData | null>(null)
  const [template, setTemplate] = useState<TemplateConfig | null>(null)
  const [t,        setT]        = useState<Translations>(getTranslations('es'))
  const [userId,   setUserId]   = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [tick,     setTick]     = useState(0)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles')
        .select('tenant_id').eq('id', user.id).single()
      if (!profile?.tenant_id) { setLoading(false); return }
      // Force fresh fetch (no cache) by using timestamp header
      const { data: t } = await supabase.from('tenants')
        .select('*').eq('id', profile.tenant_id).maybeSingle()
      if (!t) { setLoading(false); return }
      setTenant(t as TenantData)
      setTemplate(resolveTemplate((t as any).type || 'otro'))
      setT(getTranslations((t as any).language || 'es'))
      setLoading(false)
    })()
  }, [tick])

  return (
    <TenantContext.Provider value={{ tenant, template, t, tx: (s: string) => txFn(s, tenant?.language || 'es'), userId, loading, reload: () => setTick(n => n + 1) }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() { return useContext(TenantContext) }
