import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'

const GOLD = '#c9a84c'

type MovementType =
  | 'APUESTA'
  | 'DEVOLUCIÓN'
  | 'GANANCIA'
  | 'BONO'
  | 'DEPÓSITO'
  | 'RETIRO'
  | 'INICIO BONO'
  | 'OTRO'

type RawMovement = {
  index: number
  clientId: string
  client: string
  date: string
  time: string
  concept: string
  reference: string
  currency: string
  creditRaw: unknown
  debitRaw: unknown
  balanceRaw: unknown
  credit: number
  debit: number
  balance: number
  sortTime: number
}

type ProcessedMovement = RawMovement & {
  type: MovementType
  isBonus: boolean
  isStart: boolean
  affectsRollover: boolean
  rolloverAmount: number
  rolloverAccumulated: number | null
  observation: string
}

type RolloverConfig = Record<number, number>

type ManualReviewAlert = {
  reference: string
  betAmount: number
  betDate: string
  betTime: string
  currency: string
}

const DEFAULT_CONFIG: RolloverConfig = {
  10: 5,
  20: 5,
  30: 6,
  40: 6,
  50: 5,
  60: 4,
  70: 4,
  80: 3,
  90: 3,
  100: 3,
}

const PERCENTAGES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  let text = String(value ?? '')
    .trim()
    .replace(/\s/g, '')

  if (!text) return 0

  /*
   * Soporta:
   * 2500
   * 2500,98
   * 2.500,98
   * 2,500.98
   * -500
   */
  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.')
    } else {
      text = text.replace(/,/g, '')
    }
  } else if (text.includes(',')) {
    text = text.replace(',', '.')
  }

  const result = Number(text)
  return Number.isFinite(result) ? result : 0
}

function parseDateTime(dateValue: unknown, timeValue: unknown) {
  const date = String(dateValue ?? '').trim()
  const time = String(timeValue ?? '').trim()

  const match = date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)

  if (!match) return 0

  let [, day, month, year] = match

  if (year.length === 2) {
    year = `20${year}`
  }

  let hour = 0
  let minute = 0
  let second = 0

  const timeMatch = time.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
  )

  if (timeMatch) {
    hour = Number(timeMatch[1])
    minute = Number(timeMatch[2])
    second = Number(timeMatch[3] ?? 0)

    const meridiem = timeMatch[4]?.toUpperCase()

    if (meridiem === 'PM' && hour < 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0
  }

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hour,
    minute,
    second
  ).getTime()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatMoney(value: number, currency = '') {
  return `${currency ? `${currency} ` : ''}${formatNumber(value)}`
}

function classifyMovement(concept: string): MovementType {
  const normalized = normalizeText(concept)

  if (normalized === 'bet horse racing') return 'APUESTA'

  if (normalized.includes('devolucion')) {
    return 'DEVOLUCIÓN'
  }

  if (
    normalized.includes('win') ||
    normalized.includes('premio')
  ) {
    return 'GANANCIA'
  }

  if (
    normalized === 'acredita gift c - bono caballos'
  ) {
    return 'BONO'
  }

  if (normalized.includes('acredita -')) {
    return 'DEPÓSITO'
  }

  if (normalized.includes('retiro')) {
    return 'RETIRO'
  }

  return 'OTRO'
}

function findHeaderRow(rows: unknown[][]) {
  const required = [
    'id cliente',
    'cliente',
    'fecha',
    'hora',
    'concepto',
    'referencia',
    'moneda',
    'credito',
    'debito',
    'saldo',
  ]

  for (let i = 0; i < rows.length; i++) {
    const normalizedCells = rows[i].map(normalizeText)

    const matches = required.filter((requiredHeader) =>
      normalizedCells.some((cell) => {
        if (requiredHeader === 'referencia') {
          return cell.startsWith('referencia')
        }

        return cell === requiredHeader
      })
    )

    if (matches.length >= 9) {
      return i
    }
  }

  return -1
}

function getColumnMap(header: unknown[]) {
  const map: Record<string, number> = {}

  header.forEach((value, index) => {
    const normalized = normalizeText(value)

    if (normalized === 'id cliente') map.clientId = index
    if (normalized === 'cliente') map.client = index
    if (normalized === 'fecha') map.date = index
    if (normalized === 'hora') map.time = index
    if (normalized === 'concepto') map.concept = index

    if (normalized.startsWith('referencia')) {
      map.reference = index
    }

    if (normalized === 'moneda') map.currency = index
    if (normalized === 'credito') map.credit = index
    if (normalized === 'debito') map.debit = index
    if (normalized === 'saldo') map.balance = index
  })

  return map
}

