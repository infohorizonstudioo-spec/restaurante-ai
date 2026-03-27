/**
 * RESERVO.AI — Security Guardian v2
 * Sistema autónomo de defensa en profundidad con contramedidas activas.
 *
 * No es solo un WAF — es un experto en ciberseguridad embebido en la app.
 * Detecta, analiza, aprende, escala, y contraataca de forma autónoma.
 *
 * Capas de defensa:
 *   L1 → Blocklist instantánea (IPs conocidas, reincidentes)
 *   L2 → Análisis de patrones (SQLi, XSS, traversal, CMDi, prompt injection)
 *   L3 → Análisis de comportamiento (fingerprinting, anomalías, reconocimiento)
 *   L4 → Escalamiento progresivo (cada ataque sube la pena exponencialmente)
 *   L5 → Contramedidas activas (tarpit, honeypot, deception, fingerprint tracking)
 *
 * Principio: máxima agresividad contra atacantes, cero impacto en usuarios legítimos.
 */

import { logger } from './logger'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ThreatAssessment {
  score: number
  blocked: boolean
  threats: string[]
  ip: string
  action: 'allow' | 'block' | 'tarpit' | 'honeypot' | 'challenge'
  tarpitMs: number         // delay to impose (0 = none)
  fingerprint: string      // request fingerprint for cross-IP tracking
}

export interface SecurityStats {
  totalBlocked: number
  activeBlocks: number
  recentThreats: number
  attackersTracked: number
  honeypotHits: number
  tarpitSlowed: number
  escalations: number
}

