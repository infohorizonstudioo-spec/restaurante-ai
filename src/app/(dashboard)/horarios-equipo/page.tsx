'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'

// ── Types ──
interface Employee {
  id: string
  name: string
  role: string
  phone: string
}

type ShiftType = 'morning' | 'afternoon' | 'night' | null

interface WeekSchedule {
  [employeeId: string]: {
    [day: number]: ShiftType // 0=Mon .. 6=Sun
  }
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAYS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const SHIFTS: { key: ShiftType; label: string; icon: string; color: string; hours: string }[] = [
  { key: 'morning',   label: 'Mañana',   icon: '☀️', color: C.amber,  hours: '08:00–15:00' },
  { key: 'afternoon', label: 'Tarde',     icon: '🌤️', color: C.blue,   hours: '15:00–22:00' },
  { key: 'night',     label: 'Noche',     icon: '🌙', color: C.violet, hours: '22:00–06:00' },
]

function getShiftColor(shift: ShiftType): string {
  if (shift === 'morning') return C.amber
  if (shift === 'afternoon') return C.blue
  if (shift === 'night') return C.violet
  return 'transparent'
}

function getShiftBg(shift: ShiftType): string {
  if (shift === 'morning') return C.amberDim
  if (shift === 'afternoon') return C.blueDim
  if (shift === 'night') return C.violetDim
  return 'rgba(255,255,255,0.03)'
}

function getShiftIcon(shift: ShiftType): string {
  if (shift === 'morning') return '☀️'
  if (shift === 'afternoon') return '🌤️'
  if (shift === 'night') return '🌙'
  return ''
}

// Get Monday of current week
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${weekStart.toLocaleDateString('es-ES', opts)} — ${end.toLocaleDateString('es-ES', opts)}`
}

export default function HorariosEquipoPage() {
  const { tenant, tx } = useTenant()
  const _tx = (s: string) => tx?.(s) || s

  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedule, setSchedule] = useState<WeekSchedule>({})
  const [weekOffset, setWeekOffset] = useState(0)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null)

  const weekStart = getWeekStart(new Date())
  weekStart.setDate(weekStart.getDate() + weekOffset * 7)
  const weekKey = weekStart.toISOString().slice(0, 10)

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)

    const { data: tenantData } = await supabase
      .from('tenants')
      .select('staff_schedule')
      .eq('id', tenant.id)
      .maybeSingle()

    const staffData = tenantData?.staff_schedule || {}
    const emps: Employee[] = staffData.employees || []
    const sched: Record<string, WeekSchedule> = staffData.schedules || {}

    setEmployees(emps)
    setSchedule(sched[weekKey] || {})
    setLoading(false)
  }, [tenant?.id, weekKey])

  useEffect(() => { loadData() }, [loadData])

  const saveToDb = useCallback(async (emps: Employee[], sched: WeekSchedule) => {
    if (!tenant?.id) return
    setSaving(true)

    // Load current full data to merge
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('staff_schedule')
      .eq('id', tenant.id)
      .maybeSingle()

    const current = tenantData?.staff_schedule || {}
    const allSchedules = current.schedules || {}
    allSchedules[weekKey] = sched

    await supabase
      .from('tenants')
      .update({ staff_schedule: { employees: emps, schedules: allSchedules } })
      .eq('id', tenant.id)

    setSaving(false)
  }, [tenant?.id, weekKey])

  const addEmployee = async () => {
    if (!newName.trim()) return
    const emp: Employee = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      role: newRole.trim() || 'Empleado',
      phone: newPhone.trim(),
    }
    const updated = [...employees, emp]
    setEmployees(updated)
    setShowAddForm(false)
    setNewName('')
    setNewRole('')
    setNewPhone('')
    await saveToDb(updated, schedule)
  }

  const removeEmployee = async (id: string) => {
    const updated = employees.filter(e => e.id !== id)
    const newSched = { ...schedule }
    delete newSched[id]
    setEmployees(updated)
    setSchedule(newSched)
    await saveToDb(updated, newSched)
  }

  const cycleShift = async (empId: string, day: number) => {
    const current = schedule[empId]?.[day] || null
    const order: ShiftType[] = [null, 'morning', 'afternoon', 'night']
    const idx = order.indexOf(current)
    const next = order[(idx + 1) % order.length]

    const newSched: WeekSchedule = {
      ...schedule,
      [empId]: { ...(schedule[empId] || {}), [day]: next },
    }
    setSchedule(newSched)
    await saveToDb(employees, newSched)
  }

  if (loading) return <PageLoader />
  if (!tenant) return null

  // Count shifts per day
  const dayTotals = DAYS.map((_, d) => {
    let m = 0, a = 0, n = 0
    employees.forEach(emp => {
      const s = schedule[emp.id]?.[d]
      if (s === 'morning') m++
      if (s === 'afternoon') a++
      if (s === 'night') n++
    })
    return { morning: m, afternoon: a, night: n, total: m + a + n }
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'var(--rz-font)' }}>
      {/* Header */}
      <div style={{
        background: 'rgba(19,25,32,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.border}`, padding: '14px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            {_tx('Horarios del equipo')}
          </h1>
          <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{_tx('Gestiona los turnos de tu equipo')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && <span style={{ fontSize: 11, color: C.amber, fontWeight: 600 }}>{_tx('Guardando...')}</span>}
          <button onClick={() => setShowAddForm(true)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#0C1018', background: C.amber,
            borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            + {_tx('Empleado')}
          </button>
        </div>
      </div>

      <div className="rz-page-enter" style={{ maxWidth: 1200, margin: '0 auto', padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Week navigator */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 18px',
        }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{
            background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '6px 14px', color: C.text, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
          }}>
            ← {_tx('Anterior')}
          </button>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{formatWeekRange(weekStart)}</p>
            {weekOffset === 0 && <span style={{ fontSize: 10, color: C.teal, fontWeight: 600 }}>{_tx('Esta semana')}</span>}
          </div>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{
            background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '6px 14px', color: C.text, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
          }}>
            {_tx('Siguiente')} →
          </button>
        </div>

