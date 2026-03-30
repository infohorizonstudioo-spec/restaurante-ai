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
        <Step num={1} title="Configura tu negocio" desc="Ve a Configuracion y completa el nombre, direccion, horarios y tipo de negocio. Esto personaliza toda la plataforma para ti." />
        <Step num={2} title="Anade tu carta" desc="En Productos, crea tus categorias y anade cada producto con nombre, precio y foto. Los clientes los veran en la carta digital." />
        <Step num={3} title="Configura mesas" desc="En Mesas, define tus zonas (terraza, salon, barra) y anade las mesas con su capacidad. Asi podras gestionar reservas y pedidos por mesa." />
        <Step num={4} title="Genera QRs" desc="En QR Carta, genera codigos QR para cada mesa. Los clientes escanean y pueden ver tu carta y hacer pedidos desde su movil." />
        <Step num={5} title="Activa el agente" desc="En Mi Recepcionista, configura tu agente de voz IA. Atendera llamadas, gestionara reservas y tomara pedidos automaticamente." />
      </Accordion>

      {/* Section 2: Guia de la TPV */}
      <Accordion title="Guia de la TPV">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Anadir productos al ticket</div>
          <p style={{ margin: 0 }}>Desde la TPV, pulsa sobre cualquier producto de tu carta para anadirlo al ticket actual. Puedes modificar cantidades con los botones + y -.</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Cobrar un pedido</div>
          <p style={{ margin: 0 }}>Pulsa el boton de cobrar para ver el total. Selecciona el metodo de pago (efectivo, tarjeta) y confirma. El pedido se marcara como entregado.</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Dividir cuenta</div>
          <p style={{ margin: 0 }}>Puedes dividir una cuenta por igual entre varios comensales o asignar productos individualmente a cada persona.</p>
        </div>
        <div>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Enviar a cocina</div>
          <p style={{ margin: 0 }}>Al confirmar un pedido, se envia automaticamente a la pantalla de cocina (KDS). La cocina ve los productos en orden de prioridad.</p>
        </div>
      </Accordion>

      {/* Section 3: Guia de pedidos QR */}
      <Accordion title="Guia de pedidos QR">
        <p style={{ margin: '0 0 12px' }}>
          El sistema de carta QR permite a tus clientes hacer pedidos directamente desde su movil.
        </p>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Como funciona</div>
          <p style={{ margin: 0 }}>El cliente escanea el QR de su mesa, ve tu carta digital, selecciona productos y confirma el pedido. El pedido llega directamente a tu panel de pedidos y a la cocina.</p>
        </div>
        <div>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Generar QRs por mesa</div>
          <p style={{ margin: 0 }}>Ve a la seccion QR Carta. Alli puedes generar e imprimir un QR unico para cada mesa. Cada QR incluye el identificador de mesa para que los pedidos lleguen correctamente asignados.</p>
        </div>
      </Accordion>

      {/* Section 4: Caja y turnos */}
      <Accordion title="Caja y turnos">
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Abrir un turno</div>
          <p style={{ margin: 0 }}>Al empezar tu jornada, ve a Caja y pulsa Abrir turno. Introduce el efectivo inicial en caja. Todos los cobros del turno se registraran automaticamente.</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Cerrar turno</div>
          <p style={{ margin: 0 }}>Al terminar, pulsa Cerrar turno. Introduce el efectivo final contado. El sistema compara con el esperado y muestra cualquier diferencia.</p>
        </div>
        <div>
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Arqueo de caja</div>
          <p style={{ margin: 0 }}>El resumen del dia muestra todos los turnos, ingresos por metodo de pago, y diferencias de caja. Puedes consultarlo en cualquier momento desde la pestana Resumen del dia.</p>
        </div>
      </Accordion>

      {/* Section 5: Preguntas frecuentes */}
      <Accordion title="Preguntas frecuentes">
        <FAQ q="Como cambio el horario de mi negocio?" a="Ve a Configuracion > Horarios. Puedes definir horarios distintos para cada dia de la semana y anadir periodos de cierre extraordinario." />
        <FAQ q="Puedo usar Reservo.AI en varios dispositivos?" a="Si. Tu cuenta funciona en cualquier navegador y dispositivo. Los datos se sincronizan en tiempo real entre todos los dispositivos conectados." />
        <FAQ q="Como cancelo una reserva?" a="En la seccion de Reservas, busca la reserva y pulsa sobre ella. En el detalle puedes cambiar el estado a cancelada o eliminarla." />
        <FAQ q="El agente de voz funciona 24h?" a="Si. Una vez activado, el agente atiende llamadas las 24 horas del dia, los 7 dias de la semana, incluso cuando tu negocio esta cerrado." />
        <FAQ q="Como anadir un nuevo empleado?" a="Ve a Configuracion > Equipo y pulsa Anadir miembro. Introduce su email y se le enviara una invitacion para acceder al panel." />
        <FAQ q="Que pasa si me quedo sin llamadas incluidas?" a="Puedes contratar mas llamadas desde la seccion de Facturacion, o actualizar a un plan superior con mas llamadas incluidas." />
        <FAQ q="Puedo personalizar los mensajes del agente?" a="Si. En Mi Recepcionista puedes personalizar el saludo, el tono, los idiomas y las instrucciones especificas que sigue tu agente." />
        <FAQ q="Como contacto con soporte?" a="Puedes escribirnos a soporte@reservo.ai o usar el chat de ayuda desde cualquier pagina del panel. Respondemos en menos de 24 horas." />
      </Accordion>
    </div>
  )
}
