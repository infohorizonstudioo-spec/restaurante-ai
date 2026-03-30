'use client'
import { useState } from 'react'

const AMBER = '#F0A84E'
const TEAL = '#2DD4BF'
const TEXT = '#E8EEF6'
const TEXT2 = '#8895A7'
const TEXT3 = '#49566A'
const SURFACE2 = '#1A2230'
const BORDER = 'rgba(255,255,255,0.07)'
const RED = '#F87171'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: SURFACE2, border: `1px solid ${BORDER}`,
  borderRadius: 10, color: TEXT, fontSize: 14,
  fontFamily: 'inherit', outline: 'none',
}

export default function PublicReservationForm({ slug }: { slug: string }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim() || !phone.trim() || !date || !time || !partySize) {
      setError('Por favor, completa todos los campos')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/reservations/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name: name.trim(),
          phone: phone.trim(),
          date,
          time,
          party_size: parseInt(partySize) || 2,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al enviar la reserva')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Error de conexion. Intentalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>&#x2705;</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: TEAL, marginBottom: 8 }}>
          Reserva enviada
        </h2>
        <p style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6 }}>
          Tu reserva esta pendiente de confirmacion.
          Te contactaremos por telefono para confirmarla.
        </p>
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(45,212,191,0.08)', border: `1px solid ${TEAL}33`,
          fontSize: 13, color: TEXT2, textAlign: 'left',
        }}>
          <div><strong style={{ color: TEXT }}>{name}</strong></div>
          <div>{date} a las {time} - {partySize} personas</div>
        </div>
        <button
          onClick={() => { setSuccess(false); setName(''); setPhone(''); setDate(''); setTime(''); setPartySize('2') }}
          style={{
            marginTop: 16, padding: '10px 24px', borderRadius: 10,
            border: `1px solid ${BORDER}`, background: 'transparent',
            color: TEXT2, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Hacer otra reserva
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: TEXT3, letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
          NOMBRE
        </label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Tu nombre" required
          style={inputStyle}
        />
      </div>

      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: TEXT3, letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
          TELEFONO
        </label>
        <input
          type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="+34 600 000 000" required
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: TEXT3, letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
            FECHA
          </label>
          <input
            type="date" value={date} onChange={e => setDate(e.target.value)}
            min={today} required
            style={{ ...inputStyle, colorScheme: 'dark' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: TEXT3, letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
            HORA
          </label>
          <input
            type="time" value={time} onChange={e => setTime(e.target.value)}
            required
            style={{ ...inputStyle, colorScheme: 'dark' }}
          />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: TEXT3, letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
          PERSONAS
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8+'].map(n => {
            const val = n.replace('+', '')
            const isActive = partySize === val
            return (
              <button
                key={n} type="button"
                onClick={() => setPartySize(val)}
                style={{
                  padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  border: `1px solid ${isActive ? AMBER + '60' : BORDER}`,
                  background: isActive ? AMBER + '18' : 'transparent',
                  color: isActive ? AMBER : TEXT2,
                  cursor: 'pointer', fontFamily: 'inherit',
                  flex: '1 1 auto', minWidth: 44,
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(248,113,113,0.08)', border: `1px solid ${RED}33`,
          fontSize: 13, color: RED,
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%', padding: '14px',
          background: loading ? TEXT3 : `linear-gradient(135deg, ${AMBER}, #E8923A)`,
          border: 'none', borderRadius: 14,
          color: '#0C1018', fontSize: 16, fontWeight: 800,
          cursor: loading ? 'default' : 'pointer',
          fontFamily: 'inherit', marginTop: 4,
          boxShadow: loading ? 'none' : `0 4px 20px rgba(240,168,78,0.35)`,
        }}
      >
        {loading ? 'Enviando...' : 'Reservar'}
      </button>
    </form>
  )
}
