import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    // Verificar que el usuario está autenticado
    const auth = await requireAuth(req)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
    }

    const { password } = await req.json()
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password demasiado corto (mínimo 8 caracteres)' }, { status: 400 })
    }

    // Solo puede cambiar su propia contraseña — usa su userId verificado del token
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data, error } = await admin.auth.admin.updateUserById(auth.userId!, { password })
    if (error) return NextResponse.json({ error: 'Internal server error' }, { status: 400 })
    return NextResponse.json({ success: true, email: data.user?.email })
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
