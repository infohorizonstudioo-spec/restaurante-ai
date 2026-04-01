'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { UpgradeGate } from '@/components/UpgradeGate'

// ── Types ──
interface Employee {
  id: string
  name: string
  role: string
  phone: string
  dni?: string
}

type ShiftType = 'morning' | 'afternoon' | 'night' | null

interface WeekSchedule {
  [employeeId: string]: {
    [day: number]: ShiftType
  }
}

interface DayRecord {
  date: string        // YYYY-MM-DD
  dayLabel: string    // "Lunes 01", "Martes 02", ...
  entrada: string     // "08:00"
  salida: string      // "15:00"
  descanso: string    // "00:30"
  horasTrabajadas: number // decimal hours
  status: 'worked' | 'libre' | 'ausente'
}

const SHIFT_TIMES: Record<string, { entrada: string; salida: string; hours: number }> = {
  morning:   { entrada: '08:00', salida: '15:00', hours: 7 },
  afternoon: { entrada: '15:00', salida: '22:00', hours: 7 },
  night:     { entrada: '22:00', salida: '06:00', hours: 8 },
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

function getWeekStartKey(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function WorkHoursReportContent() {
  const searchParams = useSearchParams()
  const employeeId = searchParams.get('employee_id')
  const monthParam = searchParams.get('month') // YYYY-MM
  const tenantId = searchParams.get('tenant_id')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [records, setRecords] = useState<DayRecord[]>([])

  const loadReport = useCallback(async () => {
    if (!employeeId || !monthParam || !tenantId) {
      setError('Parametros incompletos. Se requiere employee_id, month y tenant_id.')
      setLoading(false)
      return
    }

    const [yearStr, monthStr] = monthParam.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr) - 1 // 0-indexed

    // Fetch tenant data
    const { data: tenantData, error: tenantErr } = await supabase
      .from('tenants')
      .select('name, staff_schedule')
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantErr || !tenantData) {
      setError('No se pudo cargar la informacion del negocio.')
      setLoading(false)
      return
    }

    setBusinessName(tenantData.name || 'Empresa')

    const staffData = tenantData.staff_schedule || {}
    const employees: Employee[] = staffData.employees || []
    const schedules: Record<string, WeekSchedule> = staffData.schedules || {}

    const emp = employees.find(e => e.id === employeeId)
    if (!emp) {
      setError('Empleado no encontrado.')
      setLoading(false)
      return
    }
    setEmployee(emp)

    // Build day records for the month
    const daysInMonth = getDaysInMonth(year, month)
    const dayRecords: DayRecord[] = []

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dateStr = date.toISOString().slice(0, 10)
      const dayOfWeek = date.getDay()
      const dayName = DAY_NAMES[dayOfWeek]
      const dayLabel = `${dayName} ${String(day).padStart(2, '0')}`

      // Find the week schedule that contains this date
      const weekKey = getWeekStartKey(date)
      const weekSchedule = schedules[weekKey]

      // Day index within the week (0=Monday .. 6=Sunday)
      const mondayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1

      const shift = weekSchedule?.[employeeId]?.[mondayIdx] || null

      if (shift && SHIFT_TIMES[shift]) {
        const st = SHIFT_TIMES[shift]
        dayRecords.push({
          date: dateStr,
          dayLabel,
          entrada: st.entrada,
          salida: st.salida,
          descanso: '00:30',
          horasTrabajadas: st.hours - 0.5, // discount 30min break
          status: 'worked',
        })
      } else if (dayOfWeek === 0) {
        // Sunday default as LIBRE
        dayRecords.push({
          date: dateStr,
          dayLabel,
          entrada: '-',
          salida: '-',
          descanso: '-',
          horasTrabajadas: 0,
          status: 'libre',
        })
      } else {
        // No shift assigned
        dayRecords.push({
          date: dateStr,
          dayLabel,
          entrada: '-',
          salida: '-',
          descanso: '-',
          horasTrabajadas: 0,
          status: 'libre',
        })
      }
    }

    setRecords(dayRecords)
    setLoading(false)
  }, [employeeId, monthParam, tenantId])

  useEffect(() => { loadReport() }, [loadReport])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
        <p>Cargando registro de jornada...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#c00', marginBottom: 8 }}>Error</p>
          <p style={{ fontSize: 14, color: '#555' }}>{error}</p>
        </div>
      </div>
    )
  }

  const today = new Date()
  const [yearStr, monthStr] = (monthParam || `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`).split('-')
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const monthIdx = Math.max(0, Math.min(11, (parseInt(monthStr) || 1) - 1))
  const monthLabel = `${monthNames[monthIdx]} ${yearStr || today.getFullYear()}`

  const totalHours = records.reduce((sum, r) => sum + r.horasTrabajadas, 0)
  const totalDaysWorked = records.filter(r => r.status === 'worked').length
  const avgHours = totalDaysWorked > 0 ? (totalHours / totalDaysWorked).toFixed(1) : '0'

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-page {
            padding: 20mm 15mm !important;
            max-width: none !important;
            margin: 0 !important;
          }
          .report-table { page-break-inside: auto; }
          .report-table tr { page-break-inside: avoid; }
          @page {
            size: A4;
            margin: 10mm 10mm;
          }
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .report-table th {
          background: #f0f0f0;
          border: 1px solid #ccc;
          padding: 6px 8px;
          text-align: center;
          font-weight: 700;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .report-table td {
          border: 1px solid #ddd;
          padding: 5px 8px;
          text-align: center;
          font-size: 11px;
        }
        .report-table tr:nth-child(even) { background: #fafafa; }
        .row-libre td { color: #888; font-style: italic; }
        .row-ausente td { color: #c00; font-style: italic; }
        .row-worked td { color: #222; }
      `}</style>

      {/* Print button bar */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#1a1a2e', padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
          Registro de Jornada &mdash; {employee?.name} &mdash; {monthLabel}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 700,
              color: '#0C1018', background: '#F0A84E',
              borderRadius: 8, border: 'none', cursor: 'pointer',
            }}
          >
            Descargar PDF (Imprimir)
          </button>
          <button
            onClick={() => window.close()}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              color: '#ccc', background: '#333',
              borderRadius: 8, border: '1px solid #555', cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Report content */}
      <div className="print-page" style={{
        maxWidth: 800, margin: '80px auto 40px', padding: '40px 32px',
        fontFamily: 'Arial, Helvetica, sans-serif', color: '#222',
        background: '#fff',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 8,
            background: '#f0f0f0', border: '1px solid #ddd',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: 10, color: '#999',
          }}>
            LOGO
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            {businessName}
          </h1>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: '#444' }}>
            Registro de Jornada Laboral
          </h2>
          <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
            {monthLabel}
          </p>
        </div>

        {/* Employee info */}
        <div style={{
          border: '1px solid #ddd', borderRadius: 6, padding: '12px 16px',
          marginBottom: 24, background: '#fafafa',
        }}>
          <table style={{ fontSize: 12, lineHeight: 1.8 }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 700, paddingRight: 16, color: '#555' }}>Trabajador/a:</td>
                <td>{employee?.name}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700, paddingRight: 16, color: '#555' }}>Puesto:</td>
                <td>{employee?.role}</td>
              </tr>
              {employee?.dni && (
                <tr>
                  <td style={{ fontWeight: 700, paddingRight: 16, color: '#555' }}>DNI/NIE:</td>
                  <td>{employee.dni}</td>
                </tr>
              )}
              <tr>
                <td style={{ fontWeight: 700, paddingRight: 16, color: '#555' }}>Periodo:</td>
                <td>{monthLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Day records table */}
        <table className="report-table">
          <thead>
            <tr>
              <th style={{ width: '28%' }}>Fecha</th>
              <th style={{ width: '14%' }}>Entrada</th>
              <th style={{ width: '14%' }}>Salida</th>
              <th style={{ width: '14%' }}>Descanso</th>
              <th style={{ width: '16%' }}>Horas trabajadas</th>
              <th style={{ width: '14%' }}>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.date} className={`row-${r.status}`}>
                <td style={{ textAlign: 'left', fontWeight: 500 }}>{r.dayLabel}</td>
                <td>{r.status === 'worked' ? r.entrada : '-'}</td>
                <td>{r.status === 'worked' ? r.salida : '-'}</td>
                <td>{r.status === 'worked' ? r.descanso : '-'}</td>
                <td style={{ fontWeight: r.status === 'worked' ? 600 : 400 }}>
                  {r.status === 'worked' ? `${r.horasTrabajadas.toFixed(1)}h` : '-'}
                </td>
                <td>
                  {r.status === 'libre' && 'LIBRE'}
                  {r.status === 'ausente' && 'AUSENTE'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary footer */}
        <div style={{
          marginTop: 24, border: '1px solid #ddd', borderRadius: 6,
          padding: '14px 16px', background: '#fafafa',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: '#333' }}>Resumen del mes</h3>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 12 }}>
            <div>
              <span style={{ color: '#666' }}>Total horas trabajadas: </span>
              <strong>{totalHours.toFixed(1)}h</strong>
            </div>
            <div>
              <span style={{ color: '#666' }}>Dias trabajados: </span>
              <strong>{totalDaysWorked}</strong>
            </div>
            <div>
              <span style={{ color: '#666' }}>Media horas/dia: </span>
              <strong>{avgHours}h</strong>
            </div>
          </div>
        </div>

        {/* Legal text */}
        <div style={{ marginTop: 32, fontSize: 10, color: '#888', lineHeight: 1.6 }}>
          <p>
            Registro de jornada conforme al articulo 34.9 del Estatuto de los Trabajadores
            (Real Decreto-ley 8/2019). La empresa garantiza la conservacion de estos registros
            durante un periodo minimo de cuatro anios.
          </p>
        </div>

        {/* Signature lines */}
        <div style={{
          marginTop: 40, display: 'flex', justifyContent: 'space-between',
          paddingTop: 20, fontSize: 11,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #999', width: 220, marginBottom: 6 }} />
            <p style={{ margin: 0, color: '#555' }}>Firma del trabajador/a</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #999', width: 220, marginBottom: 6 }} />
            <p style={{ margin: 0, color: '#555' }}>Firma de la empresa</p>
          </div>
        </div>

        {/* Date line */}
        <p style={{ marginTop: 32, fontSize: 11, color: '#666', textAlign: 'center' }}>
          Generado el {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </>
  )
}

export default function WorkHoursReportPage() {
  return (
    <UpgradeGate feature="informes_pdf">
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
          <p>Cargando...</p>
        </div>
      }>
        <WorkHoursReportContent />
      </Suspense>
    </UpgradeGate>
  )
}
