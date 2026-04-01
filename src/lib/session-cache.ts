import { supabase } from '@/lib/supabase'

export async function getSessionTenant() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', session.user.id)
    .maybeSingle()
  if (!profile?.tenant_id) return null
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', profile.tenant_id)
    .maybeSingle()
  if (!tenant) return null
  return { ...tenant, tenantId: tenant.id }
}
