/**
 * RESERVO.AI — SECURITY GUARDIAN (Edge Runtime)
 *
 * Lightweight, Edge-compatible version of the Security Guardian.
 * Uses ONLY Web APIs — no Node.js modules, no Supabase, no Redis.
 *
 * Implements:
 *   - IP-based request counting (in-memory Map with TTL)
 *   - Bot/attack-tool user-agent detection
 *   - Path traversal detection
 *   - SQL injection pattern detection in query strings
 *   - XSS pattern detection
 *   - Command injection detection
 *   - Honeypot paths
 *   - CRLF / header injection detection
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface EdgeThreatAssessment {
  blocked: boolean
  score: number
  reason: string
  threats: string[]
  ip: string
}

// ═══════════════════════════════════════════════════════════════════════════
// IN-MEMORY RATE TRACKING (with TTL cleanup)
// ═══════════════════════════════════════════════════════════════════════════

interface RateEntry {
  count: number
  firstSeen: number
  lastSeen: number
}

const ipCounts = new Map<string, RateEntry>()
const blockedIPs = new Map<string, number>() // ip -> blocked until timestamp

const RATE_WINDOW = 10_000    // 10 seconds
const RATE_LIMIT = 80         // requests per window (generous for SPAs)
const BLOCK_DURATION = 15 * 60_000 // 15 min block
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanupMaps(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [ip, entry] of ipCounts) {
    if (now - entry.lastSeen > RATE_WINDOW * 3) ipCounts.delete(ip)
  }
  for (const [ip, until] of blockedIPs) {
    if (now > until) blockedIPs.delete(ip)
  }
  // Cap map size to prevent memory issues in Edge
  if (ipCounts.size > 10_000) ipCounts.clear()
  if (blockedIPs.size > 5_000) blockedIPs.clear()
}

function trackRate(ip: string): { burst: boolean } {
  const now = Date.now()
  const entry = ipCounts.get(ip)

  if (!entry || now - entry.firstSeen > RATE_WINDOW) {
    ipCounts.set(ip, { count: 1, firstSeen: now, lastSeen: now })
    return { burst: false }
  }

  entry.count++
  entry.lastSeen = now

  if (entry.count > RATE_LIMIT) {
    blockedIPs.set(ip, now + BLOCK_DURATION)
    return { burst: true }
  }

  return { burst: false }
}

// ═══════════════════════════════════════════════════════════════════════════
// HONEYPOT PATHS
// ═══════════════════════════════════════════════════════════════════════════

const HONEYPOT_PATHS = new Set([
  // WordPress
  '/wp-admin', '/wp-login.php', '/wp-config.php', '/wp-content', '/wp-includes',
  '/wp-json', '/xmlrpc.php', '/wp-cron.php',
  // PHP / Apache
  '/admin.php', '/config.php', '/configuration.php', '/install.php', '/setup.php',
  '/phpmyadmin', '/pma', '/myadmin', '/mysql', '/mysqladmin', '/adminer',
  '/server-status', '/server-info', '/.htaccess', '/.htpasswd',
  // Sensitive files
  '/.env', '/.env.local', '/.env.production', '/.env.backup',
  '/.git', '/.git/config', '/.git/HEAD', '/.git/objects',
  '/.svn', '/.svn/entries', '/.hg', '/.bzr', '/CVS',
  '/.aws/credentials', '/.ssh/id_rsa', '/.ssh/authorized_keys',
  '/.DS_Store', '/web.config',
  // Backups
  '/backup', '/backup.sql', '/backup.zip', '/backup.tar.gz',
  '/dump.sql', '/database.sql', '/db.sql', '/data.sql',
  // Config files
  '/config.yml', '/config.yaml', '/config.json', '/config.xml',
  '/settings.json', '/secrets.json', '/credentials.json',
  // Admin panels
  '/administrator', '/admin/login', '/admin/dashboard', '/admin/config',
  '/console', '/shell', '/cmd', '/terminal', '/debug',
  // Java / Spring
  '/actuator', '/actuator/env', '/actuator/health', '/actuator/heapdump',
  // Node.js
  '/node_modules', '/package.json', '/.npmrc',
  // API discovery
  '/graphql', '/graphiql', '/swagger', '/swagger-ui', '/swagger-ui.html',
  '/api-docs', '/openapi', '/openapi.json', '/openapi.yaml',
  // Testing
  '/phpinfo.php', '/info.php', '/test.php',
])

// ═══════════════════════════════════════════════════════════════════════════
// ATTACK PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

const SQL_PATTERNS: RegExp[] = [
  /union\s+(all\s+)?select/i,
  /\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d/i,
  /\band\b\s+['"]?\d+['"]?\s*=\s*['"]?\d/i,
  /drop\s+(table|database|schema|index)/i,
  /insert\s+into/i, /delete\s+from/i, /update\s+\w+\s+set/i,
  /;\s*(drop|alter|truncate|exec|execute|xp_|sp_)\b/i,
  /'\s*(or|and)\s+'/i,
  /\bwaitfor\s+delay/i, /\bbenchmark\s*\(/i, /\bsleep\s*\(\s*\d/i,
  /\bload_file\s*\(/i, /\binto\s+(out|dump)file/i,
  /information_schema\.(tables|columns|schemata)/i,
  /pg_(sleep|catalog|tables|user)/i,
  /\bselect\s+.*\bfrom\s+.*\bwhere\b/i,
  /'\s*;\s*select\b/i,
  /\bunion\s+select\s+null/i,
  /0x[0-9a-f]{8,}/i,
]

const XSS_PATTERNS: RegExp[] = [
  /<script[\s>]/i, /<\/script>/i,
  /<[^>]+\bon\w{2,15}\s*=/i,
  /javascript\s*:/i, /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /<iframe[\s>]/i, /<object[\s>]/i, /<embed[\s>]/i,
  /\beval\s*\(\s*['"`\[]/i,
  /\bdocument\s*\.\s*(cookie|write|writeln|location|domain)/i,
  /\bwindow\s*\.\s*(location|open|eval)/i,
  /<base[\s>]/i,
  /String\.fromCharCode/i,
  /__proto__\s*[=:]/i,
  /\bconstructor\s*\.\s*constructor/i,
]

const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e(%2f|%5c)/i,
  /%252e%252e/i,
  /\.\.%2f/i, /\.\.%5c/i,
  /%c0%ae/i, /%c1%1c/i, /%c0%af/i,
  /\/etc\/(passwd|shadow|hosts)/i,
  /\/proc\/(self|version|cmdline|environ)/i,
  /\\windows\\(system32|win\.ini)/i,
]

const CMD_INJECTION_PATTERNS: RegExp[] = [
  /;\s*(ls|cat|rm|wget|curl|nc|bash|sh|python|perl|ruby|node|php)\b/i,
  /\|\s*(ls|cat|rm|wget|curl|nc|bash|sh|python|perl|ruby|node|php)\b/i,
  /&&\s*(ls|cat|rm|wget|curl|nc|bash|sh|python|perl|whoami|id|env)\b/i,
  /\$\(\s*(ls|cat|rm|wget|curl|bash|sh|whoami|id|uname)\b/i,
  /`[^`]{0,200}(ls|cat|rm|wget|curl|bash|sh|whoami|id|uname)[^`]*`/i,
  /\bxp_cmdshell/i,
  /\/dev\/tcp\//i,
  /\bmkfifo\b/i,
]

const HEADER_INJECTION_PATTERNS: RegExp[] = [
  /%0d%0a/i, /%0a/i, /%0d/i,
  /\r\n/,
]

const SUSPICIOUS_UA_PATTERNS: RegExp[] = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /nessus/i, /openvas/i,
  /burpsuite/i, /burp\s/i, /havij/i, /acunetix/i, /w3af/i,
  /dirbuster/i, /gobuster/i, /ffuf/i, /feroxbuster/i,
  /wpscan/i, /joomscan/i, /droopescan/i,
  /hydra/i, /medusa/i, /metasploit/i, /meterpreter/i,
  /zap\//i, /arachni/i, /skipfish/i, /wapiti/i,
  /nuclei/i, /dalfox/i, /commix/i, /xsstrike/i,
  /python-requests\/[12]\./i, /python-urllib/i, /python-httpx/i,
  /go-http-client/i, /java\/\d/i,
  /wget\//i, /curl\//i, /libwww-perl/i, /lwp-/i, /mechanize/i,
  /scrapy/i, /phantomjs/i, /headless/i, /selenium/i, /puppeteer/i,
  /shodan/i, /censys/i, /zgrab/i,
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function matchesAny(text: string, patterns: RegExp[]): boolean {
  for (const p of patterns) {
    if (p.test(text)) return true
  }
  return false
}

function extractIP(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return '0.0.0.0'
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

export function analyzeRequest(request: Request): EdgeThreatAssessment {
  // Periodic cleanup
  cleanupMaps()

  const ip = extractIP(request)
  const url = new URL(request.url)
  const pathname = url.pathname.toLowerCase()
  const queryString = url.search.toLowerCase()
  const ua = request.headers.get('user-agent') || ''
  const scanText = decodeURIComponent(pathname + queryString).toLowerCase()

  let score = 0
  const threats: string[] = []

  // ── Check if already blocked ──
  const blockUntil = blockedIPs.get(ip)
  if (blockUntil && Date.now() < blockUntil) {
    return {
      blocked: true,
      score: 100,
      reason: 'IP temporarily blocked due to previous violations',
      threats: ['blocked'],
      ip,
    }
  }

  // ── Rate limiting ──
  const { burst } = trackRate(ip)
  if (burst) {
    score += 40
    threats.push('burst')
  }

  // ── Honeypot paths ──
  if (HONEYPOT_PATHS.has(pathname) || HONEYPOT_PATHS.has(pathname + '/')) {
    score += 70
    threats.push('honeypot-triggered')
  }

  // ── User-agent analysis ──
  if (!ua.trim()) {
    score += 5
    threats.push('empty-ua')
  } else if (matchesAny(ua, SUSPICIOUS_UA_PATTERNS)) {
    score += 30
    threats.push('attack-tool-ua')
  }

  // ── CRLF / Header injection ──
  if (matchesAny(url.pathname + url.search, HEADER_INJECTION_PATTERNS)) {
    score += 50
    threats.push('header-injection')
  }

  // ── SQL injection ──
  if (matchesAny(scanText, SQL_PATTERNS)) {
    score += 50
    threats.push('sqli')
  }

  // ── XSS ──
  if (matchesAny(scanText, XSS_PATTERNS)) {
    score += 40
    threats.push('xss')
  }

  // ── Path traversal ──
  if (matchesAny(scanText, PATH_TRAVERSAL_PATTERNS)) {
    score += 50
    threats.push('path-traversal')
  }

  // ── Command injection ──
  if (matchesAny(scanText, CMD_INJECTION_PATTERNS)) {
    score += 60
    threats.push('cmdi')
  }

  // ── Host header spoofing ──
  const host = request.headers.get('host') || ''
  if (host && (/[<>"'`]/.test(host) || host.includes('\n') || host.includes('\r'))) {
    score += 40
    threats.push('host-spoofing')
  }

  // ── Oversized URL (potential buffer overflow attempt) ──
  if (url.href.length > 8192) {
    score += 20
    threats.push('oversized-url')
  }

  // ── Multi-vector bonus ──
  if (threats.length >= 3) {
    score += 20
    threats.push('multi-vector')
  }

  // ── Decision ──
  const blocked = score >= 50

  // Auto-block IP on high score
  if (score >= 70) {
    blockedIPs.set(ip, Date.now() + BLOCK_DURATION)
  }

  return {
    blocked,
    score: Math.min(score, 100),
    reason: blocked
      ? `Blocked: ${threats.join(', ')} (score: ${score})`
      : threats.length > 0
        ? `Suspicious: ${threats.join(', ')} (score: ${score})`
        : 'clean',
    threats,
    ip,
  }
}
