/**
 * RESERVO.AI — Business Knowledge Layer
 *
 * Gestiona la base de conocimiento estructurada de cada negocio.
 * El agente la usa para responder preguntas sin inventar.
 * Nunca genera datos de conocimiento por sí solo — solo lee lo que el negocio configuró.
 */

import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── TIPOS ────────────────────────────────────────────────────────────────────

export interface BusinessKnowledge {
  business_name?:  string
  business_type?:  string
  services?:       string[]
  menu?:           Record<string, string[]>   // { "carnes": ["chuletón", ...], ... }
  hours?:          Record<string, string>     // { "lunch": "13:00-16:00", ... }
  zones?:          string[]                  // ["terraza", "interior", "privado"]
  faqs?:           Array<{ q: string; a: string }>
  policies?:       Record<string, string>    // { "grupos": "max 6 sin revisión", ... }
  special_notes?:  string                   // notas libres del negocio
}

export interface KnowledgeQueryResult {
  found:   boolean
  answer:  string | null
  source:  string   // dónde se encontró: "menu.carnes", "faqs", "policies.grupos"…
  raw?:    any
}

// ── CONOCIMIENTO POR DEFECTO (para demostración/onboarding) ─────────────────

export const DEFAULT_KNOWLEDGE: BusinessKnowledge = {
  business_name: '',
  business_type: 'restaurante',
  services: ['reservas', 'atención de consultas'],
  menu: {},
  hours: {},
  zones: [],
  faqs: [],
  policies: {},
  special_notes: '',
}

// ── CARGA ────────────────────────────────────────────────────────────────────

export async function getBusinessKnowledge(tenantId: string): Promise<BusinessKnowledge> {
  try {
    const { data } = await admin
      .from('business_knowledge')
      .select('knowledge')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!data?.knowledge) return DEFAULT_KNOWLEDGE
    return { ...DEFAULT_KNOWLEDGE, ...data.knowledge }
  } catch {
    return DEFAULT_KNOWLEDGE
  }
}

// ── GUARDADO ─────────────────────────────────────────────────────────────────