        {/* Shift legend */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {SHIFTS.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color }} />
              <span style={{ fontSize: 11, color: C.text2 }}>{s.icon} {s.label} ({s.hours})</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}` }} />
            <span style={{ fontSize: 11, color: C.text3 }}>{_tx('Libre')}</span>
          </div>
        </div>

        {/* Add employee form */}
        {showAddForm && (
          <div style={{
            background: C.surface, border: `1px solid ${C.amber}30`, borderRadius: 12, padding: '18px 20px',
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>{_tx('Nuevo empleado')}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={_tx('Nombre *')}
                style={{
                  flex: '1 1 180px', padding: '10px 14px', fontSize: 13, background: C.surface2,
                  border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontFamily: 'inherit', outline: 'none',
                }} />
              <input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder={_tx('Rol (ej: Camarero)')}
                style={{
                  flex: '1 1 150px', padding: '10px 14px', fontSize: 13, background: C.surface2,
                  border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontFamily: 'inherit', outline: 'none',
                }} />
              <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder={_tx('Teléfono')}
                style={{
                  flex: '1 1 140px', padding: '10px 14px', fontSize: 13, background: C.surface2,
                  border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontFamily: 'inherit', outline: 'none',
                }} />
              <button onClick={addEmployee} style={{
                padding: '10px 20px', fontSize: 13, fontWeight: 700, color: '#0C1018', background: C.amber,
                borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {_tx('Guardar')}
              </button>
              <button onClick={() => setShowAddForm(false)} style={{
                padding: '10px 16px', fontSize: 13, color: C.text3, background: C.surface2,
                borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {_tx('Cancelar')}
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {employees.length === 0 && !showAddForm && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: '52px 20px', textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: C.amberDim,
              border: `1px solid ${C.amber}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 24,
            }}>👥</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>{_tx('Anade a tu equipo')}</p>
            <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
              {_tx('Registra a tus empleados y gestiona sus turnos semanales desde aqui.')}
            </p>
            <button onClick={() => setShowAddForm(true)} style={{
              marginTop: 16, padding: '10px 22px', fontSize: 13, fontWeight: 700, color: '#0C1018',
              background: C.amber, borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + {_tx('Anadir empleado')}
            </button>
          </div>
        )}

        {/* Schedule grid */}
        {employees.length > 0 && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden',
          }}>
            {/* Grid header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)',
              borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.015)',
            }}>
              <div style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: C.text2 }}>
                {_tx('Empleado')}
              </div>
              {DAYS.map((d, i) => {
                const dayDate = new Date(weekStart)
                dayDate.setDate(dayDate.getDate() + i)
                const isToday = dayDate.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
                return (
                  <div key={d} style={{
                    padding: '12px 8px', textAlign: 'center',
                    borderLeft: `1px solid ${C.border}`,
                    background: isToday ? 'rgba(240,168,78,0.04)' : 'transparent',
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: isToday ? C.amber : C.text }}>{d}</p>
                    <p style={{ fontSize: 10, color: isToday ? C.amber : C.text3 }}>{dayDate.getDate()}</p>
                  </div>
                )
              })}
            </div>

            {/* Employee rows */}
            {employees.map((emp, ei) => (
              <div key={emp.id} style={{
                display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)',
                borderTop: ei > 0 ? `1px solid ${C.border}` : 'none',
              }}>
                {/* Employee info */}
                <div style={{
                  padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
                  position: 'relative',
                }}
                  onMouseEnter={() => setEditingEmployee(emp.id)}
                  onMouseLeave={() => setEditingEmployee(null)}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: C.amberDim,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 12, color: C.amber, flexShrink: 0,
                  }}>
                    {emp.name[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</p>
                    <p style={{ fontSize: 10, color: C.text3 }}>{emp.role}</p>
                  </div>
                  {editingEmployee === emp.id && (
                    <button onClick={() => removeEmployee(emp.id)} style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: C.redDim, border: `1px solid ${C.red}25`, borderRadius: 6,
                      padding: '3px 8px', fontSize: 10, color: C.red, cursor: 'pointer', fontFamily: 'inherit',
                    }} title={_tx('Eliminar')}>
                      ✕
                    </button>
                  )}
                </div>

                {/* Shift cells */}
                {DAYS.map((_, dayIdx) => {
                  const shift = schedule[emp.id]?.[dayIdx] || null
                  const dayDate = new Date(weekStart)
                  dayDate.setDate(dayDate.getDate() + dayIdx)
                  const isToday = dayDate.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
                  return (
                    <div key={dayIdx} onClick={() => cycleShift(emp.id, dayIdx)} style={{
                      borderLeft: `1px solid ${C.border}`,
                      padding: '8px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'background 0.12s',
                      background: isToday ? 'rgba(240,168,78,0.02)' : 'transparent',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
                      onMouseLeave={e => (e.currentTarget.style.background = isToday ? 'rgba(240,168,78,0.02)' : 'transparent')}
                      title={shift ? SHIFTS.find(s => s.key === shift)?.label + ' — ' + SHIFTS.find(s => s.key === shift)?.hours : _tx('Click para asignar turno')}
                    >
                      {shift ? (
                        <div style={{
                          padding: '4px 10px', borderRadius: 8,
                          background: getShiftBg(shift), border: `1px solid ${getShiftColor(shift)}25`,
                          fontSize: 12, fontWeight: 600, color: getShiftColor(shift),
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <span style={{ fontSize: 11 }}>{getShiftIcon(shift)}</span>
                          <span style={{ fontSize: 10 }}>{shift === 'morning' ? 'M' : shift === 'afternoon' ? 'T' : 'N'}</span>
                        </div>
                      ) : (
                        <div style={{
                          width: 28, height: 28, borderRadius: 7,
                          border: `1px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 12, color: C.text3 }}>+</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Day totals row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)',
              borderTop: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.015)',
            }}>
              <div style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: C.text3 }}>
                {_tx('Total turnos')}
              </div>
              {dayTotals.map((dt, i) => (
                <div key={i} style={{
                  borderLeft: `1px solid ${C.border}`, padding: '8px 4px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: dt.total > 0 ? C.text : C.text3 }}>{dt.total}</span>
                  {dt.total > 0 && (
                    <div style={{ display: 'flex', gap: 3 }}>
                      {dt.morning > 0 && <span style={{ fontSize: 9, color: C.amber }}>{dt.morning}M</span>}
                      {dt.afternoon > 0 && <span style={{ fontSize: 9, color: C.blue }}>{dt.afternoon}T</span>}
                      {dt.night > 0 && <span style={{ fontSize: 9, color: C.violet }}>{dt.night}N</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employee cards — quick view */}
        {employees.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12,
          }}>
            {employees.map(emp => {
              const empSchedule = schedule[emp.id] || {}
              const shiftCount = Object.values(empSchedule).filter(s => s !== null).length
              const shifts = Object.entries(empSchedule)
                .filter(([, s]) => s !== null)
                .map(([d, s]) => `${DAYS[Number(d)]}: ${getShiftIcon(s)}`)
                .join('  ')

              return (
                <div key={emp.id} style={{
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: C.amberDim,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14, color: C.amber, flexShrink: 0,
                  }}>
                    {emp.name[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{emp.name}</p>
                    <p style={{ fontSize: 11, color: C.text3 }}>{emp.role}{emp.phone ? ` · ${emp.phone}` : ''}</p>
                    <p style={{ fontSize: 10, color: C.text2, marginTop: 3 }}>
                      {shiftCount > 0 ? `${shiftCount} turnos: ${shifts}` : _tx('Sin turnos esta semana')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
