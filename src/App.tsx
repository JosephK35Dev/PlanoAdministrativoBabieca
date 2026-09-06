import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Schedules from './pages/Schedules'
import Bonuses from './pages/Bonuses'
import Withdrawals from './pages/Withdrawals'
import Plano from './pages/Plano'
import type { Page } from './data'

const GOLD = '#c9a84c'

const NAV_ITEMS: { id: Page; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '🏠', label: 'Inicio' },
  { id: 'employees', icon: '👥', label: 'Empleados' },
  { id: 'schedules', icon: '🕐', label: 'Horarios' },
  { id: 'bonuses', icon: '🎁', label: 'Bonos' },
  { id: 'withdrawals', icon: '💰', label: 'Retiros' },
  { id: 'plano', icon: '📋', label: 'Plano' },
]

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Inicio',
  employees: 'Empleados',
  schedules: 'Horarios',
  bonuses: 'Bonos',
  withdrawals: 'Retiros',
  plano: 'Plano',
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', })
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })
  )
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        })
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [])


  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard navigate={page => { setCurrentPage(page); setSidebarOpen(false) }} />
      case 'employees': return <Employees />
      case 'schedules': return <Schedules />
      case 'bonuses': return <Bonuses />
      case 'withdrawals': return <Withdrawals />
      case 'plano': return <Plano />
    }
  }

  const notifications = [
    { text: '2 bonos pendientes de entrega', time: 'Ahora', dot: '#fbbf24' },
    { text: '2 retiros pendientes de pago', time: 'Hace 10 min', dot: '#fbbf24' },
    { text: 'Luis Torres aún no ha registrado llegada', time: 'Hace 25 min', dot: '#f87171' },
    { text: 'Diego Morales aún no ha registrado llegada', time: 'Hace 25 min', dot: '#f87171' },
  ]

  return (
    <div className="flex h-full" style={{ backgroundColor: '#09090b', color: '#f4f4f5' }}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-56 flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ backgroundColor: '#080808', borderRight: '1px solid #1c1c1e' }}>
        <div className="px-5 py-5" style={{ borderBottom: '1px solid #1c1c1e' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: GOLD, border: '1px solid rgba(201,168,76,0.25)' }}>
              HB
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100 tracking-wide">Hípicas</div>
              <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: GOLD, fontSize: 9 }}>Babieca</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => { setCurrentPage(item.id); setSidebarOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left"
                style={{
                  backgroundColor: active ? 'rgba(201,168,76,0.1)' : 'transparent',
                  color: active ? GOLD : '#71717a',
                  border: active ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = '#18181b'; e.currentTarget.style.color = '#d4d4d8' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#71717a' } }}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="px-2.5 py-3 space-y-0.5" style={{ borderTop: '1px solid #1c1c1e' }}>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left"
            style={{ color: '#52525b' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#18181b'; e.currentTarget.style.color = '#a1a1aa' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#52525b' }}>
            <span className="text-base">⚙️</span>
            <span className="font-medium">Configuración</span>
          </button>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: GOLD, border: '1px solid rgba(201,168,76,0.25)' }}>
              CM
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-zinc-300 truncate">Carlos Méndez</div>
              <div className="text-xs" style={{ color: '#52525b' }}>Supervisor</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0" style={{ backgroundColor: '#09090b', borderBottom: '1px solid #1c1c1e' }}>
          <button className="lg:hidden text-zinc-600 hover:text-zinc-300 p-1 transition-colors" onClick={() => setSidebarOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-zinc-200">{PAGE_TITLES[currentPage]}</h1>
            <p className="text-xs hidden sm:block capitalize" style={{ color: '#52525b' }}>{today} · {currentTime}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-10 w-80 rounded-xl shadow-2xl z-20 overflow-hidden" style={{ backgroundColor: '#111113', border: '1px solid #1c1c1e' }}>
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid #1c1c1e' }}>
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Notificaciones</span>
                    </div>
                    <div className="divide-y" style={{ borderColor: '#1c1c1e' }}>
                      {notifications.map((n, i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors cursor-default">
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: n.dot }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-zinc-300">{n.text}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>{n.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
              style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: GOLD, border: '1px solid rgba(201,168,76,0.25)' }}>
              CM
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
