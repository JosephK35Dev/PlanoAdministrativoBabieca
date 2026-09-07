import { useEffect, useState } from 'react'
import { EMPLOYEES } from '../data'
import type { WithdrawalRecord, WithdrawalStatus } from '../data'
import { supabase } from '../SupabaseClient'

const GOLD = '#c9a84c'

const STATUS_CFG: Record<WithdrawalStatus, { label: string; bg: string; color: string }> = {
  PENDIENTE: { label: 'PENDIENTE', bg: 'rgba(120,53,15,0.3)', color: '#fbbf24' },
  PAGADO: { label: 'PAGADO', bg: 'rgba(6,78,59,0.35)', color: '#34d399' },
  RECHAZADO: { label: 'RECHAZADO', bg: 'rgba(127,29,29,0.35)', color: '#f87171' },
}

const COUNTRIES = [
  'Colombia',
  'Venezuela',
  'Ecuador',
  'Perú',
  'Chile',
  'Brasil',
]
const getTodayDate = () => {
  const now = new Date()

  return `${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1,
  ).padStart(2, '0')}/${now.getFullYear()}`
}

const TODAY_PREFIX = getTodayDate()

export default function Withdrawals() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])

  useEffect(() => {
    const loadWithdrawals = async () => {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error cargando retiros:', error)
        return
      }

      const mappedWithdrawals: WithdrawalRecord[] = (data || []).map(
        record => ({
          id: record.id,
          client: record.client,
          amount: Number(record.amount),
          country: record.country,
          date: record.date,
          status: record.status as WithdrawalStatus,
          responsible: record.responsible,
          rejectionReason: record.rejection_reason ?? undefined,
        }),
      )

      setWithdrawals(mappedWithdrawals)
    }

    loadWithdrawals()
  }, [])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | 'ALL'>('ALL')
  const [addModal, setAddModal] = useState(false)
  const [confirm, setConfirm] = useState<{
    id: string
    action: 'pagar' | 'rechazar'
  } | null>(null)

  const [rejectionReason, setRejectionReason] = useState('')

  const [form, setForm] = useState({
    client: '',
    amount: '',
    country: COUNTRIES[0],
    responsible: '',
  })

  const todayW = withdrawals.filter(w => w.date.startsWith(TODAY_PREFIX))
  const pending = withdrawals.filter(w => w.status === 'PENDIENTE')
  const paid = withdrawals.filter(w => w.status === 'PAGADO')
  const rejected = withdrawals.filter(w => w.status === 'RECHAZADO')

  const filtered = withdrawals.filter(w => {
    const ok =
      w.client.toLowerCase().includes(search.toLowerCase()) ||
      w.responsible.toLowerCase().includes(search.toLowerCase()) ||
      w.country.toLowerCase().includes(search.toLowerCase())

    return ok && (statusFilter === 'ALL' || w.status === statusFilter)
  })

  const handleAdd = async () => {
    if (!form.client || !form.amount || !form.responsible || !form.country) {
      return
    }

    const newWithdrawal: WithdrawalRecord = {
      id: `R${Date.now()}`,
      client: form.client.trim(),
      amount: parseFloat(form.amount),
      country: form.country,
      date: `${TODAY_PREFIX} ${new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      status: 'PENDIENTE',
      responsible: form.responsible,
    }

    const { error } = await supabase
      .from('withdrawals')
      .insert({
        id: newWithdrawal.id,
        client: newWithdrawal.client,
        amount: newWithdrawal.amount,
        country: newWithdrawal.country,
        date: newWithdrawal.date,
        status: newWithdrawal.status,
        responsible: newWithdrawal.responsible,
        rejection_reason: null,
      })

    if (error) {
      console.error('Error guardando retiro:', error)
      return
    }

    setWithdrawals(prev => [newWithdrawal, ...prev])

    setAddModal(false)

    setForm({
      client: '',
      amount: '',
      country: COUNTRIES[0],
      responsible: '',
    })
  }

  const handleConfirm = async () => {
    if (!confirm) return

    if (confirm.action === 'pagar') {
      const { error } = await supabase
        .from('withdrawals')
        .update({
          status: 'PAGADO',
          rejection_reason: null,
        })
        .eq('id', confirm.id)

      if (error) {
        console.error('Error actualizando retiro:', error)
        return
      }

      setWithdrawals(prev =>
        prev.map(w =>
          w.id === confirm.id
            ? {
              ...w,
              status: 'PAGADO',
              rejectionReason: undefined,
            }
            : w,
        ),
      )

      setConfirm(null)
      return
    }

    if (!rejectionReason.trim()) return

    const reason = rejectionReason.trim()

    const { error } = await supabase
      .from('withdrawals')
      .update({
        status: 'RECHAZADO',
        rejection_reason: reason,
      })
      .eq('id', confirm.id)

    if (error) {
      console.error('Error rechazando retiro:', error)
      return
    }

    setWithdrawals(prev =>
      prev.map(w =>
        w.id === confirm.id
          ? {
            ...w,
            status: 'RECHAZADO',
            rejectionReason: reason,
          }
          : w,
      ),
    )

    setRejectionReason('')
    setConfirm(null)
  }

  const inputCls =
    'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none transition-colors'

  const labelCls =
    'text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 block'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Retiros de hoy', value: todayW.length, color: '#f4f4f5' },
          { label: 'Pendientes', value: pending.length, color: '#fbbf24' },
          { label: 'Pagados', value: paid.length, color: '#34d399' },
          { label: 'Rechazados', value: rejected.length, color: '#f87171' },
        ].map(s => (
          <div
            key={s.label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
          >
            <div
              className="text-3xl font-bold mb-1"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: s.color,
              }}
            >
              {s.value}
            </div>

            <div className="text-xs text-zinc-600">{s.label}</div>
          </div>
        ))}
      </div>

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
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, país o responsable..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e =>
            setStatusFilter(e.target.value as WithdrawalStatus | 'ALL')
          }
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-400 focus:outline-none cursor-pointer"
        >
          <option value="ALL">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="PAGADO">Pagado</option>
          <option value="RECHAZADO">Rechazado</option>
        </select>

        <button
          onClick={() => setAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0 transition-all"
          style={{ backgroundColor: GOLD, color: '#09090b' }}
          onMouseEnter={e =>
            (e.currentTarget.style.backgroundColor = '#e4c97a')
          }
          onMouseLeave={e =>
            (e.currentTarget.style.backgroundColor = GOLD)
          }
        >
          + Registrar retiro
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="bg-zinc-950 text-left">
                {[
                  'Cliente',
                  'Monto',
                  'País',
                  'Fecha',
                  'Estado',
                  'Responsable',
                  'Acciones',
                ].map(h => (
                  <th
                    key={h}
                    className="px-5 py-3 text-xs font-medium text-zinc-600 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-800/50">
              {filtered.map(w => {
                const sc = STATUS_CFG[w.status]

                return (
                  <tr
                    key={w.id}
                    className="hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="px-5 py-3 text-sm font-medium text-zinc-200">
                      {w.client}
                    </td>

                    <td
                      className="px-5 py-3 text-sm font-semibold text-zinc-200"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {w.amount.toLocaleString('es-ES')}
                    </td>

                    <td className="px-5 py-3 text-sm text-zinc-500">
                      {w.country}
                    </td>

                    <td
                      className="px-5 py-3 text-xs text-zinc-600"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {w.date}
                    </td>

                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: sc.bg,
                          color: sc.color,
                        }}
                      >
                        {sc.label}
                      </span>
                    </td>

                    <td className="px-5 py-3 text-sm text-zinc-500">
                      {w.responsible}
                    </td>

                    <td className="px-5 py-3">
                      {w.status === 'PENDIENTE' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setConfirm({
                                id: w.id,
                                action: 'pagar',
                              })
                            }
                            className="px-2.5 py-1 text-xs rounded transition-colors"
                            style={{
                              backgroundColor: 'rgba(6,78,59,0.35)',
                              color: '#34d399',
                              border: '1px solid rgba(52,211,153,0.2)',
                            }}
                          >
                            Pagar
                          </button>

                          <button
                            onClick={() => {
                              setRejectionReason('')
                              setConfirm({
                                id: w.id,
                                action: 'rechazar',
                              })
                            }}
                            className="px-2.5 py-1 text-xs rounded transition-colors"
                            style={{
                              backgroundColor: 'rgba(127,29,29,0.35)',
                              color: '#f87171',
                              border: '1px solid rgba(248,113,113,0.2)',
                            }}
                          >
                            Rechazar
                          </button>
                        </div>
                      )}

                      {w.status === 'RECHAZADO' && w.rejectionReason && (
                        <div className="max-w-xs">
                          <div className="text-xs text-zinc-600 mb-0.5">
                            Razón:
                          </div>
                          <div className="text-xs text-zinc-400 leading-relaxed">
                            {w.rejectionReason}
                          </div>
                        </div>
                      )}
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
                    No se encontraron registros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addModal && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-100">
                Registrar retiro
              </h3>

              <button
                onClick={() => setAddModal(false)}
                className="text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Cliente</label>
                <input
                  value={form.client}
                  onChange={e =>
                    setForm({
                      ...form,
                      client: e.target.value,
                    })
                  }
                  placeholder="Nombre del cliente"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Monto (€)</label>
                <input
                  value={form.amount}
                  onChange={e =>
                    setForm({
                      ...form,
                      amount: e.target.value,
                    })
                  }
                  type="number"
                  placeholder="0"
                  className={inputCls}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
              </div>

              <div>
                <label className={labelCls}>País</label>

                <select
                  value={form.country}
                  onChange={e =>
                    setForm({
                      ...form,
                      country: e.target.value,
                    })
                  }
                  className={inputCls}
                >
                  {COUNTRIES.map(country => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Responsable</label>

                <select
                  value={form.responsible}
                  onChange={e =>
                    setForm({
                      ...form,
                      responsible: e.target.value,
                    })
                  }
                  className={inputCls}
                >
                  <option value="">Seleccionar...</option>

                  {EMPLOYEES.map(e => (
                    <option key={e.id} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setAddModal(false)}
                className="px-4 py-2 text-sm text-zinc-500 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>

              <button
                onClick={handleAdd}
                disabled={
                  !form.client ||
                  !form.amount ||
                  !form.responsible ||
                  !form.country
                }
                className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
                style={{
                  backgroundColor: GOLD,
                  color: '#09090b',
                }}
              >
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6">
              <h3 className="text-base font-semibold text-zinc-100 mb-2">
                {confirm.action === 'pagar'
                  ? 'Confirmar pago'
                  : 'Rechazar retiro'}
              </h3>

              {confirm.action === 'pagar' ? (
                <p className="text-sm text-zinc-400">
                  ¿Confirmas el pago de este retiro? Esta acción no se puede
                  deshacer.
                </p>
              ) : (
                <>
                  <p className="text-sm text-zinc-400 mb-4">
                    Indica la razón por la que deseas rechazar este retiro.
                  </p>

                  <textarea
                    value={rejectionReason}
                    onChange={e =>
                      setRejectionReason(e.target.value)
                    }
                    placeholder="Escribe la razón del rechazo..."
                    rows={4}
                    className={`${inputCls} resize-none`}
                    autoFocus
                  />
                </>
              )}
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setConfirm(null)
                  setRejectionReason('')
                }}
                className="px-4 py-2 text-sm text-zinc-500 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirm}
                disabled={
                  confirm.action === 'rechazar' &&
                  !rejectionReason.trim()
                }
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-40"
                style={{
                  backgroundColor:
                    confirm.action === 'pagar'
                      ? '#065f46'
                      : '#7f1d1d',
                }}
              >
                {confirm.action === 'pagar'
                  ? 'Confirmar pago'
                  : 'Rechazar retiro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}