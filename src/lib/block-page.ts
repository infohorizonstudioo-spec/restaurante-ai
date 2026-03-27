/**
 * RESERVO.AI — Página de bloqueo para atacantes
 * Se muestra cuando el Security Guardian detecta y bloquea un ciberataque.
 * Diseñada para intimidar y disuadir — que se les quiten las ganas.
 */

import type { ThreatAssessment } from './security-guardian'

export function getBlockPage(assessment: ThreatAssessment): string {
  const { ip, threats, score, fingerprint, attackPhase } = assessment

  // Código de incidente único para que parezca que hay un sistema forense detrás
  const incidentId = `INC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  // Timestamp forense
  const timestamp = new Date().toISOString()

  // Mapear amenazas a nombres técnicos intimidantes
  const threatNames: Record<string, string> = {
    'sqli': 'SQL Injection Attack',
    'xss': 'Cross-Site Scripting (XSS)',
    'path-traversal': 'Directory Traversal Attack',
    'cmdi': 'Remote Command Injection',
    'prompt-injection': 'AI Prompt Injection',
    'honeypot-triggered': 'Honeypot Intrusion Detected',
    'burst': 'DDoS / Flood Attack',
    'bot-behavior': 'Automated Attack Tool',
    'reconnaissance': 'Network Reconnaissance',
    'attack-tool-ua': 'Known Attack Framework',
    'header-injection': 'HTTP Header Injection',
    'host-spoofing': 'Host Header Spoofing',
    'multi-vector': 'Multi-Vector Attack',
    'high-entropy-payload': 'Obfuscated Malicious Payload',
    'multi-layer-encoding': 'Encoded Attack Payload',
    'method-probing': 'HTTP Method Enumeration',
    'recidivist': 'Repeat Offender',
    'blocked': 'Previously Blocked Attacker',
    'malicious-referer': 'Malicious Referrer Injection',
    'oversized-body': 'Payload Size Attack',
    'xff-spoofing': 'IP Spoofing Attempt',
  }

  const detectedThreats = threats
    .map(t => threatNames[t] || t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .filter((v, i, a) => a.indexOf(v) === i) // dedupe

  const phaseNames: Record<string, string> = {
    'reconnaissance': 'RECONNAISSANCE',
    'weaponization': 'WEAPONIZATION',
    'exploitation': 'ACTIVE EXPLOITATION',
    'persistence': 'PERSISTENCE ATTEMPT',
    'exfiltration': 'DATA EXFILTRATION',
  }

  const phaseName = phaseNames[attackPhase] || ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>ACCESS DENIED — Threat Neutralized</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@keyframes scanline{0%{top:-100%}100%{top:100%}}
@keyframes glitch{0%,100%{transform:translate(0)}20%{transform:translate(-2px,2px)}40%{transform:translate(2px,-1px)}60%{transform:translate(-1px,-2px)}80%{transform:translate(1px,1px)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
@keyframes typewriter{from{width:0}to{width:100%}}
@keyframes blink{0%,100%{border-color:#ff0040}50%{border-color:transparent}}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
body{
  background:#0a0a0a;color:#ff0040;font-family:'Courier New',monospace;
  min-height:100vh;display:flex;align-items:center;justify-content:center;
  overflow:hidden;position:relative;
}
body::before{
  content:'';position:fixed;top:0;left:0;width:100%;height:100%;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,0,64,0.03) 2px,rgba(255,0,64,0.03) 4px);
  pointer-events:none;z-index:10;
}
body::after{
  content:'';position:fixed;top:-100%;left:0;width:100%;height:100%;
  background:linear-gradient(transparent 50%,rgba(255,0,64,0.05) 50%);
  background-size:100% 4px;animation:scanline 8s linear infinite;
  pointer-events:none;z-index:10;
}
.container{
  max-width:700px;width:90%;padding:40px;position:relative;z-index:5;
}
.shield{
  width:80px;height:80px;margin:0 auto 30px;position:relative;
  animation:pulse 2s ease-in-out infinite;
}
.shield svg{width:100%;height:100%;filter:drop-shadow(0 0 20px rgba(255,0,64,0.6))}
.header{
  text-align:center;margin-bottom:30px;
}
h1{
  font-size:28px;font-weight:900;letter-spacing:4px;
  text-shadow:0 0 30px rgba(255,0,64,0.5),0 0 60px rgba(255,0,64,0.3);
  animation:glitch .3s ease-in-out infinite alternate;
  margin-bottom:8px;
}
.subtitle{
  font-size:13px;color:#ff4070;letter-spacing:6px;text-transform:uppercase;
}
.terminal{
  background:rgba(255,0,64,0.05);border:1px solid rgba(255,0,64,0.3);
  border-radius:4px;padding:20px;margin:20px 0;font-size:12px;
  line-height:1.8;position:relative;overflow:hidden;
  animation:fadeIn .5s ease-out;
}
.terminal::before{
  content:'SECURITY SYSTEM — CLASSIFIED';
  position:absolute;top:0;left:0;right:0;padding:4px 10px;
  background:rgba(255,0,64,0.15);font-size:10px;letter-spacing:3px;
  border-bottom:1px solid rgba(255,0,64,0.2);
}
.terminal-content{padding-top:25px}
.line{opacity:0;animation:fadeIn .3s ease-out forwards}
.line:nth-child(1){animation-delay:.1s}
.line:nth-child(2){animation-delay:.3s}
.line:nth-child(3){animation-delay:.5s}
.line:nth-child(4){animation-delay:.7s}
.line:nth-child(5){animation-delay:.9s}
.line:nth-child(6){animation-delay:1.1s}
.line:nth-child(7){animation-delay:1.3s}
.line:nth-child(8){animation-delay:1.5s}
.line:nth-child(9){animation-delay:1.7s}
.line:nth-child(10){animation-delay:1.9s}
.line:nth-child(11){animation-delay:2.1s}
.label{color:#ff4070}
.value{color:#ff8090}
.ok{color:#00ff88}
.warn{color:#ffaa00}
.crit{color:#ff0040;font-weight:bold}
.threats{
  background:rgba(255,0,64,0.08);border:1px solid rgba(255,0,64,0.2);
  border-radius:4px;padding:15px;margin:20px 0;
}
.threat-item{
  padding:4px 0;font-size:12px;display:flex;align-items:center;gap:8px;
  opacity:0;animation:fadeIn .3s ease-out forwards;
}
.threat-item::before{content:'[!]';color:#ff0040;font-weight:bold}
.message-box{
  text-align:center;margin:30px 0 20px;padding:25px;
  border:2px solid rgba(255,0,64,0.4);border-radius:4px;
  animation:blink 1.5s ease-in-out infinite;
}
.message{
  font-size:16px;font-weight:bold;color:#ff3060;
  text-shadow:0 0 10px rgba(255,0,64,0.5);
  letter-spacing:2px;line-height:1.6;
}
.footer{
  text-align:center;font-size:10px;color:#552233;
  margin-top:20px;letter-spacing:2px;
}
.cursor{
  display:inline-block;width:8px;height:14px;background:#ff0040;
  animation:pulse 1s step-end infinite;vertical-align:middle;
  margin-left:4px;
}
</style>
</head>
<body>
<div class="container">

<div class="shield">
<svg viewBox="0 0 24 24" fill="none" stroke="#ff0040" stroke-width="1.5">
<path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z"/>
<path d="M12 8v4M12 16h.01" stroke-width="2" stroke-linecap="round"/>
</svg>
</div>

<div class="header">
<h1>ACCESS DENIED</h1>
<div class="subtitle">threat neutralized</div>
</div>

<div class="terminal">
<div class="terminal-content">
<div class="line"><span class="label">$ </span>guardian --analyze --target <span class="value">${ip}</span></div>
<div class="line"><span class="label">INCIDENT    </span><span class="value">${incidentId}</span></div>
<div class="line"><span class="label">TIMESTAMP   </span><span class="value">${timestamp}</span></div>
<div class="line"><span class="label">SOURCE IP   </span><span class="crit">${ip}</span></div>
<div class="line"><span class="label">FINGERPRINT </span><span class="value">${fingerprint}</span></div>
<div class="line"><span class="label">THREAT LVL  </span><span class="crit">${score}/100 — ${assessment.riskLevel.toUpperCase()}</span></div>
${phaseName ? `<div class="line"><span class="label">ATK PHASE   </span><span class="crit">${phaseName}</span></div>` : ''}
<div class="line"><span class="label">STATUS      </span><span class="crit">BLOCKED + LOGGED + REPORTED</span></div>
<div class="line"><span class="label">ACTION      </span><span class="warn">IP banned. Fingerprint tracked. All associated IPs flagged.</span></div>
<div class="line">&nbsp;</div>
<div class="line"><span class="ok">&#x2588;&#x2588; Attack neutralized. Evidence preserved.</span><span class="cursor"></span></div>
</div>
</div>

${detectedThreats.length > 0 ? `
<div class="threats">
${detectedThreats.map((t, i) => `<div class="threat-item" style="animation-delay:${2.3 + i * 0.15}s">${t}</div>`).join('\n')}
</div>
` : ''}

<div class="message-box">
<div class="message">
Para la pr&oacute;xima, chaval.<br>
Ahora no va a poder ser.<br>
<span style="font-size:12px;color:#ff4070;letter-spacing:3px;display:block;margin-top:10px">
Tu IP, tu fingerprint y toda tu actividad han sido registrados.<br>
Cada intento futuro desde cualquiera de tus dispositivos ser&aacute; bloqueado autom&aacute;ticamente.
</span>
</div>
</div>

<div class="footer">
SECURITY GUARDIAN v3 &bull; ADAPTIVE DEFENSE SYSTEM &bull; ALL ACCESS LOGGED
</div>

</div>
</body>
</html>`
}
