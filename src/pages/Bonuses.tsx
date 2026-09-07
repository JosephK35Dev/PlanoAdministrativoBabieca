import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../SupabaseClient'
import type { BonusRecord } from '../data'

const GOLD = '#c9a84c'

type BonusOption = {
  label: string
  kind: 'PORCENTAJE' | 'GIROS' | 'DEPORTIVA' | 'HIPISMO'
  percentage?: number
  rollover?: string
}

type BonusStep = {
  title: string
  options: BonusOption[]
}

const BONUS_CONFIG: Record<number, { name: string; steps: BonusStep[] }> = {
  1: {
    name: 'SALIDA DE CAMPEONES',
    steps: [
      {
        title: 'Primer bono',
        options: [
          { label: '50%', kind: 'PORCENTAJE', percentage: 50, rollover: 'X5' },
          { label: '60%', kind: 'PORCENTAJE', percentage: 60, rollover: 'X4' },
          { label: '80%', kind: 'PORCENTAJE', percentage: 80, rollover: 'X3' },
        ],
      },
    ],
  },

  2: {
    name: 'DE MULTIPLICAR',
    steps: [
      {
        title: 'Primer bono',
        options: [
          { label: '50%', kind: 'PORCENTAJE', percentage: 50, rollover: 'X5' },
          { label: '60%', kind: 'PORCENTAJE', percentage: 60, rollover: 'X4' },
          { label: '80%', kind: 'PORCENTAJE', percentage: 80, rollover: 'X3' },
        ],
      },
      {
        title: 'Segundo bono',
        options: [
          { label: '20 GIROS', kind: 'GIROS' },
          { label: '200% DEPORTIVAS', kind: 'DEPORTIVA', percentage: 200 },
        ],
      },
    ],
  },

  3: {
    name: 'SALVAJE',
    steps: [
      {
        title: 'Primer bono',
        options: [
          { label: '50%', kind: 'PORCENTAJE', percentage: 50, rollover: 'X5' },
          { label: '60%', kind: 'PORCENTAJE', percentage: 60, rollover: 'X4' },
          { label: '80%', kind: 'PORCENTAJE', percentage: 80, rollover: 'X3' },
        ],
      },
    ],
  },

  4: {
    name: '3×3',
    steps: [
      {
        title: 'Primer bono',
        options: [

          { label: '50%', kind: 'PORCENTAJE', percentage: 50, rollover: 'X5' },
          { label: '60%', kind: 'PORCENTAJE', percentage: 60, rollover: 'X4' },
          { label: '80%', kind: 'PORCENTAJE', percentage: 80, rollover: 'X3' },
        ],
      },
      {
        title: 'Segundo bono',
        options: [
          { label: '20 GIROS', kind: 'GIROS' },

        ],
      },
      {
        title: 'Tercer bono',
        options: [
          { label: '30 GIROS', kind: 'GIROS' },
          { label: '200% DEPORTIVAS', kind: 'DEPORTIVA', percentage: 200 },
        ],
      },
    ],
  },

  5: {
    name: '3×3',
    steps: [
      {
        title: 'Primer bono',
        options: [

          { label: '50%', kind: 'PORCENTAJE', percentage: 50, rollover: 'X5' },
          { label: '60%', kind: 'PORCENTAJE', percentage: 60, rollover: 'X4' },
          { label: '80%', kind: 'PORCENTAJE', percentage: 80, rollover: 'X3' },
        ],
      },
      {
        title: 'Segundo bono',
        options: [
          { label: '20 GIROS', kind: 'GIROS' },

        ],
      },
      {
        title: 'Tercer bono',
        options: [
          { label: '30 GIROS', kind: 'GIROS' },
          { label: '200% DEPORTIVAS', kind: 'DEPORTIVA', percentage: 200 },
        ],
      },
    ],
  },

  6: {
    name: 'SÁBADO DE GALOPE',
    steps: [
      {
        title: 'Primer bono',
        options: [
          {
            label: '20% HIPISMO',
            kind: 'HIPISMO',
            percentage: 20,
            rollover: 'X5',
          },
        ],
      },
    ],
  },
}

function getTodayKey() {
  const now = new Date()

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function getTodayLabel() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function getDayOfWeek() {
  return new Date().getDay()
}

function normalizeClientName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO').format(value)
}

