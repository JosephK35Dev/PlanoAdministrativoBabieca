import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Schedules from './pages/Schedules'
import Bonuses from './pages/Bonuses'
import RegistrationBonuses from './pages/RegistrationBonuses'
import Withdrawals from './pages/Withdrawals'
import Plano from './pages/Plano'
import Accounting from './pages/Accounting'
import { supabase } from './SupabaseClient'
import type { Page } from './data'

const GOLD = '#c9a84c'
const ACCESS_PASSWORD = 'babieca2026'
const ACCESS_STORAGE_KEY = 'babieca_access_authorized'

const NAV_ITEMS: { id: Page; icon: string; label: string; url?: string }[] = [
  { id: 'dashboard', icon: '🏠', label: 'Inicio' },
  { id: 'employees', icon: '👥', label: 'Empleados' },
  { id: 'schedules', icon: '🕐', label: 'Horarios' },
  { id: 'bonuses', icon: '🎁', label: 'Bonos' },
  { id: 'registrationBonuses', icon: '🎟️', label: 'Bonos por registro' },
  { id: 'withdrawals', icon: '💰', label: 'Retiros' },
  { id: 'accounting', icon: '🧮', label: 'Contabilidad' },
  { id: 'filter', icon: '📈', label: 'Filtro Pasarela Pago', url: 'https://josephk35dev.github.io/Filtro-Pasarela-Pagos/' },
  { id: 'plano', icon: '📋', label: 'Plano' },
]

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Inicio',
  employees: 'Empleados',
  schedules: 'Horarios',
  bonuses: 'Bonos',
  registrationBonuses: 'Bonos por registro',
  accounting: 'Contabilidad/Cuadres',
  filter: 'Filtro Pasarela Pago',
  withdrawals: 'Retiros',
  plano: 'Plano',
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [authorized, setAuthorized] = useState(() => {
    return localStorage.getItem(ACCESS_STORAGE_KEY) === 'true'
  })

  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState(false)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()

    if (password === ACCESS_PASSWORD) {
      localStorage.setItem(ACCESS_STORAGE_KEY, 'true')
      setAuthorized(true)
      setPassword('')
      setLoginError(false)
      return
    }

    setLoginError(true)
    setPassword('')
  }


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
      case 'registrationBonuses': return <RegistrationBonuses />
      case 'withdrawals': return <Withdrawals />
      case 'accounting': return <Accounting />
      case 'plano': return <Plano />
    }
  }



  if (!authorized) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          backgroundColor: '#09090b',
          color: '#f4f4f5',
        }}
      >
        <div className="w-full max-w-sm">
          <div
            className="rounded-2xl p-8 shadow-2xl"
            style={{
              backgroundColor: '#111113',
              border: '1px solid #1c1c1e',
            }}
          >
            <div className="flex flex-col items-center text-center mb-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-bold mb-4"
                style={{
                  backgroundColor: 'rgba(201,168,76,0.12)',
                  color: GOLD,
                  border: '1px solid rgba(201,168,76,0.25)',
                }}
              >
                HB
              </div>

              <h1 className="text-xl font-semibold text-zinc-100">
                Hípicas Babieca
              </h1>

              <p className="text-sm mt-1 text-zinc-500">
                Acceso al sistema
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 block">
                  Contraseña
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value)
                    setLoginError(false)
                  }}
                  placeholder="Ingresa la contraseña"
                  autoFocus
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              {loginError && (
                <p className="text-xs text-red-400">
                  La contraseña ingresada es incorrecta.
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-lg text-sm font-semibold transition-all"
                style={{
                  backgroundColor: GOLD,
                  color: '#09090b',
                }}
                onMouseEnter={e =>
                  (e.currentTarget.style.backgroundColor = '#e4c97a')
                }
                onMouseLeave={e =>
                  (e.currentTarget.style.backgroundColor = GOLD)
                }
              >
                Ingresar
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-zinc-700 mt-5">
            Acceso autorizado para personal de Hípicas Babieca
          </p>
        </div>
      </div>
    )
  }

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
                onClick={() => {
                  if (item.url) {
                    window.open(item.url, '_blank', 'noopener,noreferrer')
                    return
                  }

                  setCurrentPage(item.id)
                  setSidebarOpen(false)
                }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left"
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
              <div className="text-xs font-medium text-zinc-300 truncate">Hípicas Babieca</div>
              <div className="text-xs" style={{ color: '#52525b' }}>Administración</div>
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


            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
              style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: GOLD, border: '1px solid rgba(201,168,76,0.25)' }}>
              HB
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
