import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ATTENDANCE_RECORDS, WEEKLY_SCHEDULES, } from '../data'
import { supabase } from '../SupabaseClient'
import type { Employee, EmployeeStatus, AttendanceRecord, JornadaStatus } from '../data'

const GOLD = '#c9a84c'

const JORNADA_CFG: Record<JornadaStatus, { label: string; dot: string; bg: string; text: string }> = {
  EN_TURNO: {
    label: 'EN TURNO',
    dot: '#34d399',
    bg: 'rgba(6,78,59,0.35)',
    text: '#34d399',
  },
  SIN_LLEGADA: {
    label: 'SIN LLEGADA',
    dot: '#71717a',
    bg: 'rgba(39,39,42,0.6)',
    text: '#a1a1aa',
  },
  JORNADA_FINALIZADA: {
    label: 'JORNADA FINALIZADA',
    dot: '#52525b',
    bg: 'rgba(24,24,27,0.6)',
    text: '#71717a',
  },
  FUERA_DE_TURNO: {
    label: 'FUERA DE TURNO',
    dot: '#52525b',
    bg: 'rgba(39,39,42,0.6)',
    text: '#71717a',
  },
}

function JornadaBadge({ status }: { status: JornadaStatus }) {
  const c = JORNADA_CFG[status]

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: c.dot }}
      />
      {c.label}
    </span>
  )
}

function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const active = status === 'ACTIVO'

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
      style={{
        backgroundColor: active
          ? 'rgba(6,78,59,0.35)'
          : 'rgba(127,29,29,0.25)',
        color: active ? '#34d399' : '#f87171',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: active ? '#34d399' : '#f87171' }}
      />
      {active ? 'ACTIVO' : 'INACTIVO'}
    </span>
  )
}

function Avatar({
  name,
  size = 'sm',
}: {
  name: string
  size?: 'sm' | 'lg'
}) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const dim = size === 'lg' ? 64 : 32

  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold flex-shrink-0"
      style={{
        width: dim,
        height: dim,
        backgroundColor: 'rgba(201,168,76,0.12)',
        color: GOLD,
        border: '1px solid rgba(201,168,76,0.25)',
        fontSize: size === 'lg' ? 18 : 11,
      }}
    >
      {initials}
    </div>
  )
}


