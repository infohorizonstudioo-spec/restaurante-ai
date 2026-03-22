import { supabase } from '@/lib/supabase'

export async function getSessionTenant() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('owner_id', session.user.id)
    .single()
  return tenant
}
