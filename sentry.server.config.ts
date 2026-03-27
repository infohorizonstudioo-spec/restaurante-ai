/**
 * RESERVO.AI — Sentry Server Configuration
 * Tracks backend errors and API performance.
 */
import * as Sentry from '@sentry/nextjs'

if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    debug: false,

    // Performance monitoring
    tracesSampleRate: 0.1,

    // Filter out noisy errors
    ignoreErrors: [
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
    ],

    beforeSend(event) {
      // Strip sensitive data from server errors
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
        delete event.request.headers['x-agent-key']
      }
      return event
    },
  })
}