function parseRows(rows: unknown[][], headerIndex: number) {
  const header = rows[headerIndex]
  const columns = getColumnMap(header)

  const requiredColumns = [
    'clientId',
    'client',
    'date',
    'time',
    'concept',
    'reference',
    'currency',
    'credit',
    'debit',
    'balance',
  ]

  const missingColumns = requiredColumns.filter(
    (column) => columns[column] === undefined
  )

  if (missingColumns.length > 0) {
    throw new Error(
      `Faltan columnas necesarias: ${missingColumns.join(', ')}`
    )
  }

  const movements: RawMovement[] = []

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i]

    const hasData = row.some(
      (cell) => String(cell ?? '').trim() !== ''
    )

    if (!hasData) continue

    const clientId = String(row[columns.clientId] ?? '').trim()
    const client = String(row[columns.client] ?? '').trim()
    const concept = String(row[columns.concept] ?? '').trim()

    /*
     * Ignoramos filas que realmente no sean movimientos.
     */
    if (!concept && !client && !clientId) continue

    const date = String(row[columns.date] ?? '').trim()
    const time = String(row[columns.time] ?? '').trim()

    const creditRaw = row[columns.credit]
    const debitRaw = row[columns.debit]
    const balanceRaw = row[columns.balance]

    movements.push({
      index: i,
      clientId,
      client,
      date,
      time,
      concept,
      reference: String(row[columns.reference] ?? '').trim(),
      currency: String(row[columns.currency] ?? '').trim(),
      creditRaw,
      debitRaw,
      balanceRaw,
      credit: parseNumber(creditRaw),
      debit: parseNumber(debitRaw),
      balance: parseNumber(balanceRaw),
      sortTime: parseDateTime(date, time),
    })
  }

  movements.sort((a, b) => {
    if (a.sortTime !== b.sortTime) {
      return a.sortTime - b.sortTime
    }

    return a.index - b.index
  })

  return movements
}

function findBonusIndex(movements: RawMovement[]) {
  return movements.findIndex(
    (movement) =>
      normalizeText(movement.concept) ===
      'acredita gift c - bono caballos'
  )
}

function findStartIndex(
  movements: RawMovement[],
  bonusIndex: number
) {
  if (bonusIndex < 0) return -1

  for (
    let i = bonusIndex + 1;
    i < movements.length;
    i++
  ) {
    const movement = movements[i]

    const concept =
      normalizeText(movement.concept)

    if (concept !== 'bet horse racing') {
      continue
    }

    const betAmount = Math.abs(movement.debit)

    if (betAmount <= 0) {
      continue
    }

    /*
     * El saldo que tenía el usuario justo antes
     * de realizar esta apuesta.
     *
     * Para el primer movimiento después del bono,
     * usamos el saldo del movimiento anterior.
     */
    const previousMovement = movements[i - 1]

    if (!previousMovement) {
      continue
    }

    const previousBalance =
      previousMovement.balance

    /*
     * INICIO BONO:
     *
     * Si la cantidad apostada es mayor que el saldo
     * disponible que tenía el usuario en el movimiento
     * anterior, significa que la apuesta está utilizando
     * saldo de bono.
     */
    if (betAmount > previousBalance) {
      return i
    }
  }

  return -1
}

