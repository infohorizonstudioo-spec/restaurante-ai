'use client'
import { useState } from 'react'
import NotifBell from '@/components/NotifBell'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'

/* ── Accordion component ─────────────────────────────────────────── */
function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, marginBottom: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
          color: C.text, fontSize: 15, fontWeight: 600, textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease', flexShrink: 0, marginLeft: 12 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px', color: C.text2, fontSize: 14, lineHeight: 1.7 }}>
          {children}
        </div>
      )}
    </div>
  )
}

/* ── Step item ───────────────────────────────────────────────────── */
function Step({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: C.amberDim,
        color: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, flexShrink: 0, border: `1px solid rgba(240,168,78,0.2)`,
      }}>{num}</div>
      <div>
        <div style={{ fontWeight: 600, color: C.text, marginBottom: 2 }}>{title}</div>
        <div style={{ color: C.text2, fontSize: 13 }}>{desc}</div>
      </div>
    </div>
  )
}

/* ── FAQ item ────────────────────────────────────────────────────── */
function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 12 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 14, fontWeight: 500,
        textAlign: 'left', padding: '4px 0',
      }}>
        <span>{q}</span>
        <span style={{ color: C.text3, fontSize: 12, flexShrink: 0, marginLeft: 8 }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{ marginTop: 8, color: C.text2, fontSize: 13, lineHeight: 1.6 }}>{a}</div>}
    </div>
  )
}

