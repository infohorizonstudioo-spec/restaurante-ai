'use client'
import { UpgradeGate } from '@/components/UpgradeGate'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PageSkeleton } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'
import { getTPVLayout } from '@/lib/tpv-engine'
import type { MenuItem, TPVLayout, SaleRecord } from '@/lib/tpv-engine'

/* ── CSS injected once ──────────────────────────────────────────────── */
const TPV_STYLES = `
.tpv-product {
  transition: all 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.tpv-product:active {
  transform: scale(0.95) !important;
  opacity: 0.85;
}
.tpv-product:hover {
  transform: translateY(-2px);
  border-color: rgba(255,255,255,0.15) !important;
  box-shadow: 0 6px 20px rgba(0,0,0,0.3) !important;
}
.tpv-flash {
  animation: tpv-pulse 0.3s ease-out;
}
@keyframes tpv-pulse {
  0% { box-shadow: 0 0 0 0 rgba(240,168,78,0.5); }
  100% { box-shadow: 0 0 0 12px rgba(240,168,78,0); }
}
.tpv-cat-sidebar { display: flex; flex-direction: column; }
.tpv-center-area { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.tpv-ticket-panel { display: flex; flex-direction: column; }
@media (max-width: 768px) {
  .tpv-cat-sidebar {
    flex-direction: row !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    overflow-x: auto !important;
    border-right: none !important;
    border-bottom: 1px solid var(--rz-border) !important;
  }
  .tpv-cat-sidebar .tpv-cat-utils { display: none !important; }
  .tpv-mobile-utils { display: flex !important; }
  .tpv-3col { flex-wrap: wrap !important; }
  .tpv-center-area { width: 100% !important; flex: 1 1 100% !important; }
  .tpv-ticket-panel {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    border-left: none !important;
    border-top: 2px solid var(--rz-border) !important;
  }
  .tpv-mobile-ticket-toggle { display: flex !important; }
}
`

/* ── Types ──────────────────────────────────────────────────────────── */
interface TPVItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface ParkedOrder {
  id: string
  customer_name: string
  items: TPVItem[]
  total_estimate: number
  created_at: string
  notes: string
  order_type: string
}

interface DBTable {
  id: string
  number: string
  name?: string
  capacity: number
  zone_id?: string
  zone_name?: string
  x_pos: number
  y_pos: number
  w?: number
  h?: number
  shape_type?: string
  status: string
  rotation?: number
}

interface TodayReservation {
  table_id: string
  time: string
  customer_name: string
  party_size: number
}

/* ── Category icon map ───────────────────────────────────────────── */
const CAT_ICONS: Record<string, string> = {
  'caf\u00e9s': '\u2615', 'caf\u00e9': '\u2615', 'cafes': '\u2615', 'desayunos': '\uD83E\uDD50',
  'bebidas': '\uD83E\uDD64', 'refrescos': '\uD83E\uDD64',
  'cervezas': '\uD83C\uDF7A', 'vinos': '\uD83C\uDF77',
  'c\u00f3cteles': '\uD83C\uDF78', 'cocktails': '\uD83C\uDF78', 'cocteles': '\uD83C\uDF78', 'combinados': '\uD83C\uDF79',
  'entrantes': '\uD83E\uDD57', 'raciones': '\uD83C\uDF56', 'tapas': '\uD83C\uDF56', 'pinchos': '\uD83D\uDCCC',
  'platos': '\uD83C\uDF72', 'carnes': '\uD83E\uDD69', 'pescados': '\uD83D\uDC1F', 'arroces': '\uD83C\uDF72',
  'bocadillos': '\uD83E\uDD56', 'postres': '\uD83C\uDF70', 'boller\u00eda': '\uD83E\uDD50',
  'ensaladas': '\uD83E\uDD57', 'sandwich': '\uD83E\uDD56', 'zumos': '\uD83E\uDDC3',
}

function getCategoryIcon(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, icon] of Object.entries(CAT_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return '\uD83D\uDCE6'
}