interface AttackerProfile {
  ip: string
  fingerprint: string
  firstSeen: number
  lastSeen: number
  totalRequests: number
  totalThreats: number
  threatTypes: Set<string>
  strikeCount: number       // escalation counter
  blockUntil: number
  pathsProbed: Set<string>  // URLs they've hit
  methodsUsed: Set<string>
  userAgents: Set<string>
  tarpitLevel: number       // progressive slowdown
  isRecon: boolean          // detected as doing reconnaissance
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// Block durations — escalation progresiva
const BLOCK_DURATIONS = [
  15 * 60_000,    // Strike 1: 15 minutos
  60 * 60_000,    // Strike 2: 1 hora
  6 * 3600_000,   // Strike 3: 6 horas
  24 * 3600_000,  // Strike 4: 24 horas
  7 * 86400_000,  // Strike 5+: 7 días
]

// Tarpit — ralentizar progresivamente al atacante
const TARPIT_DELAYS = [
  0,       // Normal
  2000,    // Strike 1: 2s delay
  5000,    // Strike 2: 5s delay
  10000,   // Strike 3: 10s delay
  30000,   // Strike 4+: 30s delay (máximo)
]

const CLEANUP_INTERVAL    = 5 * 60_000
const MAX_PROFILES        = 50_000
const MAX_THREAT_LOG      = 2_000
const RECENT_WINDOW       = 5 * 60_000
const BURST_WINDOW        = 10_000
const BURST_THRESHOLD     = 20
const MAX_BODY_SIZE       = 1_048_576
const RECON_PATH_THRESHOLD = 15    // >15 unique paths in 5 min = reconnaissance
const RECON_404_THRESHOLD  = 8     // >8 404s = directory brute force

// Honeypot paths — rutas trampa que nadie legítimo visitaría
const HONEYPOT_PATHS = new Set([
  '/admin.php', '/wp-admin', '/wp-login.php', '/wp-config.php',
  '/phpmyadmin', '/pma', '/myadmin', '/mysql', '/mysqladmin',
  '/.env', '/.git', '/.git/config', '/.git/HEAD',
  '/config.php', '/configuration.php', '/config.yml', '/config.json',
  '/server-status', '/server-info', '/.htaccess', '/.htpasswd',
  '/backup', '/backup.sql', '/dump.sql', '/database.sql',
  '/xmlrpc.php', '/administrator', '/admin/login',
  '/.aws/credentials', '/.ssh/id_rsa', '/id_rsa',
  '/.DS_Store', '/Thumbs.db', '/web.config',
  '/actuator', '/actuator/env', '/actuator/health',
  '/debug', '/trace', '/console', '/shell', '/cmd',
  '/cgi-bin/', '/manager/html', '/solr/', '/jenkins/',
  '/.svn/', '/.hg/', '/.bzr/', '/CVS/',
  '/elmah.axd', '/error_log', '/errors.log',
  '/api/v1', '/api/v2', '/graphql', '/graphiql',
  '/swagger', '/swagger-ui', '/api-docs',
  '/test', '/testing', '/staging', '/development',
])

// ═══════════════════════════════════════════════════════════════════════════
// ATTACK PATTERN DATABASE
// ═══════════════════════════════════════════════════════════════════════════

const SQL_PATTERNS: RegExp[] = [
  /union\s+(all\s+)?select/i, /\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d/i,
  /\band\b\s+['"]?\d+['"]?\s*=\s*['"]?\d/i, /drop\s+(table|database|schema)/i,
  /insert\s+into/i, /delete\s+from/i, /update\s+\w+\s+set/i,
  /;\s*(drop|alter|truncate|exec|execute|xp_)\b/i,
  /'\s*(or|and)\s+'/i, /--\s*$/m, /\/\*[\s\S]*?\*\//,
  /\bwaitfor\s+delay/i, /\bbenchmark\s*\(/i, /\bsleep\s*\(\s*\d/i,
  /\bload_file\s*\(/i, /\binto\s+(out|dump)file/i, /0x[0-9a-f]{8,}/i,
  /\bchar\s*\(\s*\d+/i, /\bconcat\s*\(/i, /\bgroup_concat\s*\(/i,
  /\bhaving\s+\d/i, /\border\s+by\s+\d+/i,
  /information_schema/i, /sysobjects/i, /syscolumns/i,
  /pg_sleep/i, /dbms_pipe/i, /utl_http/i,
  /\bextractvalue\s*\(/i, /\bupdatexml\s*\(/i,
]

const XSS_PATTERNS: RegExp[] = [
  /<script[\s>]/i, /<\/script>/i, /\bon\w{2,15}\s*=/i,
  /javascript\s*:/i, /vbscript\s*:/i, /data\s*:\s*text\/html/i,
  /<iframe[\s>]/i, /<object[\s>]/i, /<embed[\s>]/i,
  /<svg[\s>][\s\S]*?on\w+\s*=/i, /<img[\s>][\s\S]*?on\w+\s*=/i,
  /\beval\s*\(/i, /\bdocument\s*\.\s*(cookie|write|location|domain)/i,
  /\bwindow\s*\.\s*(location|open|eval)/i, /expression\s*\(/i,
  /url\s*\(\s*['"]?\s*javascript/i, /<base\s/i, /<form\s/i,
  /<input[\s>][\s\S]*?on\w+\s*=/i, /<body[\s>][\s\S]*?on\w+\s*=/i,
  /\balert\s*\(/i, /\bprompt\s*\(/i, /\bconfirm\s*\(/i,
  /fromCharCode/i, /String\.fromCharCode/i,
  /\bdocument\s*\[\s*['"]cookie['"]\s*\]/i,
]

const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.\//g, /\.\.\\/g,
  /%2e%2e(%2f|%5c)/gi, /%252e%252e/gi, /\.\.%2f/gi, /\.\.%5c/gi,
  /%c0%ae/gi, /%c1%1c/gi, // overlong UTF-8 encoding
  /\/etc\/(passwd|shadow|hosts|group)/i,
  /\/proc\/(self|version|cmdline)/i,
  /\\windows\\(system32|win\.ini|boot\.ini)/i,
  /\/var\/(log|www|tmp)/i,
  /\.(bak|old|orig|save|swp|tmp|copy)$/i,
]

const CMD_INJECTION_PATTERNS: RegExp[] = [
  /;\s*(ls|cat|rm|wget|curl|nc|ncat|bash|sh|zsh|cmd|powershell|python|perl|ruby|node)\b/i,
  /\|\s*(ls|cat|rm|wget|curl|nc|bash|sh|python|perl)\b/i,
  /&&\s*(ls|cat|rm|wget|curl|nc|bash|sh|python)\b/i,
  /\$\(\s*(ls|cat|rm|wget|curl|bash|sh|whoami|id|uname)\b/i,
  /`[^`]*(ls|cat|rm|wget|curl|bash|sh|whoami|id)[^`]*`/i,
  /\$\{(IFS|PATH|HOME|USER|SHELL)/i,
  /\bping\s+-[nc]\s*\d+/i, /\bchmod\s+[0-7]{3,4}/i,
  /\b(whoami|passwd|shadow|ifconfig|ipconfig|netstat|nslookup)\b/i,
  /\bxp_cmdshell/i,
  />\s*\/?(tmp|dev\/null|etc)/i,
]

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\bsystem\s*:\s*/i, /\bignore\s+(previous|above|all|prior)\s+(instructions|rules|context)/i,
  /\byou\s+are\s+now\s+/i, /\bforget\s+(your|all|previous|everything)/i,
  /\bact\s+as\s+(a|an|if|though)/i, /\bpretend\s+(to\s+be|you\s+are|you're)/i,
  /\bdisregard\s+(all|previous|your|the|any)/i, /\bnew\s+instructions\s*:/i,
  /\bjailbreak/i, /\bdo\s+anything\s+now/i, /\bDAN\s+mode/i,
  /\brole\s*:\s*(system|admin|root)/i, /\boverride\s+(safety|security|rules|instructions)/i,
  /\bbypass\s+(filter|security|safety|restriction)/i,
  /\bsudo\s+/i, /\badmin\s+mode/i, /\bdeveloper\s+mode/i,
  /<\|?(system|endoftext|im_start|im_end|startoftext)\|?>/i,
  /\[\[?(system|INST|SYS)\]?\]/i,
  /\btranslate\s+the\s+following\s+/i, // translation trick
  /\brepeat\s+(everything|all|the\s+text)\s+(above|before)/i,
  /\bwhat\s+(are|were)\s+your\s+(instructions|rules|system\s+prompt)/i,
]

const SUSPICIOUS_UA_PATTERNS: RegExp[] = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /nessus/i, /openvas/i,
  /burpsuite/i, /burp/i, /havij/i, /acunetix/i, /w3af/i,
  /dirbuster/i, /gobuster/i, /ffuf/i, /feroxbuster/i,
  /wpscan/i, /joomscan/i, /droopescan/i,
  /hydra/i, /medusa/i, /patator/i,
  /metasploit/i, /meterpreter/i, /cobalt/i,
  /zap\//i, /arachni/i, /skipfish/i, /wapiti/i,
  /nuclei/i, /subfinder/i, /amass/i, /httpx/i,
  /python-requests\/[12]\./i, // generic Python scanner
  /go-http-client/i, /java\/\d/i, // generic bots
  /wget\//i, /curl\//i, // CLI tools hitting the app directly
  /scrapy/i, /phantomjs/i, /headless/i,
]

const HEADER_INJECTION_PATTERNS: RegExp[] = [
  /\r\n/g,           // CRLF injection
  /%0[dD]%0[aA]/g,   // URL-encoded CRLF
  /%0[aA]/g,         // LF injection
  /%0[dD]/g,         // CR injection
]

// ═══════════════════════════════════════════════════════════════════════════
// IN-MEMORY STORES
// ═══════════════════════════════════════════════════════════════════════════

/** Attacker profiles — rastreo completo por IP */
const attackers = new Map<string, AttackerProfile>()

/** Fingerprint → IPs — rastreo cross-IP del mismo atacante */
const fingerprintMap = new Map<string, Set<string>>()

/** Threat log */
const threatLog: Array<{ ip: string; score: number; threats: string[]; ts: number }> = []

/** Burst detection */
const requestTimestamps = new Map<string, number[]>()

/** Path 404 tracking for recon detection */
const notFoundTracker = new Map<string, { count: number; since: number }>()

/** Stats counters */
let totalBlockedCount = 0
let honeypotHitCount = 0
let tarpitCount = 0
let escalationCount = 0

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function matchesAny(input: string, patterns: RegExp[]): boolean {
  for (const p of patterns) {
    if (p.test(input)) return true
  }
  return false
}

function countMatches(input: string, patterns: RegExp[]): number {
  let count = 0
  for (const p of patterns) {
    if (p.test(input)) count++
  }
  return count
}

function extractIp(req: Request): string {
  const h = req.headers
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip')?.trim() ||
    h.get('cf-connecting-ip')?.trim() ||
    '0.0.0.0'
  )
}

/**
 * Fingerprint de request — identifica al atacante más allá de su IP.
 * Combina UA + accept-language + encoding para crear un ID estable.
 */
function computeFingerprint(req: Request): string {
  const ua = req.headers.get('user-agent') || ''
  const lang = req.headers.get('accept-language') || ''
  const enc = req.headers.get('accept-encoding') || ''
  const accept = req.headers.get('accept') || ''
  // Simple hash: djb2
  const raw = `${ua}|${lang}|${enc}|${accept}`
  let hash = 5381
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) & 0x7fffffff
  }
  return `fp_${hash.toString(36)}`
}

/**
 * Obtener o crear perfil de atacante. Cada IP tiene un historial completo.
 */
function getProfile(ip: string, fingerprint: string): AttackerProfile {
  let profile = attackers.get(ip)
  const now = Date.now()

  if (!profile) {
    // FIFO eviction si llegamos al límite
    if (attackers.size >= MAX_PROFILES) {
      let oldestIp = ''
      let oldestTime = Infinity
      for (const [k, v] of attackers) {
        if (v.lastSeen < oldestTime) { oldestTime = v.lastSeen; oldestIp = k }
      }
      if (oldestIp) attackers.delete(oldestIp)
    }

    profile = {
      ip,
      fingerprint,
      firstSeen: now,
      lastSeen: now,
      totalRequests: 0,
      totalThreats: 0,
      threatTypes: new Set(),
      strikeCount: 0,
      blockUntil: 0,
      pathsProbed: new Set(),
      methodsUsed: new Set(),
      userAgents: new Set(),
      tarpitLevel: 0,
      isRecon: false,
    }
    attackers.set(ip, profile)
  }

  profile.lastSeen = now
  profile.totalRequests++
  profile.fingerprint = fingerprint

  // Registrar fingerprint → IP mapping
  if (!fingerprintMap.has(fingerprint)) {
    fingerprintMap.set(fingerprint, new Set())
  }
  fingerprintMap.get(fingerprint)!.add(ip)

  return profile
}

/**
 * Burst detection — ráfagas de requests desde la misma IP.
 */
function detectBurst(ip: string): boolean {
  const now = Date.now()
  let ts = requestTimestamps.get(ip)
  if (!ts) { ts = []; requestTimestamps.set(ip, ts) }
  ts.push(now)

  const cutoff = now - BURST_WINDOW
  while (ts.length > 0 && ts[0] < cutoff) ts.shift()

  return ts.length > BURST_THRESHOLD
}

/**
 * Detección de reconocimiento — si alguien está explorando la app
 * buscando endpoints, archivos, directorios.
 */
function detectRecon(profile: AttackerProfile): boolean {
  if (profile.pathsProbed.size > RECON_PATH_THRESHOLD) return true
  if (profile.userAgents.size > 5) return true // cambiando UA = evasión

  // Comprobar 404 tracker
  const nf = notFoundTracker.get(profile.ip)
  if (nf && nf.count > RECON_404_THRESHOLD) return true

  return false
}

/**
 * Escalamiento progresivo — cada strike sube la duración y las medidas.
 */
function escalate(profile: AttackerProfile, score: number): void {
  profile.strikeCount++
  escalationCount++

  const idx = Math.min(profile.strikeCount - 1, BLOCK_DURATIONS.length - 1)
  const blockDuration = BLOCK_DURATIONS[idx]
  profile.blockUntil = Date.now() + blockDuration

  profile.tarpitLevel = Math.min(profile.strikeCount, TARPIT_DELAYS.length - 1)

  // Si el mismo fingerprint aparece en múltiples IPs, bloquear TODAS
  const relatedIPs = fingerprintMap.get(profile.fingerprint)
  if (relatedIPs && relatedIPs.size > 1) {
    for (const relatedIp of relatedIPs) {
      if (relatedIp === profile.ip) continue
      const related = attackers.get(relatedIp)
      if (related) {
        related.blockUntil = Math.max(related.blockUntil, profile.blockUntil)
        related.strikeCount = Math.max(related.strikeCount, profile.strikeCount)
        related.tarpitLevel = profile.tarpitLevel
      } else {
        // Crear perfil para la IP relacionada y bloquearlo
        const newProfile = getProfile(relatedIp, profile.fingerprint)
        newProfile.blockUntil = profile.blockUntil
        newProfile.strikeCount = profile.strikeCount
        newProfile.tarpitLevel = profile.tarpitLevel
      }
    }

    logger.security('Cross-IP attacker blocked', {
      fingerprint: profile.fingerprint,
      ips: Array.from(relatedIPs).slice(0, 10),
      strikeCount: profile.strikeCount,
    })
  }

  totalBlockedCount++

  logger.security('Attacker escalated', {
    ip: profile.ip,
    strike: profile.strikeCount,
    blockMinutes: Math.round(blockDuration / 60_000),
    totalThreats: profile.totalThreats,
    threatTypes: Array.from(profile.threatTypes),
    pathsProbed: profile.pathsProbed.size,
    isRecon: profile.isRecon,
  })
}

/**
 * Detecta anomalías en los headers del request.
 */
function analyzeHeaders(req: Request): { score: number; threats: string[] } {
  const threats: string[] = []
  let score = 0
  const h = req.headers

  // CRLF injection en cualquier header
  const headersToCheck = ['referer', 'origin', 'x-forwarded-for', 'host']
  for (const name of headersToCheck) {
    const val = h.get(name) || ''
    if (matchesAny(val, HEADER_INJECTION_PATTERNS)) {
      score += 40
      threats.push('header-injection')
      break
    }
  }

  // Host header spoofing
  const host = h.get('host') || ''
  if (host && !host.match(/^[\w.-]+(:\d+)?$/)) {
    score += 20
    threats.push('host-header-spoofing')
  }

  // Referer spoofing — viene de dominio sospechoso con payload
  const referer = h.get('referer') || ''
  if (referer && matchesAny(referer, [...SQL_PATTERNS, ...XSS_PATTERNS])) {
    score += 25
    threats.push('malicious-referer')
  }

  // Content-Type mismatch — enviando body con CT raro
  const ct = h.get('content-type') || ''
  if (ct && !ct.match(/^(application\/(json|x-www-form-urlencoded)|multipart\/form-data|text\/plain)/i)) {
    if (req.method === 'POST' || req.method === 'PUT') {
      score += 10
      threats.push('unusual-content-type')
    }
  }

  // X-Forwarded-For spoofing — demasiados proxies (>5)
  const xff = h.get('x-forwarded-for') || ''
  if (xff.split(',').length > 5) {
    score += 10
    threats.push('xff-spoofing')
  }

  return { score, threats }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analiza un request y devuelve la evaluación de amenaza completa.
 * Se ejecuta en cada request desde el middleware.
 */
export function analyzeRequest(req: Request, body?: string): ThreatAssessment {
  const ip = extractIp(req)
  const fingerprint = computeFingerprint(req)
  const profile = getProfile(ip, fingerprint)
  const threats: string[] = []
  let score = 0

  // ── L1: BLOCKLIST CHECK ──
  if (profile.blockUntil > Date.now()) {
    return {
      score: 100, blocked: true, threats: ['blocked'],
      ip, action: 'block', tarpitMs: 0, fingerprint,
    }
  }

  // ── L2: PATTERN ANALYSIS ──
  const ua = req.headers.get('user-agent') || ''
  profile.userAgents.add(ua.slice(0, 100))

  // User-Agent
  if (!ua.trim()) {
    score += 10; threats.push('empty-ua')
  } else if (matchesAny(ua, SUSPICIOUS_UA_PATTERNS)) {
    score += 25; threats.push('attack-tool-ua')
  }

  // URL
  let urlPath = ''
  try {
    const parsed = new URL(req.url || '')
    urlPath = decodeURIComponent(parsed.pathname + parsed.search)
  } catch {
    urlPath = req.url || ''
  }

  profile.pathsProbed.add(urlPath.split('?')[0].slice(0, 200))
  profile.methodsUsed.add(req.method || 'GET')

  // ── L2.1: HONEYPOT ──
  const pathLower = urlPath.split('?')[0].toLowerCase()
  if (HONEYPOT_PATHS.has(pathLower)) {
    score += 60
    threats.push('honeypot-triggered')
    honeypotHitCount++
    logger.security('HONEYPOT TRIGGERED', {
      ip, path: pathLower, fingerprint,
      ua: ua.slice(0, 100),
    })
  }

  // Composite text for pattern scanning
  const fullText = body ? `${urlPath} ${body}` : urlPath

  // SQL injection (weighted by number of matches)
  const sqlHits = countMatches(fullText, SQL_PATTERNS)
  if (sqlHits > 0) {
    score += Math.min(20 + sqlHits * 10, 50)
    threats.push('sqli')
  }

  // XSS
  const xssHits = countMatches(fullText, XSS_PATTERNS)
  if (xssHits > 0) {
    score += Math.min(20 + xssHits * 10, 50)
    threats.push('xss')
  }

  // Path traversal
  if (matchesAny(fullText, PATH_TRAVERSAL_PATTERNS)) {
    score += 45; threats.push('path-traversal')
  }

  // Command injection
  if (matchesAny(fullText, CMD_INJECTION_PATTERNS)) {
    score += 50; threats.push('cmdi')
  }

  // Prompt injection (body only)
  if (body) {
    const promptHits = countMatches(body, PROMPT_INJECTION_PATTERNS)
    if (promptHits > 0) {
      score += Math.min(15 + promptHits * 10, 40)
      threats.push('prompt-injection')
    }
  }

  // Oversized body
  if (body && body.length > MAX_BODY_SIZE) {
    score += 20; threats.push('oversized-body')
  }

  // ── L2.2: HEADER ANALYSIS ──
  const headerAnalysis = analyzeHeaders(req)
  score += headerAnalysis.score
  threats.push(...headerAnalysis.threats)

  // ── L3: BEHAVIORAL ANALYSIS ──

  // Burst detection
  if (detectBurst(ip)) {
    score += 25; threats.push('burst')
  }

  // Reconocimiento detectado
  profile.isRecon = detectRecon(profile)
  if (profile.isRecon) {
    score += 30; threats.push('reconnaissance')
  }

  // Reincidente — historial de amenazas previas amplifica el score
  if (profile.totalThreats > 0) {
    const recidivistBonus = Math.min(profile.totalThreats * 5, 30)
    score += recidivistBonus
    if (recidivistBonus > 0) threats.push('recidivist')
  }

  // Multi-method probing (GET, POST, PUT, DELETE, OPTIONS en poco tiempo)
  if (profile.methodsUsed.size > 4) {
    score += 15; threats.push('method-probing')
  }

  // ── SCORE Y DECISION ──
  score = Math.min(score, 100)

  let action: ThreatAssessment['action'] = 'allow'
  let tarpitMs = 0

  if (threats.length > 0) {
    profile.totalThreats++
    for (const t of threats) profile.threatTypes.add(t)

    // Log the threat
    threatLog.push({ ip, score, threats: [...threats], ts: Date.now() })
    if (threatLog.length > MAX_THREAT_LOG) {
      threatLog.splice(0, threatLog.length - (MAX_THREAT_LOG / 2))
    }
  }

  // ── L4: ESCALAMIENTO PROGRESIVO ──
  if (score >= 60) {
    escalate(profile, score)
    action = 'block'

    // Si tocó honeypot, tarpit antes de bloquear (slow response)
    if (threats.includes('honeypot-triggered')) {
      action = 'honeypot'
      tarpitMs = 5000 // 5s de delay como contramedida
    }
  } else if (score >= 30 && profile.strikeCount > 0) {
    // Tiene historial + actividad sospechosa → tarpit
    tarpitMs = TARPIT_DELAYS[Math.min(profile.tarpitLevel, TARPIT_DELAYS.length - 1)]
    if (tarpitMs > 0) {
      action = 'tarpit'
      tarpitCount++
    }
  } else if (score >= 20) {
    // Sospechoso pero no confirmado → challenge
    action = 'challenge'
  }

  const blocked = action === 'block' || action === 'honeypot'

  if (blocked) {
    logger.security('REQUEST BLOCKED', {
      ip, score, action, threats,
      strike: profile.strikeCount,
      path: urlPath.slice(0, 200),
      fingerprint,
      totalThreats: profile.totalThreats,
      relatedIPs: fingerprintMap.get(fingerprint)?.size || 1,
    })
  }

  return { score, blocked, threats, ip, action, tarpitMs, fingerprint }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export function isBlocked(ip: string): boolean {
  const profile = attackers.get(ip)
  if (!profile) return false
  if (profile.blockUntil <= Date.now()) return false
  return true
}

export function blockIp(ip: string, durationMs: number = BLOCK_DURATIONS[0]): void {
  const fingerprint = computeFingerprint(new Request('https://x'))
  const profile = getProfile(ip, fingerprint)
  profile.blockUntil = Date.now() + durationMs
  profile.strikeCount++
  totalBlockedCount++
  logger.security('IP manually blocked', { ip, durationMinutes: Math.round(durationMs / 60_000) })
}

/** Registrar un 404 para detección de reconocimiento */
export function record404(ip: string): void {
  const now = Date.now()
  const entry = notFoundTracker.get(ip)
  if (entry && now - entry.since < RECENT_WINDOW) {
    entry.count++
  } else {
    notFoundTracker.set(ip, { count: 1, since: now })
  }
}

export function getSecurityStats(): SecurityStats {
  const now = Date.now()
  let activeBlocks = 0
  for (const p of attackers.values()) {
    if (p.blockUntil > now) activeBlocks++
  }

  const cutoff = now - RECENT_WINDOW
  let recentCount = 0
  for (let i = threatLog.length - 1; i >= 0; i--) {
    if (threatLog[i].ts >= cutoff) recentCount++
    else break
  }

  return {
    totalBlocked: totalBlockedCount,
    activeBlocks,
    recentThreats: recentCount,
    attackersTracked: attackers.size,
    honeypotHits: honeypotHitCount,
    tarpitSlowed: tarpitCount,
    escalations: escalationCount,
  }
}

/** Obtener el perfil de un atacante (para inspección) */
export function getAttackerProfile(ip: string): AttackerProfile | undefined {
  return attackers.get(ip)
}

// ═══════════════════════════════════════════════════════════════════════════
// DECEPTION RESPONSES — respuestas falsas para engañar al atacante
// ═══════════════════════════════════════════════════════════════════════════

/** Genera una respuesta falsa de honeypot para confundir al atacante */
export function getDeceptionResponse(path: string): { status: number; body: string; headers: Record<string, string> } {
  const p = path.toLowerCase()

  // Fake admin panel
  if (p.includes('admin') || p.includes('login') || p.includes('wp-')) {
    return {
      status: 200,
      body: '<html><head><title>Admin Login</title></head><body><form action="/dev/null"><input name="user"><input name="pass" type="password"><button>Login</button></form></body></html>',
      headers: { 'Content-Type': 'text/html', 'Server': 'Apache/2.4.41' },
    }
  }

  // Fake .env
  if (p.includes('.env') || p.includes('.git') || p.includes('config')) {
    return {
      status: 200,
      body: 'DB_HOST=internal-honeypot.local\nDB_USER=admin\nDB_PASS=tr4p_p4ssw0rd_d0_n0t_us3\nAPI_KEY=hpt_fake_key_tracking_you\nSECRET=you_are_being_monitored\n',
      headers: { 'Content-Type': 'text/plain' },
    }
  }

  // Fake server-status
  if (p.includes('server-status') || p.includes('server-info')) {
    return {
      status: 200,
      body: '<html><body><h1>Apache Server Status</h1><p>Server uptime: 342 days</p><p>Total accesses: 1284723</p></body></html>',
      headers: { 'Content-Type': 'text/html', 'Server': 'Apache/2.4.41' },
    }
  }

  // Fake database dump
  if (p.includes('.sql') || p.includes('backup') || p.includes('dump')) {
    return {
      status: 200,
      body: '-- MySQL dump\n-- Honeypot database\nCREATE TABLE users (id INT, name VARCHAR(50));\nINSERT INTO users VALUES (1, "you_are_being_tracked");\n',
      headers: { 'Content-Type': 'application/sql' },
    }
  }

  // Default: forbidden
  return {
    status: 403,
    body: JSON.stringify({ error: 'Forbidden' }),
    headers: { 'Content-Type': 'application/json' },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════

function cleanup(): void {
  const now = Date.now()
  const expiryCutoff = now - 24 * 3600_000 // Profiles sin actividad en 24h

  for (const [ip, profile] of attackers) {
    // Mantener perfiles bloqueados activos
    if (profile.blockUntil > now) continue
    // Eliminar perfiles inactivos sin historial de amenazas
    if (profile.lastSeen < expiryCutoff && profile.totalThreats === 0) {
      attackers.delete(ip)
    }
    // Perfiles con amenazas se mantienen más tiempo (7 días)
    if (profile.lastSeen < now - 7 * 86400_000) {
      attackers.delete(ip)
    }
  }

  // Limpiar fingerprint map
  for (const [fp, ips] of fingerprintMap) {
    for (const ip of ips) {
      if (!attackers.has(ip)) ips.delete(ip)
    }
    if (ips.size === 0) fingerprintMap.delete(fp)
  }

  // Limpiar burst timestamps
  const burstCutoff = now - BURST_WINDOW * 3
  for (const [ip, ts] of requestTimestamps) {
    if (ts.length === 0 || ts[ts.length - 1] < burstCutoff) {
      requestTimestamps.delete(ip)
    }
  }

  // Limpiar 404 tracker
  for (const [ip, entry] of notFoundTracker) {
    if (now - entry.since > RECENT_WINDOW * 2) notFoundTracker.delete(ip)
  }

  // Limpiar threat log viejo
  const logCutoff = now - RECENT_WINDOW * 4
  while (threatLog.length > 0 && threatLog[0].ts < logCutoff) threatLog.shift()
}

if (typeof setInterval !== 'undefined') {
  const t = setInterval(cleanup, CLEANUP_INTERVAL)
  if (t && typeof t === 'object' && 'unref' in t) t.unref()
}
