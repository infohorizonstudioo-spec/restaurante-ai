/**
 * Shift & Day Report Generator — Professional print-ready HTML
 */

import type { CajaShift, CajaDaySummary } from './caja-engine'
import { formatCurrency } from './caja-engine'

interface ReportParams {
  businessName: string
  logoUrl?: string
}

/**
 * Generate a print-ready HTML report for a single shift.
 */
export function generateShiftReport(
  shift: CajaShift,
  orders: any[],
  employees: string[],
  params: ReportParams
): string {
  const openDate = new Date(shift.opened_at)
  const closeDate = shift.closed_at ? new Date(shift.closed_at) : null
  const dateStr = openDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const openTime = openDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const closeTime = closeDate?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) || 'En curso'

  const ticketMedio = shift.orders_count > 0 ? shift.total_sales / shift.orders_count : 0

  // Top products from orders
  const productMap: Record<string, { qty: number; total: number }> = {}
  for (const o of orders.filter(o => o.status !== 'cancelled')) {
    for (const item of (o.items || [])) {
      const name = item.name || 'Producto'
      const qty = item.quantity || item.qty || 1
      const price = (item.price || 0) * qty
      if (!productMap[name]) productMap[name] = { qty: 0, total: 0 }
      productMap[name].qty += qty
      productMap[name].total += price
    }
  }
  const topProducts = Object.entries(productMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 32px; color: #1a1a1a; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; font-weight: 800; }
    .header .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
    .logo { max-height: 48px; max-width: 160px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 8px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .kpi { background: #f8f8f8; border-radius: 8px; padding: 12px; text-align: center; }
    .kpi-value { font-size: 22px; font-weight: 800; }
    .kpi-label { font-size: 10px; color: #888; margin-top: 2px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #e0e0e0; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    .text-right { text-align: right; }
    .text-mono { font-family: 'Courier New', monospace; }
    .diff-ok { color: #16a34a; }
    .diff-bad { color: #dc2626; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #999; text-align: center; }
    @media print { body { padding: 16px; } }
  </style></head><body>
    <div class="header">
      <div>
        <h1>${params.businessName}</h1>
        <div class="subtitle">Resumen del turno \u2014 ${dateStr}</div>
        <div class="subtitle">${openTime} \u2192 ${closeTime} \u00b7 Abierto por: ${shift.opened_by}</div>
      </div>
      ${params.logoUrl ? `<img src="${params.logoUrl}" class="logo" alt=""/>` : ''}
    </div>

    ${employees.length > 0 ? `
    <div class="section">
      <div class="section-title">Equipo en turno</div>
      <p style="font-size:13px">${employees.join(', ')}</p>
    </div>
    ` : ''}

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-value text-mono">${formatCurrency(shift.total_sales)}\u20AC</div><div class="kpi-label">Total ventas</div></div>
      <div class="kpi"><div class="kpi-value">${shift.orders_count}</div><div class="kpi-label">Tickets</div></div>
      <div class="kpi"><div class="kpi-value text-mono">${formatCurrency(ticketMedio)}\u20AC</div><div class="kpi-label">Ticket medio</div></div>
      <div class="kpi"><div class="kpi-value text-mono">${formatCurrency(shift.total_cash)}\u20AC</div><div class="kpi-label">Efectivo</div></div>
    </div>

    <div class="section">
      <div class="section-title">Desglose de pagos</div>
      <table>
        <tr><td>Efectivo</td><td class="text-right text-mono">${formatCurrency(shift.total_cash)}\u20AC</td></tr>
        <tr><td>Tarjeta</td><td class="text-right text-mono">${formatCurrency(shift.total_card)}\u20AC</td></tr>
        ${shift.total_other > 0 ? `<tr><td>Otros</td><td class="text-right text-mono">${formatCurrency(shift.total_other)}\u20AC</td></tr>` : ''}
        <tr style="font-weight:700;border-top:2px solid #1a1a1a"><td>Total</td><td class="text-right text-mono">${formatCurrency(shift.total_sales)}\u20AC</td></tr>
      </table>
    </div>

    ${shift.status === 'closed' && shift.counted_cash != null ? `
    <div class="section">
      <div class="section-title">Arqueo de caja</div>
      <table>
        <tr><td>Caja inicial</td><td class="text-right text-mono">${formatCurrency(shift.initial_cash)}\u20AC</td></tr>
        <tr><td>Ventas en efectivo</td><td class="text-right text-mono">+${formatCurrency(shift.total_cash)}\u20AC</td></tr>
        <tr><td>Caja esperada</td><td class="text-right text-mono">${formatCurrency(shift.initial_cash + shift.total_cash)}\u20AC</td></tr>
        <tr><td>Caja contada</td><td class="text-right text-mono">${formatCurrency(shift.counted_cash!)}\u20AC</td></tr>
        <tr style="font-weight:700;border-top:2px solid #1a1a1a"><td>Diferencia</td><td class="text-right text-mono ${(shift.difference || 0) >= 0 ? 'diff-ok' : 'diff-bad'}">${(shift.difference || 0) >= 0 ? '+' : ''}${formatCurrency(shift.difference || 0)}\u20AC</td></tr>
      </table>
    </div>
    ` : ''}

    ${topProducts.length > 0 ? `
    <div class="section">
      <div class="section-title">Productos m\u00e1s vendidos</div>
      <table>
        <thead><tr><th>Producto</th><th class="text-right">Cantidad</th><th class="text-right">Total</th></tr></thead>
        <tbody>${topProducts.map(p => `<tr><td>${p.name}</td><td class="text-right">${p.qty}</td><td class="text-right text-mono">${formatCurrency(p.total)}\u20AC</td></tr>`).join('')}</tbody>
      </table>
    </div>
    ` : ''}

    ${shift.notes ? `<div class="section"><div class="section-title">Notas</div><p>${shift.notes}</p></div>` : ''}

    <div class="footer">
      Generado el ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} \u00b7 ${params.businessName} \u00b7 Powered by Reservo.AI
    </div>
  </body></html>`
}

/**
 * Generate a print-ready HTML report for the full day.
 */
export function generateDayReport(
  summary: CajaDaySummary,
  params: ReportParams
): string {
  const dateStr = new Date(summary.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const ticketMedio = summary.total_orders > 0 ? summary.total_sales / summary.total_orders : 0
  const totalCash = summary.shifts.reduce((s, sh) => s + sh.total_cash, 0)
  const totalCard = summary.shifts.reduce((s, sh) => s + sh.total_card, 0)

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 32px; color: #1a1a1a; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; font-weight: 800; }
    .header .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
    .logo { max-height: 48px; max-width: 160px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 8px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .kpi { background: #f8f8f8; border-radius: 8px; padding: 12px; text-align: center; }
    .kpi-value { font-size: 22px; font-weight: 800; }
    .kpi-label { font-size: 10px; color: #888; margin-top: 2px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #e0e0e0; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    .text-right { text-align: right; }
    .text-mono { font-family: 'Courier New', monospace; }
    .diff-ok { color: #16a34a; }
    .diff-bad { color: #dc2626; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #999; text-align: center; }
    @media print { body { padding: 16px; } .no-print { display: none; } }
  </style></head><body>
    <div class="header">
      <div>
        <h1>${params.businessName}</h1>
        <div class="subtitle">Resumen del d\u00eda \u2014 ${dateStr}</div>
      </div>
      ${params.logoUrl ? `<img src="${params.logoUrl}" class="logo" alt=""/>` : ''}
    </div>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-value text-mono">${formatCurrency(summary.total_sales)}\u20AC</div><div class="kpi-label">Total ventas</div></div>
      <div class="kpi"><div class="kpi-value">${summary.total_orders}</div><div class="kpi-label">Tickets</div></div>
      <div class="kpi"><div class="kpi-value text-mono">${formatCurrency(ticketMedio)}\u20AC</div><div class="kpi-label">Ticket medio</div></div>
      <div class="kpi"><div class="kpi-value">${summary.shifts.length}</div><div class="kpi-label">Turnos</div></div>
    </div>

    <div class="section">
      <div class="section-title">Desglose de pagos</div>
      <table>
        <tr><td>Efectivo</td><td class="text-right text-mono">${formatCurrency(totalCash)}\u20AC</td></tr>
        <tr><td>Tarjeta</td><td class="text-right text-mono">${formatCurrency(totalCard)}\u20AC</td></tr>
        <tr style="font-weight:700;border-top:2px solid #1a1a1a"><td>Total</td><td class="text-right text-mono">${formatCurrency(summary.total_sales)}\u20AC</td></tr>
      </table>
    </div>

    ${summary.shifts.length > 0 ? `
    <div class="section">
      <div class="section-title">Turnos del d\u00eda</div>
      <table>
        <thead><tr><th>Turno</th><th>Abierto por</th><th class="text-right">Ventas</th><th class="text-right">Tickets</th><th class="text-right">Arqueo</th></tr></thead>
        <tbody>${summary.shifts.map(sh => {
          const open = new Date(sh.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          const close = sh.closed_at ? new Date(sh.closed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '...'
          const diff = sh.difference != null ? `${sh.difference >= 0 ? '+' : ''}${formatCurrency(sh.difference)}\u20AC` : '\u2014'
          const diffClass = sh.difference != null ? (sh.difference >= 0 ? 'diff-ok' : 'diff-bad') : ''
          return `<tr><td>${open} \u2192 ${close}</td><td>${sh.opened_by}</td><td class="text-right text-mono">${formatCurrency(sh.total_sales)}\u20AC</td><td class="text-right">${sh.orders_count}</td><td class="text-right text-mono ${diffClass}">${diff}</td></tr>`
        }).join('')}</tbody>
      </table>
    </div>
    ` : ''}

    ${summary.top_products.length > 0 ? `
    <div class="section">
      <div class="section-title">Productos m\u00e1s vendidos</div>
      <table>
        <thead><tr><th>Producto</th><th class="text-right">Uds.</th><th class="text-right">Total</th></tr></thead>
        <tbody>${summary.top_products.map(p => `<tr><td>${p.name}</td><td class="text-right">${p.quantity}</td><td class="text-right text-mono">${formatCurrency(p.total)}\u20AC</td></tr>`).join('')}</tbody>
      </table>
    </div>
    ` : ''}

    ${summary.top_categories.length > 0 ? `
    <div class="section">
      <div class="section-title">Ventas por categor\u00eda</div>
      <table>
        <thead><tr><th>Categor\u00eda</th><th class="text-right">Total</th></tr></thead>
        <tbody>${summary.top_categories.map(c => `<tr><td>${c.name}</td><td class="text-right text-mono">${formatCurrency(c.total)}\u20AC</td></tr>`).join('')}</tbody>
      </table>
    </div>
    ` : ''}

    <div class="footer">
      Generado el ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} \u00b7 ${params.businessName} \u00b7 Powered by Reservo.AI
    </div>
  </body></html>`
}