function detectManualReviewAlert(
  movements: RawMovement[],
  startIndex: number,
  bonusAmount: number
): ManualReviewAlert | null {
  if (startIndex < 0) {
    return null
  }

  const startMovement = movements[startIndex]

  /*
   * Excepción:
   *
   * El bono puede utilizarse en varias jugadas mientras
   * el saldo permanece en 0.
   *
   * Ejemplo:
   *
   * Bono = 750
   * BET 250 → saldo 0
   * BET 250 → saldo 0
   * BET 250 → saldo 0
   *
   * 250 + 250 + 250 = 750
   *
   * En este caso NO mostramos alerta.
   *
   * IMPORTANTE:
   * Esta excepción solamente aplica cuando son VARIAS
   * apuestas y todas mantienen el saldo en 0.
   */

  let bonusBetTotal = 0
  let bonusBetCount = 0

  for (
    let i = startIndex;
    i < movements.length;
    i++
  ) {
    const movement = movements[i]

    const concept =
      normalizeText(movement.concept)

    /*
     * La secuencia del uso inicial del bono termina
     * cuando aparece otro tipo de movimiento o una apuesta
     * que ya no deja el saldo en 0.
     */
    if (concept !== 'bet horse racing') {
      break
    }

    if (
      Math.abs(movement.balance) > 0.000001
    ) {
      break
    }

    const betAmount = Math.abs(movement.debit)

    if (betAmount <= 0) {
      break
    }

    bonusBetTotal += betAmount
    bonusBetCount++

    /*
     * Solamente evitamos la alerta cuando:
     *
     * 1. Hubo más de una apuesta.
     * 2. La suma de esas apuestas es exactamente
     *    el valor del bono.
     */
    if (
      bonusBetCount > 1 &&
      Math.abs(bonusBetTotal - bonusAmount) < 0.000001
    ) {
      return null
    }

    /*
     * Si ya superamos el valor del bono,
     * dejamos de buscar la excepción.
     */
    if (bonusBetTotal > bonusAmount) {
      break
    }
  }

  /*
   * Si no se cumplió la excepción anterior,
   * aplicamos la lógica original de revisión:
   *
   * Si la referencia de la jugada inicial NO tiene
   * posteriormente un WIN o PREMIO, mostramos alerta.
   */

  const startReference =
    normalizeText(startMovement.reference)

  if (!startReference) {
    return null
  }

  const hasWinOrPrize = movements
    .slice(startIndex + 1)
    .some((movement) => {
      const sameReference =
        normalizeText(movement.reference) ===
        startReference

      if (!sameReference) {
        return false
      }

      const concept =
        normalizeText(movement.concept)

      return (
        concept.includes('win') ||
        concept.includes('premio')
      )
    })

  if (hasWinOrPrize) {
    return null
  }

  return {
    reference: startMovement.reference,
    betAmount: Math.abs(startMovement.debit),
    betDate: startMovement.date,
    betTime: startMovement.time,
    currency: startMovement.currency,
  }
}

function calculateMovements(
  movements: RawMovement[],
  bonusIndex: number,
  startIndex: number,
  required: number
): ProcessedMovement[] {
  let accumulated = 0
  let completed = false

  return movements.map((movement, index) => {
    const baseType = classifyMovement(movement.concept)

    const isBonus = index === bonusIndex
    const isStart = index === startIndex

    if (index < startIndex || startIndex < 0) {
      return {
        ...movement,
        type: isBonus ? 'BONO' : baseType,
        isBonus,
        isStart,
        affectsRollover: false,
        rolloverAmount: 0,
        rolloverAccumulated: null,
        observation: isBonus
          ? 'Bono detectado.'
          : 'Anterior al inicio del rollover.',
      }
    }

    /*
     * Una vez cumplido el rollover:
     * NO seguimos sumando ni restando absolutamente nada.
     */
    if (completed) {
      return {
        ...movement,
        type: baseType,
        isBonus,
        isStart,
        affectsRollover: false,
        rolloverAmount: 0,
        rolloverAccumulated: null,
        observation: 'Cálculo detenido: rollover cumplido.',
      }
    }

    let affectsRollover = false
    let rolloverAmount = 0
    let observation = ''

    if (baseType === 'APUESTA') {
      affectsRollover = true
      rolloverAmount = Math.abs(movement.debit)
      accumulated += rolloverAmount

      if (isStart) {
        observation =
          'Inicio del rollover. Esta apuesta también suma.'
      } else {
        observation = 'Suma al rollover.'
      }
    } else if (baseType === 'DEVOLUCIÓN') {
      affectsRollover = true
      rolloverAmount = -movement.credit
      accumulated += rolloverAmount
      observation = 'Resta por devolución.'
    } else {
      observation = 'No afecta el rollover.'
    }

    if (
      affectsRollover &&
      accumulated >= required
    ) {
      completed = true
      observation =
        `${observation} Aquí se completa el rollover.`
    }

    return {
      ...movement,
      type: isStart ? 'INICIO BONO' : baseType,
      isBonus,
      isStart,
      affectsRollover,
      rolloverAmount,
      rolloverAccumulated: accumulated,
      observation,
    }
  })
}

