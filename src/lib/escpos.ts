/**
 * ESC/POS command generator for thermal printers.
 * Generates binary data that can be sent via WebUSB, WebBluetooth, or network.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// WebUSB types (not in default TS lib — only available in browsers with WebUSB support)
type USBDevice = any
type USBEndpoint = any

// ESC/POS constants
const ESC = 0x1B
const GS = 0x1D
const LF = 0x0A

export function generateESCPOS(ticket: {
  businessName: string
  items: { name: string; qty: number; price: number }[]
  subtotal: number
  iva: number
  total: number
  table?: string
  zone?: string
  ticketNum?: string
  isKitchen?: boolean
}): Uint8Array {
  const commands: number[] = []

  // Initialize printer
  commands.push(ESC, 0x40) // Reset

  // Center alignment
  commands.push(ESC, 0x61, 0x01)

  // Bold on
  commands.push(ESC, 0x45, 0x01)

  // Business name (double height)
  commands.push(ESC, 0x21, 0x10) // Double height
  commands.push(...encode(ticket.businessName))
  commands.push(LF)

  // Normal size
  commands.push(ESC, 0x21, 0x00)

  if (ticket.isKitchen) {
    // Kitchen ticket — BIG text
    commands.push(ESC, 0x21, 0x30) // Double width + double height
    commands.push(...encode('COCINA'))
    commands.push(LF)
    commands.push(ESC, 0x21, 0x10)
    commands.push(...encode(ticket.table ? `MESA ${ticket.table}` : 'BARRA'))
    if (ticket.zone) {
      commands.push(...encode(` · ${ticket.zone}`))
    }
    commands.push(LF)
  } else {
    // Customer ticket
    if (ticket.table) {
      commands.push(...encode(`Mesa: ${ticket.table}`))
      if (ticket.zone) commands.push(...encode(` · ${ticket.zone}`))
      commands.push(LF)
    }
    if (ticket.ticketNum) {
      commands.push(...encode(`#${ticket.ticketNum}`))
      commands.push(LF)
    }
  }

  // Date/time
  const now = new Date()
  commands.push(...encode(now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })))
  commands.push(LF)

  // Separator
  commands.push(...encode('--------------------------------'))
  commands.push(LF)

  // Left alignment for items
  commands.push(ESC, 0x61, 0x00)
  commands.push(ESC, 0x45, 0x00) // Bold off

  // Items
  for (const item of ticket.items) {
    if (ticket.isKitchen) {
      // Kitchen: just qty x name, bold, bigger
      commands.push(ESC, 0x45, 0x01)
      commands.push(...encode(`${item.qty}x ${item.name}`))
      commands.push(ESC, 0x45, 0x00)
    } else {
      // Customer: qty x name ... price
      const line = `${item.qty}x ${item.name}`
      const price = `${(item.price * item.qty).toFixed(2)}\u20AC`
      const spaces = Math.max(1, 32 - line.length - price.length)
      commands.push(...encode(line + ' '.repeat(spaces) + price))
    }
    commands.push(LF)
  }

  if (!ticket.isKitchen) {
    // Separator
    commands.push(...encode('--------------------------------'))
    commands.push(LF)

    // Totals
    commands.push(...encode(padLine('Subtotal', `${ticket.subtotal.toFixed(2)}\u20AC`)))
    commands.push(LF)
    commands.push(...encode(padLine('IVA 21%', `${ticket.iva.toFixed(2)}\u20AC`)))
    commands.push(LF)
    commands.push(...encode('--------------------------------'))
    commands.push(LF)

    // Total — bold, bigger
    commands.push(ESC, 0x45, 0x01)
    commands.push(ESC, 0x21, 0x10) // Double height
    commands.push(...encode(padLine('TOTAL', `${ticket.total.toFixed(2)}\u20AC`)))
    commands.push(LF)
    commands.push(ESC, 0x21, 0x00)
    commands.push(ESC, 0x45, 0x00)

    // Footer
    commands.push(LF)
    commands.push(ESC, 0x61, 0x01) // Center
    commands.push(...encode('Gracias por su visita'))
    commands.push(LF)
    commands.push(...encode('Powered by Reservo.AI'))
    commands.push(LF)
  }

  // Cut paper
  commands.push(LF, LF, LF)
  commands.push(GS, 0x56, 0x00) // Full cut

  return new Uint8Array(commands)
}

function encode(text: string): number[] {
  return Array.from(new TextEncoder().encode(text))
}

function padLine(left: string, right: string): string {
  const spaces = Math.max(1, 32 - left.length - right.length)
  return left + ' '.repeat(spaces) + right
}

// WebUSB printer connection
export async function connectUSBPrinter(): Promise<USBDevice | null> {
  try {
    const nav = navigator as any
    const device = await nav.usb.requestDevice({
      filters: [{ classCode: 7 }] // Printer class
    })
    await device.open()
    await device.selectConfiguration(1)
    await device.claimInterface(0)
    return device
  } catch {
    return null
  }
}

export async function printToUSB(device: USBDevice, data: Uint8Array): Promise<boolean> {
  try {
    const endpoint = device.configuration?.interfaces[0]?.alternate?.endpoints.find(
      (e: USBEndpoint) => e.direction === 'out'
    )
    if (!endpoint) return false
    await device.transferOut(endpoint.endpointNumber, data)
    return true
  } catch {
    return false
  }
}

// Network printer (raw TCP via fetch to a local print server)
export async function printToNetwork(ip: string, port: number, data: Uint8Array): Promise<boolean> {
  try {
    const res = await fetch(`http://${ip}:${port}/print`, {
      method: 'POST',
      body: data as unknown as BodyInit,
    })
    return res.ok
  } catch {
    return false
  }
}
