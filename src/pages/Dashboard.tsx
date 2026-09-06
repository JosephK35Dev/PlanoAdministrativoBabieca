import { useEffect, useState } from 'react'
import { EMPLOYEES, WITHDRAWALS } from '../data'
import type { BonusRecord, Page, AttendanceRecord } from '../data'


const GOLD = '#c9a84c'

function StatCard({ icon, label, value, sub, accent = false }: {
  icon: string; label: string; value: number | string; sub: string; accent?: boolean
}) {
  return (
    <div
      className="bg-zinc-900 rounded-xl p-5 border"
      style={{ borderColor: accent ? 'rgba(201,168,76,0.3)' : '#27272a' }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xl">{icon}</span>
        {accent && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mt-0.5" />}
      </div>
      <div
        className="text-3xl font-bold mb-1"
        style={{ fontFamily: 'JetBrains Mono, monospace', color: accent ? GOLD : '#f4f4f5' }}
      >
        {value}
      </div>
      <div className="text-xs font-medium text-zinc-300 mb-0.5">{label}</div>
      <div className="text-xs text-zinc-600">{sub}</div>
    </div>
  )
}

function DayStatusRow({ label, value, variant }: {
  label: string; value: number; variant: 'ok' | 'warn' | 'danger' | 'neutral'
}) {
  const colors = { ok: '#34d399', warn: '#fbbf24', danger: '#f87171', neutral: '#71717a' }
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-zinc-300">{label}</span>
      <span className="text-sm font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace', color: colors[variant] }}>
        {value}
      </span>
    </div>
  )
}

function getTodayKey() {
  const now = new Date()

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const getTodayDate = () => {
  const now = new Date()

  return `${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1,
  ).padStart(2, '0')}/${now.getFullYear()}`
}

const TODAY_PREFIX = getTodayDate()

export default function Dashboard({ navigate }: { navigate: (page: Page) => void }) {
  const [todayBonuses, setTodayBonuses] = useState<BonusRecord[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('babieca_daily_bonuses')

    if (!saved) {
      setTodayBonuses([])
      return
    }

    try {
      const parsed = JSON.parse(saved)

      if (parsed.date === getTodayKey()) {
        setTodayBonuses(parsed.records || [])
      } else {
        setTodayBonuses([])
      }
    } catch {
      setTodayBonuses([])
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('babieca_attendance')

    if (!saved) {
      setAttendance([])
      return
    }

    try {
      const parsed = JSON.parse(saved)

      setAttendance(
        Array.isArray(parsed) ? parsed : []
      )
    } catch {
      setAttendance([])
    }
  }, [])

  const todayAttendance = attendance.filter(
    record => record.date === TODAY_PREFIX
  )
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  const todayWithdrawals = WITHDRAWALS.filter(
    w => w.date.startsWith(TODAY_PREFIX)
  )

  const activeEmployees = EMPLOYEES.filter(
    employee => employee.status === 'ACTIVO'
  )

  const pendingWithdrawals = WITHDRAWALS.filter(
    w => w.status === 'PENDIENTE'
  )

  const onShift = todayAttendance.filter(
    record => record.arrival && !record.departure
  )

  const sinLlegada = EMPLOYEES.filter(
    employee =>
      employee.status === 'ACTIVO' &&
      !todayAttendance.some(
        record => record.employeeId === employee.id
      )
  )

  const finalizados = todayAttendance.filter(
    record => record.arrival && record.departure
  )
  const recentActivity = [
  ...todayAttendance.flatMap(record => {
    const employee = EMPLOYEES.find(
      employee => employee.id === record.employeeId,
    )

    if (!employee) return []

    const activities = []

    if (record.arrival) {
      activities.push({
        time: record.arrival,
        action: 'Llegada registrada',
        detail: `${employee.name} · ${employee.role}`,
        dot: '#60a5fa',
      })
    }

    if (record.departure) {
      activities.push({
        time: record.departure,
        action: 'Salida registrada',
        detail: `${employee.name} · ${employee.role}${record.hours ? ` · ${record.hours}` : ''}`,
        dot: '#34d399',
      })
    }

    return activities
  }),

  ...todayBonuses.map(bonus => ({
    time: bonus.time || '00:00',
    action:
      bonus.status === 'ENTREGADO'
        ? 'Bono entregado'
        : 'Bono registrado',
    detail: `${bonus.client} · ${bonus.type}${bonus.bonusAmount ? ` · ${bonus.bonusAmount}` : ''}`,
    dot:
      bonus.status === 'ENTREGADO'
        ? '#34d399'
        : GOLD,
  })),

  ...todayWithdrawals.map(withdrawal => ({
    time: withdrawal.date.includes(' ')
      ? withdrawal.date.split(' ')[1]
      : '00:00',
    action:
      withdrawal.status === 'PAGADO'
        ? 'Retiro pagado'
        : withdrawal.status === 'RECHAZADO'
          ? 'Retiro rechazado'
          : 'Retiro pendiente',
    detail: `Retiro · ${withdrawal.client} · ${withdrawal.amount}`,
    dot:
      withdrawal.status === 'PAGADO'
        ? '#34d399'
        : withdrawal.status === 'RECHAZADO'
          ? '#f87171'
          : '#fbbf24',
  })),
]
  .sort((a, b) => b.time.localeCompare(a.time))
  .slice(0, 10)
  const quickLinks: { icon: string; label: string; page: Page }[] = [
    { icon: '👥', label: 'Empleados', page: 'employees' },
    { icon: '🕐', label: 'Horarios', page: 'schedules' },
    { icon: '🎁', label: 'Bonos', page: 'bonuses' },
    { icon: '💰', label: 'Retiros', page: 'withdrawals' },
    { icon: '📋', label: 'Plano', page: 'plano' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl text-zinc-100" style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}>
          {greeting}, Joseph
        </h2>
        <p className="text-sm text-zinc-600 mt-0.5">Sábado, 5 de septiembre de 2026</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🎁" label="Bonos de hoy" value={todayBonuses.length} sub={`${todayBonuses.length} `} />
        <StatCard icon="💰" label="Retiros de hoy" value={todayWithdrawals.length} sub={`${pendingWithdrawals.length} pendientes`} />
        <StatCard icon="👥" label="Personal activo" value={activeEmployees.length} sub="de 8 total" />
        <StatCard icon="🕐" label="En turno ahora" value={onShift.length} sub="empleados activos" accent />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100">Estado del día</h3>
            </div>
            <div className="divide-y divide-zinc-800/60">
              <DayStatusRow label="Retiros pendientes" value={pendingWithdrawals.length} variant={pendingWithdrawals.length > 0 ? 'warn' : 'ok'} />
              <DayStatusRow label="Empleados en turno" value={onShift.length} variant="ok" />
              <DayStatusRow label="Sin llegada" value={sinLlegada.length} variant={sinLlegada.length > 0 ? 'warn' : 'ok'} />
              <DayStatusRow label="Jornadas finalizadas" value={finalizados.length} variant="neutral" />
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100">Actividad reciente</h3>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                  <span className="text-xs text-zinc-600 w-10 flex-shrink-0" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{item.time}</span>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.dot }} />
                  <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs font-medium text-zinc-300">{item.action}</span>
                    <span className="text-xs text-zinc-600 truncate">{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-100">Accesos rápidos</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {quickLinks.map(item => (
              <button
                key={item.page}
                onClick={() => navigate(item.page)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all text-zinc-400 hover:text-zinc-100"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
