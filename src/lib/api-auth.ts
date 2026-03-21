/**
 * RESERVO.AI — Helper de autenticación para rutas API
 * Verifica que el request viene de un usuario autenticado
 * y devuelve su tenant_id verificado desde la DB.
 */
import { createClient } from '@supabase/supabase-js'

export interface AuthResult {
  ok: boolean
  userId?: string
  tenantId?: string
  error?: string
  status?: number
}

export async function requireAuth(req: Request): Promise<AuthResult> {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const cookieHeader = req.headers.get('cookie') || ''

    // Extraer token del header Authorization: Bearer <token>
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : extractTokenFromCookie(cookieHeader)

    if (!token) {
      return { ok: false, error: 'No autorizado', status: 401 }
    }

    // Verificar token con Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return { ok: false, error: 'Token inválido', status: 401 }
    }

    // Obtener tenant del usuario
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: profile } = await admin.from('profiles')
      .select('tenant_id').eq('id', user.id).maybeSingle()

    return {
      ok: true,
      userId: user.id,
      tenantId: profile?.tenant_id || undefined,
    }
  } catch (e: any) {
    return { ok: false, error: 'Error de autenticación', status: 500 }
  }
}

function extractTokenFromCookie(cookieHeader: string): string | null {
  // Supabase guarda el token en sb-<ref>-auth-token o similar
  const match = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)
  if (!match) return null
  try {
    const decoded = decodeURIComponent(match[1])
    const parsed = JSON.parse(decoded)
    return parsed?.access_token || null
  } catch {
    return null
  }
}
