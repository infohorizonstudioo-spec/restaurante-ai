import { describe, it, expect } from 'vitest'
import { classifyInteraction } from '../intelligence-engine'

describe('classifyInteraction', () => {
  const base = { text: '', business_type: 'restaurante' }

  // ── Intent detection ──

  it('detects reservation intent', () => {
    const r = classifyInteraction({ ...base, text: 'Quiero reservar mesa para 4' })
    expect(r.type).toBe('reserva')
  })

  it('detects cancellation intent', () => {
    const r = classifyInteraction({ ...base, text: 'Quiero cancelar mi reserva' })
    expect(r.type).toBe('cancelacion')
  })

  it('detects modification intent', () => {
    const r = classifyInteraction({ ...base, text: 'Necesito cambiar la hora de mi cita' })
    expect(r.type).toBe('modificacion')
  })

  it('detects order intent', () => {
    const r = classifyInteraction({ ...base, text: 'Quiero pedir a domicilio' })
    expect(r.type).toBe('pedido')
  })

  it('detects complaint', () => {
    const r = classifyInteraction({ ...base, text: 'Esto es inaceptable, quiero una reclamación' })
    expect(r.type).toBe('queja')
    expect(r.flags).toContain('complaint')
    expect(r.requires_human).toBe(true)
  })

  it('detects medical urgency', () => {
    const r = classifyInteraction({ ...base, business_type: 'veterinaria', text: 'Mi perro no respira bien, es urgente' })
    expect(r.type).toBe('urgencia')
    expect(r.flags).toContain('medical_urgency')
    expect(r.priority).toBe('high')
  })

  it('detects crisis in psychology', () => {
    const r = classifyInteraction({ ...base, business_type: 'psicologia', text: 'No puedo más, quiero hacerme daño' })
    expect(r.type).toBe('urgencia')
    expect(r.flags).toContain('crisis')
    expect(r.priority).toBe('critical')
    expect(r.risk_level).toBe(100)
    expect(r.recommended_action).toBe('escalate')
    expect(r.requires_human).toBe(true)
  })

  it('defaults to consulta for generic text', () => {
    const r = classifyInteraction({ ...base, text: '¿Cuál es vuestro horario?' })
    expect(r.type).toBe('consulta')
  })

  // ── Flag detection ──

  it('flags large groups', () => {
    const r = classifyInteraction({ ...base, text: 'Reserva para 10', party_size: 10 })
    expect(r.flags).toContain('large_group')
  })

  it('flags allergies', () => {
    const r = classifyInteraction({ ...base, text: 'Tenemos alergia al gluten, somos celiacos' })
    expect(r.flags).toContain('allergy_critical')
  })

  it('flags special occasions', () => {
    const r = classifyInteraction({ ...base, text: 'Es para un cumpleaños' })
    expect(r.flags).toContain('special_occasion')
  })

  it('flags accessibility needs', () => {
    const r = classifyInteraction({ ...base, text: 'Necesitamos accesibilidad, silla de ruedas' })
    expect(r.flags).toContain('accessibility')
  })

  it('flags urgent timing', () => {
    const r = classifyInteraction({ ...base, text: 'Necesito algo para hoy, lo antes posible' })
    expect(r.flags).toContain('urgent_timing')
  })

  // ── Risk assessment ──

  it('increases risk for chronic no-shows', () => {
    const r = classifyInteraction({
      ...base, text: 'Quiero reservar',
      customer_history: { total_reservations: 10, no_shows: 4, cancels: 0, vip: false },
    })
    expect(r.risk_level).toBeGreaterThanOrEqual(40)
    expect(r.flags).toContain('chronic_no_show')
    expect(r.recommended_action).toBe('mark_pending')
  })

  it('reduces risk for VIP customers', () => {
    const normalR = classifyInteraction({
      ...base, text: 'Reserva',
      customer_history: { total_reservations: 5, no_shows: 0, cancels: 0, vip: false },
    })
    const vipR = classifyInteraction({
      ...base, text: 'Reserva',
      customer_history: { total_reservations: 5, no_shows: 0, cancels: 0, vip: true },
    })
    expect(vipR.risk_level).toBeLessThanOrEqual(normalR.risk_level)
  })

  it('clamps risk between 0 and 100', () => {
    const r = classifyInteraction({ ...base, text: 'todo bien', customer_history: { total_reservations: 100, no_shows: 0, cancels: 0, vip: true } })
    expect(r.risk_level).toBeGreaterThanOrEqual(0)
    expect(r.risk_level).toBeLessThanOrEqual(100)
  })

  // ── Priority mapping ──

  it('assigns critical priority for crisis', () => {
    const r = classifyInteraction({ ...base, business_type: 'psicologia', text: 'quiero quitarme la vida' })
    expect(r.priority).toBe('critical')
  })

  it('assigns high priority for complaints', () => {
    const r = classifyInteraction({ ...base, text: 'Esto es horrible, quiero una queja' })
    expect(r.priority).toBe('high')
  })

  it('assigns low priority for simple queries', () => {
    const r = classifyInteraction({ ...base, text: '¿A qué hora cerráis?' })
    expect(r.priority).toBe('low')
  })

  // ── Cancellation priority over reservation ──

  it('prioritizes cancel over reserve keywords', () => {
    const r = classifyInteraction({ ...base, text: 'cancelar reserva de mañana' })
    expect(r.type).toBe('cancelacion')
  })

  // ── Reasoning output ──

  it('produces reasoning string', () => {
    const r = classifyInteraction({ ...base, text: 'Reserva para mañana' })
    expect(r.reasoning).toBeTruthy()
    expect(typeof r.reasoning).toBe('string')
  })
})
