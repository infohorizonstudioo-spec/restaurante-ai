/**
 * RESERVO.AI — Environment Variable Validation
 * Validates all required env vars at startup, categorized by service.
 * Fails fast in production, warns in development.
 */

interface EnvVar {
  key: string
  required: 'always' | 'production' | 'optional'
  service: string
  sensitive?: boolean
}

const ENV_SCHEMA: EnvVar[] = [
  // Core — always required
  { key: 'NEXT_PUBLIC_SUPABASE_URL', required: 'always', service: 'Supabase' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: 'always', service: 'Supabase' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: 'always', service: 'Supabase', sensitive: true },

  // Auth & Security — production
  { key: 'AGENT_API_KEY', required: 'production', service: 'Security', sensitive: true },
  { key: 'CRON_SECRET', required: 'production', service: 'Security', sensitive: true },

  // AI — production
  { key: 'ANTHROPIC_API_KEY', required: 'production', service: 'Claude AI', sensitive: true },

  // Voice — production
  { key: 'ELEVENLABS_API_KEY', required: 'production', service: 'ElevenLabs', sensitive: true },
  { key: 'DEEPGRAM_API_KEY', required: 'production', service: 'Deepgram', sensitive: true },

  // Telephony — production
  { key: 'TWILIO_ACCOUNT_SID', required: 'production', service: 'Twilio', sensitive: true },
  { key: 'TWILIO_AUTH_TOKEN', required: 'production', service: 'Twilio', sensitive: true },
  { key: 'TWILIO_PHONE_NUMBER', required: 'production', service: 'Twilio' },

  // Payments — optional (billing features)
  { key: 'STRIPE_SECRET_KEY', required: 'optional', service: 'Stripe', sensitive: true },
  { key: 'STRIPE_WEBHOOK_SECRET', required: 'optional', service: 'Stripe', sensitive: true },

  // Rate Limiting — optional (falls back to in-memory)
  { key: 'UPSTASH_REDIS_REST_URL', required: 'optional', service: 'Upstash Redis' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', required: 'optional', service: 'Upstash Redis', sensitive: true },

  // Monitoring — optional
  { key: 'NEXT_PUBLIC_SENTRY_DSN', required: 'optional', service: 'Sentry' },
  { key: 'SENTRY_DSN', required: 'optional', service: 'Sentry' },

  // App URL
  { key: 'NEXT_PUBLIC_APP_URL', required: 'production', service: 'App' },
]

export interface EnvValidationResult {
  valid: boolean
  missing: { key: string; service: string; required: string }[]
  warnings: { key: string; service: string; message: string }[]
}

/**
 * Validate all environment variables and return detailed results.
 */
export function validateEnvDetailed(): EnvValidationResult {
  const isProd = process.env.NODE_ENV === 'production'
  const missing: EnvValidationResult['missing'] = []
  const warnings: EnvValidationResult['warnings'] = []

  for (const v of ENV_SCHEMA) {
    const value = process.env[v.key]

    if (!value) {
      if (v.required === 'always') {
        missing.push({ key: v.key, service: v.service, required: v.required })
      } else if (v.required === 'production' && isProd) {
        missing.push({ key: v.key, service: v.service, required: v.required })
      } else if (v.required === 'optional') {
        warnings.push({ key: v.key, service: v.service, message: `${v.service} features will be disabled` })
      }
      continue
    }

    // Validate format for known patterns
    if (v.key.includes('SUPABASE_URL') && !value.startsWith('https://')) {
      warnings.push({ key: v.key, service: v.service, message: 'Should start with https://' })
    }
    if (v.sensitive && value.length < 10) {
      warnings.push({ key: v.key, service: v.service, message: 'Value seems too short — verify it is correct' })
    }
  }

  return { valid: missing.length === 0, missing, warnings }
}

/**
 * Validate required env vars. Throws in production if critical vars are missing.
 * In development, logs warnings but does not throw.
 */
export function validateEnv(): void {
  const result = validateEnvDetailed()

  if (!result.valid) {
    const services = [...new Set(result.missing.map(m => m.service))]
    const msg = `Missing ${result.missing.length} required environment variable(s) for: ${services.join(', ')}`

    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg)
    } else {
      console.warn(`[env] ${msg}`)
      result.missing.forEach(m => console.warn(`  - ${m.key} (${m.service})`))
    }
  }

  if (result.warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    result.warnings.forEach(w => console.info(`[env] ${w.key}: ${w.message}`))
  }
}