export default function Rollover() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [movements, setMovements] = useState<RawMovement[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const [manualReviewAlert, setManualReviewAlert] =
    useState<ManualReviewAlert | null>(null)

  const [selectedPercentage, setSelectedPercentage] =
    useState(50)

  const [rolloverConfig, setRolloverConfig] =
    useState<RolloverConfig>(DEFAULT_CONFIG)

  const [filter, setFilter] = useState<
    'TODOS' |
    'APUESTA' |
    'DEVOLUCIÓN' |
    'GANANCIA' |
    'BONO' |
    'DEPÓSITO' |
    'RETIRO' |
    'INICIO BONO' |
    'OTRO'
  >('TODOS')

  const [search, setSearch] = useState('')

  const bonusIndex = useMemo(
    () => findBonusIndex(movements),
    [movements]
  )

  const startIndex = useMemo(
    () => findStartIndex(movements, bonusIndex),
    [movements, bonusIndex]
  )

  const bonusAmount =
    bonusIndex >= 0
      ? movements[bonusIndex].credit
      : 0

  const multiplier =
    rolloverConfig[selectedPercentage] ?? 0

  const requiredRollover =
    bonusAmount * multiplier

  const processedMovements = useMemo(
    () =>
      calculateMovements(
        movements,
        bonusIndex,
        startIndex,
        requiredRollover
      ),
    [
      movements,
      bonusIndex,
      startIndex,
      requiredRollover,
    ]
  )

  const fulfilledRollover = useMemo(() => {
    if (startIndex < 0) return 0

    let lastValue = 0

    for (const movement of processedMovements) {
      if (
        movement.rolloverAccumulated !== null
      ) {
        lastValue =
          movement.rolloverAccumulated
      }
    }

    return lastValue
  }, [processedMovements, startIndex])

  const completed =
    requiredRollover > 0 &&
    fulfilledRollover >= requiredRollover

  const progress =
    requiredRollover > 0
      ? (fulfilledRollover / requiredRollover) * 100
      : 0

  const remaining = Math.max(
    requiredRollover - fulfilledRollover,
    0
  )

  const client =
    movements[0]?.client || '—'

  const clientId =
    movements[0]?.clientId || '—'

  const currency =
    movements[bonusIndex]?.currency ||
    movements[0]?.currency ||
    ''

  const filteredMovements = useMemo(() => {
    const query = normalizeText(search)

    return processedMovements.filter(
      (movement) => {
        const matchesFilter =
          filter === 'TODOS' ||
          movement.type === filter

        const matchesSearch =
          !query ||
          normalizeText(movement.concept).includes(query) ||
          normalizeText(movement.reference).includes(query) ||
          normalizeText(movement.client).includes(query)

        return (
          matchesFilter &&
          matchesSearch
        )
      }
    )
  }, [
    processedMovements,
    filter,
    search,
  ])

  const processFile = async (
    file: File
  ) => {
    setError('')
    setLoading(true)

    try {
      const extension =
        file.name
          .split('.')
          .pop()
          ?.toLowerCase()

      if (
        extension !== 'xlsx' &&
        extension !== 'xls'
      ) {
        throw new Error(
          'Selecciona un archivo Excel válido (.xlsx o .xls).'
        )
      }

      const buffer =
        await file.arrayBuffer()

      const workbook =
        XLSX.read(buffer, {
          type: 'array',
          raw: false,
        })

      let selectedSheetName =
        workbook.SheetNames.find(
          (name) =>
            normalizeText(name) ===
            'movimientos'
        )

      let selectedRows: unknown[][] | null =
        null

      let selectedHeaderIndex = -1

      /*
       * Primero intentamos la hoja "Movimientos".
       */
      if (selectedSheetName) {
        const sheet =
          workbook.Sheets[selectedSheetName]

        const rows =
          XLSX.utils.sheet_to_json(
            sheet,
            {
              header: 1,
              defval: '',
              raw: false,
            }
          ) as unknown[][]

        const headerIndex =
          findHeaderRow(rows)

        if (headerIndex >= 0) {
          selectedRows = rows
          selectedHeaderIndex =
            headerIndex
        }
      }

      /*
       * Si no sirve, buscamos automáticamente
       * una hoja que tenga las columnas necesarias.
       */
      if (
        !selectedRows ||
        selectedHeaderIndex < 0
      ) {
        for (
          const sheetName of workbook.SheetNames
        ) {
          const sheet =
            workbook.Sheets[sheetName]

          const rows =
            XLSX.utils.sheet_to_json(
              sheet,
              {
                header: 1,
                defval: '',
                raw: false,
              }
            ) as unknown[][]

          const headerIndex =
            findHeaderRow(rows)

          if (headerIndex >= 0) {
            selectedSheetName =
              sheetName
            selectedRows = rows
            selectedHeaderIndex =
              headerIndex
            break
          }
        }
      }

      if (
        !selectedRows ||
        selectedHeaderIndex < 0
      ) {
        throw new Error(
          'No encontré una hoja con las columnas necesarias del archivo.'
        )
      }

      const parsed =
        parseRows(
          selectedRows,
          selectedHeaderIndex
        )

      if (parsed.length === 0) {
        throw new Error(
          'El archivo no contiene movimientos válidos.'
        )
      }

      const bonusIdx =
        findBonusIndex(parsed)

      if (bonusIdx < 0) {
        throw new Error(
          'No encontré el movimiento "ACREDITA GIFT C - Bono Caballos".'
        )
      }

      const startIdx =
        findStartIndex(
          parsed,
          bonusIdx
        )

      if (startIdx < 0) {
        throw new Error(
          'Encontré el bono, pero no encontré la apuesta que marca el INICIO BONO.'
        )
      }

      /*
       * Validación adicional:
       * si la jugada de inicio no tuvo WIN/PREMIO
       * y posteriormente hubo una nueva recarga,
       * mostramos una advertencia para revisión manual.
       *
       * Esta alerta NO modifica el cálculo del rollover.
       */
      const reviewAlert = detectManualReviewAlert(
        parsed,
        startIdx,
        bonusAmount
      )

      setMovements(parsed)
      setFileName(file.name)
      setFilter('TODOS')
      setSearch('')
      setManualReviewAlert(reviewAlert)
    } catch (err) {
      setMovements([])
      setFileName('')
      setManualReviewAlert(null)

      setError(
        err instanceof Error
          ? err.message
          : 'No fue posible procesar el archivo.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0]

    if (file) {
      void processFile(file)
    }

    event.target.value = ''
  }

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault()
    setIsDragging(false)

    const file =
      event.dataTransfer.files?.[0]

    if (file) {
      void processFile(file)
    }
  }

  const updateConfig = (
    percentage: number,
    value: string
  ) => {
    const numericValue =
      Number(value)

    setRolloverConfig(
      (current) => ({
        ...current,
        [percentage]:
          Number.isFinite(numericValue)
            ? numericValue
            : 0,
      })
    )
  }

  const typeClass = (
    type: MovementType
  ) => {
    switch (type) {
      case 'APUESTA':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'

      case 'DEVOLUCIÓN':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20'

      case 'GANANCIA':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20'

      case 'BONO':
        return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'

      case 'INICIO BONO':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/20'

      case 'DEPÓSITO':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'

      case 'RETIRO':
        return 'bg-red-500/10 text-red-400 border-red-500/20'

      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    }
  }

  return (
    <div className="min-h-screen bg-[#090909] text-zinc-100 p-4 md:p-6">
      {manualReviewAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-yellow-500/30 bg-[#111111] shadow-2xl overflow-hidden">

            {/* HEADER */}
            <div className="px-6 py-5 border-b border-zinc-800 bg-yellow-500/[0.04]">
              <div className="flex items-start gap-4">

                <div className="w-11 h-11 shrink-0 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-xl">
                  ⚠
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-yellow-400">
                    REVISAR MANUALMENTE
                  </h2>

                  <p className="text-sm text-zinc-400 mt-1">
                    Posible pérdida del bono detectada.
                  </p>
                </div>

              </div>
            </div>

            {/* CONTENT */}
            <div className="p-6">

              <p className="text-sm leading-6 text-zinc-300">
                La jugada que marcó el inicio del bono
                no tiene una ganancia o premio asociado
                y posteriormente se detectó una nueva
                recarga del usuario.
              </p>

              <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04] p-4">
                <p className="text-sm leading-6 text-yellow-200/80">
                  La jugada que marcó el inicio del bono no tiene
                  una ganancia o premio asociado a su referencia.
                  Es posible que el usuario haya perdido utilizando
                  el bono. Verifica manualmente si corresponde
                  exigir rollover.
                </p>
              </div>

              {/* DETAILS */}
              <div className="mt-5 space-y-3">

                <div className="flex items-center justify-between gap-4 py-2 border-b border-zinc-800">
                  <span className="text-xs text-zinc-600 uppercase tracking-wider">
                    Referencia
                  </span>

                  <span className="text-sm font-mono text-zinc-300">
                    {manualReviewAlert.reference}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 py-2 border-b border-zinc-800">
                  <span className="text-xs text-zinc-600 uppercase tracking-wider">
                    Jugada
                  </span>

                  <span className="text-sm font-mono text-red-400">
                    -{formatNumber(
                      manualReviewAlert.betAmount
                    )}{' '}
                    {manualReviewAlert.currency}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 py-2 border-b border-zinc-800">
                  <span className="text-xs text-zinc-600 uppercase tracking-wider">
                    Fecha jugada
                  </span>

                  <span className="text-xs text-zinc-400">
                    {manualReviewAlert.betDate}{' '}
                    {manualReviewAlert.betTime}
                  </span>
                </div>

              </div>

              {/* BUTTON */}
              <button
                onClick={() =>
                  setManualReviewAlert(null)
                }
                className="w-full mt-6 py-3 rounded-xl text-sm font-semibold transition hover:brightness-110"
                style={{
                  backgroundColor: GOLD,
                  color: '#090909',
                }}
              >
                Entendido, revisaré manualmente
              </button>

            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1800px] mx-auto">

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <div
              className="text-xs tracking-[0.25em] uppercase mb-2"
              style={{ color: GOLD }}
            >
              HÍPICAS BABIECA
            </div>

            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Calculador de Rollover
            </h1>

            <p className="text-sm text-zinc-500 mt-1">
              Analiza automáticamente los movimientos del bono
              de caballos.
            </p>
          </div>

          {fileName && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                Archivo
              </div>
              <div className="text-sm text-zinc-300 mt-1">
                {fileName}
              </div>
              <div className="text-xs text-zinc-600 mt-1">
                {movements.length} movimientos
              </div>
            </div>
          )}
        </div>

        {/* UPLOAD */}
        {!movements.length && (
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() =>
              setIsDragging(false)
            }
            onDrop={handleDrop}
            className={`
              rounded-2xl border-2 border-dashed
              min-h-[300px]
              flex flex-col items-center justify-center
              text-center
              transition
              ${isDragging
                ? 'border-[#c9a84c] bg-[#c9a84c]/5'
                : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
              }
            `}
          >
            <div className="w-14 h-14 rounded-2xl border border-zinc-800 bg-zinc-900 flex items-center justify-center mb-5">
              <span className="text-2xl">↑</span>
            </div>

            <h2 className="text-lg font-medium">
              Arrastra tu archivo Excel aquí
            </h2>

            <p className="text-sm text-zinc-500 mt-2 mb-5">
              La aplicación analizará automáticamente toda la hoja.
            </p>

            <button
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={loading}
              className="px-5 py-2.5 rounded-xl font-medium text-sm transition hover:brightness-110 disabled:opacity-50"
              style={{
                backgroundColor: GOLD,
                color: '#090909',
              }}
            >
              {loading
                ? 'Procesando...'
                : 'Seleccionar archivo'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />

            {error && (
              <div className="mt-6 max-w-xl rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {movements.length > 0 && (
          <>
            {/* TOP CONTROLS */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 mb-5">

              {/* USER */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                      Usuario
                    </div>

                    <div className="text-xl font-semibold mt-1">
                      {client}
                    </div>

                    <div className="text-xs text-zinc-600 mt-1">
                      ID cliente: {clientId}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                      Moneda
                    </div>

                    <div className="text-lg font-medium mt-1">
                      {currency || '—'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                      Inicio bono
                    </div>

                    <div className="text-sm text-zinc-300 mt-1">
                      {startIndex >= 0
                        ? `${movements[startIndex].date} ${movements[startIndex].time}`
                        : '—'}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMovements([])
                      setFileName('')
                      setError('')
                      setManualReviewAlert(null)
                    }}
                    className="ml-auto text-xs text-zinc-500 hover:text-red-400 transition"
                  >
                    Cargar otro archivo
                  </button>
                </div>
              </div>

              {/* PERCENTAGE */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 min-w-[280px]">
                <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                  Porcentaje del bono
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <select
                    value={selectedPercentage}
                    onChange={(event) =>
                      setSelectedPercentage(
                        Number(event.target.value)
                      )
                    }
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#c9a84c]"
                  >
                    {PERCENTAGES.map(
                      (percentage) => (
                        <option
                          key={percentage}
                          value={percentage}
                        >
                          {percentage}%
                        </option>
                      )
                    )}
                  </select>

                  <div
                    className="px-4 py-2.5 rounded-xl border text-sm font-semibold"
                    style={{
                      color: GOLD,
                      borderColor: `${GOLD}40`,
                      backgroundColor: `${GOLD}10`,
                    }}
                  >
                    {multiplier}x
                  </div>
                </div>
              </div>
            </div>

            {/* SUMMARY */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">

              <SummaryCard
                label="Bono aplicado"
                value={formatMoney(
                  bonusAmount,
                  currency
                )}
                accent="gold"
              />

              <SummaryCard
                label="Rollover requerido"
                value={formatMoney(
                  requiredRollover,
                  currency
                )}
              />

              <SummaryCard
                label="Rollover cumplido"
                value={formatMoney(
                  fulfilledRollover,
                  currency
                )}
                accent="green"
              />

              <SummaryCard
                label="Faltante"
                value={formatMoney(
                  remaining,
                  currency
                )}
                accent={
                  remaining > 0
                    ? 'red'
                    : 'green'
                }
              />

              <SummaryCard
                label="Progreso"
                value={`${progress.toFixed(2)}%`}
              />

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                  Estado
                </div>

                <div
                  className={`mt-3 inline-flex items-center px-3 py-1.5 rounded-full border text-xs font-semibold ${completed
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    }`}
                >
                  {completed
                    ? 'ROLLOVER CUMPLIDO'
                    : 'EN PROCESO'}
                </div>
              </div>
            </div>

            {/* PROGRESS */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 mb-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-zinc-400">
                  Progreso del rollover
                </span>

                <span className="text-sm font-mono text-zinc-300">
                  {formatMoney(
                    fulfilledRollover,
                    currency
                  )}{' '}
                  /{' '}
                  {formatMoney(
                    requiredRollover,
                    currency
                  )}
                </span>
              </div>

              <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    backgroundColor: completed
                      ? '#34d399'
                      : GOLD,
                  }}
                />
              </div>
            </div>

            {/* CONFIG */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-medium">
                    Configuración de rollover
                  </h2>

                  <p className="text-xs text-zinc-600 mt-1">
                    Modifica cualquier multiplicador y el cálculo
                    se actualizará automáticamente.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
                {PERCENTAGES.map(
                  (percentage) => (
                    <div
                      key={percentage}
                      className={`
                        rounded-xl border p-3
                        ${selectedPercentage ===
                          percentage
                          ? 'border-[#c9a84c]/50 bg-[#c9a84c]/5'
                          : 'border-zinc-800 bg-zinc-900/50'
                        }
                      `}
                    >
                      <div className="text-xs text-zinc-500">
                        {percentage}%
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={
                            rolloverConfig[
                            percentage
                            ]
                          }
                          onChange={(event) =>
                            updateConfig(
                              percentage,
                              event.target.value
                            )
                          }
                          className="w-full min-w-0 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm font-mono outline-none focus:border-[#c9a84c]"
                        />

                        <span className="text-xs text-zinc-600">
                          x
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* FILTERS */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 mb-3">
              <div className="flex flex-col xl:flex-row gap-3">

                <div className="flex gap-1 overflow-x-auto pb-1">
                  {[
                    'TODOS',
                    'APUESTA',
                    'DEVOLUCIÓN',
                    'GANANCIA',
                    'BONO',
                    'DEPÓSITO',
                    'RETIRO',
                    'INICIO BONO',
                    'OTRO',
                  ].map((item) => (
                    <button
                      key={item}
                      onClick={() =>
                        setFilter(
                          item as typeof filter
                        )
                      }
                      className={`
                        whitespace-nowrap px-3 py-2 rounded-lg text-xs border transition
                        ${filter === item
                          ? 'border-[#c9a84c]/40 text-[#c9a84c] bg-[#c9a84c]/5'
                          : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }
                      `}
                    >
                      {item === 'TODOS'
                        ? 'Todos'
                        : item}
                    </button>
                  ))}
                </div>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Buscar concepto, referencia..."
                  className="xl:w-80 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#c9a84c]"
                />
              </div>
            </div>

            {/* TABLE */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/70 text-left">
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 whitespace-nowrap">
                        Fecha
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600">
                        ID
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 min-w-[260px]">
                        Concepto
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600">
                        Referencia
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600">
                        Moneda
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 text-right">
                        Crédito
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 text-right">
                        Débito
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 text-right">
                        Saldo
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600">
                        Tipo
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600">
                        Inicio bono
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600">
                        Afecta
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 text-right whitespace-nowrap">
                        Rollover acumulado
                      </th>

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 min-w-[220px]">
                        Observación
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMovements.map(
                      (movement, index) => (
                        <tr
                          key={`${movement.index}-${index}`}
                          className={`
                            border-b border-zinc-900
                            hover:bg-zinc-900/50
                            transition
                            ${movement.isStart
                              ? 'bg-purple-500/[0.04]'
                              : ''
                            }
                          `}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-zinc-400">
                            <div>
                              {movement.date}
                            </div>
                            <div className="text-[11px] text-zinc-700">
                              {movement.time}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                            {movement.index + 1}
                          </td>

                          <td className="px-4 py-3 text-zinc-300">
                            {movement.concept}
                          </td>

                          <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                            {movement.reference ||
                              '—'}
                          </td>

                          <td className="px-4 py-3 text-xs text-zinc-500">
                            {movement.currency}
                          </td>

                          <td className="px-4 py-3 text-right font-mono text-xs text-emerald-400">
                            {movement.credit
                              ? formatNumber(
                                movement.credit
                              )
                              : '—'}
                          </td>

                          <td className="px-4 py-3 text-right font-mono text-xs text-red-400">
                            {movement.debit
                              ? formatNumber(
                                movement.debit
                              )
                              : '—'}
                          </td>

                          <td className="px-4 py-3 text-right font-mono text-xs text-zinc-300">
                            {formatNumber(
                              movement.balance
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`
                                inline-flex
                                px-2.5 py-1
                                rounded-full
                                border
                                text-[10px]
                                font-semibold
                                whitespace-nowrap
                                ${typeClass(
                                movement.type
                              )}
                              `}
                            >
                              {movement.type}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            {movement.isStart ? (
                              <span className="text-purple-300 font-semibold text-xs">
                                ★ INICIO
                              </span>
                            ) : (
                              <span className="text-zinc-700">
                                —
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {movement.affectsRollover ? (
                              <span className="text-emerald-400 text-xs">
                                Sí
                              </span>
                            ) : (
                              <span className="text-zinc-600 text-xs">
                                No
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {movement.rolloverAccumulated !==
                              null ? (
                              <span className="text-zinc-200">
                                {formatNumber(
                                  movement.rolloverAccumulated
                                )}
                              </span>
                            ) : (
                              <span className="text-zinc-700">
                                —
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-xs text-zinc-500">
                            {movement.observation}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {filteredMovements.length ===
                0 && (
                  <div className="py-16 text-center text-sm text-zinc-600">
                    No hay movimientos que coincidan
                    con el filtro.
                  </div>
                )}
            </div>

            {/* FOOTER INFO */}
            <div className="flex flex-col md:flex-row justify-between gap-3 mt-4 text-xs text-zinc-600">
              <span>
                Mostrando{' '}
                {filteredMovements.length} de{' '}
                {processedMovements.length}{' '}
                movimientos.
              </span>

              <span>
                El cálculo se detiene automáticamente
                cuando el rollover es cumplido.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'gold' | 'green' | 'red'
}) {
  let valueClass = 'text-zinc-100'

  if (accent === 'gold') {
    valueClass = 'text-[#c9a84c]'
  }

  if (accent === 'green') {
    valueClass = 'text-emerald-400'
  }

  if (accent === 'red') {
    valueClass = 'text-red-400'
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-[10px] uppercase tracking-widest text-zinc-600">
        {label}
      </div>

      <div
        className={`mt-3 text-lg font-semibold font-mono ${valueClass}`}
      >
        {value}
      </div>
    </div>
  )
}