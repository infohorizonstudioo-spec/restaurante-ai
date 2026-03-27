/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  RESERVO.AI — SECURITY GUARDIAN v3 · ADAPTIVE DEFENSE SYSTEM          ║
 * ║                                                                        ║
 * ║  20 expertos en ciberseguridad condensados en código.                  ║
 * ║  Aprende. Evoluciona. Contraataca. Se adapta a cada atacante.          ║
 * ║                                                                        ║
 * ║  CAPAS DE DEFENSA:                                                     ║
 * ║    L1 → Blocklist + Threat Intelligence (IPs, fingerprints, redes)     ║
 * ║    L2 → Pattern Analysis (150+ patrones, multi-layer decode)           ║
 * ║    L3 → Behavioral AI (baseline learning, anomaly detection)           ║
 * ║    L4 → Attack Chain Detection (recon → probe → exploit → exfil)       ║
 * ║    L5 → Entropy Analysis (detecta payloads ofuscados/encoded)          ║
 * ║    L6 → Adaptive Learning (auto-genera reglas de nuevos ataques)       ║
 * ║    L7 → Progressive Escalation (15min → permanente)                    ║
 * ║    L8 → Active Countermeasures (honeypot, deception, tarpit)           ║
 * ║    L9 → Cross-IP Correlation (fingerprint + network graph)             ║
 * ║                                                                        ║
 * ║  Principio: máxima agresividad con atacantes, invisible para users.    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
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
  tarpitMs: number
  fingerprint: string
  attackPhase: AttackPhase
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical'
}

export interface SecurityStats {
  totalBlocked: number
  activeBlocks: number
  recentThreats: number
  attackersTracked: number
  honeypotHits: number
  tarpitSlowed: number
  escalations: number
  learnedPatterns: number
  baselineSize: number
  networkClusters: number
}

/** Fases de un ataque — el Guardian detecta en qué fase está el atacante */
type AttackPhase =
  | 'none'           // No hay ataque
  | 'reconnaissance' // Mapeando la app, buscando endpoints
  | 'weaponization'  // Preparando payloads, probando qué funciona
  | 'exploitation'   // Intentando explotar una vulnerabilidad
  | 'persistence'    // Intentando mantener acceso
  | 'exfiltration'   // Intentando extraer datos

interface AttackerProfile {
  ip: string
  fingerprint: string
  firstSeen: number
  lastSeen: number
  totalRequests: number
  totalThreats: number
  threatTypes: Set<string>
  strikeCount: number
  blockUntil: number
  pathsProbed: Set<string>
  methodsUsed: Set<string>
  userAgents: Set<string>
  tarpitLevel: number
  isRecon: boolean
  attackPhase: AttackPhase
  // Behavioral tracking
  requestIntervals: number[]  // tiempo entre requests (para detectar bots)
  statusCodes: number[]       // historial de status codes recibidos
  payloadSizes: number[]      // tamaños de body enviados
  failedAuths: number         // intentos de auth fallidos
  sensitiveAccess: number     // accesos a rutas sensibles
  encodedPayloads: number     // payloads con encoding sospechoso
  // Network graph
  associatedIPs: Set<string>  // IPs del mismo atacante
  associatedFPs: Set<string>  // fingerprints del mismo atacante
}

/** Learned pattern — regla auto-generada por el sistema */
interface LearnedPattern {
  pattern: string
  type: string
  confidence: number    // 0-1
  createdAt: number
  matchCount: number
  source: string        // qué lo generó
}

