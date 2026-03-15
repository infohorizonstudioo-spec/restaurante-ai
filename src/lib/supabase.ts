import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const supabase = createClient()

export async function getDemoTenant() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  if (profile.role === 'superadmin') {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', 'la-bahia')
      .single()
    return tenant
  }

  if (profile.tenant_id) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', profile.tenant_id)
      .single()
    return tenant
  }

  return null
}

export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  return data
}
