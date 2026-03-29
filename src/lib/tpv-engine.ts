// TPV Intelligence Engine — auto-categorization, smart layouts, sales learning
// Pure logic, no DB calls, no React

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  active: boolean
  image_url?: string
}

export interface SaleRecord {
  item_name: string
  quantity: number
  hour: number
  day_of_week: number
}

export interface TPVLayout {
  categories: {
    name: string
    priority: number
    items: { id: string; name: string; price: number; image_url?: string }[]
  }[]
  quickAccess: { id: string; name: string; price: number; image_url?: string }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// ─── Category detection rules ────────────────────────────────────────────────

const CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  {
    category: 'Cafes',
    keywords: [
      'cafe', 'cortado', 'americano', 'cappuccino', 'latte',
      'infusion', 'te', 'descafeinado', 'colacao',
    ],
  },
  {
    category: 'Desayunos',
    keywords: [
      'tostada', 'croissant', 'bolleria', 'magdalena',
      'churro', 'porras', 'mollete',
    ],
  },
  {
    category: 'Bebidas',
    keywords: [
      'coca cola', 'fanta', 'aquarius', 'nestea', 'agua',
      'zumo', 'refresco', 'sprite', 'seven up', 'kas',
    ],
  },
  {
    category: 'Cervezas',
    keywords: [
      'cerveza', 'cana', 'tercio', 'doble', 'jarra',
      'birra', 'ipa', 'lager',
    ],
  },
  {
    category: 'Vinos',
    keywords: [
      'vino', 'tinto', 'blanco', 'rosado', 'ribera',
      'rioja', 'verdejo', 'cava', 'champagne',
    ],
  },
  {
    category: 'Cocteles',
    keywords: [
      'gin tonic', 'mojito', 'copa', 'whisky', 'ron',
      'vodka', 'combinado', 'cubata', 'daiquiri',
    ],
  },
  {
    category: 'Entrantes',
    keywords: ['ensalada', 'gazpacho', 'croqueta', 'sopa', 'crema'],
  },
  {
    category: 'Raciones',
    keywords: ['racion', 'tapa', 'pincho', 'montadito', 'brocheta'],
  },
  {
    category: 'Platos',
    keywords: [
      'hamburguesa', 'filete', 'pollo', 'cerdo', 'ternera',
      'solomillo', 'chuleta', 'pescado', 'lubina', 'dorada',
      'paella', 'arroz',
    ],
  },
  {
    category: 'Bocadillos',
    keywords: ['bocadillo', 'sandwich', 'wrap', 'pita', 'kebab'],
  },
  {
    category: 'Postres',
    keywords: [
      'tarta', 'helado', 'flan', 'natilla', 'brownie',
      'tiramisu', 'fruta',
    ],
  },
]

// ─── Business categories ─────────────────────────────────────────────────────

const BUSINESS_CATEGORIES: Record<string, string[]> = {
  restaurante: [
    'Entrantes', 'Raciones', 'Carnes', 'Pescados', 'Arroces',
    'Postres', 'Cafes', 'Bebidas', 'Cervezas', 'Vinos', 'Cocteles',
  ],
  bar: [
    'Tapas', 'Raciones', 'Bocadillos', 'Cervezas', 'Vinos',
    'Refrescos', 'Cocteles', 'Cafes', 'Otro',
  ],
  cafeteria: [
    'Cafes', 'Desayunos', 'Bolleria', 'Bocadillos',
    'Bebidas', 'Zumos', 'Postres', 'Otro',
  ],
}

// ─── Time-based priority buckets ─────────────────────────────────────────────

interface TimeSlot {
  start: number
  end: number
  priorities: string[]
}

const TIME_SLOTS: TimeSlot[] = [
  { start: 7,  end: 11, priorities: ['Cafes', 'Desayunos', 'Bolleria'] },
  { start: 11, end: 13, priorities: ['Cafes', 'Bebidas', 'Bocadillos'] },
  { start: 13, end: 16, priorities: ['Raciones', 'Platos', 'Cervezas', 'Vinos', 'Bebidas'] },
  { start: 16, end: 18, priorities: ['Cafes', 'Bebidas', 'Meriendas'] },
  { start: 18, end: 20, priorities: ['Cervezas', 'Tapas', 'Raciones', 'Bebidas'] },
  { start: 20, end: 24, priorities: ['Raciones', 'Platos', 'Cervezas', 'Vinos', 'Cocteles'] },
  { start: 0,  end: 7,  priorities: ['Cocteles', 'Cervezas', 'Bebidas'] },
]

function getTimeSlot(hour: number): TimeSlot {
  const h = ((hour % 24) + 24) % 24
  for (const slot of TIME_SLOTS) {
    if (slot.start <= slot.end) {
      if (h >= slot.start && h < slot.end) return slot
    } else {
      if (h >= slot.start || h < slot.end) return slot
    }
  }
  // Fallback (should not happen)
  return TIME_SLOTS[TIME_SLOTS.length - 1]
}

// ─── Exported functions ──────────────────────────────────────────────────────

/**
 * Guesses the category of a product from its name.
 * Spanish-language focused with accent normalization.
 */
