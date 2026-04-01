/**
 * Kitchen Ticket Generation & Printing
 * Shared between TPV and Cocina pages.
 */

export interface TicketItem {
  name: string
  quantity?: number
  qty?: number
  notes?: string
}

/**
 * Print HTML content via hidden iframe (browser print dialog).
 * Works with any configured printer (including thermal 80mm).
 */
export function printTicket(html: string) {
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

/**
 * Generate a kitchen ticket (comanda) HTML for 80mm thermal printer.
 */
export function generateKitchenTicket(params: {
  items: TicketItem[]
  table: string | null
  zone?: string | null
  notes?: string
  orderNum?: string
  customerName?: string
}): string {
  const { items, table, zone, notes, orderNum, customerName } = params
  const now = new Date()
  const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })

  const num = orderNum || String(Date.now()).slice(-4)

  return `<!DOCTYPE html><html><head><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; width: 300px; margin: 0 auto; padding: 16px; font-size: 14px; }
    .header { text-align: center; padding: 12px; margin-bottom: 12px; background: #111; color: #fff; border-radius: 8px; }
    .header h1 { font-size: 22px; letter-spacing: 4px; font-weight: 900; }
    .header .order-num { font-size: 28px; font-weight: 900; margin-top: 8px; letter-spacing: 2px; }
    .header .loc { font-size: 16px; font-weight: 700; margin-top: 6px; }
    .header .time { font-size: 12px; opacity: 0.7; margin-top: 2px; }
    .customer { text-align: center; font-size: 13px; color: #666; margin-bottom: 8px; }
    .items { margin: 12px 0; }
    .item { font-size: 16px; font-weight: 700; padding: 8px 0; border-bottom: 1px dashed #ccc; display: flex; gap: 8px; align-items: flex-start; }
    .item-qty { background: #222; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 14px; flex-shrink: 0; }
    .item-notes { font-size: 12px; font-weight: 400; color: #c60; font-style: italic; margin-top: 2px; }
    .notes { background: #fff3cd; padding: 10px; border-radius: 6px; margin-top: 8px; font-size: 13px; border-left: 4px solid #ffc107; }
    .notes-label { font-weight: 700; font-size: 11px; text-transform: uppercase; color: #856404; margin-bottom: 4px; }
    .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #999; }
    @media print { body { width: 80mm; } }
  </style></head><body>
    <div class="header">
      <h1>\uD83C\uDF73 COCINA</h1>
      <div class="order-num">COMANDA #${num}</div>
      <div class="loc">${table ? 'MESA ' + table : 'BARRA'}${zone ? ' \u00B7 ' + zone : ''}</div>
      <div class="time">${time} \u00B7 ${date}</div>
    </div>
    ${customerName && customerName !== 'TPV' && customerName !== 'QR' ? `<div class="customer">${customerName}</div>` : ''}
    <div class="items">
      ${items.map(i => {
        const q = i.qty || i.quantity || 1
        return `<div class="item"><span class="item-qty">${q}x</span><div><span>${i.name}</span>${i.notes ? `<div class="item-notes">\u26A0 ${i.notes}</div>` : ''}</div></div>`
      }).join('')}
    </div>
    ${notes ? `<div class="notes"><div class="notes-label">\u26A0 Notas</div>${notes}</div>` : ''}
    <div class="footer">${now.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' })} ${time}</div>
  </body></html>`
}

/**
 * Parse order notes to separate metadata from real customer notes.
 * Notes format: "Mesa: 5 | Contexto: comer | Sin cebolla | Alergico a frutos secos"
 * Returns: { mesa, contexto, customerNotes }
 */
export function parseOrderNotes(notes: string | null): {
  mesa: string | null
  contexto: string | null
  customerNotes: string
} {
  if (!notes) return { mesa: null, contexto: null, customerNotes: '' }
  const parts = notes.split('|').map(p => p.trim())
  let mesa: string | null = null
  let contexto: string | null = null
  const realNotes: string[] = []

  for (const part of parts) {
    if (part.startsWith('Mesa:')) {
      mesa = part.replace('Mesa:', '').trim()
    } else if (part.startsWith('Contexto:')) {
      contexto = part.replace('Contexto:', '').trim()
    } else if (part === 'Pedido QR' || part === 'TPV - aparcado') {
      // skip metadata
    } else if (part) {
      realNotes.push(part)
    }
  }

  return { mesa, contexto, customerNotes: realNotes.join(' | ') }
}
