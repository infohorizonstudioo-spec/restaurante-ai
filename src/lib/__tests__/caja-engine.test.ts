import { describe, it, expect } from 'vitest'
import {
  calculateShiftTotals,
  generateDaySummary,
  getShiftLabel,
  getShiftName,
  getShiftIcon,
  formatCurrency,
  type CajaShift,
} from '../caja-engine'

describe('caja-engine', () => {
  describe('calculateShiftTotals', () => {
    it('calculates totals from orders', () => {
      const orders = [
        { total_estimate: 25.50, payment_method: 'cash', status: 'delivered' },
        { total_estimate: 18.00, payment_method: 'card', status: 'delivered' },
        { total_estimate: 12.00, payment_method: 'cash', status: 'confirmed' },
      ]
      const totals = calculateShiftTotals(orders)
      expect(totals.total_sales).toBe(55.50)
      expect(totals.total_cash).toBe(37.50)
      expect(totals.total_card).toBe(18.00)
      expect(totals.orders_count).toBe(3)
    })

    it('excludes cancelled orders', () => {
      const orders = [
        { total_estimate: 25.50, payment_method: 'cash', status: 'delivered' },
        { total_estimate: 100.00, payment_method: 'card', status: 'cancelled' },
      ]
      const totals = calculateShiftTotals(orders)
      expect(totals.total_sales).toBe(25.50)
      expect(totals.orders_count).toBe(1)
    })

    it('handles empty orders', () => {
      const totals = calculateShiftTotals([])
      expect(totals.total_sales).toBe(0)
      expect(totals.orders_count).toBe(0)
    })

    it('handles orders without payment_method as cash', () => {
      const orders = [{ total_estimate: 10, status: 'delivered' }]
      const totals = calculateShiftTotals(orders)
      expect(totals.total_cash).toBe(10)
    })
  })

  describe('generateDaySummary', () => {
    it('aggregates shifts and products', () => {
      const shifts: CajaShift[] = [{
        id: '1', tenant_id: 't1', opened_by: 'Juan', opened_at: new Date().toISOString(),
        closed_at: null, initial_cash: 100, total_sales: 200, total_cash: 150,
        total_card: 50, total_other: 0, orders_count: 10, counted_cash: null,
        difference: null, notes: null, status: 'closed',
      }]
      const orders = [
        { status: 'delivered', items: [{ name: 'Cerveza', quantity: 3, price: 3 }] },
        { status: 'delivered', items: [{ name: 'Hamburguesa', quantity: 1, price: 12 }] },
      ]
      const summary = generateDaySummary(shifts, orders)
      expect(summary.total_sales).toBe(200)
      expect(summary.total_orders).toBe(10)
      expect(summary.top_products.length).toBeGreaterThan(0)
      expect(summary.top_products[0].name).toBe('Hamburguesa')
    })
  })

  describe('shift helpers', () => {
    it('labels morning shift correctly', () => {
      expect(getShiftLabel(10)).toBe('Turno mañana')
      expect(getShiftLabel(7)).toBe('Turno mañana')
    })

    it('labels afternoon shift correctly', () => {
      expect(getShiftLabel(18)).toBe('Turno tarde')
    })

    it('labels night shift correctly', () => {
      expect(getShiftLabel(23)).toBe('Turno noche')
      expect(getShiftLabel(2)).toBe('Turno noche')
    })

    it('returns correct shift names', () => {
      expect(getShiftName(10)).toBe('morning')
      expect(getShiftName(18)).toBe('afternoon')
      expect(getShiftName(1)).toBe('night')
    })

    it('returns correct icons', () => {
      expect(getShiftIcon('morning')).toBe('☀️')
      expect(getShiftIcon('afternoon')).toBe('🌤️')
      expect(getShiftIcon('night')).toBe('🌙')
    })
  })

  describe('formatCurrency', () => {
    it('formats whole numbers', () => {
      expect(formatCurrency(100)).toBe('100.00')
    })

    it('formats decimals', () => {
      expect(formatCurrency(25.5)).toBe('25.50')
    })

    it('formats large numbers with commas', () => {
      expect(formatCurrency(1234.56)).toBe('1,234.56')
    })
  })
})
