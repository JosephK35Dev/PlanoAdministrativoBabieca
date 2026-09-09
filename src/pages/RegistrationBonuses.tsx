import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../SupabaseClient'

const GOLD = '#c9a84c'

type RegistrationBonus = {
  id: string
  client: string
  country: string
  bonusType: 'Registro' | 'Perdido'
  recharged: boolean
  date: string
  time: string
  responsible: string
  createdAt: string
}

const COUNTRIES = [
  'Colombia',
  'Chile',
  'Perú',
  'Ecuador',
  'Venezuela',
  'Brasil',
  'México',
  'Estados Unidos',
]

function getTodayKey() {
  const now = new Date()

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

function getTodayLabel() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function normalizeClientName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-')

  return `${day}/${month}/${year}`
}

export default function RegistrationBonuses() {
  const [records, setRecords] = useState<
    RegistrationBonus[]
  >([])

  const [client, setClient] = useState('')
  const [country, setCountry] = useState('Colombia')
  const [bonusType, setBonusType] = useState<
    'Registro' | 'Perdido'
  >('Registro')

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] =
    useState<string | null>(null)

  const [search, setSearch] = useState('')

  /*
   * Cargar todos los registros
   */
  useEffect(() => {
    const loadRecords = async () => {
      const { data, error } = await supabase
        .from('registration_bonuses')
        .select('*')
        .order('created_at', {
          ascending: false,
        })

      if (error) {
        console.error(
          'Error cargando bonos por registro:',
          error,
        )
        return
      }

      const mappedRecords: RegistrationBonus[] =
        (data || []).map(record => ({
          id: record.id,
          client: record.client,
          country: record.country,
          bonusType: record.bonus_type,
          recharged: record.recharged,
          date: record.date,
          time: record.time,
          responsible: record.responsible,
          createdAt: record.created_at,
        }))

      setRecords(mappedRecords)
    }

    loadRecords()
  }, [])

  /*
   * Estadísticas
   */
  const totalRecords = records.length

  const registrationRecords = useMemo(
    () =>
      records.filter(
        record => record.bonusType === 'Registro',
      ).length,
    [records],
  )

  const lostRecords = useMemo(
    () =>
      records.filter(
        record => record.bonusType === 'Perdido',
      ).length,
    [records],
  )

  const rechargedRecords = useMemo(
    () =>
      records.filter(
        record => record.recharged,
      ).length,
    [records],
  )

  /*
   * Filtrar tabla
   */
  const filteredRecords = useMemo(() => {
    const normalizedSearch =
      normalizeClientName(search)

    if (!normalizedSearch) return records

    return records.filter(record => {
      return (
        normalizeClientName(record.client).includes(
          normalizedSearch,
        ) ||
        normalizeClientName(record.country).includes(
          normalizedSearch,
        ) ||
        normalizeClientName(record.bonusType).includes(
          normalizedSearch,
        )
      )
    })
  }, [records, search])

  /*
   * Abrir modal
   */
  const handleOpenModal = () => {
    setClient('')
    setCountry('Colombia')
    setBonusType('Registro')
    setModalOpen(true)
  }

  /*
   * Cerrar modal
   */
  const handleCloseModal = () => {
    if (saving) return

    setModalOpen(false)
    setClient('')
    setCountry('Colombia')
    setBonusType('Registro')
  }

  /*
   * Guardar nuevo registro
   */
  const handleCreateRecord = async () => {
    const cleanClient = client
      .trim()
      .replace(/\s+/g, ' ')

    if (!cleanClient || !country || !bonusType) {
      return
    }

    setSaving(true)

    const now = new Date()

    const newRecord: RegistrationBonus = {
      id: `RB${Date.now()}`,
      client: cleanClient,
      country,
      bonusType,
      recharged: false,
      date: getTodayKey(),
      time: `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes(),
      ).padStart(2, '0')}`,
      responsible: 'Usuario actual',
      createdAt: now.toISOString(),
    }

    const { error } = await supabase
      .from('registration_bonuses')
      .insert({
        id: newRecord.id,
        client: newRecord.client,
        country: newRecord.country,
        bonus_type: newRecord.bonusType,
        recharged: false,
        date: newRecord.date,
        time: newRecord.time,
        responsible: newRecord.responsible,
      })

    if (error) {
      console.error(
        'Error guardando bono por registro:',
        error,
      )

      setSaving(false)
      return
    }

    setRecords(prev => [
      newRecord,
      ...prev,
    ])

    setSaving(false)
    handleCloseModal()
  }

  /*
   * Marcar como recargado
   */
  const handleToggleRecharge = async (
    record: RegistrationBonus,
  ) => {
    setUpdatingId(record.id)

    const newValue = !record.recharged

    const { error } = await supabase
      .from('registration_bonuses')
      .update({
        recharged: newValue,
      })
      .eq('id', record.id)

    if (error) {
      console.error(
        'Error actualizando estado de recarga:',
        error,
      )

      setUpdatingId(null)
      return
    }

    setRecords(prev =>
      prev.map(item =>
        item.id === record.id
          ? {
            ...item,
            recharged: newValue,
          }
          : item,
      ),
    )

    setUpdatingId(null)
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Bonos por registro
            </h1>

            <p className="text-sm text-zinc-500 mt-1 capitalize">
              {getTodayLabel()}
            </p>
          </div>

          <button
            onClick={handleOpenModal}
            className="h-11 px-5 rounded-lg text-sm font-medium transition hover:opacity-90"
            style={{
              backgroundColor: GOLD,
              color: '#09090b',
            }}
          >
            + Registrar bono
          </button>
        </div>
      </div>

      {/* ESTADÍSTICAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
          <p className="text-xs text-zinc-500">
            Total registrados
          </p>

          <p className="text-2xl font-semibold text-white mt-2">
            {totalRecords}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
          <p className="text-xs text-zinc-500">
            Registro
          </p>

          <p
            className="text-2xl font-semibold mt-2"
            style={{ color: GOLD }}
          >
            {registrationRecords}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
          <p className="text-xs text-zinc-500">
            Perdido
          </p>

          <p className="text-2xl font-semibold text-white mt-2">
            {lostRecords}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
          <p className="text-xs text-zinc-500">
            Recargaron
          </p>

          <p className="text-2xl font-semibold text-emerald-400 mt-2">
            {rechargedRecords}
          </p>
        </div>
      </div>

      {/* BUSCADOR */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <label className="block text-sm text-zinc-400 mb-2">
          Buscar
        </label>

        <input
          value={search}
          onChange={e =>
            setSearch(e.target.value)
          }
          placeholder="Buscar por nombre, país o tipo de bono"
          className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none focus:border-zinc-600"
        />
      </div>

      {/* LISTA */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">
            Historial de bonos
          </h2>

          <p className="text-xs text-zinc-500 mt-1">
            Todos los registros realizados
          </p>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-zinc-500">
              {records.length === 0
                ? 'No hay bonos registrados.'
                : 'No se encontraron resultados.'}
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
                    País
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                    Tipo de bono
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                    Recargó
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                    Fecha
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                    Hora
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map(record => (
                  <tr
                    key={record.id}
                    className="border-b border-zinc-900 last:border-0"
                  >
                    {/* CLIENTE */}
                    <td className="px-5 py-4 text-white font-medium">
                      {record.client}
                    </td>

                    {/* PAÍS */}
                    <td className="px-5 py-4 text-zinc-300">
                      {record.country}
                    </td>

                    {/* TIPO */}
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                        style={{
                          backgroundColor:
                            record.bonusType ===
                              'Registro'
                              ? 'rgba(201,168,76,0.10)'
                              : 'rgba(113,113,122,0.12)',
                          color:
                            record.bonusType ===
                              'Registro'
                              ? GOLD
                              : '#a1a1aa',
                        }}
                      >
                        {record.bonusType}
                      </span>
                    </td>

                    {/* RECARGÓ */}
                    <td className="px-5 py-4">
                      <span
                        className={
                          record.recharged
                            ? 'text-emerald-400'
                            : 'text-zinc-500'
                        }
                      >
                        {record.recharged
                          ? 'Sí'
                          : 'No'}
                      </span>
                    </td>

                    {/* FECHA */}
                    <td className="px-5 py-4 text-zinc-400">
                      {formatDate(record.date)}
                    </td>

                    {/* HORA */}
                    <td className="px-5 py-4 text-zinc-400">
                      {record.time}
                    </td>

                    {/* ACCIÓN */}
                    <td className="px-5 py-4">
                      <button
                        onClick={() =>
                          handleToggleRecharge(
                            record,
                          )
                        }
                        disabled={
                          updatingId === record.id
                        }
                        className="text-xs font-medium transition disabled:opacity-40"
                        style={{
                          color: GOLD,
                        }}
                      >
                        {updatingId === record.id
                          ? 'Actualizando...'
                          : record.recharged
                            ? 'Marcar no recargó'
                            : 'Marcar recargó'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            {/* HEADER MODAL */}
            <div className="px-6 py-5 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">
                Nuevo registro
              </p>

              <h2 className="text-lg font-semibold text-white">
                Bono por registro
              </h2>

              <p className="text-sm text-zinc-500 mt-1">
                Completa los datos del cliente.
              </p>
            </div>

            {/* CONTENIDO */}
            <div className="p-6 space-y-5">
              {/* CLIENTE */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Nombre del cliente
                </label>

                <input
                  autoFocus
                  value={client}
                  onChange={e =>
                    setClient(e.target.value)
                  }
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleCreateRecord()
                    }
                  }}
                  placeholder="Nombre del cliente"
                  className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none focus:border-zinc-600"
                />
              </div>

              {/* PAÍS */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  País
                </label>

                <select
                  value={country}
                  onChange={e =>
                    setCountry(e.target.value)
                  }
                  className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none focus:border-zinc-600"
                >
                  {COUNTRIES.map(item => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              {/* TIPO */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Tipo de bono
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setBonusType('Registro')
                    }
                    className="rounded-lg border px-4 py-3 text-sm font-medium transition"
                    style={{
                      borderColor:
                        bonusType === 'Registro'
                          ? GOLD
                          : '#27272a',
                      backgroundColor:
                        bonusType === 'Registro'
                          ? 'rgba(201,168,76,0.08)'
                          : '#18181b',
                      color:
                        bonusType === 'Registro'
                          ? GOLD
                          : '#a1a1aa',
                    }}
                  >
                    Registro
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setBonusType('Perdido')
                    }
                    className="rounded-lg border px-4 py-3 text-sm font-medium transition"
                    style={{
                      borderColor:
                        bonusType === 'Perdido'
                          ? GOLD
                          : '#27272a',
                      backgroundColor:
                        bonusType === 'Perdido'
                          ? 'rgba(201,168,76,0.08)'
                          : '#18181b',
                      color:
                        bonusType === 'Perdido'
                          ? GOLD
                          : '#a1a1aa',
                    }}
                  >
                    Perdido
                  </button>
                </div>
              </div>

              {/* ESTADO INICIAL */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">
                    Estado de recarga
                  </span>

                  <span className="text-sm font-medium text-zinc-500">
                    No recargó
                  </span>
                </div>

                <p className="text-xs text-zinc-600 mt-2">
                  Se podrá actualizar cuando el cliente
                  realice una recarga.
                </p>
              </div>
            </div>

            {/* FOOTER */}
            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                disabled={saving}
                className="h-10 px-4 rounded-lg text-sm text-zinc-400 hover:text-white transition disabled:opacity-40"
              >
                Cancelar
              </button>

              <button
                onClick={handleCreateRecord}
                disabled={
                  saving || !client.trim()
                }
                className="h-10 px-5 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{
                  backgroundColor: GOLD,
                  color: '#09090b',
                }}
              >
                {saving
                  ? 'Guardando...'
                  : 'Registrar bono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}