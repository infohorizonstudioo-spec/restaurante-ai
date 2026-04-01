import { describe, it, expect } from 'vitest'
import { parseOrderNotes, generateKitchenTicket } from '../kitchen-ticket'

describe('kitchen-ticket', () => {
  describe('parseOrderNotes', () => {
    it('separates mesa from customer notes', () => {
      const result = parseOrderNotes('Mesa: 5 | Contexto: comer | Sin cebolla | Alergico a frutos secos')
      expect(result.mesa).toBe('5')
      expect(result.contexto).toBe('comer')
      expect(result.customerNotes).toBe('Sin cebolla | Alergico a frutos secos')
    })

    it('handles null notes', () => {
      const result = parseOrderNotes(null)
      expect(result.mesa).toBeNull()
      expect(result.contexto).toBeNull()
      expect(result.customerNotes).toBe('')
    })

    it('handles notes without metadata', () => {
      const result = parseOrderNotes('Sin gluten por favor')
      expect(result.mesa).toBeNull()
      expect(result.customerNotes).toBe('Sin gluten por favor')
    })

    it('handles Pedido QR metadata', () => {
      const result = parseOrderNotes('Mesa: 3 | Pedido QR')
      expect(result.mesa).toBe('3')
      expect(result.customerNotes).toBe('')
    })

    it('handles only metadata', () => {
      const result = parseOrderNotes('Mesa: 7 | Contexto: cenar')
      expect(result.mesa).toBe('7')
      expect(result.contexto).toBe('cenar')
      expect(result.customerNotes).toBe('')
    })
  })

  describe('generateKitchenTicket', () => {
    it('generates HTML with table number', () => {
      const html = generateKitchenTicket({
        items: [{ name: 'Hamburguesa', qty: 2 }],
        table: '5',
        zone: 'Terraza',
      })
      expect(html).toContain('MESA 5')
      expect(html).toContain('Terraza')
      expect(html).toContain('2x')
      expect(html).toContain('Hamburguesa')
    })

    it('shows BARRA when no table', () => {
      const html = generateKitchenTicket({
        items: [{ name: 'Cerveza', quantity: 1 }],
        table: null,
      })
      expect(html).toContain('BARRA')
    })

    it('includes notes', () => {
      const html = generateKitchenTicket({
        items: [{ name: 'Ensalada', qty: 1 }],
        table: '3',
        notes: 'Sin cebolla',
      })
      expect(html).toContain('Sin cebolla')
    })

    it('handles item notes', () => {
      const html = generateKitchenTicket({
        items: [{ name: 'Pizza', qty: 1, notes: 'Extra queso' }],
        table: '1',
      })
      expect(html).toContain('Extra queso')
    })

    it('defaults quantity to 1', () => {
      const html = generateKitchenTicket({
        items: [{ name: 'Agua' }],
        table: null,
      })
      expect(html).toContain('1x')
    })
  })
})