export default function Bonuses() {
  const [records, setRecords] = useState<BonusRecord[]>([])
  const [client, setClient] = useState('')


  const [modalOpen, setModalOpen] = useState(false)
  const [selectedOption, setSelectedOption] =
    useState<BonusOption | null>(null)

  const [rechargeAmount, setRechargeAmount] = useState('')

  const todayKey = getTodayKey()
  const dayOfWeek = getDayOfWeek()

  const todayConfig = BONUS_CONFIG[dayOfWeek]

  useEffect(() => {
    const loadBonuses = async () => {
      const { data, error } = await supabase
        .from('bonus_records')
        .select('*')
        .eq('date', todayKey)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error cargando bonos:', error)
        return
      }

      const mappedRecords: BonusRecord[] = (data || []).map(record => ({
        id: record.id,
        client: record.client,
        step: record.step,
        type: record.type,
        kind: record.kind,
        rechargeAmount: record.recharge_amount ?? undefined,
        percentage: record.percentage ?? undefined,
        bonusAmount: record.bonus_amount ?? undefined,
        rollover: record.rollover ?? undefined,
        date: record.date,
        time: record.time,
        status: record.status,
        responsible: record.responsible,
      }))

      setRecords(mappedRecords)
    }

    loadBonuses()
  }, [todayKey])

  /*
   * Buscar cuántos bonos ya tiene el cliente hoy
   */
  const getClientRecords = (clientName: string) => {
    const normalized = normalizeClientName(clientName)

    return records.filter(
      record =>
        normalizeClientName(record.client) === normalized,
    )
  }

  const currentClientRecords = useMemo(() => {
    if (!client.trim()) return []

    return getClientRecords(client)
  }, [client, records])

  const currentStep =
    currentClientRecords.length

  /*
   * Abrir modal del siguiente bono
   */
  const handleSearchClient = () => {
    if (!client.trim()) return

    const clientRecords = getClientRecords(client)

    if (
      !todayConfig ||
      clientRecords.length >= todayConfig.steps.length
    ) {
      setModalOpen(false)
      return
    }

    setSelectedOption(null)
    setRechargeAmount('')
    setModalOpen(true)
  }

  /*
   * Asignar bono
   */
  const handleAssignBonus = async () => {
    if (!selectedOption) return

    if (
      selectedOption.kind === 'PORCENTAJE' ||
      selectedOption.kind === 'HIPISMO'
    ) {
      if (!rechargeAmount) return
    }

    const amount = Number(rechargeAmount)

    if (
      (selectedOption.kind === 'PORCENTAJE' ||
        selectedOption.kind === 'HIPISMO') &&
      (!amount || amount <= 0)
    ) {
      return
    }

    const percentage = selectedOption.percentage || 0

    const bonusAmount =
      percentage > 0
        ? amount * (percentage / 100)
        : undefined

    const newRecord: BonusRecord = {
      id: `B${Date.now()}`,
      client: client.trim().replace(/\s+/g, ' '),
      step: currentStep + 1,
      type: selectedOption.label,
      kind: selectedOption.kind,
      rechargeAmount:
        selectedOption.kind === 'PORCENTAJE' ||
          selectedOption.kind === 'HIPISMO'
          ? amount
          : undefined,
      percentage: selectedOption.percentage,
      bonusAmount,
      rollover: selectedOption.rollover,
      date: todayKey,
      time: new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'ENTREGADO',
      responsible: 'Usuario actual',
    }

    const { error } = await supabase
      .from('bonus_records')
      .insert({
        id: newRecord.id,
        client: newRecord.client,
        step: newRecord.step,
        type: newRecord.type,
        kind: newRecord.kind,
        recharge_amount: newRecord.rechargeAmount,
        percentage: newRecord.percentage,
        bonus_amount: newRecord.bonusAmount,
        rollover: newRecord.rollover,
        date: newRecord.date,
        time: newRecord.time,
        status: newRecord.status,
        responsible: newRecord.responsible,
      })

    if (error) {
      console.error('Error guardando bono:', error)
      return
    }

    setRecords(prev => [newRecord, ...prev])

    setModalOpen(false)
    setSelectedOption(null)
    setRechargeAmount('')
  }
  const canAssignMore =
    todayConfig &&
    currentClientRecords.length < todayConfig.steps.length

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Bonos
            </h1>

            <p className="text-sm text-zinc-500 mt-1 capitalize">
              {getTodayLabel()}
            </p>
          </div>

          {todayConfig && (
            <div className="text-right">
              <p className="text-xs text-zinc-500">
                Promoción del día
              </p>

              <p
                className="text-sm font-semibold"
                style={{ color: GOLD }}
              >
                {todayConfig.name}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* BUSCADOR */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <label className="block text-sm text-zinc-400 mb-2">
          Cliente
        </label>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={client}
            onChange={e => setClient(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleSearchClient()
              }
            }}
            placeholder="Nombre del cliente"
            className="flex-1 h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none focus:border-zinc-600"
          />

          <button
            onClick={handleSearchClient}
            disabled={!client.trim()}
            className="h-11 px-6 rounded-lg text-sm font-medium transition disabled:opacity-40"
            style={{
              backgroundColor: GOLD,
              color: '#09090b',
            }}
          >
            Consultar bono
          </button>
        </div>

        {/* INFO DEL CLIENTE */}
        {client.trim() && currentClientRecords.length > 0 && (
          <div className="mt-4 p-4 rounded-lg bg-zinc-900/70 border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">
                Bonos asignados hoy
              </span>

              <span
                className="text-sm font-semibold"
                style={{ color: GOLD }}
              >
                {currentClientRecords.length}/
                {todayConfig?.steps.length || 0}
              </span>
            </div>
          </div>
        )}

        {client.trim() &&
          todayConfig &&
          !canAssignMore &&
          currentClientRecords.length >=
          todayConfig.steps.length && (
            <div className="mt-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
              <p className="text-sm text-zinc-400">
                Este cliente ya utilizó todos los bonos
                disponibles para hoy.
              </p>
            </div>
          )}
      </div>

      {/* LISTA DEL DÍA */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Bonos asignados hoy
            </h2>

            <p className="text-xs text-zinc-500 mt-1">
              {records.length} bono
              {records.length !== 1 ? 's' : ''} registrado
              {records.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-zinc-500">
              No hay bonos asignados hoy.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                    Cliente
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                    Bono
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                    Recarga
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                    Bono otorgado
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                    Rollover
                  </th>
                </tr>
              </thead>

              <tbody>
                {records.map(record => (
                  <tr
                    key={record.id}
                    className="border-b border-zinc-900 last:border-0"
                  >
                    <td className="px-5 py-4 text-white font-medium">
                      {record.client}
                    </td>

                    <td className="px-5 py-4 text-zinc-300">
                      {record.type}
                    </td>

                    <td className="px-5 py-4 text-zinc-400">
                      {record.rechargeAmount
                        ? formatMoney(
                          record.rechargeAmount,
                        )
                        : '—'}
                    </td>

                    <td className="px-5 py-4 text-zinc-300">
                      {record.bonusAmount
                        ? formatMoney(record.bonusAmount)
                        : record.type}
                    </td>

                    <td className="px-5 py-4 text-zinc-400">
                      {record.rollover || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL */}
      {modalOpen && todayConfig && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="px-6 py-5 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">
                Bono #{currentStep + 1}
              </p>

              <h2 className="text-lg font-semibold text-white">
                {client.trim()}
              </h2>

              <p className="text-sm text-zinc-500 mt-1">
                Selecciona el beneficio que corresponde.
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <p className="text-sm text-zinc-400 mb-3">
                  Opciones disponibles
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {todayConfig.steps[
                    currentStep
                  ]?.options.map(option => {
                    const selected =
                      selectedOption === option

                    return (
                      <button
                        key={option.label}
                        onClick={() =>
                          setSelectedOption(option)
                        }
                        className="rounded-lg border px-4 py-4 text-left transition"
                        style={{
                          borderColor: selected
                            ? GOLD
                            : '#27272a',
                          backgroundColor: selected
                            ? 'rgba(201,168,76,0.08)'
                            : '#18181b',
                        }}
                      >
                        <p
                          className="text-sm font-semibold"
                          style={{
                            color: selected
                              ? GOLD
                              : '#e4e4e7',
                          }}
                        >
                          {option.label}
                        </p>

                        {option.rollover && (
                          <p className="text-xs text-zinc-500 mt-1">
                            Rollover {option.rollover}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* MONTO */}
              {selectedOption &&
                (selectedOption.kind === 'PORCENTAJE' ||
                  selectedOption.kind === 'HIPISMO') && (
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Valor de la recarga
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={rechargeAmount}
                      onChange={e =>
                        setRechargeAmount(
                          e.target.value,
                        )
                      }
                      placeholder="Ej. 50000"
                      className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none focus:border-zinc-600"
                    />

                    {selectedOption.percentage &&
                      rechargeAmount &&
                      Number(rechargeAmount) > 0 && (
                        <div className="mt-3 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">
                              Recarga
                            </span>

                            <span className="text-zinc-300">
                              {formatMoney(
                                Number(
                                  rechargeAmount,
                                ),
                              )}
                            </span>
                          </div>

                          <div className="flex justify-between text-sm mt-2">
                            <span className="text-zinc-500">
                              Bono
                            </span>

                            <span
                              className="font-semibold"
                              style={{
                                color: GOLD,
                              }}
                            >
                              {formatMoney(
                                Number(
                                  rechargeAmount,
                                ) *
                                (selectedOption.percentage /
                                  100),
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                  </div>
                )}
            </div>

            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setModalOpen(false)
                  setSelectedOption(null)
                  setRechargeAmount('')
                }}
                className="h-10 px-4 rounded-lg text-sm text-zinc-400 hover:text-white transition"
              >
                Cancelar
              </button>

              <button
                onClick={handleAssignBonus}
                disabled={
                  !selectedOption ||
                  (
                    (selectedOption.kind === 'PORCENTAJE' ||
                      selectedOption.kind === 'HIPISMO') &&
                    (!rechargeAmount ||
                      Number(rechargeAmount) <= 0))
                }
                className="h-10 px-5 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{
                  backgroundColor: GOLD,
                  color: '#09090b',
                }}
              >
                Asignar bono
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}