/**
 * RESERVO.AI — Sentry Edge Configuration
 * Tracks middleware errors.
 */
import * as Sentry from '@sentry/nextjs'

if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    debug: false,
    tracesSampleRate: 0.1,
  })
}
