import { useState } from 'react'
import { EMPLOYEES, SCHEDULE, TEMPORARY_WEEKLY_SCHEDULES, } from '../data'

const GOLD = '#c9a84c'
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmtDate(date: Date) {
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const TODAY = new Date()

export default function Schedules() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [addModal, setAddModal] = useState(false)
  const [overrides, setOverrides] =
    useState<Record<string, Record<string, string[]>>>(() => {
      const saved = localStorage.getItem('babieca_schedules')

      if (!saved) return {}

      try {
        return JSON.parse(saved)
      } catch {
        return {}
      }
    })

  const saveOverrides = (
    updated: Record<string, Record<string, string[]>>
  ) => {
    setOverrides(updated)
    localStorage.setItem(
      'babieca_schedules',
      JSON.stringify(updated)
    )
  }

  const [form, setForm] = useState({ empId: '', dayIdx: '0', start: '08:00', end: '16:00', special: '' })

  const weekStart = addDays(getWeekStart(TODAY), weekOffset * 7)
  const weekDates = DAYS.map((_, i) => addDays(weekStart, i))

  const todayDayIdx = (() => {
    const d = TODAY.getDay()
    return d === 0 ? 6 : d - 1
  })()

  const getSchedule = (empId: string) => {
    const weekKey = weekStart.toISOString().slice(0, 10)

    // Si existe una modificación específica para esta semana,
    // tiene prioridad.
    if (overrides[empId]?.[weekKey]) {
      return overrides[empId][weekKey]
    }



    // Rotación temporal para los demás empleados.
    const rotations = TEMPORARY_WEEKLY_SCHEDULES[empId]

    if (rotations) {
      const rotationIndex =
        ((weekOffset % rotations.length) + rotations.length) %
        rotations.length

      return rotations[rotationIndex]
    }

    return SCHEDULE[empId] || Array(7).fill('—')
  }
  const handleAdd = () => {
    if (!form.empId) return
    const dayIdx = parseInt(form.dayIdx)
    const value = form.special || `${form.start}–${form.end}`
    const weekKey = weekStart.toISOString().slice(0, 10)

    const current = [
      ...(overrides[form.empId]?.[weekKey] || getSchedule(form.empId)),
    ]

    current[dayIdx] = value

    const updated = {
      ...overrides,
      [form.empId]: {
        ...overrides[form.empId],
        [weekKey]: current,
      },
    }

    saveOverrides(updated)
    setAddModal(false)
  }


  const getCellColor = (value: string) => {
    if (value === 'DESCANSO') return '#52525b'
    if (value === 'VACACIONES') return '#f59e0b'
    if (value === '—') return '#3f3f46'
    return '#d4d4d8'
  }

  const isCurrentWeek = weekOffset === 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div className="text-sm">
            <span className="font-medium text-zinc-200">
              {isCurrentWeek ? 'Semana actual' : weekOffset < 0 ? `Semana anterior` : 'Próxima semana'}
            </span>
            <span className="text-zinc-600 ml-2">{fmtDate(weekStart)} — {fmtDate(addDays(weekStart, 6))}, 2026</span>
          </div>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)}
              className="px-3 py-1 text-xs rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-200 transition-colors">
              Hoy
            </button>
          )}
        </div>
        <button onClick={() => setAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ backgroundColor: GOLD, color: '#09090b' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e4c97a')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = GOLD)}>
          + Asignar horario
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="bg-zinc-950">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 uppercase tracking-wider w-44">Empleado</th>
                {DAYS.map((day, i) => {
                  const isToday = isCurrentWeek && i === todayDayIdx
                  return (
                    <th key={day} className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: isToday ? GOLD : '#52525b' }}>
                      <div>{day.slice(0, 3)}</div>
                      <div className="text-xs mt-0.5 font-normal" style={{ fontFamily: 'JetBrains Mono, monospace', color: isToday ? GOLD : '#3f3f46' }}>
                        {fmtDate(weekDates[i])}
                      </div>
                      {isToday && <div className="w-1 h-1 rounded-full mx-auto mt-1" style={{ backgroundColor: GOLD }} />}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {EMPLOYEES.map(emp => (
                <tr key={emp.id} className="hover:bg-zinc-800/15 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium" style={{ backgroundColor: '#27272a', color: '#a1a1aa' }}>
                        {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-300 truncate">{emp.name.split(' ').slice(0, 2).join(' ')}</div>
                        <div className="text-xs text-zinc-700">{emp.role}</div>
                      </div>
                    </div>
                  </td>
                  {getSchedule(emp.id).map((cell, i) => {
                    const isToday = isCurrentWeek && i === todayDayIdx
                    return (
                      <td key={i} className="px-3 py-3 text-center" style={{ backgroundColor: isToday ? 'rgba(201,168,76,0.04)' : undefined }}>
                        <span className="text-xs" style={{ fontFamily: cell.includes(':') ? 'JetBrains Mono, monospace' : undefined, color: getCellColor(cell) }}>
                          {cell}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs text-zinc-700 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-zinc-500">08:00–16:00</span> Turno activo
        </span>
        <span className="flex items-center gap-1.5"><span style={{ color: '#52525b' }}>DESCANSO</span> Día libre</span>
        <span className="flex items-center gap-1.5"><span style={{ color: '#f59e0b' }}>VACACIONES</span> Vacaciones</span>
        <span className="flex items-center gap-1.5"><span style={{ color: '#3f3f46' }}>—</span> Sin asignar</span>
      </div>

      {addModal && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-100">Asignar horario</h3>
              <button onClick={() => setAddModal(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                {
                  label: 'Empleado', field: (
                    <select value={form.empId} onChange={e => setForm({ ...form, empId: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none">
                      <option value="">Seleccionar...</option>
                      {EMPLOYEES.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  )
                },
                {
                  label: 'Día', field: (
                    <select value={form.dayIdx} onChange={e => setForm({ ...form, dayIdx: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none">
                      {DAYS.map((d, i) => <option key={i} value={i}>{d} — {fmtDate(weekDates[i])}</option>)}
                    </select>
                  )
                },
              ].map(({ label, field }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 block">{label}</label>
                  {field}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 block">Entrada</label>
                  <input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value, special: '' })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none" style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 block">Salida</label>
                  <input type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value, special: '' })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none" style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 block">O marcar como</label>
                <div className="flex gap-2">
                  {['DESCANSO', 'VACACIONES'].map(s => (
                    <button key={s} onClick={() => setForm({ ...form, special: s })}
                      className="px-3 py-1.5 text-xs rounded-lg border transition-colors"
                      style={form.special === s
                        ? { backgroundColor: GOLD, color: '#09090b', borderColor: GOLD }
                        : { backgroundColor: '#18181b', color: '#71717a', borderColor: '#3f3f46' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button onClick={() => setAddModal(false)} className="px-4 py-2 text-sm text-zinc-500 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors">Cancelar</button>
              <button onClick={handleAdd} disabled={!form.empId}
                className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
                style={{ backgroundColor: GOLD, color: '#09090b' }}>
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