export function autoDetectCategory(name: string, businessType: string): string {
  const norm = normalize(name)

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (norm.includes(kw)) {
        return rule.category
      }
    }
  }

  // Default: first category from the business type
  const cats = getBusinessCategories(businessType)
  return cats[0] ?? 'Otro'
}

/**
 * Returns default categories for a business type.
 */
export function getBusinessCategories(businessType: string): string[] {
  const key = normalize(businessType)
  return BUSINESS_CATEGORIES[key] ?? BUSINESS_CATEGORIES['restaurante']!
}

/**
 * Generates an intelligent TPV layout based on time of day,
 * available items, and optional sales history.
 */
export function getTPVLayout(
  items: MenuItem[],
  hour: number,
  salesHistory?: SaleRecord[],
): TPVLayout {
  const activeItems = items.filter((i) => i.active)
  const slot = getTimeSlot(hour)

  // Group items by category
  const grouped = new Map<string, MenuItem[]>()
  for (const item of activeItems) {
    const cat = item.category || 'Otro'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(item)
  }

  // Build sales boost map from history (category -> total qty at this hour)
  const salesBoost = new Map<string, number>()
  if (salesHistory && salesHistory.length > 0) {
    // Find each item's category by matching name
    const itemCategoryMap = new Map<string, string>()
    for (const item of activeItems) {
      itemCategoryMap.set(normalize(item.name), item.category)
    }

    for (const sale of salesHistory) {
      if (sale.hour !== hour) continue
      const cat = itemCategoryMap.get(normalize(sale.item_name))
      if (cat) {
        salesBoost.set(cat, (salesBoost.get(cat) ?? 0) + sale.quantity)
      }
    }
  }

  // Calculate priority for each category
  const categoryEntries: TPVLayout['categories'] = []

  for (const [catName, catItems] of grouped) {
    const timeIndex = slot.priorities.indexOf(catName)
    // Time-based priority: higher for categories that appear earlier in the slot
    const timePriority = timeIndex >= 0 ? (slot.priorities.length - timeIndex) * 10 : 0
    // Sales boost: add proportional bonus
    const maxBoost = salesHistory?.length ? 20 : 0
    const boost = salesBoost.get(catName) ?? 0
    const totalSales = Array.from(salesBoost.values()).reduce((a, b) => a + b, 0) || 1
    const salesPriority = maxBoost * (boost / totalSales)

    const priority = timePriority + salesPriority

    categoryEntries.push({
      name: catName,
      priority,
      items: catItems.map((i) => ({ id: i.id, name: i.name, price: i.price, image_url: i.image_url })),
    })
  }

  // Sort by priority descending
  categoryEntries.sort((a, b) => b.priority - a.priority)

  // Quick access: top 8 items for this hour based on sales, or fallback to priority categories
  let quickAccess: TPVLayout['quickAccess'] = []

  if (salesHistory && salesHistory.length > 0) {
    // Aggregate sales at this hour by item name
    const hourSales = new Map<string, number>()
    for (const sale of salesHistory) {
      if (sale.hour !== hour) continue
      const key = normalize(sale.item_name)
      hourSales.set(key, (hourSales.get(key) ?? 0) + sale.quantity)
    }

    // Sort by quantity descending, map to items
    const sorted = Array.from(hourSales.entries()).sort((a, b) => b[1] - a[1])
    const itemMap = new Map<string, MenuItem>()
    for (const item of activeItems) {
      itemMap.set(normalize(item.name), item)
    }

    for (const [normName] of sorted) {
      if (quickAccess.length >= 8) break
      const item = itemMap.get(normName)
      if (item) {
        quickAccess.push({ id: item.id, name: item.name, price: item.price, image_url: item.image_url })
      }
    }
  }

  // If not enough from history, fill from top priority categories
  if (quickAccess.length < 8) {
    for (const cat of categoryEntries) {
      for (const item of cat.items) {
        if (quickAccess.length >= 8) break
        if (!quickAccess.some((q) => q.id === item.id)) {
          quickAccess.push(item)
        }
      }
      if (quickAccess.length >= 8) break
    }
  }

  return { categories: categoryEntries, quickAccess }
}

/**
 * Parses a pasted menu text into structured items.
 * Handles common Spanish menu formats.
 */
export function parseBulkMenu(
  text: string,
  businessType: string,
): { name: string; price: number; category: string }[] {
  const results: { name: string; price: number; category: string }[] = []
  const lines = text.split('\n')

  // Pattern matches:
  //   "Cafe con leche - 1.80"
  //   "Cafe con leche 1.80€"
  //   "Cafe con leche 1,80"
  //   "Cafe con leche... 1.80"
  //   "Cafe con leche  1.80 €"
  const linePattern = /^(.+?)[\s.\-–—]+(\d+[.,]\d{1,2})\s*€?\s*$/

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const match = line.match(linePattern)
    if (!match) continue

    const name = match[1]!.trim()
    const priceStr = match[2]!.replace(',', '.')
    const price = parseFloat(priceStr)

    if (!name || isNaN(price)) continue

    const category = autoDetectCategory(name, businessType)
    results.push({ name, price, category })
  }

  return results
}
