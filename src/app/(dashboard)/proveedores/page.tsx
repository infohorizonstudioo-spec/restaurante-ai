'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageSkeleton } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/components/NotificationToast'
import { C } from '@/lib/colors'

/* ── Types ─────────────────────────────────────────────────────────── */
interface Supplier {
  id: string; tenant_id: string; name: string; phone: string; email: string
  contact_name: string; category: string; notes: string; products: string[]
  delivery_days: string[]; min_order: number; payment_terms: string; active: boolean
  created_at: string
}
interface InventoryItem {
  id: string; tenant_id: string; name: string; category: string; unit: string
  current_stock: number; min_stock: number; max_stock: number
  supplier_id: string | null; price_per_unit: number; active: boolean
}
interface SupplyOrder {
  id: string; tenant_id: string; supplier_id: string; items: any[]
  total: number; notes: string; status: string; call_id: string | null
  call_summary: string | null; delivery_date: string | null; delivered_at: string | null
  ordered_by: string; priority: string; created_at: string
  suppliers?: { name: string }
}

/* ── Tabs ──────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'proveedores', label: 'Proveedores', icon: '🏭' },
  { id: 'faltantes', label: 'Faltantes', icon: '⚠️' },
  { id: 'pedidos', label: 'Pedidos', icon: '📦' },
  { id: 'llamar', label: 'Llamar', icon: '📞' },
] as const
type TabId = typeof TABS[number]['id']

/* ── Status config ─────────────────────────────────────────────────── */
const ORDER_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Borrador',   color: C.text2,  bg: 'rgba(136,149,167,0.10)' },
  ordered:   { label: 'Pedido',     color: C.blue,   bg: C.blueDim },
  confirmed: { label: 'Confirmado', color: C.teal,   bg: C.tealDim },
  shipped:   { label: 'Enviado',    color: C.violet,  bg: C.violetDim },
  delivered: { label: 'Entregado',  color: C.green,  bg: C.greenDim },
  cancelled: { label: 'Cancelado',  color: C.red,    bg: C.redDim },
}

const PRIORITY_CFG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Baja',   color: C.text3 },
  normal: { label: 'Normal', color: C.text2 },
  high:   { label: 'Alta',   color: C.amber },
  urgent: { label: 'Urgente', color: C.red },
}

const CATEGORIES = ['Carnes', 'Pescados', 'Verduras', 'Frutas', 'Bebidas', 'Lácteos', 'Panadería', 'Limpieza', 'Envases', 'Otros']

