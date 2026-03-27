/**
 * RESERVO.AI — Sentry Client Configuration
 * Tracks frontend errors, performance, and session replays.
 */
import * as Sentry from '@sentry/nextjs'

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    debug: false,

    // Performance monitoring
    tracesSampleRate: 0.1,

    // Session replay for debugging (only in prod, 10% of sessions)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Filter out noisy errors
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error promise rejection',
      'Loading chunk',
      'Network request failed',
      'AbortError',
      'cancelled',
    ],

    beforeSend(event) {
      // Don't send PII
      if (event.request?.cookies) delete event.request.cookies
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
      }
      return event
    },
  })
}
