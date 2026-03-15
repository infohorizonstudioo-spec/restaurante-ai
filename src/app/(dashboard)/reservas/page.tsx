
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reservas</h1>
          <p className="text-white/40 text-sm">{todayCount} hoy · {tomorrowCount} mañana</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all active:scale-95">
          + Nueva reserva
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="glass rounded-xl px-3 py-2 text-sm text-white/70 bg-transparent border-white/10 focus:outline-none"/>
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${filter===s ? 'bg-white/12 text-white' : 'text-white/35 hover:text-white/60 hover:bg-white/5'}`}>
              {s === 'todos' ? 'Todos' : STATUS_CFG[s]?.label}
              <span className="ml-1.5 text-white/20">
                {s === 'todos' ? reservations.length : reservations.filter(r=>r.status===s).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Hora','Cliente','Pers.','Zona','Notas','Estado','Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-white/30 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-white/25 text-sm">Sin reservas</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5 font-mono text-sm text-white/60 whitespace-nowrap">{r.time.slice(0,5)}</td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium whitespace-nowrap">{r.customer_name}</p>
                    {r.customer_phone && <p className="text-xs text-white/30">{r.customer_phone}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-center">{r.people}</td>
                  <td className="px-4 py-3.5 text-sm text-white/50 capitalize whitespace-nowrap">{r.zone}</td>
                  <td className="px-4 py-3.5 max-w-[160px]">
                    {r.notes && <p className="text-xs text-white/50 truncate">{r.notes}</p>}
                    {r.allergies && <p className="text-xs text-amber-400">⚠ {r.allergies}</p>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap ${STATUS_CFG[r.status]?.cls || 'bg-white/10 text-white/40 border-white/10'}`}>
                      {STATUS_CFG[r.status]?.label || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1">
                      {r.status === 'pendiente' && (
                        <button onClick={() => updateStatus(r.id, 'confirmada')}
                          className="text-xs px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-lg hover:bg-emerald-500/25 transition-all whitespace-nowrap">
                          Confirmar
                        </button>
                      )}
                      {r.status === 'confirmada' && (
                        <button onClick={() => updateStatus(r.id, 'sentada')}
                          className="text-xs px-2.5 py-1 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-lg hover:bg-blue-500/25 transition-all">
                          Sentar
                        </button>
                      )}
                      {!['completada','cancelada','no_show'].includes(r.status) && (
                        <button onClick={() => updateStatus(r.id, 'cancelada')}
                          className="text-xs px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all">✕</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Nueva Reserva</h2>
            <div className="grid grid-cols-2 gap-3">
              {([
                {label:'Nombre *',key:'customer_name',type:'text',span:2},
                {label:'Teléfono',key:'customer_phone',type:'tel',span:1},
                {label:'Personas',key:'people',type:'number',span:1},
                {label:'Fecha',key:'date',type:'date',span:1},
                {label:'Hora',key:'time',type:'time',span:1},
                {label:'Notas',key:'notes',type:'text',span:2},
                {label:'Alergias',key:'allergies',type:'text',span:2},
              ] as {label:string;key:string;type:string;span:number}[]).map(f => (
                <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                  <label className="text-xs text-white/40 mb-1 block">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"/>
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs text-white/40 mb-1 block">Zona</label>
                <select value={form.zone} onChange={e => setForm(p => ({...p, zone: e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50">
                  {ZONAS.map(z => <option key={z} value={z} className="bg-gray-900 capitalize">{z}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-all">Cancelar</button>
              <button onClick={createReservation} className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-all">Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