/* ── Main page ─────────────────────────────────────────────────────── */
export default function ProveedoresPage() {
  const { tenant, template, t, tx, userId } = useTenant()
  const toast = useToast()

  const [tab, setTab] = useState<TabId>('proveedores')
  const [loading, setLoading] = useState(true)
  const [tid, setTid] = useState<string | null>(null)

  // Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [orders, setOrders] = useState<SupplyOrder[]>([])

  // Supplier form
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', contact_name: '', category: '', notes: '', products: '', delivery_days: '', min_order: '', payment_terms: '' })

  // Shopping list (items to order)
  const [cart, setCart] = useState<Record<string, number>>({}) // item_id -> qty
  const [callSupplierId, setCallSupplierId] = useState<string | null>(null)
  const [callNotes, setCallNotes] = useState('')
  const [calling, setCalling] = useState(false)

  // Search
  const [search, setSearch] = useState('')

  // Order detail modal
  const [orderModal, setOrderModal] = useState<SupplyOrder | null>(null)

  /* ── Load data ───────────────────────────────────────────────────── */
  const loadAll = useCallback(async (tenantId: string) => {
    const [s, i, o] = await Promise.all([
      supabase.from('suppliers').select('*').eq('tenant_id', tenantId).order('name'),
      supabase.from('inventory_items').select('*').eq('tenant_id', tenantId).order('name'),
      supabase.from('supply_orders').select('*, suppliers(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100),
    ])
    setSuppliers(s.data || [])
    setInventory(i.data || [])
    setOrders(o.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
      if (!p?.tenant_id) return
      setTid(p.tenant_id)
      await loadAll(p.tenant_id)
    })()
  }, [loadAll])

  /* ── Realtime ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!tid) return
    const ch = supabase.channel('suppliers-rt-' + tid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers', filter: 'tenant_id=eq.' + tid }, () => loadAll(tid))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items', filter: 'tenant_id=eq.' + tid }, () => loadAll(tid))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_orders', filter: 'tenant_id=eq.' + tid }, () => loadAll(tid))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tid, loadAll])

  if (loading) return <PageSkeleton variant="list" />

  const lowStock = inventory.filter(item => item.active && item.current_stock <= item.min_stock)
  const activeSuppliers = suppliers.filter(s => s.active)

  /* ── Supplier CRUD ───────────────────────────────────────────────── */
  function openNewForm() {
    setEditing(null)
    setForm({ name: '', phone: '', email: '', contact_name: '', category: '', notes: '', products: '', delivery_days: '', min_order: '', payment_terms: '' })
    setShowForm(true)
  }
  function openEditForm(sup: Supplier) {
    setEditing(sup)
    setForm({
      name: sup.name, phone: sup.phone || '', email: sup.email || '',
      contact_name: sup.contact_name || '', category: sup.category || '',
      notes: sup.notes || '', products: (sup.products || []).join(', '),
      delivery_days: (sup.delivery_days || []).join(', '),
      min_order: sup.min_order ? String(sup.min_order) : '',
      payment_terms: sup.payment_terms || '',
    })
    setShowForm(true)
  }

  async function saveSupplier() {
    if (!tid || !form.name.trim()) return
    const payload = {
      tenant_id: tid,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      contact_name: form.contact_name.trim(),
      category: form.category,
      notes: form.notes.trim(),
      products: form.products.split(',').map(p => p.trim()).filter(Boolean),
      delivery_days: form.delivery_days.split(',').map(d => d.trim()).filter(Boolean),
      min_order: form.min_order ? parseFloat(form.min_order) : null,
      payment_terms: form.payment_terms.trim(),
      active: true,
    }
    if (editing) {
      await supabase.from('suppliers').update(payload).eq('id', editing.id).eq('tenant_id', tid)
      toast.push({ title: 'Proveedor actualizado', type: 'success', priority: 'info', icon: '✅' })
    } else {
      await supabase.from('suppliers').insert(payload)
      toast.push({ title: 'Proveedor creado', type: 'success', priority: 'info', icon: '✅' })
    }
    setShowForm(false)
    loadAll(tid)
  }

  async function toggleSupplierActive(sup: Supplier) {
    if (!tid) return
    await supabase.from('suppliers').update({ active: !sup.active }).eq('id', sup.id).eq('tenant_id', tid)
    loadAll(tid)
  }

  /* ── Cart / shopping list ────────────────────────────────────────── */
  function addToCart(itemId: string, qty: number) {
    setCart(prev => {
      const next = { ...prev }
      if (qty <= 0) { delete next[itemId]; return next }
      next[itemId] = qty
      return next
    })
  }
  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const item = inventory.find(i => i.id === id)
    return item ? { ...item, orderQty: qty } : null
  }).filter(Boolean) as (InventoryItem & { orderQty: number })[]

  async function createOrder() {
    if (!tid || cartItems.length === 0 || !callSupplierId) return
    const items = cartItems.map(ci => ({ item_id: ci.id, name: ci.name, qty: ci.orderQty, unit: ci.unit, price: ci.price_per_unit }))
    const total = items.reduce((s, i) => s + i.qty * i.price, 0)
    const { error } = await supabase.from('supply_orders').insert({
      tenant_id: tid, supplier_id: callSupplierId, items, total,
      notes: callNotes.trim(), status: 'draft', ordered_by: userId || 'unknown', priority: 'normal',
    })
    if (!error) {
      toast.push({ title: 'Pedido creado', type: 'success', priority: 'info', icon: '📦' })
      setCart({})
      setCallNotes('')
      setTab('pedidos')
      loadAll(tid)
    }
  }

  /* ── Call supplier ───────────────────────────────────────────────── */
  async function launchCall(supplierId: string, orderId?: string) {
    if (!tid) return
    setCalling(true)
    try {
      // Resolver datos del proveedor para la llamada
      const supplier = suppliers.find(s => s.id === supplierId)
      if (!supplier?.phone) {
        toast.push({ title: 'El proveedor no tiene teléfono', type: 'error', priority: 'critical', icon: '❌' }); return
      }
      // Buscar pedido pendiente si hay
      let products: string[] = supplier.products || []
      let notes = ''
      if (orderId) {
        const order = orders.find(o => o.id === orderId)
        if (order?.items) {
          products = (order.items as any[]).map(i => `${i.quantity || 1}x ${i.name}`)
          notes = order.notes || ''
        }
      }
      const res = await fetch('/api/retell/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tid,
          call_type: 'supplier',
          phone: supplier.phone,
          supplier_name: supplier.name,
          supplier_id: supplierId,
          order_id: orderId || undefined,
          products,
          notes,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.push({ title: 'Llamada iniciada', type: 'success', priority: 'info', icon: '📞' })
      } else {
        toast.push({ title: data.error || 'Error al llamar', type: 'error', priority: 'critical', icon: '❌' })
      }
    } finally { setCalling(false) }
  }

  /* ── Update order status ─────────────────────────────────────────── */
  async function updateOrderStatus(orderId: string, status: string) {
    if (!tid) return
    const payload: any = { status }
    if (status === 'delivered') payload.delivered_at = new Date().toISOString()
    await supabase.from('supply_orders').update(payload).eq('id', orderId).eq('tenant_id', tid)
    toast.push({ title: 'Estado actualizado', type: 'success', priority: 'info', icon: '✅' })
    setOrderModal(null)
    loadAll(tid)
  }

  /* ── Filtered suppliers ──────────────────────────────────────────── */
  const filteredSuppliers = search
    ? suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.category || '').toLowerCase().includes(search.toLowerCase()) || (s.products || []).some(p => p.toLowerCase().includes(search.toLowerCase())))
    : suppliers

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'rgba(19,25,32,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, position: 'sticky', top: 0, zIndex: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Proveedores</h1>
          <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{activeSuppliers.length} proveedores activos · {lowStock.length} productos bajo stock</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proveedor..."
              style={{ padding: '8px 14px', fontSize: 13, border: `1px solid ${C.borderMd}`, borderRadius: 9, outline: 'none', width: 200, background: C.surface2, color: C.text, fontFamily: 'inherit' }} />
          </div>
          <button onClick={openNewForm} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, background: C.amber, color: '#0C1018', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ Nuevo proveedor</button>
          <NotifBell />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '0 24px', display: 'flex', alignItems: 'stretch' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === t.id ? `2px solid ${C.amber}` : '2px solid transparent',
            color: tab === t.id ? C.amber : C.text2, fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            transition: 'all 0.12s', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{t.icon}</span> {t.label}
            {t.id === 'faltantes' && lowStock.length > 0 && (
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: C.redDim, color: C.red, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{lowStock.length}</span>
            )}
            {t.id === 'llamar' && Object.keys(cart).length > 0 && (
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: C.amberDim, color: C.amber, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Object.keys(cart).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px' }}>
        {tab === 'proveedores' && <SuppliersTab suppliers={filteredSuppliers} onEdit={openEditForm} onToggle={toggleSupplierActive} onCall={launchCall} calling={calling} />}
        {tab === 'faltantes' && <FaltantesTab items={lowStock} suppliers={suppliers} cart={cart} onAddToCart={addToCart} inventory={inventory} />}
        {tab === 'pedidos' && <PedidosTab orders={orders} suppliers={suppliers} onDetail={setOrderModal} />}
        {tab === 'llamar' && <LlamarTab cartItems={cartItems} suppliers={activeSuppliers} inventory={inventory} cart={cart} onAddToCart={addToCart} callSupplierId={callSupplierId} setCallSupplierId={setCallSupplierId} callNotes={callNotes} setCallNotes={setCallNotes} onCreateOrder={createOrder} onCall={launchCall} calling={calling} />}
      </div>

      {/* Supplier form modal */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormRow label="Nombre *">
              <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Distribuciones García" />
            </FormRow>
            <div style={{ display: 'flex', gap: 12 }}>
              <FormRow label="Teléfono" style={{ flex: 1 }}>
                <Input value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+34 600 123 456" />
              </FormRow>
              <FormRow label="Email" style={{ flex: 1 }}>
                <Input value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="info@proveedor.com" />
              </FormRow>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <FormRow label="Persona de contacto" style={{ flex: 1 }}>
                <Input value={form.contact_name} onChange={v => setForm(f => ({ ...f, contact_name: v }))} placeholder="Carlos García" />
              </FormRow>
              <FormRow label="Categoría" style={{ flex: 1 }}>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: `1px solid ${C.borderMd}`, borderRadius: 8, background: C.surface2, color: C.text, fontFamily: 'inherit', outline: 'none' }}>
                  <option value="">Seleccionar...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormRow>
            </div>
            <FormRow label="Productos (separados por coma)">
              <Input value={form.products} onChange={v => setForm(f => ({ ...f, products: v }))} placeholder="Pollo, Ternera, Cerdo" />
            </FormRow>
            <div style={{ display: 'flex', gap: 12 }}>
              <FormRow label="Días de entrega" style={{ flex: 1 }}>
                <Input value={form.delivery_days} onChange={v => setForm(f => ({ ...f, delivery_days: v }))} placeholder="Lunes, Miércoles, Viernes" />
              </FormRow>
              <FormRow label="Pedido mínimo (€)" style={{ flex: 1 }}>
                <Input value={form.min_order} onChange={v => setForm(f => ({ ...f, min_order: v }))} placeholder="50" type="number" />
              </FormRow>
            </div>
            <FormRow label="Condiciones de pago">
              <Input value={form.payment_terms} onChange={v => setForm(f => ({ ...f, payment_terms: v }))} placeholder="30 días, transferencia" />
            </FormRow>
            <FormRow label="Notas">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="Notas internas..."
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: `1px solid ${C.borderMd}`, borderRadius: 8, background: C.surface2, color: C.text, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            </FormRow>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={saveSupplier} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', background: C.amber, color: '#0C1018', cursor: 'pointer', fontFamily: 'inherit' }}>
                {editing ? 'Guardar cambios' : 'Crear proveedor'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Order detail modal */}
      {orderModal && (
        <Modal onClose={() => setOrderModal(null)} title={`Pedido a ${(orderModal as any).suppliers?.name || 'proveedor'}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Pill label="Estado" value={(ORDER_STATUS_CFG[orderModal.status] || ORDER_STATUS_CFG.draft).label} color={(ORDER_STATUS_CFG[orderModal.status] || ORDER_STATUS_CFG.draft).color} />
              <Pill label="Prioridad" value={(PRIORITY_CFG[orderModal.priority] || PRIORITY_CFG.normal).label} color={(PRIORITY_CFG[orderModal.priority] || PRIORITY_CFG.normal).color} />
              <Pill label="Total" value={`${orderModal.total?.toFixed(2) || '0.00'} €`} color={C.text} />
            </div>
            {orderModal.items && orderModal.items.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 6 }}>Productos</p>
                {orderModal.items.map((item: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text }}>
                    <span>{item.name}</span>
                    <span style={{ color: C.text2 }}>{item.qty} {item.unit} · {((item.qty || 0) * (item.price || 0)).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            )}
            {orderModal.notes && <p style={{ fontSize: 13, color: C.text2 }}>📝 {orderModal.notes}</p>}
            {orderModal.call_summary && <p style={{ fontSize: 13, color: C.violet, background: C.violetDim, padding: '8px 12px', borderRadius: 8 }}>📞 {orderModal.call_summary}</p>}
            {orderModal.delivery_date && <p style={{ fontSize: 13, color: C.text2 }}>📅 Entrega prevista: {new Date(orderModal.delivery_date).toLocaleDateString()}</p>}
            {orderModal.delivered_at && <p style={{ fontSize: 13, color: C.green }}>Entregado: {new Date(orderModal.delivered_at).toLocaleDateString()}</p>}
            <p style={{ fontSize: 11, color: C.text3 }}>Creado: {new Date(orderModal.created_at).toLocaleString()}</p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {['draft', 'ordered', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(s => {
                const cfg = ORDER_STATUS_CFG[s]
                return (
                  <button key={s} onClick={() => updateOrderStatus(orderModal.id, s)} style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                    border: `1px solid ${cfg.color}40`, cursor: 'pointer', fontFamily: 'inherit',
                    background: orderModal.status === s ? cfg.bg : 'transparent',
                    color: cfg.color,
                  }}>{cfg.label}</button>
                )
              })}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   TAB COMPONENTS
   ══════════════════════════════════════════════════════════════════════ */

/* ── Suppliers tab ─────────────────────────────────────────────────── */
function SuppliersTab({ suppliers, onEdit, onToggle, onCall, calling }: {
  suppliers: Supplier[]; onEdit: (s: Supplier) => void; onToggle: (s: Supplier) => void; onCall: (id: string) => void; calling: boolean
}) {
  if (suppliers.length === 0) return <EmptyState icon="🏭" title="Sin proveedores" desc="Agrega tu primer proveedor para gestionar inventario y hacer pedidos por llamada." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {suppliers.map(s => (
        <div key={s.id} style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.12s',
          opacity: s.active ? 1 : 0.5,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.surface2; (e.currentTarget as HTMLElement).style.borderColor = C.borderMd }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.surface; (e.currentTarget as HTMLElement).style.borderColor = C.border }}
        >
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: C.tealDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.teal, flexShrink: 0 }}>
            {s.name[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s.name}</p>
            <p style={{ fontSize: 12, color: C.text2, marginTop: 1 }}>
              {s.category && <span style={{ marginRight: 8 }}>{s.category}</span>}
              {s.contact_name && <span style={{ marginRight: 8 }}>· {s.contact_name}</span>}
              {s.phone && <span>· {s.phone}</span>}
            </p>
            {s.products && s.products.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                {s.products.slice(0, 5).map((p, i) => (
                  <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: C.surface2, color: C.text3, border: `1px solid ${C.border}` }}>{p}</span>
                ))}
                {s.products.length > 5 && <span style={{ fontSize: 10, color: C.text3 }}>+{s.products.length - 5}</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {s.phone && (
              <button onClick={() => onCall(s.id)} disabled={calling} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${C.teal}30`, background: C.tealDim, color: C.teal, cursor: calling ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                📞 Llamar
              </button>
            )}
            <button onClick={() => onEdit(s)} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.text3, cursor: 'pointer', fontFamily: 'inherit' }}>
              Editar
            </button>
            <button onClick={() => onToggle(s)} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: s.active ? C.red : C.green, cursor: 'pointer', fontFamily: 'inherit' }}>
              {s.active ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Faltantes tab ─────────────────────────────────────────────────── */
function FaltantesTab({ items, suppliers, cart, onAddToCart, inventory }: {
  items: InventoryItem[]; suppliers: Supplier[]; cart: Record<string, number>; onAddToCart: (id: string, qty: number) => void; inventory: InventoryItem[]
}) {
  if (items.length === 0) return <EmptyState icon="✅" title="Todo en stock" desc="No hay productos por debajo del stock mínimo. Tu inventario esta al dia." />

  const grouped = items.reduce((acc, item) => {
    const cat = item.category || 'Sin categoría'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, InventoryItem[]>)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <StatCard label="Productos bajo stock" value={String(items.length)} color={C.red} icon="⚠️" />
        <StatCard label="Sin stock (0)" value={String(items.filter(i => i.current_stock === 0).length)} color={C.red} icon="🚫" />
        <StatCard label="En lista de pedido" value={String(Object.keys(cart).length)} color={C.amber} icon="🛒" />
      </div>

      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{cat}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {catItems.map(item => {
              const pct = item.max_stock > 0 ? (item.current_stock / item.max_stock) * 100 : 0
              const sup = item.supplier_id ? suppliers.find(s => s.id === item.supplier_id) : null
              const inCart = cart[item.id] || 0
              const suggestedQty = Math.max(1, (item.max_stock || item.min_stock * 2) - item.current_stock)
              return (
                <div key={item.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.name}</p>
                      {sup && <span style={{ fontSize: 10, color: C.text3 }}>({sup.name})</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <div style={{ flex: 1, maxWidth: 120, height: 4, borderRadius: 2, background: C.surface2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 2, background: item.current_stock === 0 ? C.red : C.amber, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: item.current_stock === 0 ? C.red : C.amber }}>
                        {item.current_stock} {item.unit}
                      </span>
                      <span style={{ fontSize: 11, color: C.text3 }}>/ mín {item.min_stock}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {inCart > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => onAddToCart(item.id, inCart - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.amber, minWidth: 28, textAlign: 'center' }}>{inCart}</span>
                        <button onClick={() => onAddToCart(item.id, inCart + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    ) : (
                      <button onClick={() => onAddToCart(item.id, suggestedQty)} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${C.amber}30`, background: C.amberDim, color: C.amber, cursor: 'pointer', fontFamily: 'inherit' }}>
                        + Pedir {suggestedQty} {item.unit}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Pedidos tab ───────────────────────────────────────────────────── */
function PedidosTab({ orders, suppliers, onDetail }: {
  orders: SupplyOrder[]; suppliers: Supplier[]; onDetail: (o: SupplyOrder) => void
}) {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  if (orders.length === 0) return <EmptyState icon="📦" title="Sin pedidos" desc="Cuando crees pedidos a proveedores aparecerán aqui con su estado y detalle." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Status filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>Todos ({orders.length})</FilterBtn>
        {Object.entries(ORDER_STATUS_CFG).map(([key, cfg]) => {
          const count = orders.filter(o => o.status === key).length
          if (count === 0) return null
          return <FilterBtn key={key} active={filter === key} onClick={() => setFilter(key)} color={cfg.color}>{cfg.label} ({count})</FilterBtn>
        })}
      </div>

      {filtered.map(o => {
        const cfg = ORDER_STATUS_CFG[o.status] || ORDER_STATUS_CFG.draft
        const supName = (o as any).suppliers?.name || suppliers.find(s => s.id === o.supplier_id)?.name || 'Proveedor'
        return (
          <div key={o.id} onClick={() => onDetail(o)} style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
            transition: 'all 0.12s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.surface2; (e.currentTarget as HTMLElement).style.borderColor = C.borderMd }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.surface; (e.currentTarget as HTMLElement).style.borderColor = C.border }}
          >
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📦</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{supName}</p>
              <p style={{ fontSize: 12, color: C.text2, marginTop: 1 }}>
                {(o.items || []).length} productos · {o.total?.toFixed(2) || '0.00'} €
                {o.delivery_date && <span> · Entrega: {new Date(o.delivery_date).toLocaleDateString()}</span>}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 8, background: cfg.bg, color: cfg.color, fontWeight: 700, border: `1px solid ${cfg.color}25` }}>{cfg.label}</span>
              <span style={{ fontSize: 11, color: C.text3 }}>{new Date(o.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Llamar tab ────────────────────────────────────────────────────── */
function LlamarTab({ cartItems, suppliers, inventory, cart, onAddToCart, callSupplierId, setCallSupplierId, callNotes, setCallNotes, onCreateOrder, onCall, calling }: {
  cartItems: (InventoryItem & { orderQty: number })[]; suppliers: Supplier[]; inventory: InventoryItem[]
  cart: Record<string, number>; onAddToCart: (id: string, qty: number) => void
  callSupplierId: string | null; setCallSupplierId: (id: string | null) => void
  callNotes: string; setCallNotes: (v: string) => void; onCreateOrder: () => void; onCall: (id: string, orderId?: string) => void; calling: boolean
}) {
  const selectedSup = callSupplierId ? suppliers.find(s => s.id === callSupplierId) : null
  // Items from this supplier's inventory
  const supplierItems = callSupplierId ? inventory.filter(i => i.supplier_id === callSupplierId && i.active) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Step 1: pick supplier */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>1. Selecciona proveedor</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {suppliers.map(s => (
            <button key={s.id} onClick={() => setCallSupplierId(s.id)} style={{
              padding: '8px 14px', fontSize: 12, fontWeight: callSupplierId === s.id ? 700 : 500,
              borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
              border: `1px solid ${callSupplierId === s.id ? C.amber + '60' : C.border}`,
              background: callSupplierId === s.id ? C.amberDim : 'transparent',
              color: callSupplierId === s.id ? C.amber : C.text2,
            }}>
              {s.name}
            </button>
          ))}
        </div>
        {suppliers.length === 0 && <p style={{ fontSize: 13, color: C.text3 }}>Primero agrega proveedores en la pestana de Proveedores.</p>}
      </div>

      {/* Step 2: items */}
      {callSupplierId && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>2. Productos a pedir</p>
          {supplierItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {supplierItems.map(item => {
                const inCart = cart[item.id] || 0
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: inCart > 0 ? C.amberDim : 'transparent', border: `1px solid ${inCart > 0 ? C.amber + '20' : C.border}` }}>
                    <div>
                      <span style={{ fontSize: 13, color: C.text }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: C.text3, marginLeft: 8 }}>Stock: {item.current_stock} {item.unit}</span>
                      {item.price_per_unit > 0 && <span style={{ fontSize: 11, color: C.text3, marginLeft: 8 }}>{item.price_per_unit.toFixed(2)} €/{item.unit}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {inCart > 0 && <button onClick={() => onAddToCart(item.id, inCart - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>}
                      <input type="number" value={inCart || ''} onChange={e => onAddToCart(item.id, Math.max(0, parseInt(e.target.value) || 0))} placeholder="0"
                        style={{ width: 50, textAlign: 'center', padding: '4px', fontSize: 13, fontWeight: 700, border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface2, color: C.amber, fontFamily: 'inherit', outline: 'none' }} />
                      <button onClick={() => onAddToCart(item.id, inCart + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: C.text3 }}>Este proveedor no tiene productos vinculados en inventario. Puedes vincularlos desde la gestion de inventario o agregar notas abajo.</p>
          )}
        </div>
      )}

      {/* Step 3: cart summary + notes */}
      {callSupplierId && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>3. Resumen y notas</p>
          {cartItems.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {cartItems.map(ci => (
                <div key={ci.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: C.text }}>
                  <span>{ci.name} x{ci.orderQty} {ci.unit}</span>
                  <span style={{ color: C.text2 }}>{(ci.orderQty * ci.price_per_unit).toFixed(2)} €</span>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: C.amber }}>
                <span>Total estimado</span>
                <span>{cartItems.reduce((s, ci) => s + ci.orderQty * ci.price_per_unit, 0).toFixed(2)} €</span>
              </div>
            </div>
          )}
          <textarea value={callNotes} onChange={e => setCallNotes(e.target.value)} rows={3} placeholder="Notas adicionales para el pedido o la llamada..."
            style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: `1px solid ${C.borderMd}`, borderRadius: 8, background: C.surface2, color: C.text, fontFamily: 'inherit', outline: 'none', resize: 'vertical', marginBottom: 12 }} />

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCreateOrder} disabled={cartItems.length === 0} style={{
              flex: 1, padding: '10px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none',
              background: cartItems.length > 0 ? C.amber : C.surface2, color: cartItems.length > 0 ? '#0C1018' : C.text3,
              cursor: cartItems.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}>
              Crear pedido
            </button>
            {selectedSup?.phone && (
              <button onClick={() => onCall(callSupplierId!)} disabled={calling} style={{
                flex: 1, padding: '10px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none',
                background: calling ? C.surface2 : `linear-gradient(135deg, ${C.teal}, #1aa89a)`, color: calling ? C.text3 : '#0C1018',
                cursor: calling ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
                {calling ? 'Llamando...' : '📞 Llamar al proveedor'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
   ══════════════════════════════════════════════════════════════════════ */

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose} onKeyDown={e => { if (e.key === 'Escape') onClose() }} tabIndex={-1} ref={el => { if (el) el.focus() }}>
      <div style={{ background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{title}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text3 }} aria-label="Cerrar">x</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '64px 24px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: C.amberDim, border: `1px solid rgba(240,168,78,0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 20px' }}>{icon}</div>
      <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>{desc}</p>
    </div>
  )
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color }}>{value}</p>
    </div>
  )
}

function FormRow({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 4, display: 'block' }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: `1px solid ${C.borderMd}`, borderRadius: 8, background: C.surface2, color: C.text, fontFamily: 'inherit', outline: 'none' }} />
  )
}

function FilterBtn({ children, active, onClick, color }: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', fontSize: 11, fontWeight: active ? 700 : 500, borderRadius: 7,
      border: `1px solid ${active ? (color || C.amber) + '40' : C.border}`,
      background: active ? (color || C.amber) + '15' : 'transparent',
      color: active ? (color || C.amber) : C.text3,
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
    }}>{children}</button>
  )
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: C.text3, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}
