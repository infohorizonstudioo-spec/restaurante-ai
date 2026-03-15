'use client'
import Link from 'next/link'

const PLANES = [
  {
    name: 'Starter',
    price: 350,
    plan: 'starter',
    color: 'from-violet-500/20 to-indigo-500/20',
    border: 'border-violet-500/30',
    badge: null,
    features: [
      'Recepcionista IA 24/7',
      'Gestión de reservas',
      'Panel de control completo',
      'Hasta 500 reservas/mes',
      'Soporte por email',
      '1 usuario',
    ]
  },
  {
    name: 'Pro',
    price: 500,
    plan: 'pro',
    color: 'from-amber-500/20 to-orange-500/20',
    border: 'border-amber-500/40',
    badge: 'Más popular',
    features: [
      'Todo lo del Starter',
      'Reservas ilimitadas',
      'Gestión de pedidos y mesas',
      'Alertas y avisos automáticos',
      'Integración WhatsApp',
      'Soporte prioritario 24/7',
      '3 usuarios',
      'Informes mensuales',
    ]
  }
]

export default function PreciosPage() {
  return (
    <div className="min-h-screen bg-[#070710] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/6 rounded-full blur-3xl"/>
      </div>
      <div className="relative max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <Link href="/login" className="inline-flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-black shadow-lg shadow-violet-500/20">R</div>
            <span className="font-bold text-lg">Reservo.AI</span>
          </Link>
          <h1 className="text-4xl font-black mb-4">Planes simples y transparentes</h1>
          <p className="text-white/40 text-lg max-w-lg mx-auto">
            Tu recepcionista con IA trabajando 24/7. Sin sorpresas, sin comisiones.
          </p>
        </div>

        {/* Free trial banner */}
        <div className="bg-gradient-to-r from-violet-600/15 to-indigo-600/15 border border-violet-500/25 rounded-2xl p-5 text-center mb-8">
          <div className="text-2xl mb-2">🎁</div>
          <p className="font-bold text-white">Prueba gratis con 10 llamadas</p>
          <p className="text-white/40 text-sm mt-1">Empieza sin tarjeta de crédito · 10 llamadas gratuitas para probar tu recepcionista IA</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {PLANES.map(plan => (
            <div key={plan.plan}
              className={`relative bg-gradient-to-br ${plan.color} border ${plan.border} rounded-2xl p-8 flex flex-col`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-amber-500 text-black text-xs font-bold px-4 py-1 rounded-full">{plan.badge}</span>
                </div>
              )}
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-black">{plan.price}€</span>
                  <span className="text-white/40 mb-2">/mes</span>
                </div>
                <p className="text-white/30 text-xs mt-1">IVA no incluido · Pago mensual</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/70">
                    <span className="text-violet-400 mt-0.5 shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/registro"
                className={`w-full py-3.5 rounded-xl text-sm font-bold text-center transition-all ${plan.badge ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-white/10 hover:bg-white/15 text-white border border-white/20'}`}>
                Empezar con 10 llamadas gratis →
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center space-y-3">
          <p className="text-white/25 text-sm">
            Todos los planes incluyen <strong className="text-white/50">10 llamadas gratuitas de prueba</strong> · Sin tarjeta de crédito
          </p>
          <div className="flex items-center justify-center gap-6 text-white/20 text-xs">
            <span>✓ Cancela cuando quieras</span>
            <span>✓ Soporte en español</span>
            <span>✓ Datos en Europa</span>
          </div>
          <p className="text-white/20 text-xs mt-2">
            ¿Tienes dudas? <a href="mailto:info@horizonstudio.ai" className="text-violet-400 hover:text-violet-300">Contacta con nosotros</a>
          </p>
        </div>
      </div>
    </div>
  )
}