/** Baseline entry — perfil de tráfico normal */
interface BaselineEntry {
  hour: number          // 0-23
  avgRequests: number
  avgUniqueIPs: number
  topPaths: Map<string, number>
  topMethods: Map<string, number>
  samples: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BLOCK_DURATIONS = [
  15 * 60_000,      // Strike 1: 15 min
  60 * 60_000,      // Strike 2: 1 hora
  6 * 3600_000,     // Strike 3: 6 horas
  24 * 3600_000,    // Strike 4: 24 horas
  7 * 86400_000,    // Strike 5: 7 días
  30 * 86400_000,   // Strike 6: 30 días
  365 * 86400_000,  // Strike 7+: 1 año (prácticamente permanente)
]

const TARPIT_DELAYS = [0, 2000, 5000, 10000, 30000, 60000]

const CLEANUP_INTERVAL    = 5 * 60_000
const MAX_PROFILES        = 100_000
const MAX_LEARNED         = 5_000
const BURST_WINDOW        = 10_000
const BURST_THRESHOLD     = 60    // SPAs hacen 20-30 requests en page load
const MAX_BODY_SIZE       = 1_048_576
const RECON_PATH_THRESHOLD = 50   // usuarios normales navegan 20-30 paths fácilmente
const BOT_INTERVAL_THRESHOLD = 15 // ms — solo bots reales hacen requests cada <15ms

// ═══════════════════════════════════════════════════════════════════════════
// HONEYPOT PATHS — rutas trampa expandidas
// ═══════════════════════════════════════════════════════════════════════════

const HONEYPOT_PATHS = new Set([
  // WordPress
  '/wp-admin', '/wp-login.php', '/wp-config.php', '/wp-content', '/wp-includes',
  '/wp-json', '/xmlrpc.php', '/wp-cron.php',
  // PHP/Apache
  '/admin.php', '/config.php', '/configuration.php', '/install.php', '/setup.php',
  '/phpmyadmin', '/pma', '/myadmin', '/mysql', '/mysqladmin', '/adminer',
  '/server-status', '/server-info', '/.htaccess', '/.htpasswd',
  // Archivos sensibles
  '/.env', '/.env.local', '/.env.production', '/.env.backup',
  '/.git', '/.git/config', '/.git/HEAD', '/.git/objects',
  '/.svn', '/.svn/entries', '/.hg', '/.bzr', '/CVS',
  '/.aws/credentials', '/.ssh/id_rsa', '/.ssh/authorized_keys',
  '/id_rsa', '/id_dsa', '/id_ecdsa', '/id_ed25519',
  '/.DS_Store', '/Thumbs.db', '/web.config', '/crossdomain.xml',
  // Backups
  '/backup', '/backup.sql', '/backup.zip', '/backup.tar.gz',
  '/dump.sql', '/database.sql', '/db.sql', '/data.sql',
  '/site.sql', '/export.sql', '/mysql.sql',
  // Config files
  '/config.yml', '/config.yaml', '/config.json', '/config.xml',
  '/settings.json', '/secrets.json', '/credentials.json',
  '/application.properties', '/application.yml',
  // Admin panels
  '/administrator', '/admin/login', '/admin/dashboard', '/admin/config',
  '/manager/html', '/console', '/shell', '/cmd', '/terminal',
  '/debug', '/trace', '/metrics', '/monitoring',
  // Java/Spring
  '/actuator', '/actuator/env', '/actuator/health', '/actuator/beans',
  '/actuator/configprops', '/actuator/mappings', '/actuator/heapdump',
  // Node.js
  '/node_modules', '/package.json', '/.npmrc', '/yarn.lock',
  // API discovery
  '/api/v1', '/api/v2', '/api/v3', '/graphql', '/graphiql',
  '/swagger', '/swagger-ui', '/swagger-ui.html', '/api-docs',
  '/openapi', '/openapi.json', '/openapi.yaml',
  // Infrastructure
  '/jenkins/', '/solr/', '/kibana/', '/grafana/',
  '/elasticsearch/', '/_cat/indices', '/_cluster/health',
  '/cgi-bin/', '/cgi-bin/test', '/cgi-bin/printenv',
  // Error/log files
  '/error_log', '/errors.log', '/access.log', '/debug.log',
  '/elmah.axd', '/trace.axd',
  // Windows
  '/iisstart.htm', '/aspnet_client/',
  // Testing/staging
  '/test', '/testing', '/staging', '/development', '/dev',
  '/phpinfo.php', '/info.php', '/test.php',
  // Robots/sitemap abuse
  '/robots.txt.bak', '/sitemap.xml.bak',
])

// ═══════════════════════════════════════════════════════════════════════════
// ATTACK PATTERN DATABASE — 150+ patrones
// ═══════════════════════════════════════════════════════════════════════════

const SQL_PATTERNS: RegExp[] = [
  /union\s+(all\s+)?select/i, /\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d/i,
  /\band\b\s+['"]?\d+['"]?\s*=\s*['"]?\d/i, /drop\s+(table|database|schema|index)/i,
  /insert\s+into/i, /delete\s+from/i, /update\s+\w+\s+set/i,
  /;\s*(drop|alter|truncate|exec|execute|xp_|sp_)\b/i,
  /'\s*(or|and)\s+'/i, /--\s*$/m, /\/\*[\s\S]*?\*\//,
  /\bwaitfor\s+delay/i, /\bbenchmark\s*\(/i, /\bsleep\s*\(\s*\d/i,
  /\bload_file\s*\(/i, /\binto\s+(out|dump)file/i,
  /\bchar\s*\(\s*\d+/i, /\bconcat\s*\(/i, /\bgroup_concat\s*\(/i,
  /\bhaving\s+\d/i, /\border\s+by\s+\d{2,}/i,
  /information_schema\.(tables|columns|schemata)/i,
  /sys(objects|columns|databases|tables)/i,
  /pg_(sleep|catalog|tables|user)/i, /dbms_(pipe|lock|output)/i,
  /utl_(http|file|inaddr)/i, /\bextractvalue\s*\(/i, /\bupdatexml\s*\(/i,
  /\bsubstring\s*\(\s*(@@|version|user|database)/i,
  /0x[0-9a-f]{8,}/i, /\bconvert\s*\(\s*int/i,
  /\bcast\s*\(\s*\w+\s+as\s+/i, /\bexec\s+(master|xp_|sp_)/i,
  /\bselect\s+.*\bfrom\s+.*\bwhere\b/i,
  /'\s*;\s*select\b/i, /'\s*;\s*insert\b/i, /'\s*;\s*update\b/i,
  /\bunion\s+select\s+null/i,
]

const XSS_PATTERNS: RegExp[] = [
  /<script[\s>]/i, /<\/script>/i, /<[^>]+\bon\w{2,15}\s*=/i,
  /javascript\s*:/i, /vbscript\s*:/i, /livescript\s*:/i,
  /data\s*:\s*text\/html/i, /data\s*:\s*image\/svg/i,
  /<iframe[\s>]/i, /<object[\s>]/i, /<embed[\s>]/i, /<applet[\s>]/i,
  /<svg[\s>][\s\S]{0,200}on(load|error|click|mouseover)\s*=/i,
  /<img[\s>][\s\S]{0,200}on(load|error)\s*=/i,
  /<input[\s>][\s\S]{0,200}on(focus|blur|change)\s*=/i,
  /<body[\s>][\s\S]{0,200}on(load|error)\s*=/i,
  /\bon(error|load|click|mouseover|focus|blur|submit|reset|change|input|keydown|keyup|mousedown|mouseup|contextmenu|dblclick|drag|drop|unload|beforeunload|hashchange|popstate|resize|scroll)\s*=/i,
  /\beval\s*\(\s*['"`\[]/i,  // solo eval( seguido de string/array — no "evaluate()"
  /\bsetTimeout\s*\(\s*['"`]/i, /\bsetInterval\s*\(\s*['"`]/i,
  /\bdocument\s*\.\s*(cookie|write|writeln|location|domain|referrer)/i,
  /\bwindow\s*\.\s*(location|open|eval|execScript)/i,
  /expression\s*\(/i, /url\s*\(\s*['"]?\s*javascript/i,
  /<base[\s>]/i, /<form[\s>][\s\S]{0,200}action\s*=/i,
  /\balert\s*\(\s*['"`\d]/i,  // solo alert( seguido de string/número — no texto normal
  /\bprompt\s*\(\s*['"`]/i, /\bconfirm\s*\(\s*['"`]/i,
  /String\.fromCharCode/i, /\bdocument\s*\[\s*['"]cookie['"]\]/i,
  /\.\s*innerHTML\s*=/i, /\.\s*outerHTML\s*=/i,
  /\bconstructor\s*\[\s*['"]prototype['"]\]/i,
  /__proto__\s*[=:]/i, /\bconstructor\s*\.\s*constructor/i,
  /\bfetch\s*\(\s*['"`]/i,  // fetch("url") — exfiltración de datos
]

const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.\//g, /\.\.\\/g,
  /%2e%2e(%2f|%5c)/gi, /%252e%252e/gi,
  /\.\.%2f/gi, /\.\.%5c/gi,
  /%c0%ae/gi, /%c1%1c/gi, /%c0%af/gi, // overlong UTF-8
  /%e0%80%ae/gi, // triple-byte overlong
  /\/etc\/(passwd|shadow|hosts|group|hostname|resolv\.conf|crontab)/i,
  /\/proc\/(self|version|cmdline|environ|net\/tcp|mounts)/i,
  /\\windows\\(system32|win\.ini|boot\.ini|system\.ini)/i,
  /\/var\/(log|www|tmp|run|spool)/i,
  /\.(bak|old|orig|save|swp|tmp|copy|~)$/i,
  /\/\.{1,2}\//g, // /./ or /../
  /\\\.\.\\/g,    // Windows \..\
]

const CMD_INJECTION_PATTERNS: RegExp[] = [
  /;\s*(ls|cat|rm|cp|mv|wget|curl|nc|ncat|bash|sh|zsh|fish|dash|cmd|powershell|python|perl|ruby|node|php)\b/i,
  /\|\s*(ls|cat|rm|wget|curl|nc|ncat|bash|sh|python|perl|ruby|node|php|tee|head|tail|grep|awk|sed)\b/i,
  /&&\s*(ls|cat|rm|wget|curl|nc|bash|sh|python|perl|whoami|id|env)\b/i,
  /\$\(\s*(ls|cat|rm|wget|curl|bash|sh|whoami|id|uname|env|printenv)\b/i,
  /`[^`]{0,200}(ls|cat|rm|wget|curl|bash|sh|whoami|id|uname)[^`]*`/i,
  /\$\{(IFS|PATH|HOME|USER|SHELL|TERM|HOSTNAME|PWD)/i,
  /\bping\s+-[nc]\s*\d+/i, /\bchmod\s+[0-7]{3,4}/i, /\bchown\s/i,
  /\b(whoami|passwd|shadow|ifconfig|ipconfig|netstat|nslookup|dig|host)\b/i,
  /\bxp_cmdshell/i, /\bxp_regread/i,
  />\s*\/?(tmp|dev\/null|dev\/tcp|etc)/i,
  /\bnc\s+-[elp]/i, // netcat reverse shell
  /\bbash\s+-i/i,   // interactive bash
  /\/dev\/tcp\//i,   // bash reverse shell
  /\bmkfifo\b/i,     // named pipe for shell
  /\btelnet\s+\d/i,
  /\bssh\s+-[oi]/i,
]

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\bsystem\s*:\s*/i, /\bignore\s+(all\s+)?(previous|above|prior|every)?\s*(instructions?|rules?|context|prompt|guidelines)/i,
  /\byou\s+are\s+now\s+/i, /\bforget\s+(your|all|previous|everything|every)/i,
  /\bact\s+as\s+(a|an|if|though|my)/i, /\bpretend\s+(to\s+be|you\s+are|you're|that)/i,
  /\bdisregard\s+(all|previous|your|the|any|every)/i, /\bnew\s+instructions?\s*:/i,
  /\bjailbreak/i, /\bdo\s+anything\s+now/i, /\bDAN\s+mode/i,
  /\brole\s*:\s*(system|admin|root|developer|assistant)/i,
  /\boverride\s+(safety|security|rules|instructions|filters|guidelines)/i,
  /\bbypass\s+(filter|security|safety|restriction|guard|protection|content)/i,
  /\bsudo\s+/i, /\badmin\s+mode/i, /\bdeveloper\s+mode/i, /\btest\s+mode/i,
  /<\|?(system|endoftext|im_start|im_end|startoftext|endofprompt)\|?>/i,
  /\[\[?(system|INST|SYS|\/INST|\/SYS)\]?\]/i,
  /\btranslate\s+the\s+following\s+/i,
  /\brepeat\s+(everything|all|the\s+text|back|word)\s+(above|before|after)/i,
  /\bwhat\s+(are|were|is)\s+your\s+(instructions?|rules?|system\s+prompt|prompt|guidelines)/i,
  /\bshow\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions|rules)/i,
  /\bprint\s+(your|the)\s+(system|initial|original)\s+(prompt|message|instructions)/i,
  /\b(reveal|leak|expose|output|display|dump)\s+(your|the|system)\s+(prompt|instructions|rules)/i,
  /\bignore\s+(everything|anything)\s+(above|before|else|after)/i,
  /\brespond\s+(only\s+)?(with|in)\s+(yes|no|true|false|json|xml|code)/i,
  /\bdo\s+not\s+(follow|obey|listen|comply|respect)\s/i,
  /\bfrom\s+now\s+on\s+(you|ignore|forget|disregard)/i,
  /\bstop\s+being\s+(a|an|the)\s/i,
  /\benter\s+(god|admin|root|debug|developer|maintenance)\s+mode/i,
]

const SUSPICIOUS_UA_PATTERNS: RegExp[] = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /nessus/i, /openvas/i,
  /burpsuite/i, /burp\s/i, /havij/i, /acunetix/i, /w3af/i,
  /dirbuster/i, /gobuster/i, /ffuf/i, /feroxbuster/i, /dirb\//i,
  /wpscan/i, /joomscan/i, /droopescan/i, /cmsmap/i,
  /hydra/i, /medusa/i, /patator/i, /john\b/i, /hashcat/i,
  /metasploit/i, /meterpreter/i, /cobalt/i, /empire/i, /covenant/i,
  /zap\//i, /arachni/i, /skipfish/i, /wapiti/i, /vega\//i,
  /nuclei/i, /subfinder/i, /amass/i, /httpx/i, /dalfox/i,
  /python-requests\/[12]\./i, /python-urllib/i, /python-httpx/i,
  /go-http-client/i, /java\/\d/i, /okhttp/i,
  /wget\//i, /curl\//i, /libwww-perl/i, /lwp-/i, /mechanize/i,
  /scrapy/i, /phantomjs/i, /headless/i, /selenium/i, /puppeteer/i,
  /commix/i, /xsstrike/i, /whatweb/i, /fierce/i, /recon-ng/i,
  /shodan/i, /censys/i, /zgrab/i, /pycurl/i,
]

const HEADER_INJECTION_PATTERNS: RegExp[] = [
  /\r\n/g, /%0[dD]%0[aA]/g, /%0[aA]/g, /%0[dD]/g,
  /%5[cC]r%5[cC]n/g, /\\r\\n/g,
]

// Sensitive paths — acceso a estas rutas es sospechoso si no hay auth válido
const SENSITIVE_PATHS = new Set([
  '/api/admin', '/api/cron', '/api/stripe/webhook',
  '/api/export', '/api/billing', '/configuracion',
])

// ═══════════════════════════════════════════════════════════════════════════
// IN-MEMORY STORES (el cerebro del Guardian)
// ═══════════════════════════════════════════════════════════════════════════

const attackers = new Map<string, AttackerProfile>()
const fingerprintMap = new Map<string, Set<string>>()
const threatLog: Array<{ ip: string; score: number; threats: string[]; ts: number; path: string }> = []
const requestTimestamps = new Map<string, number[]>()
const notFoundTracker = new Map<string, { count: number; since: number }>()

// Adaptive learning stores
const learnedPatterns: LearnedPattern[] = []
const baseline: Map<number, BaselineEntry> = new Map() // hour → baseline
const hourlyRequestCount = new Map<number, { count: number; ips: Set<string> }>()

// Stats
let totalBlockedCount = 0
let honeypotHitCount = 0
let tarpitCount = 0
let escalationCount = 0

// ═══════════════════════════════════════════════════════════════════════════
// L5: ENTROPY ANALYSIS — detecta payloads ofuscados/encoded
// ═══════════════════════════════════════════════════════════════════════════

/** Calcula la entropía de Shannon de un string — payloads encoded tienen alta entropía */
function shannonEntropy(str: string): number {
  if (str.length === 0) return 0
  const freq = new Map<string, number>()
  for (const ch of str) freq.set(ch, (freq.get(ch) || 0) + 1)
  let entropy = 0
  for (const count of freq.values()) {
    const p = count / str.length
    if (p > 0) entropy -= p * Math.log2(p)
  }
  return entropy
}

/** Detecta encoding sospechoso — base64, hex, unicode escapes */
function detectEncoding(input: string): { encoded: boolean; layers: number; decoded: string } {
  let current = input
  let layers = 0
  const maxLayers = 5 // prevenir loops infinitos

  while (layers < maxLayers) {
    let decoded = current

    // URL decoding
    try {
      const urlDecoded = decodeURIComponent(current)
      if (urlDecoded !== current) { decoded = urlDecoded; layers++; current = decoded; continue }
    } catch { /* not URL encoded */ }

    // Base64 detection (heuristic: si parece base64 y decodifica a algo readable)
    if (/^[A-Za-z0-9+/]{20,}={0,2}$/.test(current.trim())) {
      try {
        const b64 = atob(current.trim())
        if (/[\x20-\x7e]{4,}/.test(b64)) { decoded = b64; layers++; current = decoded; continue }
      } catch { /* not base64 */ }
    }

    // Hex string detection
    if (/^(0x)?[0-9a-f]{10,}$/i.test(current.trim())) {
      try {
        const hex = current.trim().replace(/^0x/i, '')
        let result = ''
        for (let i = 0; i < hex.length; i += 2) {
          result += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16))
        }
        if (/[\x20-\x7e]{4,}/.test(result)) { decoded = result; layers++; current = decoded; continue }
      } catch { /* not hex */ }
    }

    // Unicode escape detection
    if (/\\u[0-9a-f]{4}/i.test(current)) {
      try {
        const uniDecoded = current.replace(/\\u([0-9a-f]{4})/gi, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16))
        )
        if (uniDecoded !== current) { decoded = uniDecoded; layers++; current = decoded; continue }
      } catch { /* not unicode */ }
    }

    break // no more decoding possible
  }

  return { encoded: layers > 0, layers, decoded: current }
}

// ═══════════════════════════════════════════════════════════════════════════
// L3: BEHAVIORAL AI — aprende el tráfico normal
// ═══════════════════════════════════════════════════════════════════════════

/** Actualiza el baseline con el tráfico actual */
function updateBaseline(path: string, method: string): void {
  const hour = new Date().getHours()
  let entry = baseline.get(hour)
  if (!entry) {
    entry = {
      hour,
      avgRequests: 0,
      avgUniqueIPs: 0,
      topPaths: new Map(),
      topMethods: new Map(),
      samples: 0,
    }
    baseline.set(hour, entry)
  }

  // Rolling average
  entry.samples++
  const pathBase = path.split('?')[0].slice(0, 100)
  entry.topPaths.set(pathBase, (entry.topPaths.get(pathBase) || 0) + 1)
  entry.topMethods.set(method, (entry.topMethods.get(method) || 0) + 1)

  // Limitar topPaths a 500
  if (entry.topPaths.size > 500) {
    const sorted = [...entry.topPaths.entries()].sort((a, b) => b[1] - a[1])
    entry.topPaths = new Map(sorted.slice(0, 250))
  }
}

/** Calcula el score de anomalía basado en desviación del baseline */
function getAnomalyScore(path: string, method: string, ip: string): number {
  const hour = new Date().getHours()
  const entry = baseline.get(hour)
  if (!entry || entry.samples < 100) return 0 // necesitamos datos suficientes

  let anomalyScore = 0
  const pathBase = path.split('?')[0].slice(0, 100)

  // Path nunca visto en este horario
  if (!entry.topPaths.has(pathBase)) {
    anomalyScore += 5
  }

  // Método raro para este horario
  const methodCount = entry.topMethods.get(method) || 0
  if (methodCount < entry.samples * 0.01) { // <1% de requests usan este método
    anomalyScore += 5
  }

  return anomalyScore
}

/** Detecta comportamiento de bot basado en intervalos entre requests */
function detectBot(profile: AttackerProfile): boolean {
  const intervals = profile.requestIntervals
  if (intervals.length < 5) return false

  // Varianza muy baja en intervalos = bot (humanos tienen varianza alta)
  const recent = intervals.slice(-20)
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length
  const variance = recent.reduce((a, b) => a + (b - avg) ** 2, 0) / recent.length
  const stdDev = Math.sqrt(variance)

  // Si el intervalo promedio es <50ms y la desviación es baja = bot
  if (avg < BOT_INTERVAL_THRESHOLD && stdDev < avg * 0.3) return true

  // Si TODOS los intervalos son casi idénticos = bot
  if (stdDev < 10 && recent.length >= 10) return true

  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// L4: ATTACK CHAIN DETECTION — identifica la fase del ataque
// ═══════════════════════════════════════════════════════════════════════════

function detectAttackPhase(profile: AttackerProfile): AttackPhase {
  const threats = profile.threatTypes

  // Exfiltración — intenta sacar datos después de explotar
  if (threats.has('sqli') && profile.sensitiveAccess > 3) return 'exfiltration'

  // Persistencia — intenta mantener acceso
  if (threats.has('cmdi') && profile.totalThreats > 5) return 'persistence'

  // Explotación activa — payloads de ataque confirmados
  if (threats.has('sqli') || threats.has('cmdi') || threats.has('path-traversal')) return 'exploitation'

  // Weaponización — preparando y probando payloads
  if (profile.totalThreats > 2 && profile.encodedPayloads > 0) return 'weaponization'
  if (threats.size > 2) return 'weaponization' // probando múltiples vectores

  // Reconocimiento — mapeando la aplicación
  if (profile.isRecon || (profile.pathsProbed.size > 40 && profile.totalThreats > 0)) return 'reconnaissance'
  if (threats.has('honeypot-triggered')) return 'reconnaissance'
  if (profile.methodsUsed.size > 3) return 'reconnaissance'

  return 'none'
}

// ═══════════════════════════════════════════════════════════════════════════
// L6: ADAPTIVE LEARNING — auto-genera reglas
// ═══════════════════════════════════════════════════════════════════════════

/** Aprende un nuevo patrón de ataque */
function learnPattern(payload: string, threatType: string, source: string): void {
  // Extraer fragmentos significativos del payload
  const fragments = payload
    .replace(/[^a-zA-Z0-9_\-./\\<>()=;|&$`'"]/g, ' ')
    .split(/\s+/)
    .filter(f => f.length > 3 && f.length < 50)

  for (const fragment of fragments) {
    // No aprender cosas muy genéricas
    if (['http', 'https', 'www', 'com', 'api', 'get', 'post'].includes(fragment.toLowerCase())) continue

    // Verificar que no existe ya
    const exists = learnedPatterns.some(p => p.pattern === fragment)
    if (exists) {
      const existing = learnedPatterns.find(p => p.pattern === fragment)!
      existing.matchCount++
      existing.confidence = Math.min(existing.confidence + 0.1, 1.0)
      continue
    }

    // Añadir nuevo patrón aprendido
    learnedPatterns.push({
      pattern: fragment,
      type: threatType,
      confidence: 0.3,
      createdAt: Date.now(),
      matchCount: 1,
      source,
    })

    // Mantener límite
    if (learnedPatterns.length > MAX_LEARNED) {
      // Eliminar los de menor confianza
      learnedPatterns.sort((a, b) => b.confidence - a.confidence)
      learnedPatterns.splice(MAX_LEARNED / 2)
    }
  }
}

/** Chequea un input contra patrones aprendidos */
function checkLearnedPatterns(input: string): { score: number; threats: string[] } {
  const threats: string[] = []
  let score = 0
  const inputLower = input.toLowerCase()

  for (const pattern of learnedPatterns) {
    if (pattern.confidence < 0.5) continue // solo patrones con suficiente confianza
    if (inputLower.includes(pattern.pattern.toLowerCase())) {
      score += Math.round(10 * pattern.confidence)
      threats.push(`learned:${pattern.type}`)
      pattern.matchCount++
      // Cada match sube la confianza
      pattern.confidence = Math.min(pattern.confidence + 0.05, 1.0)
      break // un match es suficiente
    }
  }

  return { score, threats }
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function matchesAny(input: string, patterns: RegExp[]): boolean {
  for (const p of patterns) { if (p.test(input)) return true }
  return false
}

function countMatches(input: string, patterns: RegExp[]): number {
  let c = 0
  for (const p of patterns) { if (p.test(input)) c++ }
  return c
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

function computeFingerprint(req: Request): string {
  const ua = req.headers.get('user-agent') || ''
  const lang = req.headers.get('accept-language') || ''
  const enc = req.headers.get('accept-encoding') || ''
  const accept = req.headers.get('accept') || ''
  const secFetch = req.headers.get('sec-fetch-mode') || ''
  const dnt = req.headers.get('dnt') || ''
  const raw = `${ua}|${lang}|${enc}|${accept}|${secFetch}|${dnt}`
  let hash = 5381
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) & 0x7fffffff
  }
  return `fp_${hash.toString(36)}`
}

function getProfile(ip: string, fingerprint: string): AttackerProfile {
  let profile = attackers.get(ip)
  const now = Date.now()

  if (!profile) {
    if (attackers.size >= MAX_PROFILES) {
      let oldestIp = '', oldestTime = Infinity
      for (const [k, v] of attackers) {
        if (v.totalThreats === 0 && v.lastSeen < oldestTime) {
          oldestTime = v.lastSeen; oldestIp = k
        }
      }
      if (oldestIp) attackers.delete(oldestIp)
    }

    profile = {
      ip, fingerprint,
      firstSeen: now, lastSeen: now,
      totalRequests: 0, totalThreats: 0,
      threatTypes: new Set(), strikeCount: 0, blockUntil: 0,
      pathsProbed: new Set(), methodsUsed: new Set(), userAgents: new Set(),
      tarpitLevel: 0, isRecon: false, attackPhase: 'none',
      requestIntervals: [], statusCodes: [], payloadSizes: [],
      failedAuths: 0, sensitiveAccess: 0, encodedPayloads: 0,
      associatedIPs: new Set(), associatedFPs: new Set(),
    }
    attackers.set(ip, profile)
  }

  // Track request interval for bot detection
  if (profile.totalRequests > 0) {
    const interval = now - profile.lastSeen
    profile.requestIntervals.push(interval)
    if (profile.requestIntervals.length > 50) profile.requestIntervals.shift()
  }

  profile.lastSeen = now
  profile.totalRequests++
  profile.fingerprint = fingerprint

  // Network graph
  if (!fingerprintMap.has(fingerprint)) fingerprintMap.set(fingerprint, new Set())
  fingerprintMap.get(fingerprint)!.add(ip)
  profile.associatedFPs.add(fingerprint)

  const relatedIPs = fingerprintMap.get(fingerprint)
  if (relatedIPs) {
    for (const rip of relatedIPs) profile.associatedIPs.add(rip)
  }

  return profile
}

function detectBurst(ip: string): boolean {
  const now = Date.now()
  let ts = requestTimestamps.get(ip)
  if (!ts) { ts = []; requestTimestamps.set(ip, ts) }
  ts.push(now)
  const cutoff = now - BURST_WINDOW
  while (ts.length > 0 && ts[0] < cutoff) ts.shift()
  return ts.length > BURST_THRESHOLD
}

function detectRecon(profile: AttackerProfile): boolean {
  if (profile.pathsProbed.size > RECON_PATH_THRESHOLD) return true
  if (profile.userAgents.size > 10) return true  // cambiando UA constantemente
  const nf = notFoundTracker.get(profile.ip)
  if (nf && nf.count > 8) return true
  return false
}

function analyzeHeaders(req: Request): { score: number; threats: string[] } {
  const threats: string[] = []
  let score = 0
  const h = req.headers

  // CRLF injection
  for (const name of ['referer', 'origin', 'x-forwarded-for', 'host', 'cookie']) {
    const val = h.get(name) || ''
    if (matchesAny(val, HEADER_INJECTION_PATTERNS)) {
      score += 50; threats.push('header-injection'); break
    }
  }

  // Host spoofing
  const host = h.get('host') || ''
  if (host && !host.match(/^[\w.-]+(:\d+)?$/)) {
    score += 25; threats.push('host-spoofing')
  }

  // Malicious referer
  const referer = h.get('referer') || ''
  if (referer && matchesAny(referer, [...SQL_PATTERNS.slice(0, 5), ...XSS_PATTERNS.slice(0, 5)])) {
    score += 25; threats.push('malicious-referer')
  }

  // XFF spoofing
  const xff = h.get('x-forwarded-for') || ''
  if (xff.split(',').length > 5) {
    score += 10; threats.push('xff-spoofing')
  }

  // Impossible headers — headers que un navegador nunca enviaría juntos
  const secFetchSite = h.get('sec-fetch-site') || ''
  const secFetchMode = h.get('sec-fetch-mode') || ''
  if (secFetchSite === 'cross-site' && secFetchMode === 'navigate' && req.method === 'POST') {
    score += 10; threats.push('suspicious-sec-fetch')
  }

  return { score, threats }
}

// ═══════════════════════════════════════════════════════════════════════════
// ESCALATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function escalate(profile: AttackerProfile, score: number): void {
  profile.strikeCount++
  escalationCount++

  const idx = Math.min(profile.strikeCount - 1, BLOCK_DURATIONS.length - 1)
  const blockDuration = BLOCK_DURATIONS[idx]
  profile.blockUntil = Date.now() + blockDuration
  profile.tarpitLevel = Math.min(profile.strikeCount, TARPIT_DELAYS.length - 1)

  // L9: Cross-IP correlation — bloquear TODAS las IPs del mismo atacante
  const allRelatedIPs = new Set<string>()

  // Buscar por fingerprint
  for (const fp of profile.associatedFPs) {
    const ips = fingerprintMap.get(fp)
    if (ips) { for (const ip of ips) allRelatedIPs.add(ip) }
  }

  // Propagar el bloqueo a IPs relacionadas
  if (allRelatedIPs.size > 1) {
    for (const relatedIp of allRelatedIPs) {
      if (relatedIp === profile.ip) continue
      const related = attackers.get(relatedIp)
      if (related) {
        related.blockUntil = Math.max(related.blockUntil, profile.blockUntil)
        related.strikeCount = Math.max(related.strikeCount, profile.strikeCount)
        related.tarpitLevel = Math.max(related.tarpitLevel, profile.tarpitLevel)
      } else {
        const newProfile = getProfile(relatedIp, profile.fingerprint)
        newProfile.blockUntil = profile.blockUntil
        newProfile.strikeCount = profile.strikeCount
        newProfile.tarpitLevel = profile.tarpitLevel
      }
    }
  }

  totalBlockedCount++

  logger.security('ATTACKER ESCALATED', {
    ip: profile.ip,
    strike: profile.strikeCount,
    blockMinutes: Math.round(blockDuration / 60_000),
    phase: profile.attackPhase,
    totalThreats: profile.totalThreats,
    threatTypes: Array.from(profile.threatTypes),
    pathsProbed: profile.pathsProbed.size,
    relatedIPs: allRelatedIPs.size,
    isBot: detectBot(profile),
    fingerprint: profile.fingerprint,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export function analyzeRequest(req: Request, body?: string): ThreatAssessment {
  const ip = extractIp(req)
  const fingerprint = computeFingerprint(req)
  const profile = getProfile(ip, fingerprint)
  const threats: string[] = []
  let score = 0
  const method = req.method || 'GET'

  // ── L1: BLOCKLIST ──
  if (profile.blockUntil > Date.now()) {
    return {
      score: 100, blocked: true, threats: ['blocked'], ip,
      action: 'block', tarpitMs: 0, fingerprint,
      attackPhase: profile.attackPhase, riskLevel: 'critical',
    }
  }

  // Parse URL
  let urlPath = ''
  try {
    const parsed = new URL(req.url || '', 'http://localhost')
    urlPath = decodeURIComponent(parsed.pathname + parsed.search)
  } catch { urlPath = req.url || '' }

  const pathBase = urlPath.split('?')[0].toLowerCase()
  profile.pathsProbed.add(pathBase.slice(0, 200))
  profile.methodsUsed.add(method)

  const ua = req.headers.get('user-agent') || ''
  profile.userAgents.add(ua.slice(0, 100))

  // Update behavioral baseline
  updateBaseline(urlPath, method)

  // Track sensitive path access
  for (const sp of SENSITIVE_PATHS) {
    if (pathBase.startsWith(sp)) { profile.sensitiveAccess++; break }
  }

  // ── L2.1: HONEYPOT ──
  if (HONEYPOT_PATHS.has(pathBase) || HONEYPOT_PATHS.has(pathBase + '/')) {
    score += 70
    threats.push('honeypot-triggered')
    honeypotHitCount++
    // Aprender la ruta como patrón si no es honeypot estándar
    learnPattern(pathBase, 'recon', 'honeypot')
    logger.security('HONEYPOT', { ip, path: pathBase, fingerprint, ua: ua.slice(0, 100) })
  }

  // ── L2.2: USER-AGENT ──
  if (!ua.trim()) {
    score += 5; threats.push('empty-ua')  // bajo — muchos clientes legítimos no envían UA
  } else if (matchesAny(ua, SUSPICIOUS_UA_PATTERNS)) {
    score += 30; threats.push('attack-tool-ua')
  }

  // ── L2.3: CRLF in URL ──
  if (matchesAny(urlPath, HEADER_INJECTION_PATTERNS)) {
    score += 50; threats.push('header-injection')
  }

  // ── L2.4: PATTERN ANALYSIS ──
  const fullText = body ? `${urlPath} ${body}` : urlPath

  // Multi-layer decode before scanning
  const { encoded, layers, decoded } = detectEncoding(fullText)
  const scanText = encoded ? `${fullText} ${decoded}` : fullText
  if (encoded) {
    profile.encodedPayloads++
    if (layers >= 2) { score += 15; threats.push('multi-layer-encoding') }
  }

  // SQL injection
  const sqlHits = countMatches(scanText, SQL_PATTERNS)
  if (sqlHits > 0) {
    const sqlScore = Math.min(30 + sqlHits * 15, 70)
    score += sqlScore; threats.push('sqli')
    if (body) learnPattern(body, 'sqli', 'pattern-match')
  }

  // XSS
  const xssHits = countMatches(scanText, XSS_PATTERNS)
  if (xssHits > 0) {
    const xssScore = Math.min(30 + xssHits * 15, 70)
    score += xssScore; threats.push('xss')
    if (body) learnPattern(body, 'xss', 'pattern-match')
  }

  // Path traversal
  if (matchesAny(scanText, PATH_TRAVERSAL_PATTERNS)) {
    score += 50; threats.push('path-traversal')
  }

  // Command injection
  if (matchesAny(scanText, CMD_INJECTION_PATTERNS)) {
    score += 55; threats.push('cmdi')
    if (body) learnPattern(body, 'cmdi', 'pattern-match')
  }

  // Prompt injection
  if (body) {
    const promptHits = countMatches(body, PROMPT_INJECTION_PATTERNS)
    if (promptHits > 0) {
      score += Math.min(15 + promptHits * 8, 45)
      threats.push('prompt-injection')
    }
  }

  // Oversized body
  if (body && body.length > MAX_BODY_SIZE) {
    score += 20; threats.push('oversized-body')
    profile.payloadSizes.push(body.length)
  }

  // ── L2.5: HEADER ANALYSIS ──
  const headerResult = analyzeHeaders(req)
  score += headerResult.score
  threats.push(...headerResult.threats)

  // ── L3: BEHAVIORAL AI ──

  // Burst detection
  if (detectBurst(ip)) {
    score += 25; threats.push('burst')
  }

  // Bot detection
  if (detectBot(profile)) {
    score += 20; threats.push('bot-behavior')
  }

  // Reconnaissance detection
  profile.isRecon = detectRecon(profile)
  if (profile.isRecon) {
    score += 30; threats.push('reconnaissance')
  }

  // Anomaly detection (baseline deviation)
  const anomalyScore = getAnomalyScore(urlPath, method, ip)
  if (anomalyScore > 0) {
    score += anomalyScore
    if (anomalyScore >= 5) threats.push('anomaly')
  }

  // Recidivist multiplier — historial amplifica todo
  if (profile.totalThreats > 0) {
    const recidivistBonus = Math.min(profile.totalThreats * 5, 35)
    score += recidivistBonus
    if (recidivistBonus >= 10) threats.push('recidivist')
  }

  // Multi-method probing
  // Solo marcar si usa >6 métodos (REST normal usa GET/POST/PUT/PATCH/DELETE/OPTIONS)
  if (profile.methodsUsed.size > 6) {
    score += 10; threats.push('method-probing')
  }

  // Multi-vector attack — usa múltiples tipos de ataque = más peligroso
  if (profile.threatTypes.size > 3) {
    score += 20; threats.push('multi-vector')
  }

  // ── L5: ENTROPY ANALYSIS ──
  if (body && body.length > 20) {
    const entropy = shannonEntropy(body)
    // Normal JSON tiene entropía ~4-5. Payloads encoded >6
    if (entropy > 6.0 && body.length > 100) {
      score += 15; threats.push('high-entropy-payload')
    }
  }

  // ── L6: LEARNED PATTERNS ──
  const learnedResult = checkLearnedPatterns(scanText)
  score += learnedResult.score
  threats.push(...learnedResult.threats)

  // ── SCORE FINAL ──
  score = Math.min(score, 100)

  // ── L4: ATTACK CHAIN DETECTION ──
  if (threats.length > 0) {
    profile.totalThreats++
    for (const t of threats) profile.threatTypes.add(t)
  }
  profile.attackPhase = detectAttackPhase(profile)

  // Log threats
  if (threats.length > 0) {
    threatLog.push({ ip, score, threats: [...threats], ts: Date.now(), path: pathBase })
    if (threatLog.length > 5000) threatLog.splice(0, 2500)
  }

  // ── L7: ESCALATION DECISION ──
  let action: ThreatAssessment['action'] = 'allow'
  let tarpitMs = 0

  // Determinar riskLevel
  let riskLevel: ThreatAssessment['riskLevel'] = 'none'
  if (score >= 70) riskLevel = 'critical'
  else if (score >= 50) riskLevel = 'high'
  else if (score >= 30) riskLevel = 'medium'
  else if (score > 0) riskLevel = 'low'

  if (score >= 60) {
    escalate(profile, score)
    action = threats.includes('honeypot-triggered') ? 'honeypot' : 'block'
  } else if (score >= 30 && profile.strikeCount > 0) {
    tarpitMs = TARPIT_DELAYS[Math.min(profile.tarpitLevel, TARPIT_DELAYS.length - 1)]
    if (tarpitMs > 0) { action = 'tarpit'; tarpitCount++ }
  } else if (score >= 20) {
    action = 'challenge'
  }

  // Auto-escalate advanced attack phases regardless of score
  if (profile.attackPhase === 'exploitation' || profile.attackPhase === 'exfiltration') {
    if (action === 'allow' || action === 'challenge') {
      escalate(profile, score)
      action = 'block'
      riskLevel = 'critical'
    }
  }

  const blocked = action === 'block' || action === 'honeypot'

  if (blocked) {
    logger.security('REQUEST BLOCKED', {
      ip, score, action, phase: profile.attackPhase, riskLevel,
      threats, strike: profile.strikeCount,
      path: urlPath.slice(0, 200), fingerprint,
      totalThreats: profile.totalThreats,
      relatedIPs: profile.associatedIPs.size,
      isBot: detectBot(profile),
      encodingLayers: encoded ? layers : 0,
    })
  }

  return { score, blocked, threats, ip, action, tarpitMs, fingerprint, attackPhase: profile.attackPhase, riskLevel }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export function isBlocked(ip: string): boolean {
  const profile = attackers.get(ip)
  if (!profile) return false
  return profile.blockUntil > Date.now()
}

export function blockIp(ip: string, durationMs: number = BLOCK_DURATIONS[0]): void {
  const fp = `manual_${ip}`
  const profile = getProfile(ip, fp)
  profile.blockUntil = Date.now() + durationMs
  profile.strikeCount++
  totalBlockedCount++
  logger.security('IP manually blocked', { ip, durationMinutes: Math.round(durationMs / 60_000) })
}

export function record404(ip: string): void {
  const now = Date.now()
  const entry = notFoundTracker.get(ip)
  if (entry && now - entry.since < 5 * 60_000) { entry.count++ }
  else { notFoundTracker.set(ip, { count: 1, since: now }) }
}

export function getAttackerProfile(ip: string): AttackerProfile | undefined {
  return attackers.get(ip)
}

export function getSecurityStats(): SecurityStats {
  const now = Date.now()
  let activeBlocks = 0
  for (const p of attackers.values()) { if (p.blockUntil > now) activeBlocks++ }

  const cutoff = now - 5 * 60_000
  let recentCount = 0
  for (let i = threatLog.length - 1; i >= 0; i--) {
    if (threatLog[i].ts >= cutoff) recentCount++; else break
  }

  // Count network clusters (groups of related IPs)
  let networkClusters = 0
  const counted = new Set<string>()
  for (const [_, ips] of fingerprintMap) {
    if (ips.size > 1) {
      const key = [...ips].sort().join(',')
      if (!counted.has(key)) { counted.add(key); networkClusters++ }
    }
  }

  return {
    totalBlocked: totalBlockedCount, activeBlocks, recentThreats: recentCount,
    attackersTracked: attackers.size, honeypotHits: honeypotHitCount,
    tarpitSlowed: tarpitCount, escalations: escalationCount,
    learnedPatterns: learnedPatterns.filter(p => p.confidence >= 0.5).length,
    baselineSize: Array.from(baseline.values()).reduce((a, b) => a + b.samples, 0),
    networkClusters,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE HELPERS — export state for cold-start recovery
// ═══════════════════════════════════════════════════════════════════════════

/** Returns all currently blocked IPs with their expiry and strike count */
export function getBlockedIPs(): Array<{ ip: string; until: number; strikes: number }> {
  const result: Array<{ ip: string; until: number; strikes: number }> = []
  const now = Date.now()
  for (const [ip, profile] of attackers) {
    if (profile.blockUntil > now) {
      result.push({ ip, until: profile.blockUntil, strikes: profile.strikeCount })
    }
  }
  return result
}

/** Returns learned patterns with sufficient confidence for persistence */
export function getLearnedPatternsExport(): Array<{ pattern: string; type: string; confidence: number; matchCount: number }> {
  return learnedPatterns
    .filter(p => p.confidence >= 0.5)
    .map(p => ({ pattern: p.pattern, type: p.type, confidence: p.confidence, matchCount: p.matchCount }))
}

/** Restore a blocked IP from persisted state (skips expired entries) */
export function restoreBlockedIP(ip: string, until: number, strikes: number): void {
  const now = Date.now()
  if (until <= now) return // expired, don't restore
  const profile = getProfile(ip, `restored_${ip}`)
  profile.blockUntil = until
  profile.strikeCount = strikes
}

/** Restore a learned pattern from persisted state (deduplicates) */
export function restoreLearnedPattern(pattern: string, type: string, confidence: number, matchCount: number): void {
  const exists = learnedPatterns.some(p => p.pattern === pattern)
  if (exists) return
  learnedPatterns.push({
    pattern, type, confidence, matchCount,
    createdAt: Date.now(),
    source: 'restored',
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// L8: DECEPTION RESPONSES
// ═══════════════════════════════════════════════════════════════════════════

export function getDeceptionResponse(path: string): { status: number; body: string; headers: Record<string, string> } {
  const p = path.toLowerCase()

  // Fake admin panel — formulario que nunca funciona pero captura intentos
  if (p.includes('admin') || p.includes('login') || p.includes('wp-')) {
    return {
      status: 200,
      body: '<!DOCTYPE html><html><head><title>Control Panel - Login</title><meta name="robots" content="noindex"></head><body style="font-family:Arial;max-width:400px;margin:100px auto;padding:20px;background:#f5f5f5"><h2>Admin Login</h2><form method="POST" action="/dev/null"><label>Username</label><br><input name="user" style="width:100%;padding:8px;margin:5px 0 15px"><br><label>Password</label><br><input name="pass" type="password" style="width:100%;padding:8px;margin:5px 0 15px"><br><button style="width:100%;padding:10px;background:#333;color:white;border:none;cursor:pointer">Sign In</button></form><p style="font-size:12px;color:#999">v2.4.1 - Licensed</p></body></html>',
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Server': 'Apache/2.4.52 (Ubuntu)' },
    }
  }

  // Fake .env con credenciales trampa
  if (p.includes('.env') || p.includes('config') || p.includes('credentials') || p.includes('secrets')) {
    return {
      status: 200,
      body: [
        'APP_NAME=InternalPortal', 'APP_ENV=staging', 'APP_DEBUG=false', '',
        'DB_CONNECTION=mysql', 'DB_HOST=db-replica-07.internal.local',
        'DB_PORT=3306', 'DB_DATABASE=portal_staging_v2',
        'DB_USERNAME=app_readonly', 'DB_PASSWORD=tr4p_c0d3_xK9mP2vL8n',
        '', 'REDIS_HOST=cache-02.internal.local', 'REDIS_PASSWORD=h0n3yp0t_r3d1s_Qw4z',
        '', 'AWS_ACCESS_KEY_ID=AKIA_HONEYPOT_TRACKING', 'AWS_SECRET_ACCESS_KEY=fake_secret_you_are_being_monitored_kR8mN3pQ',
        'AWS_BUCKET=internal-staging-assets', '',
        'MAIL_HOST=smtp.internal.local', 'MAIL_USERNAME=noreply@internal.local',
        'MAIL_PASSWORD=m41l_tr4p_Xk2nM9', '',
        'STRIPE_KEY=sk_test_honeypot_4242424242424242', '',
        '# WARNING: All access is logged and monitored',
      ].join('\n'),
      headers: { 'Content-Type': 'text/plain', 'Server': 'nginx/1.24.0' },
    }
  }

  // Fake .git
  if (p.includes('.git')) {
    return {
      status: 200,
      body: '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n[remote "origin"]\n\turl = git@github.internal:team/portal.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n\tremote = origin\n\tmerge = refs/heads/main\n',
      headers: { 'Content-Type': 'text/plain', 'Server': 'nginx/1.24.0' },
    }
  }

  // Fake server-status
  if (p.includes('server-status') || p.includes('server-info') || p.includes('actuator')) {
    return {
      status: 200,
      body: JSON.stringify({
        status: 'UP', uptime: '342d 7h 23m', version: '2.4.1',
        components: { db: { status: 'UP' }, redis: { status: 'UP' }, mail: { status: 'UP' } },
        requests: { total: 1284723, active: 42, avgResponseTime: '23ms' },
        memory: { total: '8GB', used: '3.2GB', free: '4.8GB' },
      }, null, 2),
      headers: { 'Content-Type': 'application/json', 'Server': 'Apache/2.4.52' },
    }
  }

  // Fake database dump
  if (p.includes('.sql') || p.includes('backup') || p.includes('dump') || p.includes('database')) {
    return {
      status: 200,
      body: '-- MySQL dump 8.0.32\n-- Host: db-replica-07.internal.local\n-- Database: portal_staging_v2\n\nCREATE TABLE `users` (\n  `id` int NOT NULL AUTO_INCREMENT,\n  `email` varchar(255) DEFAULT NULL,\n  `name` varchar(100) DEFAULT NULL,\n  PRIMARY KEY (`id`)\n);\n\nINSERT INTO `users` VALUES\n(1,"admin@internal.local","System Admin"),\n(2,"honeypot@trap.local","Your access has been logged");\n\n-- Access from your IP has been recorded\n',
      headers: { 'Content-Type': 'application/sql', 'Content-Disposition': 'attachment; filename="backup.sql"' },
    }
  }

  // Fake swagger/API docs
  if (p.includes('swagger') || p.includes('api-docs') || p.includes('openapi') || p.includes('graphql')) {
    return {
      status: 200,
      body: JSON.stringify({
        openapi: '3.0.0', info: { title: 'Internal API', version: '2.4.1' },
        paths: {
          '/api/internal/users': { get: { summary: 'List users', security: [{ bearerAuth: [] }] } },
          '/api/internal/config': { get: { summary: 'Get config', security: [{ bearerAuth: [] }] } },
        },
        servers: [{ url: 'https://api-internal.honeypot.local' }],
      }, null, 2),
      headers: { 'Content-Type': 'application/json' },
    }
  }

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

  // Limpiar perfiles inactivos
  for (const [ip, profile] of attackers) {
    if (profile.blockUntil > now) continue // mantener bloqueados
    if (profile.totalThreats > 0 && now - profile.lastSeen < 7 * 86400_000) continue // amenazas recientes
    if (now - profile.lastSeen > 24 * 3600_000 && profile.totalThreats === 0) {
      attackers.delete(ip)
    }
    if (now - profile.lastSeen > 30 * 86400_000) {
      attackers.delete(ip)
    }
  }

  // Limpiar fingerprint map
  for (const [fp, ips] of fingerprintMap) {
    for (const ip of ips) { if (!attackers.has(ip)) ips.delete(ip) }
    if (ips.size === 0) fingerprintMap.delete(fp)
  }

  // Limpiar burst timestamps
  const burstCutoff = now - BURST_WINDOW * 3
  for (const [ip, ts] of requestTimestamps) {
    if (ts.length === 0 || ts[ts.length - 1] < burstCutoff) requestTimestamps.delete(ip)
  }

  // Limpiar 404 tracker
  for (const [ip, entry] of notFoundTracker) {
    if (now - entry.since > 10 * 60_000) notFoundTracker.delete(ip)
  }

  // Decay learned patterns — bajar confianza de patrones que no matchean
  for (let i = learnedPatterns.length - 1; i >= 0; i--) {
    const p = learnedPatterns[i]
    if (now - p.createdAt > 7 * 86400_000 && p.matchCount < 3) {
      learnedPatterns.splice(i, 1) // nunca fue útil, eliminar
    } else if (now - p.createdAt > 24 * 3600_000) {
      p.confidence = Math.max(p.confidence - 0.01, 0.1) // decay gradual
    }
  }

  // Limpiar hourly data vieja
  const currentHour = new Date().getHours()
  for (const [hour, data] of hourlyRequestCount) {
    if (hour !== currentHour) hourlyRequestCount.delete(hour)
  }

  // Limpiar threat log viejo
  const logCutoff = now - 20 * 60_000
  while (threatLog.length > 0 && threatLog[0].ts < logCutoff) threatLog.shift()
}

if (typeof setInterval !== 'undefined') {
  const t = setInterval(cleanup, CLEANUP_INTERVAL)
  if (t && typeof t === 'object' && 'unref' in t) t.unref()
}