/* ── Main ────────────────────────────────────────────────────────── */
export default function AyudaPage() {
  const { tenant, tx } = useTenant()

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Centro de ayuda</h1>
          <p style={{ fontSize: 14, color: C.text3, margin: '6px 0 0' }}>
            Todo lo que necesitas para sacar el mejor partido a Reservo.AI
          </p>
        </div>
        <NotifBell />
      </div>

      {/* Section 1: Primeros pasos */}
      <Accordion title="Primeros pasos" defaultOpen>
        <Step num={1} title="Configura tu negocio" desc="Ve a Configuraci\u00f3n y completa el nombre, direcci\u00f3n, horarios y tipo de negocio. Esto personaliza toda la plataforma para ti." />
        <Step num={2} title="A\u00f1ade tu carta" desc="En Productos, crea tus categor\u00edas y a\u00f1ade cada producto con nombre, precio y foto. Los clientes los ver\u00e1n en la carta digital." />
        <Step num={3} title="Configura mesas" desc="En Mesas, define tus zonas (terraza, sal\u00f3n, barra) y a\u00f1ade las mesas con su capacidad. As\u00ed podr\u00e1s gestionar reservas y pedidos por mesa." />
        <Step num={4} title="Genera QRs" desc="En QR Carta, genera c\u00f3digos QR para cada mesa. Los clientes escanean y pueden ver tu carta y hacer pedidos desde su m\u00f3vil." />
        <Step num={5} title="Activa el agente" desc="En Mi Recepcionista, configura tu agente de voz IA. Atender\u00e1 llamadas, gestionar\u00e1 reservas y tomar\u00e1 pedidos autom\u00e1ticamente." />
      </Accordion>

      {/* Section 2: Gu\u00eda de la TPV */}
      <Accordion title="Gu\u00eda de la TPV">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>A\u00f1adir productos al ticket</div>
          <p style={{ margin: 0 }}>Desde la TPV, pulsa sobre cualquier producto de tu carta para a\u00f1adirlo al ticket actual. Puedes modificar cantidades con los botones + y -.</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Cobrar un pedido</div>
          <p style={{ margin: 0 }}>Pulsa el bot\u00f3n de cobrar para ver el total. Selecciona el m\u00e9todo de pago (efectivo, tarjeta) y confirma. El pedido se marcar\u00e1 como entregado.</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Dividir cuenta</div>
          <p style={{ margin: 0 }}>Puedes dividir una cuenta por igual entre varios comensales o asignar productos individualmente a cada persona.</p>
        </div>
        <div>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Enviar a cocina</div>
          <p style={{ margin: 0 }}>Al confirmar un pedido, se env\u00eda autom\u00e1ticamente a la pantalla de cocina (KDS). La cocina ve los productos en orden de prioridad.</p>
        </div>
      </Accordion>

      {/* Section 3: Gu\u00eda de pedidos QR */}
      <Accordion title="Gu\u00eda de pedidos QR">
        <p style={{ margin: '0 0 12px' }}>
          El sistema de carta QR permite a tus clientes hacer pedidos directamente desde su m\u00f3vil.
        </p>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>C\u00f3mo funciona</div>
          <p style={{ margin: 0 }}>El cliente escanea el QR de su mesa, ve tu carta digital, selecciona productos y confirma el pedido. El pedido llega directamente a tu panel de pedidos y a la cocina.</p>
        </div>
        <div>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Generar QRs por mesa</div>
          <p style={{ margin: 0 }}>Ve a la secci\u00f3n QR Carta. All\u00ed puedes generar e imprimir un QR \u00fanico para cada mesa. Cada QR incluye el identificador de mesa para que los pedidos lleguen correctamente asignados.</p>
        </div>
      </Accordion>

      {/* Section 4: Caja y turnos */}
      <Accordion title="Caja y turnos">
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Abrir un turno</div>
          <p style={{ margin: 0 }}>Al empezar tu jornada, ve a Caja y pulsa Abrir turno. Introduce el efectivo inicial en caja. Todos los cobros del turno se registrar\u00e1n autom\u00e1ticamente.</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Cerrar turno</div>
          <p style={{ margin: 0 }}>Al terminar, pulsa Cerrar turno. Introduce el efectivo final contado. El sistema compara con el esperado y muestra cualquier diferencia.</p>
        </div>
        <div>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Arqueo de caja</div>
          <p style={{ margin: 0 }}>El resumen del d\u00eda muestra todos los turnos, ingresos por m\u00e9todo de pago, y diferencias de caja. Puedes consultarlo en cualquier momento desde la pesta\u00f1a Resumen del d\u00eda.</p>
        </div>
      </Accordion>

      {/* Section 5: Preguntas frecuentes */}
      <Accordion title="Preguntas frecuentes">
        <FAQ q="\u00bfC\u00f3mo cambio el horario de mi negocio?" a="Ve a Configuraci\u00f3n > Horarios. Puedes definir horarios distintos para cada d\u00eda de la semana y a\u00f1adir periodos de cierre extraordinario." />
        <FAQ q="\u00bfPuedo usar Reservo.AI en varios dispositivos?" a="S\u00ed. Tu cuenta funciona en cualquier navegador y dispositivo. Los datos se sincronizan en tiempo real entre todos los dispositivos conectados." />
        <FAQ q="\u00bfC\u00f3mo cancelo una reserva?" a="En la secci\u00f3n de Reservas, busca la reserva y pulsa sobre ella. En el detalle puedes cambiar el estado a cancelada o eliminarla." />
        <FAQ q="\u00bfEl agente de voz funciona 24h?" a="S\u00ed. Una vez activado, el agente atiende llamadas las 24 horas del d\u00eda, los 7 d\u00edas de la semana, incluso cuando tu negocio est\u00e1 cerrado." />
        <FAQ q="\u00bfC\u00f3mo a\u00f1adir un nuevo empleado?" a="Ve a Configuraci\u00f3n > Equipo y pulsa A\u00f1adir miembro. Introduce su email y se le enviar\u00e1 una invitaci\u00f3n para acceder al panel." />
        <FAQ q="\u00bfQu\u00e9 pasa si me quedo sin llamadas incluidas?" a="Puedes contratar m\u00e1s llamadas desde la secci\u00f3n de Facturaci\u00f3n, o actualizar a un plan superior con m\u00e1s llamadas incluidas." />
        <FAQ q="\u00bfPuedo personalizar los mensajes del agente?" a="S\u00ed. En Mi Recepcionista puedes personalizar el saludo, el tono, los idiomas y las instrucciones espec\u00edficas que sigue tu agente." />
        <FAQ q="\u00bfC\u00f3mo contacto con soporte?" a="Puedes escribirnos a soporte@reservo.ai o usar el chat de ayuda desde cualquier p\u00e1gina del panel. Respondemos en menos de 24 horas." />
      </Accordion>
    </div>
  )
}
