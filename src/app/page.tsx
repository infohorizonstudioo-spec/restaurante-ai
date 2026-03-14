import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080810] text-white overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-violet-600/8 rounded-full blur-3xl"/>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-600/8 rounded-full blur-3xl"/>
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-600/8 rounded-full blur-3xl"/>
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white/50 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
          Sistema operativo · Tiempo real
        </div>

        {/* Title */}
        <h1 className="text-6xl sm:text-7xl font-black mb-6 leading-none tracking-tight">
          <span className="text-white">Pedidos por</span>
          <br/>
          <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-violet-500 bg-clip-text text-transparent">
            Teléfono con IA
          </span>
        </h1>

        <p className="text-xl text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed">
          Una IA con voz real atiende las llamadas de tu restaurante 24/7, 
          toma pedidos y los envía al panel en tiempo real.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24">
          <Link href="/panel"
            className="flex items-center gap-2 bg-white text-gray-900 font-bold px-8 py-4 rounded-2xl text-lg hover:bg-white/90 active:scale-95 transition-all shadow-2xl shadow-white/10">
            Ver Panel en Vivo
            <span>→</span>
          </Link>
          <a href="https://github.com/infohorizonstudioo-spec/restaurante-ai" target="_blank"
            className="flex items-center gap-2 bg-white/5 border border-white/10 text-white/70 font-medium px-8 py-4 rounded-2xl text-lg hover:bg-white/10 transition-all">
            Ver Código
          </a>
        </div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-3 gap-4 mb-16">
          {[
            { icon: '🎙️', title: 'Voz Real', desc: 'ElevenLabs genera una voz natural y fluida en español', color: 'from-orange-500/20 to-pink-500/20' },
            { icon: '🧠', title: 'IA Avanzada', desc: 'Claude entiende el pedido completo y extrae todos los datos', color: 'from-violet-500/20 to-blue-500/20' },
            { icon: '⚡', title: 'Tiempo Real', desc: 'El pedido aparece en el panel en el momento que se confirma', color: 'from-emerald-500/20 to-cyan-500/20' },
          ].map(f => (
            <div key={f.title} className={`bg-gradient-to-br ${f.color} border border-white/8 rounded-2xl p-6 text-left`}>
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-lg mb-1">{f.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Flow */}
        <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-8">
          <p className="text-xs text-white/25 uppercase tracking-widest mb-6">Flujo de una llamada</p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            {['📞 Cliente llama', '→', '🔊 IA responde', '→', '📝 Extrae pedido', '→', '💾 Guarda en BD', '→', '📱 Panel se actualiza'].map((s, i) => (
              <span key={i} className={s === '→' ? 'text-white/20' : 'bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white/60'}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