/* ── Full Floor Plan ────────────────────────────────────────────── */
function FullFloorPlan({ tables, selectedTable, tableOrders, currentOrder, reservedTableIds, onSelect }: {
  tables: DBTable[]
  selectedTable: string | null
  tableOrders: Record<string, TPVItem[]>
  currentOrder: TPVItem[]
  reservedTableIds: Set<string>
  onSelect: (tableNumber: string | null) => void
}) {
  const statusColor: Record<string, string> = {
    libre: '#34D399', ocupada: '#F87171', reservada: '#F0A84E', bloqueada: '#49566A',
  }
  const statusFill: Record<string, string> = {
    libre: '#34D39933', ocupada: '#F8717133', reservada: '#F0A84E33', bloqueada: '#49566A33',
  }

  function getPersonIcons(count: number): string {
    if (count === 0) return ''
    if (count === 1) return '\uD83D\uDC64'
    if (count === 2) return '\uD83D\uDC64\uD83D\uDC64'
    if (count <= 3) return '\uD83D\uDC64\uD83D\uDC64\uD83D\uDC64'
    return '\uD83D\uDC64\uD83D\uDC64\uD83D\uDC64...'
  }

  if (!tables.length) {
    const cols = 5
    const spacing = 80
    const r = 28
    const pad = 40
    return (
      <svg
        viewBox={`0 0 ${cols * spacing + pad} ${Math.ceil(20 / cols) * spacing + pad + 50}`}
        style={{ width: '100%', height: '100%', minHeight: 300 }}
        preserveAspectRatio="xMidYMid meet"
      >
        {Array.from({ length: 20 }, (_, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          const cx = pad / 2 + col * spacing + spacing / 2
          const cy = pad / 2 + row * spacing + spacing / 2
          const num = String(i + 1)
          const isSelected = selectedTable === num
          const orderItems = num === selectedTable ? currentOrder : (tableOrders[num] || [])
          const itemCount = orderItems.reduce((s, it) => s + it.quantity, 0)
          return (
            <g key={num} onClick={() => onSelect(num)} style={{ cursor: 'pointer' }}>
              <circle
                cx={cx} cy={cy} r={r}
                fill={isSelected ? 'rgba(240,168,78,0.3)' : itemCount > 0 ? '#F8717133' : '#34D39933'}
                stroke={isSelected ? '#F0A84E' : itemCount > 0 ? '#F87171' : '#34D399'}
                strokeWidth={isSelected ? 3 : 1.5}
              />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                fill={isSelected ? '#F0A84E' : '#E8EEF6'} fontSize={14} fontWeight={700}>
                {num}
              </text>
              {itemCount > 0 && (
                <text x={cx} y={cy + 16} textAnchor="middle" fontSize={9}>
                  {getPersonIcons(itemCount)}
                </text>
              )}
            </g>
          )
        })}
        {/* Barra at bottom */}
        <g onClick={() => onSelect(null)} style={{ cursor: 'pointer' }}>
          <rect
            x={20} y={Math.ceil(20 / cols) * spacing + pad / 2 + 10}
            width={cols * spacing} height={36} rx={8}
            fill={selectedTable === null ? 'rgba(240,168,78,0.3)' : 'rgba(52,211,153,0.08)'}
            stroke={selectedTable === null ? '#F0A84E' : '#34D399'}
            strokeWidth={selectedTable === null ? 3 : 1.5}
          />
          <text
            x={20 + cols * spacing / 2}
            y={Math.ceil(20 / cols) * spacing + pad / 2 + 28}
            textAnchor="middle" dominantBaseline="middle"
            fill={selectedTable === null ? '#F0A84E' : '#E8EEF6'} fontSize={13} fontWeight={700}
          >
            BARRA
          </text>
        </g>
      </svg>
    )
  }

  const maxX = Math.max(...tables.map(t => (t.x_pos || 0) + (t.w || 80)))
  const maxY = Math.max(...tables.map(t => (t.y_pos || 0) + (t.h || 80)))
  const hasBarra = tables.some(t => t.name?.toLowerCase() === 'barra' || t.number.toLowerCase() === 'barra')

  return (
    <svg
      viewBox={`0 0 ${maxX} ${maxY + (hasBarra ? 0 : 50)}`}
      style={{ width: '100%', height: '100%', minHeight: 300 }}
      preserveAspectRatio="xMidYMid meet"
    >
      {tables.map(t => {
        const isSelected = selectedTable === t.number
        const orderItems = t.number === selectedTable ? currentOrder : (tableOrders[t.number] || [])
        const itemCount = orderItems.reduce((s, i) => s + i.quantity, 0)
        const status = t.status || 'libre'
        const sc = statusColor[status] || '#49566A'
        const sf = isSelected ? 'rgba(240,168,78,0.3)' : (statusFill[status] || '#49566A33')
        const isReserved = reservedTableIds.has(t.id)
        const w = t.w || 60
        const h = t.h || 60
        const cx = (t.x_pos || 0) + w / 2
        const cy = (t.y_pos || 0) + h / 2

        return (
          <g key={t.id} onClick={() => onSelect(t.number)} style={{ cursor: 'pointer' }}>
            {t.shape_type === 'round' ? (
              <ellipse
                cx={cx} cy={cy} rx={w / 2 - 2} ry={h / 2 - 2}
                fill={sf}
                stroke={isSelected ? '#F0A84E' : sc}
                strokeWidth={isSelected ? 3 : 1.5}
              />
            ) : (
              <rect
                x={t.x_pos || 0} y={t.y_pos || 0} width={w} height={h} rx={8}
                fill={sf}
                stroke={isSelected ? '#F0A84E' : sc}
                strokeWidth={isSelected ? 3 : 1.5}
              />
            )}
            <text
              x={cx} y={cy - (itemCount > 0 || isReserved ? 6 : 0)}
              textAnchor="middle" dominantBaseline="middle"
              fill={isSelected ? '#F0A84E' : '#E8EEF6'}
              fontSize={14} fontWeight={700}
            >
              {t.number}
            </text>
            {itemCount > 0 && (
              <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10}>
                {getPersonIcons(itemCount)}
              </text>
            )}
            {isReserved && itemCount === 0 && (
              <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle" fontSize={12}>
                {'\uD83D\uDCC5'}
              </text>
            )}
          </g>
        )
      })}
      {!hasBarra && (
        <g onClick={() => onSelect(null)} style={{ cursor: 'pointer' }}>
          <rect
            x={10} y={maxY + 5}
            width={maxX - 20} height={36} rx={8}
            fill={selectedTable === null ? 'rgba(240,168,78,0.3)' : 'rgba(52,211,153,0.08)'}
            stroke={selectedTable === null ? '#F0A84E' : '#34D399'}
            strokeWidth={selectedTable === null ? 3 : 1.5}
          />
          <text
            x={maxX / 2} y={maxY + 23}
            textAnchor="middle" dominantBaseline="middle"
            fill={selectedTable === null ? '#F0A84E' : '#E8EEF6'} fontSize={13} fontWeight={700}
          >
            BARRA
          </text>
        </g>
      )}
    </svg>
  )
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function TPVPage() {
  const { tenant, template } = useTenant()
  const [loading, setLoading] = useState(true)
  const [tid, setTid] = useState<string | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [layout, setLayout] = useState<TPVLayout | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [view, setView] = useState<'products' | 'tables'>('products')
  const [order, setOrder] = useState<TPVItem[]>([])
  const [parked, setParked] = useState<ParkedOrder[]>([])
  const [parkedOpen, setParkedOpen] = useState(false)
  const [showCobrar, setShowCobrar] = useState(false)
  const [cobroType, setCobroType] = useState<'barra' | 'mesa' | 'recoger' | 'domicilio'>('barra')
  const [cobroName, setCobroName] = useState('')
  const [cobroTable, setCobroTable] = useState('')
  const [cobroNotes, setCobroNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [intel, setIntel] = useState<Record<string, unknown> | null>(null)
  const [comboSuggestion, setComboSuggestion] = useState<{ name: string; price: number; id: string } | null>(null)
  const [alertsDismissed, setAlertsDismissed] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableOrders, setTableOrders] = useState<Record<string, TPVItem[]>>({})
  const [dbTables, setDbTables] = useState<DBTable[]>([])
  const [todayReservations, setTodayReservations] = useState<TodayReservation[]>([])
  const [mobileTicketOpen, setMobileTicketOpen] = useState(false)

  const flashRef = useRef<string | null>(null)
  const stylesInjected = useRef(false)
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Inject styles once
  useEffect(() => {
    if (stylesInjected.current) return
    stylesInjected.current = true
    const style = document.createElement('style')
    style.textContent = TPV_STYLES
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  // Read table selected from /mesas TPV mode
  useEffect(() => {
    const saved = sessionStorage.getItem('tpv_selected_table')
    if (saved) {
      setSelectedTable(saved)
      sessionStorage.removeItem('tpv_selected_table')
    }
  }, [])

  // Load tenant + menu items
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
      if (!p?.tenant_id) return
      setTid(p.tenant_id)

      // Fetch real tables via API (with tenant_id fallback)
      let fetchedTables: DBTable[] = []
      try {
        const { data: { session: tSession } } = await supabase.auth.getSession()
        const headers: Record<string, string> = {}
        if (tSession?.access_token) headers.Authorization = 'Bearer ' + tSession.access_token
        const res = await fetch(`/api/tables?tenant_id=${p.tenant_id}`, { headers })
        const d = await res.json()
        fetchedTables = (d.tables || []) as DBTable[]
      } catch { /* ignore */ }
      setDbTables(fetchedTables)

      // Fetch today's reservations
      const todayStr = new Date().toISOString().slice(0, 10)
      const { data: todayRes } = await supabase
        .from('reservations')
        .select('table_id, time, customer_name, party_size')
        .eq('tenant_id', p.tenant_id)
        .eq('date', todayStr)
        .in('status', ['confirmada', 'pendiente'])
      setTodayReservations((todayRes as TodayReservation[]) || [])

      const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('tenant_id', p.tenant_id)
        .eq('active', true)

      const mi: MenuItem[] = (items || []).map((i: Record<string, unknown>) => ({
        id: i.id as string,
        name: i.name as string,
        price: Number(i.price) || 0,
        category: (i.category as string) || 'Otro',
        active: true,
        image_url: (i.image_url as string) || undefined,
      }))
      setMenuItems(mi)

      // Fetch sales history for intelligent layout
      let salesHistory: SaleRecord[] = []
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession()
        const histRes = await fetch('/api/tpv/sales-history', {
          headers: authSession?.access_token ? { Authorization: 'Bearer ' + authSession.access_token } : {},
        })
        if (histRes.ok) {
          const histData = await histRes.json()
          salesHistory = histData.history || []
        }
      } catch { /* sales history is optional */ }

      const hour = new Date().getHours()
      const lyt = getTPVLayout(mi, hour, salesHistory)
      setLayout(lyt)
      if (lyt.categories.length > 0) {
        setActiveCategory(lyt.categories[0]!.name)
      }

      // Fetch intelligence data
      const headers: Record<string, string> = {}
      const { data: { session: intelSession } } = await supabase.auth.getSession()
      if (intelSession?.access_token) headers.Authorization = 'Bearer ' + intelSession.access_token
      fetch('/api/tpv/intelligence', { headers }).then(r => r.json()).then(d => setIntel(d.intelligence)).catch(() => {})

      setLoading(false)
    })()
  }, [])

  // Auto-dismiss alerts after 30 seconds, then refresh
  useEffect(() => {
    const alerts = intel?.alerts as unknown[] | undefined
    if (!alerts || alerts.length === 0 || alertsDismissed) return
    alertTimer.current = setTimeout(() => {
      setAlertsDismissed(true)
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        const h: Record<string, string> = {}
        if (s?.access_token) h.Authorization = 'Bearer ' + s.access_token
        fetch('/api/tpv/intelligence', { headers: h }).then(r => r.json()).then(d => {
          setIntel(d.intelligence)
          setAlertsDismissed(false)
        }).catch(() => {})
      })
    }, 30000)
    return () => { if (alertTimer.current) clearTimeout(alertTimer.current) }
  }, [intel?.alerts, alertsDismissed])

  // Cleanup combo timer
  useEffect(() => {
    return () => { if (comboTimer.current) clearTimeout(comboTimer.current) }
  }, [])

  // Load parked orders
  const loadParked = useCallback(async (tenantId: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('order_events')
      .select('id,customer_name,items,total_estimate,created_at,notes,order_type')
      .eq('tenant_id', tenantId)
      .eq('status', 'collecting')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
    setParked((data || []) as unknown as ParkedOrder[])
  }, [])

  useEffect(() => {
    if (tid) loadParked(tid)
  }, [tid, loadParked])

  // Computed
  const total = useMemo(() => order.reduce((s, i) => s + i.price * i.quantity, 0), [order])

  const filteredItems = useMemo(() => {
    if (!layout) return []
    if (search.trim()) {
      const q = search.toLowerCase()
      const all: { id: string; name: string; price: number; image_url?: string }[] = []
      for (const cat of layout.categories) {
        for (const item of cat.items) {
          if (item.name.toLowerCase().includes(q)) all.push(item)
        }
      }
      return all
    }
    const cat = layout.categories.find(c => c.name === activeCategory)
    return cat?.items || []
  }, [layout, activeCategory, search])

  // ── Actions ──────────────────────────────────────────────────────────
  function addItem(item: { id: string; name: string; price: number }) {
    flashRef.current = item.id
    setTimeout(() => { flashRef.current = null }, 300)
    setOrder(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }]
    })
    // Mark table as ocupada if adding first item
    if (selectedTable && order.length === 0) {
      const dbTable = dbTables.find(t => t.number === selectedTable)
      if (dbTable && dbTable.status !== 'ocupada') {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          const h: Record<string, string> = { 'Content-Type': 'application/json' }
          if (s?.access_token) h.Authorization = 'Bearer ' + s.access_token
          fetch('/api/tables', { method: 'PATCH', headers: h, body: JSON.stringify({ id: dbTable.id, status: 'ocupada' }) }).catch(e => console.error('table update error:', e))
        })
        setDbTables(prev => prev.map(t => t.id === dbTable.id ? { ...t, status: 'ocupada' } : t))
      }
    }
    // Check combo suggestions
    if (intel?.combos) {
      const nameLow = item.name.toLowerCase()
      const combos = intel.combos as { itemA?: string; itemB?: string }[]
      const combo = combos.find((c) =>
        c.itemA?.toLowerCase() === nameLow || c.itemB?.toLowerCase() === nameLow
      )
      if (combo) {
        const other = combo.itemA?.toLowerCase() === nameLow ? combo.itemB : combo.itemA
        if (other) {
          const matchItem = menuItems.find(m => m.name.toLowerCase() === other.toLowerCase())
          if (matchItem) {
            if (comboTimer.current) clearTimeout(comboTimer.current)
            setComboSuggestion({ name: matchItem.name, price: matchItem.price, id: matchItem.id })
            comboTimer.current = setTimeout(() => setComboSuggestion(null), 4000)
          }
        }
      }
    }
  }

  function addCustomItem() {
    const price = parseFloat(customPrice.replace(',', '.'))
    if (!customName.trim() || isNaN(price) || price <= 0) return
    const id = 'custom-' + Date.now()
    setOrder(prev => [...prev, { id, name: customName.trim(), price, quantity: 1 }])
    setCustomName('')
    setCustomPrice('')
    setShowCustom(false)
  }

  function updateQty(id: string, delta: number) {
    setOrder(prev => {
      return prev.map(i => {
        if (i.id !== id) return i
        const newQty = i.quantity + delta
        return newQty > 0 ? { ...i, quantity: newQty } : i
      }).filter(i => i.quantity > 0)
    })
  }

  function removeItem(id: string) {
    setOrder(prev => prev.filter(i => i.id !== id))
  }

  async function cobrar() {
    if (!tid || order.length === 0) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}),
        },
        body: JSON.stringify({
          tenant_id: tid,
          customer_name: cobroName.trim() || 'TPV',
          order_type: cobroType,
          notes: [cobroTable ? `Mesa: ${cobroTable}` : '', cobroNotes].filter(Boolean).join(' | ') || 'TPV',
          items: order.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
          total_estimate: total,
        }),
      })

      const d = await res.json()
      if (!res.ok) {
        alert('Error al guardar pedido: ' + (d.error || 'Error desconocido'))
        setSaving(false)
        return
      }
      if (res.ok) {
        if (d.order?.id) {
          await fetch('/api/orders', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}),
            },
            body: JSON.stringify({ id: d.order.id, tenant_id: tid, status: 'confirmed' }),
          })

          // Harmonize: sync stock, notifications, and operational state
          fetch('/api/harmonize/order-created', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}),
            },
            body: JSON.stringify({ order_id: d.order.id }),
          }).catch(e => console.error('harmonize error:', e))
        }

        // Print customer receipt
        const tableForTicket = cobroType === 'mesa' && cobroTable ? cobroTable : selectedTable
        const customerHtml = generateCustomerTicket(order, total, tableForTicket, tenant?.name || 'Reservo.AI')
        printTicket(customerHtml)

        // Print kitchen ticket if there are food items
        const foodItems = order.filter(item => isFood(item))
        if (foodItems.length > 0) {
          setTimeout(() => {
            const kitchenHtml = generateKitchenTicket(foodItems, tableForTicket, cobroNotes)
            printTicket(kitchenHtml)
          }, 1000)
        }
      }

      // Clear table order and update table status to libre
      if (selectedTable) {
        setTableOrders(prev => {
          const next = { ...prev }
          delete next[selectedTable]
          return next
        })
        const dbTable = dbTables.find(t => t.number === selectedTable)
        if (dbTable) {
          const { data: { session: tblSession } } = await supabase.auth.getSession()
          const tblH: Record<string, string> = { 'Content-Type': 'application/json' }
          if (tblSession?.access_token) tblH.Authorization = 'Bearer ' + tblSession.access_token
          await fetch('/api/tables', { method: 'PATCH', headers: tblH, body: JSON.stringify({ id: dbTable.id, status: 'libre' }) }).catch(e => console.error('table update error:', e))
          setDbTables(prev => prev.map(t => t.id === dbTable.id ? { ...t, status: 'libre' } : t))
        }
      }
      setOrder([])
      setShowCobrar(false)
      setCobroName('')
      setCobroTable('')
      setCobroNotes('')
      setCobroType('barra')
    } finally {
      setSaving(false)
    }
  }

  async function aparcar() {
    if (!tid || order.length === 0) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}),
        },
        body: JSON.stringify({
          tenant_id: tid,
          customer_name: 'TPV - aparcado',
          order_type: 'barra',
          notes: 'TPV - aparcado',
          items: order.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
          total_estimate: total,
        }),
      })
      setOrder([])
      if (tid) loadParked(tid)
    } finally {
      setSaving(false)
    }
  }

  function loadParkedOrder(po: ParkedOrder) {
    const items: TPVItem[] = Array.isArray(po.items)
      ? (po.items as unknown as { name: string; qty?: number; quantity?: number; price: number }[]).map((i, idx) => ({
          id: 'parked-' + idx + '-' + Date.now(),
          name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.qty || i.quantity) || 1,
        }))
      : []
    setOrder(items)
    setParkedOpen(false)
    if (tid) {
      supabase.from('order_events').delete().eq('id', po.id).eq('tenant_id', tid).then(() => {
        loadParked(tid)
      })
    }
  }

  function cancelar() {
    setOrder([])
  }

  // ── Ticket helpers ──────────────────────────────────────────────────
  const DRINK_CATEGORIES = ['Cafes', 'Caf\u00e9s', 'Bebidas', 'Cervezas', 'Vinos', 'Cocteles', 'C\u00f3cteles', 'Refrescos', 'Zumos']

  function isFood(item: TPVItem): boolean {
    const menuItem = menuItems.find(m => m.name === item.name)
    if (!menuItem) return true
    return !DRINK_CATEGORIES.some(cat =>
      menuItem.category?.toLowerCase().includes(cat.toLowerCase())
    )
  }

  function printTicket(html: string) {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.left = '-9999px'
    iframe.style.top = '-9999px'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    }
    setTimeout(() => document.body.removeChild(iframe), 5000)
  }

  function generateCustomerTicket(ticketItems: TPVItem[], ticketTotal: number, table: string | null, businessName: string): string {
    const now = new Date()
    const date = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    const subtotal = ticketTotal / 1.21
    const iva = ticketTotal - subtotal
    const logoUrl = tenant?.logo_url
    const addr = tenant?.address || ''
    const phone = tenant?.phone || ''
    const ticketNum = Date.now().toString(36).toUpperCase().slice(-6)

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; width: 300px; margin: 0 auto; padding: 16px; font-size: 12px; color: #222; }
      .header { text-align: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid #222; }
      .logo { max-width: 120px; max-height: 60px; margin: 0 auto 8px; display: block; }
      .biz-name { font-size: 20px; font-weight: 800; letter-spacing: 1px; margin-bottom: 2px; }
      .biz-info { font-size: 10px; color: #666; line-height: 1.5; }
      .meta { display: flex; justify-content: space-between; font-size: 11px; color: #555; padding: 8px 0; border-bottom: 1px dashed #ccc; margin-bottom: 8px; }
      .items { margin-bottom: 8px; }
      .item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; border-bottom: 1px dotted #e0e0e0; }
      .item-name { flex: 1; }
      .item-qty { width: 30px; text-align: center; color: #888; }
      .item-price { width: 60px; text-align: right; font-weight: 600; }
      .totals { border-top: 2px solid #222; padding-top: 8px; margin-top: 4px; }
      .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; }
      .total-final { font-size: 18px; font-weight: 800; padding: 6px 0; border-top: 1px solid #222; margin-top: 4px; }
      .footer { text-align: center; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #ccc; }
      .footer-msg { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
      .footer-sub { font-size: 9px; color: #999; }
      @media print { body { width: 80mm; } }
    </style></head><body>
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="logo"/>` : ''}
        <div class="biz-name">${businessName}</div>
        ${addr ? `<div class="biz-info">${addr}</div>` : ''}
        ${phone ? `<div class="biz-info">Tel: ${phone}</div>` : ''}
      </div>
      <div class="meta">
        <span>${date} ${time}</span>
        <span>${table ? 'Mesa ' + table : 'Barra'}</span>
        <span>#${ticketNum}</span>
      </div>
      <div class="items">
        ${ticketItems.map(i => `<div class="item"><span class="item-qty">${i.quantity}x</span><span class="item-name">${i.name}</span><span class="item-price">${(i.price * i.quantity).toFixed(2)}\u20AC</span></div>`).join('')}
      </div>
      <div class="totals">
        <div class="total-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}\u20AC</span></div>
        <div class="total-row"><span>IVA 21%</span><span>${iva.toFixed(2)}\u20AC</span></div>
        <div class="total-row total-final"><span>TOTAL</span><span>${ticketTotal.toFixed(2)}\u20AC</span></div>
      </div>
      <div class="footer">
        <div class="footer-msg">\u00A1Gracias por su visita!</div>
        <div class="footer-sub">Powered by Reservo.AI</div>
      </div>
    </body></html>`
  }

  function generateKitchenTicket(foodItems: TPVItem[], table: string | null, notes: string): string {
    const now = new Date()
    const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    const date = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; width: 300px; margin: 0 auto; padding: 16px; font-size: 14px; }
      .header { text-align: center; padding: 12px; margin-bottom: 12px; background: #111; color: #fff; border-radius: 8px; }
      .header h1 { font-size: 22px; letter-spacing: 4px; font-weight: 900; }
      .header .loc { font-size: 16px; font-weight: 700; margin-top: 6px; }
      .header .time { font-size: 12px; opacity: 0.7; margin-top: 2px; }
      .items { margin: 12px 0; }
      .item { font-size: 16px; font-weight: 700; padding: 8px 0; border-bottom: 1px dashed #ccc; display: flex; gap: 8px; }
      .item-qty { background: #222; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 14px; }
      .notes { background: #fff3cd; padding: 10px; border-radius: 6px; margin-top: 8px; font-size: 13px; border-left: 4px solid #ffc107; }
      .notes-label { font-weight: 700; font-size: 11px; text-transform: uppercase; color: #856404; margin-bottom: 4px; }
      .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #999; }
      @media print { body { width: 80mm; } }
    </style></head><body>
      <div class="header">
        <h1>\uD83C\uDF73 COCINA</h1>
        <div class="loc">${table ? 'MESA ' + table : 'BARRA'}</div>
        <div class="time">${date} \u2014 ${time}</div>
      </div>
      <div class="items">
        ${foodItems.map(i => `<div class="item"><span class="item-qty">${i.quantity}x</span><span>${i.name}</span></div>`).join('')}
      </div>
      ${notes ? `<div class="notes"><div class="notes-label">\u26A0 Notas</div>${notes}</div>` : ''}
      <div class="footer">${now.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' })} ${time}</div>
    </body></html>`
  }

  function sendToKitchen() {
    const foodItems = order.filter(item => isFood(item))
    if (foodItems.length === 0) return
    const table = selectedTable || null
    const kitchenHtml = generateKitchenTicket(foodItems, table, '')
    printTicket(kitchenHtml)
  }

  const hasFoodItems = useMemo(() => order.some(item => isFood(item)), [order, menuItems]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fullscreen ──────────────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // ── Table management ────────────────────────────────────────────────
  function selectTable(table: string | null) {
    // Save current order to current table
    if (selectedTable && order.length > 0) {
      setTableOrders(prev => ({ ...prev, [selectedTable]: order }))
    } else if (selectedTable && order.length === 0) {
      setTableOrders(prev => {
        const next = { ...prev }
        delete next[selectedTable]
        return next
      })
    }
    // Load order from new table
    setSelectedTable(table)
    const savedOrder = table ? (tableOrders[table] || []) : []
    setOrder(savedOrder)
  }

  // Persist tableOrders to localStorage
  useEffect(() => {
    if (!tid) return
    const saved = localStorage.getItem(`tpv_tables_${tid}`)
    if (saved) {
      try { setTableOrders(JSON.parse(saved)) } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid])

  useEffect(() => {
    if (tid) localStorage.setItem(`tpv_tables_${tid}`, JSON.stringify(tableOrders))
  }, [tableOrders, tid])

  // Table count helper
  const getTableItemCount = useCallback((table: string) => {
    if (table === selectedTable) return order.reduce((s, i) => s + i.quantity, 0)
    const items = tableOrders[table]
    return items ? items.reduce((s, i) => s + i.quantity, 0) : 0
  }, [tableOrders, selectedTable, order])

  const reservedTableIds = useMemo(() => new Set(todayReservations.map(r => r.table_id).filter(Boolean)), [todayReservations])

  // Find zone name for selected table
  const selectedDbTable = useMemo(() => dbTables.find(t => t.number === selectedTable), [dbTables, selectedTable])

  // Trending item IDs for badge
  const trendingNames = useMemo(() => {
    if (!intel?.trending) return new Set<string>()
    const td = intel.trending as { trendingUp?: { name?: string }[] }
    const arr = Array.isArray(td.trendingUp) ? td.trendingUp : (Array.isArray(td) ? td : [])
    return new Set(arr.map((t: any) => (t.name || String(t)).toLowerCase()))
  }, [intel?.trending])

  // Suppress unused var warning
  void getTableItemCount
  void mobileTicketOpen
  void setMobileTicketOpen

  if (loading) return <PageSkeleton variant="cards" />

  if (template && !template.hasOrders) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\uD83D\uDEAB'}</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>Modulo no disponible</h2>
          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>El TPV esta disponible para negocios de hosteleria.</p>
        </div>
      </div>
    )
  }

  const intelAlerts = (intel?.alerts || []) as { priority?: string; message?: string }[]
  const rawTrending = intel?.trending as { trendingUp?: { name?: string }[] } | undefined
  const intelTrending = (Array.isArray(rawTrending?.trendingUp) ? rawTrending.trendingUp : (Array.isArray(rawTrending) ? rawTrending : [])) as { name?: string }[]

  return (
    <UpgradeGate feature="pedidos">
      <div style={{
        background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column',
        ...(fullscreen ? { position: 'fixed' as const, inset: 0, zIndex: 9999 } : {}),
      }}>

        {/* ── Alerts banner ─────────────────────────────────────── */}
        {intelAlerts.length > 0 && !alertsDismissed && (() => {
          const alert = intelAlerts[0]!
          const bgMap: Record<string, string> = { critical: '#F87171', warning: '#F0A84E', info: '#2DD4BF' }
          const iconMap: Record<string, string> = { critical: '\uD83D\uDEA8', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' }
          const level = alert.priority || 'info'
          return (
            <div style={{
              padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
              background: `color-mix(in srgb, ${bgMap[level] || '#2DD4BF'} 15%, transparent)`,
              borderBottom: `1px solid ${bgMap[level] || '#2DD4BF'}`,
              fontSize: 13, fontWeight: 600, color: bgMap[level] || '#2DD4BF',
              flexShrink: 0,
            }}>
              <span>{iconMap[level] || '\u2139\uFE0F'}</span>
              <span style={{ flex: 1 }}>{alert.message}</span>
              <button onClick={() => setAlertsDismissed(true)} style={{
                background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: 'inherit', padding: '0 4px',
              }}>{'\u2715'}</button>
            </div>
          )
        })()}

        {/* ── Mobile ticket toggle ──────────────────────────────── */}
        {order.length > 0 && (
          <button
            className="tpv-mobile-ticket-toggle"
            onClick={() => setMobileTicketOpen(prev => !prev)}
            style={{
              display: 'none',
              position: 'fixed', bottom: 16, right: 16, zIndex: 50,
              padding: '14px 20px', borderRadius: 16,
              background: 'linear-gradient(135deg, #F0A84E, #E8923A)',
              border: 'none', color: '#0C1018', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 20px rgba(240,168,78,0.4)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {total.toFixed(2)}{'\u20AC'} ({order.reduce((s, i) => s + i.quantity, 0)})
          </button>
        )}

        {/* ── 3-Column Main Layout ────────────────────────────── */}
        <div className="tpv-3col" style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* ═══════════════════════════════════════════════════════
              LEFT: Category Sidebar (160px)
              ═══════════════════════════════════════════════════════ */}
          <div
            className="tpv-cat-sidebar"
            style={{
              width: 160, minWidth: 160, maxWidth: 160,
              background: C.surface,
              borderRight: `1px solid ${C.border}`,
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            {/* Category buttons */}
            <div style={{ paddingTop: 8, paddingBottom: 8 }}>
            {layout?.categories.map(cat => {
              const isActive = activeCategory === cat.name && view === 'products' && !search.trim()
              return (
                <button
                  key={cat.name}
                  onClick={() => {
                    setActiveCategory(cat.name)
                    setSearch('')
                    setShowSearch(false)
                    setView('products')
                  }}
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: isActive ? 'rgba(240,168,78,0.15)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '3px solid' : '3px solid transparent',
                    borderLeftColor: isActive ? C.amber : 'transparent',
                    borderBottom: `1px solid ${C.border}`,
                    color: isActive ? C.amber : C.text2,
                    fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'background 0.15s, color 0.15s',
                    boxShadow: isActive ? 'inset 0 0 12px rgba(240,168,78,0.08)' : 'none',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = C.surface2; e.currentTarget.style.color = C.text } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text2 } }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{getCategoryIcon(cat.name)}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{cat.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: isActive ? C.amber : C.text3, opacity: 0.7, flexShrink: 0 }}>
                    {cat.items.length}
                  </span>
                </button>
              )
            })}
            </div>

            {/* ── Utility buttons (bottom) ──────────────────────────── */}
            <div className="tpv-cat-utils" style={{ marginTop: 'auto', borderTop: `1px solid ${C.border}`, paddingTop: 4, paddingBottom: 4 }}>
              <button
                onClick={() => { setShowSearch(!showSearch); setView('products') }}
                style={{
                  width: '100%', padding: '13px 14px',
                  background: showSearch ? C.surface2 : 'transparent',
                  border: 'none', borderBottom: `1px solid ${C.border}`,
                  color: showSearch ? C.amber : C.text3,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{ fontSize: 17 }}>{'\uD83D\uDD0D'}</span> Buscar
              </button>
              <button
                onClick={() => window.location.href = '/mesas?mode=tpv'}
                style={{
                  width: '100%', padding: '13px 14px',
                  background: view === 'tables' ? C.surface2 : 'transparent',
                  border: 'none', borderBottom: `1px solid ${C.border}`,
                  color: view === 'tables' ? C.amber : C.text3,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{ fontSize: 17 }}>{'\uD83E\uDE91'}</span> Mesas
              </button>
              <button
                onClick={() => setShowCustom(true)}
                style={{
                  width: '100%', padding: '13px 14px',
                  background: 'transparent',
                  border: 'none', borderBottom: `1px solid ${C.border}`,
                  color: C.text3,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{ fontSize: 17 }}>{'\u2795'}</span> Manual
              </button>
              <button
                onClick={toggleFullscreen}
                style={{
                  width: '100%', padding: '13px 14px',
                  background: fullscreen ? C.surface2 : 'transparent',
                  border: 'none',
                  color: fullscreen ? C.amber : C.text3,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{ fontSize: 17 }}>{'\u26F6'}</span> {fullscreen ? 'Salir' : 'Completa'}
              </button>
            </div>
          </div>

          {/* ── Mobile utility row (hidden on desktop) ──────────── */}
          <div className="tpv-mobile-utils" style={{
            display: 'none', gap: 4, padding: '6px 8px',
            background: C.surface, borderBottom: `1px solid ${C.border}`,
            overflowX: 'auto', width: '100%', flexShrink: 0,
          }}>
            <button onClick={() => { setShowSearch(!showSearch); setView('products') }}
              style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: showSearch ? C.surface2 : 'transparent', color: showSearch ? C.amber : C.text3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {'\uD83D\uDD0D'} Buscar
            </button>
            <button onClick={() => window.location.href = '/mesas?mode=tpv'}
              style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: view === 'tables' ? C.surface2 : 'transparent', color: view === 'tables' ? C.amber : C.text3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {'\uD83E\uDE91'} Mesas
            </button>
            <button onClick={() => setShowCustom(true)}
              style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: C.text3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {'\u2795'} Manual
            </button>
            <button onClick={toggleFullscreen}
              style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: fullscreen ? C.surface2 : 'transparent', color: fullscreen ? C.amber : C.text3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {'\u26F6'} {fullscreen ? 'Salir' : 'Completa'}
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════
              CENTER: Products Grid or Floor Plan (flex: 1)
              ═══════════════════════════════════════════════════════ */}
          <div className="tpv-center-area" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>

            {/* Search bar */}
            {showSearch && view === 'products' && (
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex', gap: 8, flexShrink: 0 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    autoFocus
                    style={{
                      width: '100%', padding: '12px 16px 12px 40px',
                      background: C.surface2, border: `1px solid ${C.border}`,
                      borderRadius: 12, color: C.text, fontSize: 15,
                      outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(240,168,78,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(240,168,78,0.15)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: C.text3 }}>
                    {'\uD83D\uDD0D'}
                  </span>
                </div>
                {search && (
                  <button onClick={() => setSearch('')} style={{
                    padding: '10px 14px', background: C.surface2, border: `1px solid ${C.border}`,
                    borderRadius: 10, color: C.text3, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {'\u2715'}
                  </button>
                )}
              </div>
            )}

            {/* ── Mesa bar (always visible in products view) ───────── */}
            {view === 'products' && (
              <div style={{
                display: 'flex', gap: 6, padding: '8px 12px', overflowX: 'auto',
                borderBottom: `1px solid ${C.border}`, alignItems: 'center',
                WebkitOverflowScrolling: 'touch', flexShrink: 0,
              }}>
                {/* Barra button */}
                <button
                  onClick={() => selectTable(null)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: `1px solid ${selectedTable === null ? C.amber : C.border}`,
                    background: selectedTable === null ? C.amberDim : 'transparent',
                    color: selectedTable === null ? C.amber : C.text2,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  🍺 Barra
                </button>
                {/* DB tables as pills */}
                {dbTables.map(t => {
                  const isSel = selectedTable === t.number
                  const hasItems = (tableOrders[t.number] || []).length > 0
                  const sc = { libre: '#34D399', ocupada: '#F87171', reservada: '#F0A84E', bloqueada: '#49566A' }[t.status || 'libre'] || '#49566A'
                  return (
                    <button key={t.id}
                      onClick={() => { selectTable(t.number); setView('products') }}
                      onDoubleClick={() => window.location.href = '/mesas'}
                      style={{
                        position: 'relative', padding: '6px 12px', borderRadius: 8,
                        border: `1px solid ${isSel ? C.amber : hasItems ? sc : C.border}`,
                        background: isSel ? C.amberDim : hasItems ? sc + '15' : 'transparent',
                        color: isSel ? C.amber : hasItems ? sc : C.text2,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}
                    >
                      {t.name?.toLowerCase().includes('barra') ? '🍺' : '🪑'} {t.number}
                      {hasItems && <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: '#F87171' }}/>}
                    </button>
                  )
                })}
                {/* Fallback numbered tables if no DB tables */}
                {dbTables.length === 0 && Array.from({ length: 10 }, (_, i) => {
                  const num = String(i + 1)
                  const isSel = selectedTable === num
                  const hasItems = (tableOrders[num] || []).length > 0
                  return (
                    <button key={num} onClick={() => selectTable(num)}
                      style={{
                        padding: '6px 10px', borderRadius: 8, minWidth: 36,
                        border: `1px solid ${isSel ? C.amber : hasItems ? '#F87171' : C.border}`,
                        background: isSel ? C.amberDim : 'transparent',
                        color: isSel ? C.amber : hasItems ? '#F87171' : C.text3,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >{num}</button>
                  )
                })}
                {/* Edit link */}
                <button onClick={() => window.location.href = '/mesas?mode=tpv'} style={{
                  padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent',
                  color: C.text3, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}>
                  ✏️ Editar
                </button>
              </div>
            )}

            {/* Trending / Popular now (only in products view) */}
            {view === 'products' && intelTrending.length > 0 && !search.trim() && (
              <div style={{
                display: 'flex', gap: 6, padding: '8px 12px', overflowX: 'auto',
                borderBottom: `1px solid ${C.border}`, alignItems: 'center',
                WebkitOverflowScrolling: 'touch', flexShrink: 0,
              }}>
                <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, whiteSpace: 'nowrap', marginRight: 4 }}>
                  Populares ahora
                </span>
                {intelTrending.slice(0, 6).map((t, idx: number) => {
                  const tName = t.name || String(t)
                  const mi = menuItems.find(m => m.name.toLowerCase() === tName.toLowerCase())
                  return (
                    <button
                      key={idx}
                      onClick={() => mi && addItem(mi)}
                      style={{
                        padding: '4px 10px', borderRadius: 20, border: 'none', cursor: mi ? 'pointer' : 'default',
                        background: C.amberDim, color: C.amber, fontSize: 11, fontWeight: 600,
                        whiteSpace: 'nowrap', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3,
                      }}
                    >
                      {tName} <span style={{ fontSize: 10 }}>{'\u2191'}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {view === 'products' ? (
              /* ── Product Grid ────────────────────────────────────── */
              <div style={{ flex: 1, overflow: 'auto', padding: 16, position: 'relative' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 10, alignContent: 'start',
                }}>
                  {filteredItems.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 40px', color: C.text3 }}>
                      <div style={{ fontSize: 48, marginBottom: 12, filter: 'drop-shadow(0 0 8px rgba(240,168,78,0.2))' }}>{search.trim() ? '\uD83D\uDD0D' : '\uD83D\uDCE6'}</div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: C.text2, marginBottom: 4 }}>
                        {search.trim() ? 'Sin resultados' : 'Sin productos en esta categoria'}
                      </p>
                      <p style={{ fontSize: 12, color: C.text3 }}>
                        {search.trim() ? 'Prueba con otro termino de busqueda' : 'Selecciona otra categoria del menu lateral'}
                      </p>
                    </div>
                  ) : (
                    filteredItems.map(item => {
                      const isTrending = trendingNames.has(item.name.toLowerCase())
                      return (
                        <button
                          key={item.id}
                          className={`tpv-product ${flashRef.current === item.id ? 'tpv-flash' : ''}`}
                          onClick={() => addItem(item)}
                          style={{
                            position: 'relative',
                            background: item.image_url ? 'none' : `linear-gradient(145deg, ${C.surface2}, ${C.surface})`,
                            backgroundImage: item.image_url ? `url(${item.image_url})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 12,
                            padding: item.image_url ? 0 : '10px 8px',
                            cursor: 'pointer',
                            display: 'flex', flexDirection: 'column',
                            alignItems: item.image_url ? 'stretch' : 'center',
                            justifyContent: item.image_url ? 'flex-end' : 'center',
                            gap: item.image_url ? 0 : 4, minHeight: 100,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Price badge top-right */}
                          <span style={{
                            position: 'absolute', top: 6, right: 6,
                            background: C.amber, color: '#0C1018',
                            fontSize: 12, fontWeight: 800,
                            padding: '3px 9px', borderRadius: 6,
                            zIndex: 2,
                          }}>
                            {item.price.toFixed(2)}{'\u20AC'}
                          </span>
                          {/* Trending star top-left */}
                          {isTrending && (
                            <span style={{
                              position: 'absolute', top: 6, left: 6,
                              fontSize: 12,
                              zIndex: 2,
                            }}>
                              {'\u2B50'}
                            </span>
                          )}
                          {item.image_url ? (
                            <div style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                              padding: '20px 8px 8px', borderRadius: '0 0 12px 12px',
                            }}>
                              <span style={{
                                fontSize: 13, fontWeight: 700, color: C.text,
                                textAlign: 'center', lineHeight: 1.3,
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {item.name}
                              </span>
                            </div>
                          ) : (
                            <span style={{
                              fontSize: 14, fontWeight: 700, color: C.text,
                              textAlign: 'center', lineHeight: 1.3,
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              marginTop: 6,
                            }}>
                              {item.name}
                            </span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>

                {/* Combo suggestion toast */}
                {comboSuggestion && (
                  <div style={{
                    position: 'absolute', bottom: 16, right: 16, zIndex: 10,
                    background: C.surface, border: `1px solid ${C.amberBorder}`,
                    borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', gap: 10, maxWidth: 280,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: C.text3, marginBottom: 2 }}>Suele ir con:</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{comboSuggestion.name}</div>
                    </div>
                    <button
                      onClick={() => {
                        addItem(comboSuggestion)
                        setComboSuggestion(null)
                        if (comboTimer.current) clearTimeout(comboTimer.current)
                      }}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: C.amberDim, color: C.amber, fontSize: 12, fontWeight: 700,
                        fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}
                    >
                      + Anadir
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ── Floor Plan View ─────────────────────────────────── */
              <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                <FullFloorPlan
                  tables={dbTables}
                  selectedTable={selectedTable}
                  tableOrders={tableOrders}
                  currentOrder={order}
                  reservedTableIds={reservedTableIds}
                  onSelect={(num) => {
                    selectTable(num)
                    setView('products')
                  }}
                />
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════
              RIGHT: Ticket Panel (280px)
              ═══════════════════════════════════════════════════════ */}
          <div
            className="tpv-ticket-panel"
            style={{
              width: 280, minWidth: 280, maxWidth: 280,
              background: `linear-gradient(180deg, ${C.surface}, rgba(12,16,24,0.95))`,
              borderLeft: `1px solid ${C.border}`,
              display: 'flex', flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* ── Mini floor plan in ticket panel ────────────────── */}
            {dbTables.length > 0 && (
              <div style={{ padding: 10, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <svg
                  viewBox={`0 0 ${Math.max(200, Math.max(...dbTables.map(t => (t.x_pos || 0) + (t.w || 60))) + 20)} ${Math.max(80, Math.max(...dbTables.map(t => (t.y_pos || 0) + (t.h || 60))) + 20)}`}
                  style={{ width: '100%', height: 90, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}` }}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {dbTables.map(t => {
                    const isSel = selectedTable === t.number
                    const hasItems = (tableOrders[t.number] || []).length > 0 || (selectedTable === t.number && order.length > 0)
                    const sc = ({ libre: '#34D399', ocupada: '#F87171', reservada: '#F0A84E', bloqueada: '#49566A' } as Record<string,string>)[t.status || 'libre'] || '#49566A'
                    const w = t.w || 60, h = t.h || 60
                    const cx = (t.x_pos || 0) + w / 2, cy = (t.y_pos || 0) + h / 2
                    return (
                      <g key={t.id} onClick={() => selectTable(t.number)} onDoubleClick={() => window.location.href = '/mesas'} style={{ cursor: 'pointer' }}>
                        {t.shape_type === 'round' ? (
                          <ellipse cx={cx} cy={cy} rx={w/2-2} ry={h/2-2}
                            fill={isSel ? 'rgba(240,168,78,0.35)' : hasItems ? sc+'33' : sc+'18'}
                            stroke={isSel ? '#F0A84E' : sc} strokeWidth={isSel ? 2.5 : 1} />
                        ) : (
                          <rect x={t.x_pos||0} y={t.y_pos||0} width={w} height={h} rx={6}
                            fill={isSel ? 'rgba(240,168,78,0.35)' : hasItems ? sc+'33' : sc+'18'}
                            stroke={isSel ? '#F0A84E' : sc} strokeWidth={isSel ? 2.5 : 1} />
                        )}
                        <text x={cx} y={cy-(hasItems?5:0)} textAnchor="middle" dominantBaseline="middle"
                          fill={isSel ? '#F0A84E' : '#E8EEF6'} fontSize={11} fontWeight={700}>
                          {t.name || t.number}
                        </text>
                        {hasItems && (
                          <text x={cx} y={cy+10} textAnchor="middle" fontSize={8}>
                            {'\uD83D\uDC64'.repeat(Math.min(3, (selectedTable===t.number ? order : (tableOrders[t.number]||[])).reduce((s: number, i: TPVItem) => s + i.quantity, 0)))}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </svg>
              </div>
            )}

            {/* Parked orders */}
            {parked.length > 0 && (
              <div style={{ borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <button
                  onClick={() => setParkedOpen(!parkedOpen)}
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.amber }}>
                    {'\uD83C\uDD7F\uFE0F'} Aparcados ({parked.length})
                  </span>
                  <span style={{ fontSize: 11, color: C.text3 }}>{parkedOpen ? '\u25B2' : '\u25BC'}</span>
                </button>
                {parkedOpen && (
                  <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {parked.map(po => {
                      const pitems = Array.isArray(po.items) ? po.items : []
                      return (
                        <button
                          key={po.id}
                          onClick={() => loadParkedOrder(po)}
                          style={{
                            background: C.surface2, border: `1px solid ${C.border}`,
                            borderRadius: 8, padding: '8px 10px',
                            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                            {pitems.length} items - {(po.total_estimate || 0).toFixed(2)}{'\u20AC'}
                          </div>
                          <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>
                            {new Date(po.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Order header */}
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>
                {selectedTable
                  ? selectedDbTable?.zone_name
                    ? `Mesa ${selectedTable} \u00B7 ${selectedDbTable.zone_name}`
                    : `Mesa ${selectedTable}`
                  : 'Barra'}
              </h2>
              {selectedTable && selectedDbTable && selectedDbTable.capacity > 0 && (
                <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
                  {Array.from({ length: Math.min(selectedDbTable.capacity, 6) }).map(() => '\uD83D\uDC64').join('')}
                  {' '}{selectedDbTable.capacity} personas
                </div>
              )}
              {order.length > 0 && (
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                  {order.reduce((s, i) => s + i.quantity, 0)} items
                </div>
              )}
            </div>

            {/* Order items */}
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
              {order.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 14px', color: C.text3 }}>
                  <div style={{ fontSize: 48, marginBottom: 10, filter: 'drop-shadow(0 0 8px rgba(240,168,78,0.15))' }}>{'\uD83D\uDED2'}</div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>Toca un producto para agregarlo</p>
                </div>
              ) : (
                order.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px',
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: C.text,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {item.name}
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: C.surface2, border: `1px solid ${C.border}`,
                          color: C.text, fontSize: 14, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'inherit',
                        }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, width: 22, textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: C.surface2, border: `1px solid ${C.border}`,
                          color: C.text, fontSize: 14, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'inherit',
                        }}
                      >
                        +
                      </button>
                    </div>

                    {/* Subtotal */}
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.amber, minWidth: 48, textAlign: 'right', flexShrink: 0 }}>
                      {(item.price * item.quantity).toFixed(2)}{'\u20AC'}
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => removeItem(item.id)}
                      style={{
                        width: 24, height: 24, borderRadius: 6,
                        background: C.redDim, border: 'none',
                        color: C.red, fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'inherit', flexShrink: 0,
                      }}
                    >
                      {'\u2715'}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Total */}
            <div style={{
              borderTop: `2px solid ${C.border}`,
              padding: '14px 16px 10px',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              flexShrink: 0,
              background: total > 0 ? 'rgba(240,168,78,0.03)' : 'transparent',
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text2 }}>TOTAL</span>
              <span style={{
                fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: '-0.02em',
                textShadow: total > 0 ? '0 0 20px rgba(240,168,78,0.15)' : 'none',
              }}>
                {total.toFixed(2)}{'\u20AC'}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ padding: '8px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              {/* Cobrar */}
              <button
                onClick={() => {
                  if (order.length === 0) return
                  if (selectedTable) {
                    setCobroType('mesa')
                    setCobroTable(selectedTable)
                  } else {
                    setCobroType('barra')
                    setCobroTable('')
                  }
                  setShowCobrar(true)
                }}
                disabled={order.length === 0}
                style={{
                  width: '100%', height: 52,
                  background: order.length > 0 ? 'linear-gradient(135deg, #F0A84E, #E8923A)' : C.surface2,
                  border: 'none', borderRadius: 14,
                  color: order.length > 0 ? '#0C1018' : C.text3,
                  fontSize: 17, fontWeight: 800,
                  cursor: order.length > 0 ? 'pointer' : 'default',
                  boxShadow: order.length > 0 ? '0 4px 20px rgba(240,168,78,0.35)' : 'none',
                  fontFamily: 'inherit',
                  letterSpacing: '0.5px',
                }}
              >
                COBRAR
              </button>

              {/* Cocina */}
              <button
                onClick={sendToKitchen}
                disabled={!hasFoodItems}
                style={{
                  width: '100%', height: 40,
                  background: hasFoodItems ? 'rgba(45,212,191,0.12)' : C.surface2,
                  border: hasFoodItems ? `1px solid ${C.teal}` : `1px solid ${C.border}`,
                  borderRadius: 10,
                  color: hasFoodItems ? C.teal : C.text3,
                  fontSize: 13, fontWeight: 600,
                  cursor: hasFoodItems ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {'\uD83C\uDF73'} Cocina
              </button>

              {/* Aparcar + Cancelar row */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={aparcar}
                  disabled={order.length === 0 || saving}
                  style={{
                    flex: 1, padding: '10px',
                    background: 'transparent',
                    border: order.length > 0 ? `1px solid ${C.border}` : 'none',
                    borderRadius: 10,
                    color: order.length > 0 ? C.text2 : C.text3,
                    fontSize: 12, fontWeight: 600,
                    cursor: order.length > 0 ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                  }}
                >
                  Aparcar
                </button>
                <button
                  onClick={cancelar}
                  disabled={order.length === 0}
                  style={{
                    padding: '10px 14px',
                    background: 'transparent', border: 'none',
                    color: order.length > 0 ? C.red : C.text3,
                    fontSize: 12, fontWeight: 500,
                    cursor: order.length > 0 ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                  }}
                >
                  {'\u2715'} Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Cobrar modal ──────────────────────────────────────────── */}
        {showCobrar && (
          <div
            onClick={() => setShowCobrar(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100, padding: 20,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: 28, width: '100%', maxWidth: 420,
              }}
            >
              <h3 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Cobrar pedido</h3>
              <p style={{ fontSize: 32, fontWeight: 800, color: C.amber, marginBottom: 20 }}>
                {total.toFixed(2)}{'\u20AC'}
              </p>

              {/* Order type */}
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 8, display: 'block' }}>
                Tipo de pedido
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                {(['barra', 'mesa', 'recoger', 'domicilio'] as const).map(tp => {
                  const icons: Record<string, string> = { barra: '\uD83C\uDF7A', mesa: '\uD83C\uDF7D\uFE0F', recoger: '\uD83E\uDD61', domicilio: '\uD83D\uDEF5' }
                  const labels: Record<string, string> = { barra: 'Barra', mesa: 'Mesa', recoger: 'Recoger', domicilio: 'Domicilio' }
                  return (
                    <button
                      key={tp}
                      onClick={() => setCobroType(tp)}
                      style={{
                        padding: '14px 8px', borderRadius: 12,
                        border: cobroType === tp ? `2px solid ${C.amber}` : `1px solid ${C.border}`,
                        background: cobroType === tp ? C.amberDim : C.surface2,
                        color: cobroType === tp ? C.amber : C.text2,
                        fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', textAlign: 'center',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{icons[tp]}</div>
                      {labels[tp]}
                    </button>
                  )
                })}
              </div>

              {/* Customer name */}
              <input
                value={cobroName}
                onChange={e => setCobroName(e.target.value)}
                placeholder="Nombre del cliente (opcional)"
                style={{
                  width: '100%', padding: '12px 14px', marginBottom: 10,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 14,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />

              {/* Table number (only for mesa) */}
              {cobroType === 'mesa' && (
                <input
                  value={cobroTable}
                  onChange={e => setCobroTable(e.target.value)}
                  placeholder="Numero de mesa"
                  style={{
                    width: '100%', padding: '12px 14px', marginBottom: 10,
                    background: C.surface2, border: `1px solid ${C.border}`,
                    borderRadius: 10, color: C.text, fontSize: 14,
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              )}

              {/* Notes */}
              <input
                value={cobroNotes}
                onChange={e => setCobroNotes(e.target.value)}
                placeholder="Notas (opcional)"
                style={{
                  width: '100%', padding: '12px 14px', marginBottom: 20,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 14,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />

              <button
                onClick={cobrar}
                disabled={saving}
                style={{
                  width: '100%', padding: '16px',
                  background: 'linear-gradient(135deg, #F0A84E, #E8923A)',
                  border: 'none', borderRadius: 14,
                  color: '#0C1018', fontSize: 18, fontWeight: 800,
                  cursor: saving ? 'wait' : 'pointer',
                  boxShadow: '0 4px 20px rgba(240,168,78,0.3)',
                  fontFamily: 'inherit',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Procesando...' : 'Confirmar cobro'}
              </button>
            </div>
          </div>
        )}

        {/* ── Custom price modal ──────────────────────────────────── */}
        {showCustom && (
          <div
            onClick={() => setShowCustom(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100, padding: 20,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: 28, width: '100%', maxWidth: 360,
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 16 }}>Precio manual</h3>
              <input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Nombre del producto"
                autoFocus
                style={{
                  width: '100%', padding: '12px 14px', marginBottom: 10,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 14,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              <input
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
                placeholder="Precio (\u20AC)"
                type="text"
                inputMode="decimal"
                style={{
                  width: '100%', padding: '12px 14px', marginBottom: 20,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 14,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
                onKeyDown={e => { if (e.key === 'Enter') addCustomItem() }}
              />
              <button
                onClick={addCustomItem}
                style={{
                  width: '100%', padding: '14px',
                  background: 'linear-gradient(135deg, #F0A84E, #E8923A)',
                  border: 'none', borderRadius: 12,
                  color: '#0C1018', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Agregar
              </button>
            </div>
          </div>
        )}
      </div>
    </UpgradeGate>
  )
}
