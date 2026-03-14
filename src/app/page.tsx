import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-8">
        <div className="text-6xl">📞🤖</div>
        <h1 className="text-5xl font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
          IA para Restaurantes
        </h1>
        <p className="text-xl text-gray-400">
          Tu restaurante recibe pedidos por teléfono automáticamente.<br/>
          Una IA con voz real atiende a tus clientes 24/7.
        </p>
        <div className="grid grid-cols-3 gap-4 text-center py-6">
          {[
            { icon: '🎙️', title: 'Voz Real', desc: 'ElevenLabs · natural y fluida' },
            { icon: '⚡', title: 'Tiempo Real', desc: 'Pedidos en el panel al instante' },
            { icon: '🧠', title: 'IA Avanzada', desc: 'Claude · entiende todo' },
          ].map(f => (
            <div key={f.title} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <div className="text-3xl mb-2">{f.icon}</div>
              <div className="font-bold">{f.title}</div>
              <div className="text-gray-500 text-xs mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
        <Link href="/panel"
          className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all">
          Ver Panel de Pedidos →
        </Link>
      </div>
    </main>
  )
}
