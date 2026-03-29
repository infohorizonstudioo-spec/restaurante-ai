'use client'
import { UpgradeGate } from '@/components/UpgradeGate'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'
import {
  type CajaShift,
  type CajaDaySummary,
  calculateShiftTotals,
  generateDaySummary,
  generateShiftId,
  getShiftLabel,
  getShiftName,
  getShiftIcon,
  formatCurrency,
  formatTime,
} from '@/lib/caja-engine'

/* ── Local storage key ───────────────────────────────────────────── */
const LS_KEY = (tid: string) => `reservo_caja_shifts_${tid}`

function loadShifts(tenantId: string): CajaShift[] {
  try {
    const raw = localStorage.getItem(LS_KEY(tenantId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveShifts(tenantId: string, shifts: CajaShift[]) {
  localStorage.setItem(LS_KEY(tenantId), JSON.stringify(shifts))
}

/* ── Main component ──────────────────────────────────────────────── */
export default function CajaPage() {
  const { tenant, template, t } = useTenant()
  const [plan, setPlan] = useState<string>('free')
  const [loading, setLoading] = useState(true)
  const [tid, setTid] = useState<string | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [shifts, setShifts] = useState<CajaShift[]>([])
  const [openShift, setOpenShift] = useState<CajaShift | null>(null)
  const [tab, setTab] = useState<'turno' | 'dia'>('turno')

  // Modal state
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [openCash, setOpenCash] = useState('')
  const [openName, setOpenName] = useState('')
  const [closeCash, setCloseCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')

  // Staff list for selector
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([])

  /* ── Load data ─────────────────────────────────────────────────── */
  const loadOrders = useCallback(async (tenantId: string) => {
    const r = await fetch('/api/orders?tenant_id=' + tenantId + '&limit=100')
    const d = await r.json()
    setOrders(d.orders || [])
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
      if (!p?.tenant_id) { setLoading(false); return }

      const { data: tData } = await supabase.from('tenants').select('plan, staff_schedule').eq('id', p.tenant_id).maybeSingle()
      setPlan(tData?.plan || 'free')
      setTid(p.tenant_id)

      // Load staff from staff_schedule
      const staffData = tData?.staff_schedule || {}
      const employees: { id: string; name: string; role: string }[] = staffData.employees || []
      setStaff(employees.map(e => ({ id: e.id, name: e.name })))

      // Load shifts from localStorage
      const savedShifts = loadShifts(p.tenant_id)
      setShifts(savedShifts)

      // Find currently open shift
      const open = savedShifts.find(s => s.status === 'open')
      if (open) setOpenShift(open)

      await loadOrders(p.tenant_id)
      setLoading(false)
    })()
  }, [loadOrders])

  /* ── Realtime orders ───────────────────────────────────────────── */
  useEffect(() => {
    if (!tid) return
    const ch = supabase.channel(`caja-orders-${tid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_events', filter: `tenant_id=eq.${tid}` }, () => {
        loadOrders(tid)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tid, loadOrders])

  /* ── Shift orders (filtered by shift time) ─────────────────────── */
  const shiftOrders = openShift
    ? orders.filter(o => {
        const created = new Date(o.created_at).getTime()
        const shiftStart = new Date(openShift.opened_at).getTime()
        return created >= shiftStart
      })
    : []

  const shiftTotals = calculateShiftTotals(shiftOrders)
  const ticketMedio = shiftTotals.orders_count > 0
    ? shiftTotals.total_sales / shiftTotals.orders_count
    : 0

  /* ── Today's orders ────────────────────────────────────────────── */
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayOrders = orders.filter(o => (o.created_at || '').slice(0, 10) === todayStr)
  const todayShifts = shifts.filter(s => (s.opened_at || '').slice(0, 10) === todayStr)
  const daySummary: CajaDaySummary = generateDaySummary(
    openShift ? [...todayShifts.filter(s => s.id !== openShift.id), { ...openShift, ...shiftTotals }] : todayShifts,
    todayOrders
  )

  /* ── Open shift ────────────────────────────────────────────────── */
  function handleOpenShift() {
    if (!tid) return
    const now = new Date().toISOString()
    const shift: CajaShift = {
      id: generateShiftId(),
      tenant_id: tid,
      opened_by: openName || 'Sistema',
      opened_at: now,
      closed_at: null,
      initial_cash: parseFloat(openCash) || 0,
      total_sales: 0,
      total_cash: 0,
      total_card: 0,
      total_other: 0,
      orders_count: 0,
      counted_cash: null,
      difference: null,
      notes: null,
      status: 'open',
    }
    const updated = [...shifts, shift]
    setShifts(updated)
    setOpenShift(shift)
    saveShifts(tid, updated)
    setShowOpenModal(false)
    setOpenCash('')
    setOpenName('')
  }

  /* ── Close shift ───────────────────────────────────────────────── */
  function handleCloseShift() {
    if (!tid || !openShift) return
    const counted = parseFloat(closeCash) || 0
    const expectedCash = openShift.initial_cash + shiftTotals.total_cash
    const closed: CajaShift = {
      ...openShift,
      ...shiftTotals,
      closed_at: new Date().toISOString(),
      counted_cash: counted,
      difference: Math.round((counted - expectedCash) * 100) / 100,
      notes: closeNotes || null,
      status: 'closed',
    }
    const updated = shifts.map(s => s.id === closed.id ? closed : s)
    setShifts(updated)
    setOpenShift(null)
    saveShifts(tid, updated)
    setShowCloseModal(false)
    setCloseCash('')
    setCloseNotes('')
  }

  /* ── Render ────────────────────────────────────────────────────── */
  if (loading) return <PageLoader />

  // Gate: only hospitality (has orders)
  if (template && !template.hasOrders) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Modulo no disponible</h3>
          <p style={{ fontSize: 14, color: C.text2 }}>La caja esta disponible para negocios de hosteleria.</p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const currentShiftLabel = getShiftLabel(now.getHours())
  const currentShiftName = getShiftName(now.getHours())
  const shiftIcon = getShiftIcon(currentShiftName)

  return (
    <UpgradeGate feature="pedidos">
      <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>
              Caja
            </h1>
            <p style={{ fontSize: 13, color: C.text2, margin: '4px 0 0' }}>
              {shiftIcon} {currentShiftLabel}
              {openShift && (
                <span style={{ color: C.green, marginLeft: 8 }}>
                  Abierto desde {formatTime(openShift.opened_at)}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <NotifBell />
            {!openShift ? (
              <button
                onClick={() => setShowOpenModal(true)}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${C.green}, #22B88A)`,
                  color: '#0C1018', fontSize: 14, fontWeight: 700,
                }}
              >
                Abrir turno
              </button>
            ) : (
              <button
                onClick={() => setShowCloseModal(true)}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${C.red}, #E05252)`,
                  color: '#fff', fontSize: 14, fontWeight: 700,
                }}
              >
                Cerrar turno
              </button>
            )}
          </div>
        </div>

        {/* ── Tab toggle ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.surface, borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {(['turno', 'dia'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: tab === t ? C.surface2 : 'transparent',
                color: tab === t ? C.text : C.text3,
                fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              }}
            >
              {t === 'turno' ? 'Turno actual' : 'Resumen del dia'}
            </button>
          ))}
        </div>

        {/* ── TURNO ACTUAL ───────────────────────────────────────── */}
        {tab === 'turno' && (
          <>
            {!openShift ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '64px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>No hay turno abierto</h3>
                <p style={{ fontSize: 14, color: C.text2, marginBottom: 20 }}>
                  Abre un turno para comenzar a registrar ventas.
                </p>
                <button
                  onClick={() => setShowOpenModal(true)}
                  style={{
                    padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${C.green}, #22B88A)`,
                    color: '#0C1018', fontSize: 14, fontWeight: 700,
                  }}
                >
                  Abrir turno
                </button>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                  <KPICard label="Total ventas" value={`${formatCurrency(shiftTotals.total_sales)} EUR`} color={C.amber} big />
                  <KPICard label="Pedidos" value={String(shiftTotals.orders_count)} color={C.blue} />
                  <KPICard label="Ticket medio" value={`${formatCurrency(ticketMedio)} EUR`} color={C.teal} />
                  <KPICard label="Efectivo" value={`${formatCurrency(shiftTotals.total_cash)} EUR`} color={C.green} />
                  <KPICard label="Tarjeta" value={`${formatCurrency(shiftTotals.total_card)} EUR`} color={C.violet} />
                </div>

                {/* Recent orders */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>
                    Pedidos del turno ({shiftOrders.length})
                  </h3>
                  {shiftOrders.length === 0 ? (
                    <p style={{ fontSize: 13, color: C.text3, textAlign: 'center', padding: '20px 0' }}>
                      Sin pedidos en este turno todavia.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {shiftOrders.slice(0, 10).map((o: any) => (
                        <div key={o.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: C.surface2, borderRadius: 10, padding: '10px 14px',
                        }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                              {o.customer_name || 'Cliente'}
                            </span>
                            <span style={{ fontSize: 12, color: C.text3, marginLeft: 8 }}>
                              {formatTime(o.created_at)}
                            </span>
                            {o.order_type && (
                              <span style={{ fontSize: 11, color: C.text3, marginLeft: 8 }}>
                                {o.order_type === 'mesa' ? '🍽️' : o.order_type === 'domicilio' ? '🛵' : '🥡'}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <StatusBadge status={o.status} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                              {formatCurrency(parseFloat(o.total_estimate) || 0)} EUR
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── RESUMEN DEL DIA ────────────────────────────────────── */}
        {tab === 'dia' && (
          <>
            {/* Day KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <KPICard label="Ventas del dia" value={`${formatCurrency(daySummary.total_sales)} EUR`} color={C.amber} big />
              <KPICard label="Pedidos del dia" value={String(daySummary.total_orders)} color={C.blue} />
              <KPICard
                label="Turnos completados"
                value={String(todayShifts.filter(s => s.status === 'closed').length)}
                color={C.teal}
              />
            </div>

            {/* Shifts list */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>Turnos de hoy</h3>
              {todayShifts.length === 0 ? (
                <p style={{ fontSize: 13, color: C.text3, textAlign: 'center', padding: '20px 0' }}>
                  No hay turnos registrados hoy.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todayShifts.map(s => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: C.surface2, borderRadius: 10, padding: '12px 14px', flexWrap: 'wrap', gap: 8,
                    }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                          {s.opened_by}
                        </span>
                        <span style={{ fontSize: 12, color: C.text3, marginLeft: 8 }}>
                          {formatTime(s.opened_at)} - {s.closed_at ? formatTime(s.closed_at) : 'Abierto'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: 12, color: C.text2 }}>{s.orders_count} pedidos</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>
                          {formatCurrency(s.total_sales)} EUR
                        </span>
                        {s.status === 'open' ? (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${C.green}18`, color: C.green, fontWeight: 600 }}>Abierto</span>
                        ) : (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${C.text3}18`, color: C.text3, fontWeight: 600 }}>Cerrado</span>
                        )}
                        {s.difference != null && (
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 600,
                            background: s.difference >= 0 ? `${C.green}18` : `${C.red}18`,
                            color: s.difference >= 0 ? C.green : C.red,
                          }}>
                            {s.difference >= 0 ? '+' : ''}{formatCurrency(s.difference)} EUR
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top products */}
            {daySummary.top_products.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>Productos mas vendidos</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {daySummary.top_products.slice(0, 5).map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 13, color: C.text }}>{p.name}</span>
                        <span style={{ fontSize: 13, color: C.text2 }}>{p.quantity}x &middot; {formatCurrency(p.total)} EUR</span>
                      </div>
                    ))}
                  </div>
                </div>

                {daySummary.top_categories.length > 0 && (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>Categorias</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {daySummary.top_categories.slice(0, 5).map((c, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 13, color: C.text }}>{c.name}</span>
                          <span style={{ fontSize: 13, color: C.text2 }}>{formatCurrency(c.total)} EUR</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── OPEN SHIFT MODAL ───────────────────────────────────── */}
        {showOpenModal && (
          <Modal onClose={() => setShowOpenModal(false)}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Abrir turno</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: C.text2, display: 'block', marginBottom: 6 }}>Empleado</label>
              {staff.length > 0 ? (
                <select
                  value={openName}
                  onChange={e => setOpenName(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                    background: C.surface2, color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
                  }}
                >
                  <option value="">Seleccionar...</option>
                  {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  <option value="Sistema">Sistema</option>
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Nombre del empleado"
                  value={openName}
                  onChange={e => setOpenName(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                    background: C.surface2, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: C.text2, display: 'block', marginBottom: 6 }}>Efectivo inicial en caja (EUR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={openCash}
                onChange={e => setOpenCash(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                  background: C.surface2, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={handleOpenShift}
              disabled={!openName}
              style={{
                width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: openName ? 'pointer' : 'not-allowed',
                background: openName ? `linear-gradient(135deg, ${C.green}, #22B88A)` : C.surface2,
                color: openName ? '#0C1018' : C.text3, fontSize: 14, fontWeight: 700,
                opacity: openName ? 1 : 0.5,
              }}
            >
              Abrir turno
            </button>
          </Modal>
        )}

        {/* ── CLOSE SHIFT MODAL ──────────────────────────────────── */}
        {showCloseModal && openShift && (
          <Modal onClose={() => setShowCloseModal(false)}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Cerrar turno</h2>

            {/* Summary */}
            <div style={{ background: C.surface2, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: C.text2 }}>Total ventas</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{formatCurrency(shiftTotals.total_sales)} EUR</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: C.text2 }}>Pedidos</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{shiftTotals.orders_count}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: C.text2 }}>Efectivo (ventas)</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.green }}>{formatCurrency(shiftTotals.total_cash)} EUR</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: C.text2 }}>Tarjeta</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.violet }}>{formatCurrency(shiftTotals.total_card)} EUR</span>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: C.text2 }}>Efectivo esperado en caja</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  {formatCurrency(openShift.initial_cash + shiftTotals.total_cash)} EUR
                </span>
              </div>
            </div>

            {/* Counted cash input */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: C.text2, display: 'block', marginBottom: 6 }}>Efectivo contado en caja (EUR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={closeCash}
                onChange={e => setCloseCash(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                  background: C.surface2, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Difference */}
            {closeCash && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 14,
                background: getDiffBg(parseFloat(closeCash) - (openShift.initial_cash + shiftTotals.total_cash)),
              }}>
                <span style={{
                  fontSize: 14, fontWeight: 700,
                  color: getDiffColor(parseFloat(closeCash) - (openShift.initial_cash + shiftTotals.total_cash)),
                }}>
                  Diferencia: {getDiffSign(parseFloat(closeCash) - (openShift.initial_cash + shiftTotals.total_cash))}
                  {formatCurrency(Math.abs(parseFloat(closeCash) - (openShift.initial_cash + shiftTotals.total_cash)))} EUR
                </span>
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: C.text2, display: 'block', marginBottom: 6 }}>Notas (opcional)</label>
              <textarea
                placeholder="Observaciones del turno..."
                value={closeNotes}
                onChange={e => setCloseNotes(e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                  background: C.surface2, color: C.text, fontSize: 14, outline: 'none', resize: 'vertical',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={handleCloseShift}
              style={{
                width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${C.red}, #E05252)`,
                color: '#fff', fontSize: 14, fontWeight: 700,
              }}
            >
              Confirmar cierre
            </button>
          </Modal>
        )}
      </div>
    </UpgradeGate>
  )
}

/* ── Sub-components ──────────────────────────────────────────────── */

function KPICard({ label, value, color, big }: { label: string; value: string; color: string; big?: boolean }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: big ? '20px 20px' : '16px 18px',
    }}>
      <div style={{ fontSize: 12, color: C.text2, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: big ? 28 : 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    collecting: C.yellow, confirmed: C.blue, preparing: C.amber,
    ready: C.green, delivered: C.teal, cancelled: C.red,
  }
  const labels: Record<string, string> = {
    collecting: 'Tomando', confirmed: 'Confirmado', preparing: 'Preparando',
    ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado',
  }
  const c = colors[status] || C.text3
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 6,
      background: `${c}18`, color: c, fontWeight: 600,
    }}>
      {labels[status] || status}
    </span>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
          padding: '24px', width: '100%', maxWidth: 440,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ── Difference helpers ──────────────────────────────────────────── */

function getDiffColor(diff: number): string {
  if (diff > 0.01) return C.green
  if (diff < -0.01) return C.red
  return C.text
}

function getDiffBg(diff: number): string {
  if (diff > 0.01) return `${C.green}12`
  if (diff < -0.01) return `${C.red}12`
  return C.surface2
}

function getDiffSign(diff: number): string {
  if (diff > 0.01) return '+'
  if (diff < -0.01) return '-'
  return ''
}