export async function saveBusinessKnowledge(
  tenantId: string,
  knowledge: BusinessKnowledge
): Promise<void> {
  const { data: existing } = await admin
    .from('business_knowledge')
    .select('id')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (existing) {
    await admin.from('business_knowledge')
      .update({ knowledge, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
  } else {
    await admin.from('business_knowledge')
      .insert({ tenant_id: tenantId, knowledge })
  }
}

// ── CONSULTA DE CONOCIMIENTO ─────────────────────────────────────────────────
// El motor de decisión la usa para responder preguntas del cliente con base real.
// Nunca inventa — si no encuentra respuesta, dice found: false.

export function queryKnowledge(k: BusinessKnowledge, question: string): KnowledgeQueryResult {
  const q = String(question||'').toLowerCase()

  // 1. FAQs explícitas — máxima prioridad
  if (k.faqs && k.faqs.length > 0) {
    for (const faq of k.faqs) {
      if (!faq?.q) continue
      const words = String(faq.q).toLowerCase().split(/\s+/).filter(w => w.length > 3)
      const matchCount = words.filter(w => q.includes(w)).length
      if (matchCount >= Math.max(1, Math.floor(words.length * 0.5))) {
        return { found: true, answer: String(faq.a||''), source: 'faqs', raw: faq }
      }
    }
  }

  // 2. Menú — buscar producto por nombre
  if (k.menu && Object.keys(k.menu).length > 0) {
    for (const [category, items] of Object.entries(k.menu)) {
      if (!Array.isArray(items)) continue
      const allItems = items.filter(i => typeof i === 'string') as string[]
      const catLower = String(category).toLowerCase()
      for (const item of allItems) {
        const itemLower = String(item).toLowerCase()
        if (q.includes(itemLower)) {
          const list = allItems.join(', ')
          return {
            found: true,
            answer: `Sí, tenemos ${item} en la sección de ${category}. También tenemos: ${list}.`,
            source: `menu.${category}`,
            raw: { category, items: allItems }
          }
        }
      }
      // Buscar por categoría
      if (q.includes(catLower) || (category === 'carnes' && /carne|carnes/i.test(q))) {
        const list = allItems.join(', ')
        return {
          found: true,
          answer: `En ${category} tenemos: ${list}.`,
          source: `menu.${category}`,
          raw: { category, items: allItems }
        }
      }
    }
  }

  // 3. Servicios
  if (k.services && k.services.length > 0) {
    const serviceWords = ['servicio', 'ofrecéis', 'hacéis', 'podéis', 'disponible', 'recoger', 'domicilio', 'pedido', 'reserva']
    if (serviceWords.some(w => q.includes(w))) {
      return {
        found: true,
        answer: `Nuestros servicios incluyen: ${k.services.join(', ')}.`,
        source: 'services',
        raw: k.services
      }
    }
  }

  // 4. Horarios
  if (k.hours && Object.keys(k.hours).length > 0) {
    if (/hora|horario|abierto|cerrado|cuando|a qué hora/i.test(q)) {
      const hourStr = Object.entries(k.hours)
        .map(([t, h]) => `${t}: ${h}`)
        .join(', ')
      return {
        found: true,
        answer: `Nuestros horarios son — ${hourStr}.`,
        source: 'hours',
        raw: k.hours
      }
    }
  }

  // 5. Políticas
  if (k.policies && Object.keys(k.policies).length > 0) {
    for (const [policy, description] of Object.entries(k.policies)) {
      if (q.includes(String(policy).toLowerCase())) {
        return { found: true, answer: String(description||''), source: `policies.${policy}`, raw: description }
      }
    }
  }

  return { found: false, answer: null, source: 'none' }
}

// ── CONTEXTO PARA EL AGENTE DE VOZ ───────────────────────────────────────────
// Genera texto natural que el agente puede usar para responder preguntas.
// Formato conversacional, no robótico.

export function buildAgentKnowledge(k: BusinessKnowledge): string {
  const parts: string[] = []
  try {
    // Menú / servicios
    if (k.menu && Object.keys(k.menu).length > 0) {
      const menuLines = Object.entries(k.menu)
        .map(([cat, items]) => {
          const arr = Array.isArray(items) ? items.filter(i=>typeof i==='string') : []
          return arr.length > 0 ? `${cat}: ${arr.join(', ')}` : null
        }).filter(Boolean)
      if (menuLines.length > 0) parts.push(`CARTA:\n${menuLines.join('\n')}`)
    }
    if (k.services?.length) {
      parts.push(`SERVICIOS: ${k.services.filter(s=>typeof s==='string').join(', ')}`)
    }

    // Horarios
    if (k.hours && Object.keys(k.hours).length > 0) {
      const hourLines = Object.entries(k.hours).map(([t,h]) => `${t}: ${h}`).join(', ')
      parts.push(`HORARIOS: ${hourLines}`)
    }

    // FAQs — formato directo pregunta/respuesta
    if (k.faqs?.length) {
      const faqLines = k.faqs
        .filter(f => f?.q && f?.a)
        .map(f => `- "${f.q}" → ${f.a}`)
        .join('\n')
      if (faqLines) parts.push(`PREGUNTAS FRECUENTES:\n${faqLines}`)
    }

    // Políticas
    if (k.policies && Object.keys(k.policies).length > 0) {
      const policyLines = Object.entries(k.policies)
        .map(([k2,v]) => `- ${k2}: ${v}`).join('\n')
      parts.push(`NORMAS Y POLÍTICA:\n${policyLines}`)
    }

    // Zonas
    if (k.zones?.length) {
      parts.push(`ZONAS DISPONIBLES: ${k.zones.filter(z=>typeof z==='string').join(', ')}`)
    }

    // Notas especiales
    if (k.special_notes) parts.push(`NOTAS: ${k.special_notes}`)

  } catch(e) { /* best effort */ }
  return parts.join('\n\n')
}

// ── CONSTRUIR CONTEXTO PARA CLAUDE (análisis post-call) ──────────────────────
export function buildKnowledgeContext(k: BusinessKnowledge): string {
  const parts: string[] = []
  try {
    if (k.business_name) parts.push(`Negocio: ${k.business_name}`)
    if (k.services?.length) parts.push(`Servicios: ${k.services.filter(s=>typeof s==='string').join(', ')}`)
    if (k.hours && Object.keys(k.hours).length > 0)
      parts.push(`Horarios: ${Object.entries(k.hours).map(([t,h]) => `${t} ${h}`).join(', ')}`)
    if (k.menu && Object.keys(k.menu).length > 0) {
      const menuStr = Object.entries(k.menu)
        .map(([cat, items]) => {
          const arr = Array.isArray(items) ? items.filter(i=>typeof i==='string') : []
          return `${cat}: ${arr.join(', ')}`
        }).join(' | ')
      parts.push(`Menú — ${menuStr}`)
    }
    if (k.faqs?.length) {
      const faqStr = k.faqs.slice(0, 5).filter(f => f?.q && f?.a)
        .map(f => `P: ${f.q} R: ${f.a}`).join(' | ')
      if (faqStr) parts.push(`FAQs — ${faqStr}`)
    }
    if (k.policies && Object.keys(k.policies).length > 0)
      parts.push(`Políticas — ${Object.entries(k.policies).map(([k2,v]) => `${k2}: ${v}`).join(' | ')}`)
    if (k.special_notes) parts.push(`Notas: ${k.special_notes}`)
  } catch(e) { /* best effort */ }
  return parts.join('\n')
}
