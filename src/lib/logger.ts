/**
 * RESERVO.AI — Logger estructurado + integración Sentry
 * Reemplaza console.log/error en toda la app.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`
  const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
  const err = entry.error ? ` | ${entry.error.name}: ${entry.error.message}` : ''
  return `${base}${ctx}${err}`
}

async function reportToSentry(entry: LogEntry) {
  if (process.env.NODE_ENV !== 'production') return
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN && !process.env.SENTRY_DSN) return

  try {
    const Sentry = await import('@sentry/nextjs')
    if (entry.error) {
      Sentry.captureException(new Error(entry.error.message), {
        tags: { level: entry.level },
        extra: entry.context,
      })
    } else if (entry.level === 'error' || entry.level === 'warn') {
      Sentry.captureMessage(entry.message, {
        level: entry.level === 'error' ? 'error' : 'warning',
        extra: entry.context,
      })
    }
  } catch {
    // Sentry no disponible — silenciar
  }
}

function createEntry(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  }
  if (error instanceof Error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  } else if (error) {
    entry.error = { name: 'UnknownError', message: String(error) }
  }
  return entry
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    if (!shouldLog('debug')) return
    const entry = createEntry('debug', message, context)
    console.debug(formatEntry(entry))
  },

  info(message: string, context?: Record<string, unknown>) {
    if (!shouldLog('info')) return
    const entry = createEntry('info', message, context)
    console.info(formatEntry(entry))
  },

  warn(message: string, context?: Record<string, unknown>, error?: unknown) {
    if (!shouldLog('warn')) return
    const entry = createEntry('warn', message, context, error)
    console.warn(formatEntry(entry))
    reportToSentry(entry)
  },

  error(message: string, context?: Record<string, unknown>, error?: unknown) {
    if (!shouldLog('error')) return
    const entry = createEntry('error', message, context, error)
    console.error(formatEntry(entry))
    reportToSentry(entry)
  },

  /** Log de request API — para métricas */
  apiRequest(method: string, path: string, statusCode: number, durationMs: number, context?: Record<string, unknown>) {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    const msg = `${method} ${path} → ${statusCode} (${durationMs}ms)`
    if (!shouldLog(level)) return
    const entry = createEntry(level, msg, { ...context, statusCode, durationMs })
    if (level === 'error') console.error(formatEntry(entry))
    else if (level === 'warn') console.warn(formatEntry(entry))
    else console.info(formatEntry(entry))
  },

  /** Log específico de seguridad */
  security(event: string, context?: Record<string, unknown>) {
    const entry = createEntry('warn', `[SECURITY] ${event}`, context)
    console.warn(formatEntry(entry))
    reportToSentry(entry)
  },
}

export default logger
