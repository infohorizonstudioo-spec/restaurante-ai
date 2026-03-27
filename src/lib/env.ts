const requiredServer = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const

const requiredPublic = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

export function validateEnv() {
  const missing: string[] = []
  for (const key of requiredServer) {
    if (!process.env[key]) missing.push(key)
  }
  for (const key of requiredPublic) {
    if (!process.env[key]) missing.push(key)
  }
  if (missing.length > 0) {
    // Don't list the specific vars in production
    throw new Error(`Missing ${missing.length} required environment variable(s)`)
  }
}
