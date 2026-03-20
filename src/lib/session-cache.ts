/**
 * Cache de sesión para evitar llamadas duplicadas a getUser + profiles
 * en la misma carga de página. Se limpia cuando el usuario cierra sesión.
 */
import { supabase } from './supabase'

let _cache: { userId: string; tenantId: string } | null = null
let _promise: Promise<{ userId: string; tenantId: string } | null> | null = null

export async function getSessionTenant(): Promise<{ userId: string; tenantId: string } | null> {
  // Devolver caché si existe
  if (_cache) return _cache

  // Evitar llamadas paralelas duplicadas — reutilizar la misma promesa
  if (_promise) return _promise

  _promise = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data: p } = await supabase.from('profiles')
        .select('tenant_id').eq('id', user.id).maybeSingle()
      if (!p?.tenant_id) return null
      _cache = { userId: user.id, tenantId: p.tenant_id }
      return _cache
    } catch {
      return null
    } finally {
      _promise = null
    }
  })()

  return _promise
}

// Llamar al cerrar sesión para limpiar la caché
export function clearSessionCache() {
  _cache = null
  _promise = null
}

// Limpiar caché cuando el usuario cierra sesión
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') clearSessionCache()
})