function getTodayDate() {
  const now = new Date()

  return now.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getCurrentTime() {
  const now = new Date()

  return now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function calculateHours(arrival: string, departure: string) {
  if (!arrival || !departure) return ''

  const [arrivalHour, arrivalMinute] = arrival.split(':').map(Number)
  const [departureHour, departureMinute] = departure.split(':').map(Number)

  const arrivalTotal = arrivalHour * 60 + arrivalMinute
  const departureTotal = departureHour * 60 + departureMinute

  let difference = departureTotal - arrivalTotal

  if (difference < 0) {
    difference += 24 * 60
  }

  const hours = Math.floor(difference / 60)
  const minutes = difference % 60

  return `${hours}h ${minutes.toString().padStart(2, '0')}min`
}

function Modal({
  children,
}: {
  children: React.ReactNode
}) {
  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center p-4">
      {children}
    </div>,
    document.body,
  )
}
export default function Employees() {

  const getEffectiveSchedule = (employeeId: string) => {
    const saved = localStorage.getItem('babieca_schedules')

    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)

    const weekStart = new Date(today)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)

    const weekKey = weekStart.toISOString().slice(0, 10)

    // 1. Primero: horario modificado manualmente para esta semana
    if (saved) {
      try {
        const schedules = JSON.parse(saved)
        const override = schedules[employeeId]?.[weekKey]

        if (override) {
          return override
        }
      } catch {
        // Si localStorage falla, continuamos con la rotación
      }
    }

    // 2. Horario de la rotación semanal
    const rotations = WEEKLY_SCHEDULES[employeeId]

    if (!rotations || rotations.length === 0) {
      return Array(7).fill('—')
    }

    // La rotación comienza en la semana del 31/08/2026
    const rotationAnchor = new Date('2026-08-31T00:00:00')

    const weeksSinceAnchor = Math.floor(
      (weekStart.getTime() - rotationAnchor.getTime()) /
      (7 * 24 * 60 * 60 * 1000)
    )

    const rotationIndex =
      ((weeksSinceAnchor % rotations.length) + rotations.length) %
      rotations.length

    return rotations[rotationIndex]
  }
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(true)

  useEffect(() => {
    const loadEmployees = async () => {
      setEmployeesLoading(true)

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('id')

      if (error) {
        console.error('Error cargando empleados:', error)
        setEmployeesLoading(false)
        return
      }

      setEmployees(data as Employee[])
      setEmployeesLoading(false)
    }

    loadEmployees()
  }, [])

  const [attendance, setAttendance] =
    useState<AttendanceRecord[]>(() => {
      const saved = localStorage.getItem('babieca_attendance')

      if (!saved) {
        return ATTENDANCE_RECORDS
      }

      try {
        return JSON.parse(saved)
      } catch {
        return ATTENDANCE_RECORDS
      }
    })

  const saveAttendance = (
    updated: AttendanceRecord[],
  ) => {
    setAttendance(updated)

    localStorage.setItem(
      'babieca_attendance',
      JSON.stringify(updated),
    )
  }


  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<JornadaStatus | 'ALL'>('ALL')

  const [profileId, setProfileId] = useState<string | null>(null)

  const [arrivalModal, setArrivalModal] = useState(false)
  const [departureModal, setDepartureModal] = useState(false)
  const [employeeModal, setEmployeeModal] = useState(false)
  const [editingEmployee, setEditingEmployee] =
    useState<Employee | null>(null)

  const [selectedEmp, setSelectedEmp] =
    useState<Employee | null>(null)

  const [arrivalTime, setArrivalTime] =
    useState(getCurrentTime())

  const [departureTime, setDepartureTime] =
    useState(getCurrentTime())

  const [arrivalObs, setArrivalObs] = useState('')
  const [departureObs, setDepartureObs] = useState('')

  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')

  const dateStr = getTodayDate()

  const getTodayAttendance = (employeeId: string) => {
    return attendance.find(
      record =>
        record.employeeId === employeeId &&
        record.date === dateStr,
    )
  }

  const getJornadaStatus = (
    employeeId: string,
  ): JornadaStatus => {
    const record = getTodayAttendance(employeeId)

    const schedule = getEffectiveSchedule(employeeId)

    // Día de la semana actual
    const dayOfWeek = new Date().getDay()

    // Convertimos domingo = 6 para que:
    // lunes = 0 ... domingo = 6
    const scheduleDay =
      dayOfWeek === 0 ? 6 : dayOfWeek - 1

    const todaySchedule =
      schedule?.[scheduleDay]

    // No tiene turno o está de descanso
    if (
      !todaySchedule ||
      todaySchedule === 'DESCANSO' ||
      todaySchedule === '—'
    ) {
      return 'FUERA_DE_TURNO'
    }

    // Extraemos hora de entrada y salida
    const [startTime, endTime] =
      todaySchedule.split('–')

    const now = new Date()

    const currentMinutes =
      now.getHours() * 60 + now.getMinutes()

    const [startHour, startMinute] =
      startTime.split(':').map(Number)

    const startMinutes =
      startHour * 60 + startMinute

    const [endHour, endMinute] =
      endTime.split(':').map(Number)

    let endMinutes =
      endHour * 60 + endMinute

    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60
    }

    // Si ya registró salida
    if (record?.departure) {
      return 'JORNADA_FINALIZADA'
    }

    // Si ya registró llegada, permanece EN TURNO
    // hasta que registre la salida
    if (record?.arrival) {
      return 'EN_TURNO'
    }

    // Antes de comenzar el turno
    if (currentMinutes < startMinutes) {
      return 'FUERA_DE_TURNO'
    }

    // Dentro del horario pero todavía no registra llegada
    if (currentMinutes < endMinutes) {
      return 'SIN_LLEGADA'
    }

    // El turno terminó y nunca registró llegada
    return 'FUERA_DE_TURNO'
  }
  const getHistory = (employeeId: string) => {
    return attendance.filter(
      record => record.employeeId === employeeId,
    )
  }

  const filtered = employees.filter(employee => {
    const matchesSearch =
      employee.name
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      employee.role
        .toLowerCase()
        .includes(search.toLowerCase())

    const jornadaStatus =
      getJornadaStatus(employee.id)

    const matchesStatus =
      statusFilter === 'ALL' ||
      jornadaStatus === statusFilter

    return matchesSearch && matchesStatus
  })

  const stats = {
    active: employees.filter(
      e => e.status === 'ACTIVO',
    ).length,

    onShift: employees.filter(
      e =>
        e.status === 'ACTIVO' &&
        getJornadaStatus(e.id) === 'EN_TURNO',
    ).length,

    noArrival: employees.filter(
      e =>
        e.status === 'ACTIVO' &&
        getJornadaStatus(e.id) === 'SIN_LLEGADA',
    ).length,

    finished: employees.filter(
      e =>
        e.status === 'ACTIVO' &&
        getJornadaStatus(e.id) ===
        'JORNADA_FINALIZADA',
    ).length,
  }

  const openArrivalModal = (
    employee?: Employee,
  ) => {
    setSelectedEmp(employee || null)
    setArrivalTime(getCurrentTime())
    setArrivalObs('')
    setArrivalModal(true)
  }

  const openDepartureModal = (
    employee?: Employee,
  ) => {
    setSelectedEmp(employee || null)
    setDepartureTime(getCurrentTime())
    setDepartureObs('')
    setDepartureModal(true)
  }

  const closeArrivalModal = () => {
    setArrivalModal(false)
    setSelectedEmp(null)
    setArrivalObs('')
  }

  const closeDepartureModal = () => {
    setDepartureModal(false)
    setSelectedEmp(null)
    setDepartureObs('')
  }

  const handleArrival = () => {
    if (!selectedEmp || !arrivalTime) return

    const existing =
      getTodayAttendance(selectedEmp.id)

    if (existing) {
      const updated = attendance.map(record =>
        record.id === existing.id
          ? {
            ...record,
            arrival: arrivalTime,
            notes: arrivalObs,
          }
          : record,
      )

      saveAttendance(updated)
    } else {
      const newRecord: AttendanceRecord = {
        id: `A${Date.now()}`,
        employeeId: selectedEmp.id,
        date: dateStr,
        arrival: arrivalTime,
        notes: arrivalObs,
      }

      const updated = [
        newRecord,
        ...attendance,
      ]

      saveAttendance(updated)
    }

    closeArrivalModal()
  }

  const handleDeparture = () => {
    if (!selectedEmp || !departureTime) return

    const existing =
      getTodayAttendance(selectedEmp.id)

    if (!existing?.arrival) return

    const hours = calculateHours(
      existing.arrival,
      departureTime,
    )

    const updated = attendance.map(record =>
      record.id === existing.id
        ? {
          ...record,
          departure: departureTime,
          hours,
          notes: departureObs,
        }
        : record,
    )

    saveAttendance(updated)

    closeDepartureModal()
  }

  const handleAddEmployee = async () => {
    if (!newName.trim() || !newRole.trim()) {
      return
    }

    const maxId = employees.reduce(
      (max, employee) =>
        Math.max(max, Number(employee.id)),
      0,
    )

    const newEmployee: Employee = {
      id: String(maxId + 1).padStart(3, '0'),
      name: newName.trim(),
      role: newRole.trim(),
      status: 'ACTIVO',
    }

    const { data, error } = await supabase
      .from('employees')
      .insert(newEmployee)
      .select()
      .single()

    if (error) {
      console.error('Error agregando empleado:', error)
      return
    }

    setEmployees(prev => [
      ...prev,
      data as Employee,
    ])

    setNewName('')
    setNewRole('')
    setEmployeeModal(false)
  }

  const handleEditEmployee = async () => {
    if (
      !editingEmployee ||
      !newName.trim() ||
      !newRole.trim()
    ) {
      return
    }

    const { data, error } = await supabase
      .from('employees')
      .update({
        name: newName.trim(),
        role: newRole.trim(),
      })
      .eq('id', editingEmployee.id)
      .select()
      .single()

    if (error) {
      console.error('Error editando empleado:', error)
      return
    }

    setEmployees(prev =>
      prev.map(employee =>
        employee.id === editingEmployee.id
          ? (data as Employee)
          : employee,
      ),
    )

    setNewName('')
    setNewRole('')
    setEditingEmployee(null)
    setEmployeeModal(false)
  }

  const toggleEmployeeStatus = async (
    employee: Employee,
  ) => {
    const newStatus: EmployeeStatus =
      employee.status === 'ACTIVO'
        ? 'INACTIVO'
        : 'ACTIVO'

    const { data, error } = await supabase
      .from('employees')
      .update({
        status: newStatus,
      })
      .eq('id', employee.id)
      .select()
      .single()

    if (error) {
      console.error(
        'Error cambiando estado del empleado:',
        error,
      )
      return
    }

    setEmployees(prev =>
      prev.map(e =>
        e.id === employee.id
          ? (data as Employee)
          : e,
      ),
    )
  }

  const inputCls =
    'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors'

  const labelCls =
    'text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 block'

  return (
    <>
      {/* ================================================= */}
      {/* PERFIL / PÁGINA PRINCIPAL */}
      {/* ================================================= */}

      {profileId ? (
        (() => {
          const emp = employees.find(
            e => e.id === profileId,
          )

          if (!emp) {
            return null
          }

          const history =
            getHistory(profileId)

          return (
            <div className="p-6 space-y-6 max-w-4xl mx-auto">

              <button
                onClick={() =>
                  setProfileId(null)
                }
                className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>

                Volver a Empleados
              </button>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

                <div className="flex flex-col sm:flex-row sm:items-start gap-4">

                  <Avatar
                    name={emp.name}
                    size="lg"
                  />

                  <div className="flex-1">

                    <h2 className="text-xl font-semibold text-zinc-100">
                      {emp.name}
                    </h2>

                    <p className="text-sm text-zinc-500 mt-0.5">
                      {emp.role} · ID {emp.id}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">

                      <EmployeeStatusBadge
                        status={emp.status}
                      />

                      <JornadaBadge
                        status={getJornadaStatus(
                          emp.id,
                        )}
                      />

                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">

                      <button
                        onClick={() => {
                          setEditingEmployee(emp)
                          setNewName(emp.name)
                          setNewRole(emp.role)
                          setEmployeeModal(true)
                        }}
                        className="px-3 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
                      >
                        Editar empleado
                      </button>

                      <button
                        onClick={() =>
                          toggleEmployeeStatus(emp)
                        }
                        className="px-3 py-2 text-sm rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                      >
                        {emp.status === 'ACTIVO'
                          ? 'Desactivar empleado'
                          : 'Activar empleado'}
                      </button>

                    </div>

                  </div>

                </div>

              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">

                <div className="px-5 py-4 border-b border-zinc-800">

                  <h3 className="text-sm font-semibold text-zinc-100">
                    Historial de asistencia
                  </h3>

                </div>

                <div className="overflow-x-auto">

                  <table className="w-full">

                    <thead>

                      <tr className="bg-zinc-950">

                        {[
                          'Fecha',
                          'Entrada',
                          'Salida',
                          'Horas',
                          'Observaciones',
                        ].map(header => (
                          <th
                            key={header}
                            className="px-5 py-3 text-left text-xs font-medium text-zinc-600 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-zinc-800/50">

                      {history.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-5 py-10 text-center text-sm text-zinc-700"
                          >
                            Sin registros
                          </td>
                        </tr>
                      ) : (
                        history.map(record => (
                          <tr
                            key={record.id}
                            className="hover:bg-zinc-800/20 transition-colors"
                          >

                            <td
                              className="px-5 py-3 text-sm text-zinc-400"
                              style={{
                                fontFamily:
                                  'JetBrains Mono, monospace',
                              }}
                            >
                              {record.date}
                            </td>

                            <td
                              className="px-5 py-3 text-sm text-emerald-400"
                              style={{
                                fontFamily:
                                  'JetBrains Mono, monospace',
                              }}
                            >
                              {record.arrival || '—'}
                            </td>

                            <td
                              className="px-5 py-3 text-sm text-zinc-400"
                              style={{
                                fontFamily:
                                  'JetBrains Mono, monospace',
                              }}
                            >
                              {record.departure || '—'}
                            </td>

                            <td
                              className="px-5 py-3 text-sm text-zinc-300"
                              style={{
                                fontFamily:
                                  'JetBrains Mono, monospace',
                              }}
                            >
                              {record.hours || '—'}
                            </td>

                            <td className="px-5 py-3 text-sm text-zinc-600">
                              {record.notes || '—'}
                            </td>

                          </tr>
                        ))
                      )}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>
          )
        })()
      ) : (

        // =================================================
        // PÁGINA PRINCIPAL
        // =================================================

        <div className="p-6 space-y-6 max-w-7xl mx-auto">

          {/* Aquí va TODO tu contenido actual de la
              página principal de empleados */}

          {/* STATS */}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            {[
              {
                label: 'Activos',
                value: stats.active,
                color: '#f4f4f5',
              },
              {
                label: 'En turno',
                value: stats.onShift,
                color: '#34d399',
              },
              {
                label: 'Sin llegada',
                value: stats.noArrival,
                color: '#fbbf24',
              },
              {
                label: 'Jornada finalizada',
                value: stats.finished,
                color: '#71717a',
              },
            ].map(stat => (
              <div
                key={stat.label}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
              >
                <div
                  className="text-3xl font-bold mb-1"
                  style={{
                    fontFamily:
                      'JetBrains Mono, monospace',
                    color: stat.color,
                  }}
                >
                  {stat.value}
                </div>

                <div className="text-xs text-zinc-600">
                  {stat.label}
                </div>
              </div>
            ))}

          </div>

          {/* FILTROS */}

          <div className="flex flex-col sm:flex-row gap-3">

            <div className="relative flex-1">

              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>

              <input
                value={search}
                onChange={e =>
                  setSearch(e.target.value)
                }
                placeholder="Buscar empleado o cargo..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-colors"
              />

            </div>

            <select
              value={statusFilter}
              onChange={e =>
                setStatusFilter(
                  e.target.value as
                  | JornadaStatus
                  | 'ALL',
                )
              }
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-400 focus:outline-none cursor-pointer"
            >
              <option value="ALL">
                Todos los estados
              </option>

              <option value="EN_TURNO">
                En turno
              </option>

              <option value="SIN_LLEGADA">
                Sin llegada
              </option>

              <option value="JORNADA_FINALIZADA">
                Jornada finalizada
              </option>

              <option value="FUERA_DE_TURNO">
                Fuera de turno
              </option>
            </select>

            <button
              onClick={() => {
                setEditingEmployee(null)
                setNewName('')
                setNewRole('')
                setEmployeeModal(true)
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap"
              style={{
                backgroundColor: GOLD,
                color: '#09090b',
              }}
            >
              + Agregar empleado
            </button>

            <button
              onClick={() =>
                openArrivalModal()
              }
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap"
              style={{
                backgroundColor:
                  'rgba(6,78,59,0.4)',
                color: '#34d399',
                border:
                  '1px solid rgba(52,211,153,0.2)',
              }}
            >
              Registrar llegada
            </button>

            <button
              onClick={() =>
                openDepartureModal()
              }
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-400 border border-zinc-800 hover:bg-zinc-800 transition-colors whitespace-nowrap"
            >
              Registrar salida
            </button>

          </div>

          {/* TABLA */}

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">

            <div className="overflow-x-auto">

              <table className="w-full min-w-[850px]">

                <thead>

                  <tr className="bg-zinc-950 text-left">

                    {[
                      'Empleado',
                      'Cargo',
                      'Estado',
                      'Entrada',
                      'Salida',
                      'Horas trabajadas',
                      'Acciones',
                    ].map(header => (
                      <th
                        key={header}
                        className="px-5 py-3 text-xs font-medium text-zinc-600 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}

                  </tr>

                </thead>

                <tbody className="divide-y divide-zinc-800/50">

                  {filtered.map(employee => {

                    const record =
                      getTodayAttendance(
                        employee.id,
                      )

                    const jornadaStatus =
                      getJornadaStatus(
                        employee.id,
                      )

                    return (
                      <tr
                        key={employee.id}
                        className="hover:bg-zinc-800/20 transition-colors group"
                      >

                        <td className="px-5 py-3">

                          <button
                            onClick={() =>
                              setProfileId(
                                employee.id,
                              )
                            }
                            className="flex items-center gap-3"
                          >

                            <Avatar
                              name={employee.name}
                            />

                            <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                              {employee.name}
                            </span>

                          </button>

                        </td>

                        <td className="px-5 py-3 text-sm text-zinc-500">
                          {employee.role}
                        </td>

                        <td className="px-5 py-3">
                          <JornadaBadge
                            status={
                              jornadaStatus
                            }
                          />
                        </td>

                        <td
                          className="px-5 py-3 text-sm text-zinc-400"
                          style={{
                            fontFamily:
                              'JetBrains Mono, monospace',
                          }}
                        >
                          {record?.arrival || '—'}
                        </td>

                        <td
                          className="px-5 py-3 text-sm text-zinc-400"
                          style={{
                            fontFamily:
                              'JetBrains Mono, monospace',
                          }}
                        >
                          {record?.departure || '—'}
                        </td>

                        <td
                          className="px-5 py-3 text-sm text-zinc-400"
                          style={{
                            fontFamily:
                              'JetBrains Mono, monospace',
                          }}
                        >
                          {record?.hours || '—'}
                        </td>

                        <td className="px-5 py-3">

                          <div className="flex gap-2">

                            {employee.status ===
                              'ACTIVO' &&
                              jornadaStatus ===
                              'SIN_LLEGADA' && (
                                <button
                                  onClick={() =>
                                    openArrivalModal(
                                      employee,
                                    )
                                  }
                                  className="px-2.5 py-1 text-xs rounded transition-colors"
                                  style={{
                                    backgroundColor:
                                      'rgba(6,78,59,0.35)',
                                    color:
                                      '#34d399',
                                    border:
                                      '1px solid rgba(52,211,153,0.2)',
                                  }}
                                >
                                  Llegada
                                </button>
                              )}

                            {employee.status ===
                              'ACTIVO' &&
                              jornadaStatus ===
                              'EN_TURNO' && (
                                <button
                                  onClick={() =>
                                    openDepartureModal(
                                      employee,
                                    )
                                  }
                                  className="px-2.5 py-1 text-xs rounded bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 transition-colors"
                                >
                                  Salida
                                </button>
                              )}

                            <button
                              onClick={() =>
                                setProfileId(
                                  employee.id,
                                )
                              }
                              className="px-2.5 py-1 text-xs rounded bg-zinc-800/50 text-zinc-500 border border-zinc-800 hover:text-zinc-300 transition-colors"
                            >
                              Perfil
                            </button>

                          </div>

                        </td>

                      </tr>
                    )
                  })}

                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-sm text-zinc-700"
                      >
                        No se encontraron empleados
                      </td>
                    </tr>
                  )}

                </tbody>

              </table>

            </div>

          </div>

        </div>
      )}

      {/* ================================================= */}
      {/* MODAL EMPLEADO */}
      {/* ================================================= */}

      {employeeModal && (
        <Modal>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">

            <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">

              <h3 className="text-base font-semibold text-zinc-100">
                {editingEmployee
                  ? 'Editar empleado'
                  : 'Agregar empleado'}
              </h3>

              <button
                onClick={() => {
                  setEmployeeModal(false)
                  setEditingEmployee(null)
                }}
                className="text-zinc-600 hover:text-zinc-300"
              >
                ✕
              </button>

            </div>

            <div className="p-6 space-y-4">

              <div>

                <label className={labelCls}>
                  Nombre completo
                </label>

                <input
                  value={newName}
                  onChange={e =>
                    setNewName(e.target.value)
                  }
                  placeholder="Ej. Juan Pérez"
                  className={inputCls}
                />

              </div>

              <div>

                <label className={labelCls}>
                  Cargo
                </label>

                <input
                  value={newRole}
                  onChange={e =>
                    setNewRole(e.target.value)
                  }
                  placeholder="Ej. Cajero"
                  className={inputCls}
                />

              </div>

            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">

              <button
                onClick={() => {
                  setEmployeeModal(false)
                  setEditingEmployee(null)
                }}
                className="px-4 py-2 text-sm text-zinc-500 border border-zinc-800 rounded-lg hover:bg-zinc-800"
              >
                Cancelar
              </button>

              <button
                onClick={
                  editingEmployee
                    ? handleEditEmployee
                    : handleAddEmployee
                }
                className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
                style={{
                  backgroundColor: GOLD,
                  color: '#09090b',
                }}
              >
                {editingEmployee
                  ? 'Guardar cambios'
                  : 'Agregar empleado'}
              </button>

            </div>

          </div>

        </Modal>
      )}

      {/* ================================================= */}
      {/* MODAL LLEGADA */}
      {/* ================================================= */}

      {arrivalModal && (
        <Modal>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">

            <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">

              <h3 className="text-base font-semibold text-zinc-100">
                Registrar llegada
              </h3>

              <button
                onClick={closeArrivalModal}
                className="text-zinc-600 hover:text-zinc-300"
              >
                ✕
              </button>

            </div>

            <div className="p-6 space-y-4">

              <div>

                <label className={labelCls}>
                  Empleado
                </label>

                <select
                  value={
                    selectedEmp?.id || ''
                  }
                  onChange={e =>
                    setSelectedEmp(
                      employees.find(
                        employee =>
                          employee.id ===
                          e.target.value,
                      ) || null,
                    )
                  }
                  className={inputCls}
                >

                  <option value="">
                    Seleccionar empleado...
                  </option>

                  {employees
                    .filter(
                      employee =>
                        employee.status ===
                        'ACTIVO' &&
                        getJornadaStatus(
                          employee.id,
                        ) ===
                        'SIN_LLEGADA',
                    )
                    .map(employee => (
                      <option
                        key={employee.id}
                        value={employee.id}
                      >
                        {employee.name} —{' '}
                        {employee.role}
                      </option>
                    ))}

                </select>

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className={labelCls}>
                    Fecha
                  </label>

                  <input
                    value={dateStr}
                    readOnly
                    className={
                      inputCls +
                      ' text-zinc-500'
                    }
                    style={{
                      fontFamily:
                        'JetBrains Mono, monospace',
                    }}
                  />

                </div>

                <div>

                  <label className={labelCls}>
                    Hora
                  </label>

                  <input
                    type="time"
                    value={arrivalTime}
                    onChange={e =>
                      setArrivalTime(
                        e.target.value,
                      )
                    }
                    className={
                      inputCls +
                      ' text-emerald-400'
                    }
                    style={{
                      fontFamily:
                        'JetBrains Mono, monospace',
                    }}
                  />

                </div>

              </div>

              <div>

                <label className={labelCls}>
                  Observación (opcional)
                </label>

                <textarea
                  value={arrivalObs}
                  onChange={e =>
                    setArrivalObs(
                      e.target.value,
                    )
                  }
                  rows={2}
                  placeholder="Añadir nota..."
                  className={
                    inputCls +
                    ' resize-none'
                  }
                />

              </div>

            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">

              <button
                onClick={closeArrivalModal}
                className="px-4 py-2 text-sm text-zinc-500 border border-zinc-800 rounded-lg hover:bg-zinc-800"
              >
                Cancelar
              </button>

              <button
                onClick={handleArrival}
                disabled={!selectedEmp}
                className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
                style={{
                  backgroundColor: GOLD,
                  color: '#09090b',
                }}
              >
                Registrar llegada
              </button>

            </div>

          </div>

        </Modal>
      )}

      {/* ================================================= */}
      {/* MODAL SALIDA */}
      {/* ================================================= */}

      {departureModal && (
        <Modal>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">

            <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">

              <h3 className="text-base font-semibold text-zinc-100">
                Registrar salida
              </h3>

              <button
                onClick={closeDepartureModal}
                className="text-zinc-600 hover:text-zinc-300"
              >
                ✕
              </button>

            </div>

            <div className="p-6 space-y-4">

              <div>

                <label className={labelCls}>
                  Empleado
                </label>

                <select
                  value={
                    selectedEmp?.id || ''
                  }
                  onChange={e =>
                    setSelectedEmp(
                      employees.find(
                        employee =>
                          employee.id ===
                          e.target.value,
                      ) || null,
                    )
                  }
                  className={inputCls}
                >

                  <option value="">
                    Seleccionar empleado...
                  </option>

                  {employees
                    .filter(
                      employee =>
                        employee.status ===
                        'ACTIVO' &&
                        getJornadaStatus(
                          employee.id,
                        ) ===
                        'EN_TURNO',
                    )
                    .map(employee => (
                      <option
                        key={employee.id}
                        value={employee.id}
                      >
                        {employee.name} —{' '}
                        {employee.role}
                      </option>
                    ))}

                </select>

              </div>

              {selectedEmp && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3">

                  <div className="flex justify-between text-sm">

                    <span className="text-zinc-600">
                      Entrada registrada:
                    </span>

                    <span
                      className="text-emerald-400"
                      style={{
                        fontFamily:
                          'JetBrains Mono, monospace',
                      }}
                    >
                      {
                        getTodayAttendance(
                          selectedEmp.id,
                        )?.arrival
                      }
                    </span>

                  </div>

                </div>
              )}

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className={labelCls}>
                    Fecha
                  </label>

                  <input
                    value={dateStr}
                    readOnly
                    className={
                      inputCls +
                      ' text-zinc-500'
                    }
                    style={{
                      fontFamily:
                        'JetBrains Mono, monospace',
                    }}
                  />

                </div>

                <div>

                  <label className={labelCls}>
                    Hora
                  </label>

                  <input
                    type="time"
                    value={departureTime}
                    onChange={e =>
                      setDepartureTime(
                        e.target.value,
                      )
                    }
                    className={
                      inputCls +
                      ' text-zinc-300'
                    }
                    style={{
                      fontFamily:
                        'JetBrains Mono, monospace',
                    }}
                  />

                </div>

              </div>

              <div>

                <label className={labelCls}>
                  Observación (opcional)
                </label>

                <textarea
                  value={departureObs}
                  onChange={e =>
                    setDepartureObs(
                      e.target.value,
                    )
                  }
                  rows={2}
                  placeholder="Añadir nota..."
                  className={
                    inputCls +
                    ' resize-none'
                  }
                />

              </div>

            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">

              <button
                onClick={closeDepartureModal}
                className="px-4 py-2 text-sm text-zinc-500 border border-zinc-800 rounded-lg hover:bg-zinc-800"
              >
                Cancelar
              </button>

              <button
                onClick={handleDeparture}
                disabled={!selectedEmp}
                className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
                style={{
                  backgroundColor: GOLD,
                  color: '#09090b',
                }}
              >
                Registrar salida
              </button>

            </div>

          </div>

        </Modal>
      )}

    </>
  )
}
