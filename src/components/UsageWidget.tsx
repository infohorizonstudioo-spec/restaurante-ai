'use client'
interface Props { tenant: any; compact?: boolean }
export default function UsageWidget({ tenant, compact = false }: Props) {
  const isTrial = !tenant.plan || tenant.plan === 'trial' || tenant.plan === 'free'
  if (isTrial) {
    const used = tenant.free_calls_used || 0
    const total = tenant.free_calls_limit || 10
    const left = Math.max(0, total - used)
    const pct = Math.min(100, (used / total) * 100)
    const isLow = left <= 3
    const isDepleted = left === 0
    return (
      <div className={`${compact ? 'p-3' : 'p-5'} rounded-2xl border ${isDepleted ? 'bg-red-50 border-red-200' : isLow ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
        {!compact && <div className="flex justify-between mb-3"><p className="font-semibold text-gray-900">Prueba gratuita</p><a href="/precios" className="text-xs text-indigo-600 font-medium">Ver planes</a></div>}
        <div className="flex justify-between mb-2"><span className={`text-sm ${isLow ? 'text-amber-700 font-medium' : 'text-gray-600'}`}>Llamadas gratuitas</span><span className={`font-bold ${isDepleted ? 'text-red-600' : isLow ? 'text-amber-700' : 'text-gray-900'}`}>{left} / {total}</span></div>
        <div className="bg-gray-200 rounded-full h-2 overflow-hidden"><div className={`h-full rounded-full ${isDepleted ? 'bg-red-500' : isLow ? 'bg-amber-400' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }}/></div>
        {isDepleted && !compact && <div className="mt-3"><p className="text-red-600 text-sm font-medium mb-2">Prueba agotada</p><a href="/precios" className="block text-center bg-red-600 text-white py-2 rounded-xl text-sm font-semibold">Activar plan →</a></div>}
        {isLow && !isDepleted && !compact && <p className="text-amber-600 text-xs mt-2">⚠️ Cerca del límite. <a href="/precios" className="underline">Elige un plan</a></p>}
      </div>
    )
  }
  const included = tenant.plan_calls_included || 50
  const used = tenant.plan_calls_used || 0
  const left = Math.max(0, included - used)
  const extra = Math.max(0, used - included)
  const extraCost = extra * (tenant.plan_extra_rate || 0.90)
  const pct = Math.min(100, (used / included) * 100)
  const isNear = pct >= 80
  const isOver = extra > 0
  return (
    <div className={`${compact ? 'p-3' : 'p-5'} rounded-2xl border ${isOver ? 'bg-orange-50 border-orange-200' : isNear ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-200'}`}>
      {!compact && <div className="flex justify-between mb-3"><p className="font-semibold text-gray-900">Uso mensual</p><a href="/precios" className="text-xs text-indigo-600">Cambiar plan</a></div>}
      <div className="flex justify-between mb-2"><span className="text-sm text-gray-600">Llamadas usadas</span><span className="font-bold">{used} / {included}</span></div>
      <div className="bg-gray-200 rounded-full h-2 overflow-hidden mb-3"><div className={`h-full rounded-full ${isOver ? 'bg-orange-500' : isNear ? 'bg-amber-400' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100,pct)}%` }}/></div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-gray-50 rounded-xl p-2 text-center"><p className="text-gray-400 text-xs">Restantes</p><p className={`font-bold ${isNear ? 'text-amber-600' : 'text-gray-800'}`}>{left}</p></div>
        <div className={`rounded-xl p-2 text-center ${isOver ? 'bg-orange-50' : 'bg-gray-50'}`}><p className="text-gray-400 text-xs">Coste extra</p><p className={`font-bold ${isOver ? 'text-orange-600' : 'text-gray-400'}`}>{extraCost > 0 ? `+${extraCost.toFixed(2)}€` : '0€'}</p></div>
      </div>
      {isNear && !isOver && !compact && <p className="text-amber-600 text-xs mt-2 font-medium">⚠️ Al {Math.round(pct)}% del límite. <a href="/precios" className="underline">Sube de plan</a></p>}
      {isOver && !compact && <p className="text-orange-600 text-xs mt-2 font-medium">📊 {extra} llamadas extra: +{extraCost.toFixed(2)}€</p>}
    </div>
  )
}