import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { supabase } from '../SupabaseClient'

const GOLD = '#c9a84c'
const ACCOUNTING_PASSWORD =
    'Contabilidad1234'

type Country = {
    id: string
    name: string
    currency: string
    symbol: string
    baseAmount: number
}

type Movement = {
    id: string
    countryId: string
    date: string
    concept: string
    entry: number
    exit: number
    observations: string
    createdAt: string
}

type FilterType =
    | 'day'
    | 'week'
    | 'month'
    | 'range'

type MovementWithBalance =
    Movement & {
        balance: number
    }

/*
 * =========================================================
 * TIPOS DE CONCILIACIÓN
 * =========================================================
 */

type ReconciliationDay = {
    id: string
    countryId: string
    date: string
    openingBalance: number
    bankClosingBalance: number | null
    cumulativeDifference: number
    notes: string
}

type ReconciliationMovement = {
    id: string
    reconciliationDayId: string
    countryId: string
    source: 'platform' | 'manual'
    status: 'pending' | 'confirmed' | 'problem'
    movementType: 'entry' | 'exit'
    movementDatetime: string | null
    platformUser: string
    platformMethod: string
    platformReference: string
    concept: string
    amount: number
    description: string
    observations: string
}

type ImportPreview = {
    movementType: 'entry' | 'exit'
    movementDatetime: string | null
    platformUser: string
    platformMethod: string
    platformReference: string
    concept: string
    amount: number
}

/*
 * =========================================================
 * UTILIDADES GENERALES
 * =========================================================
 */

function getTodayKey() {
    const now = new Date()

    return `${now.getFullYear()}-${String(
        now.getMonth() + 1,
    ).padStart(2, '0')}-${String(
        now.getDate(),
    ).padStart(2, '0')}`
}

function formatDate(date: string) {
    const [year, month, day] =
        date.split('-')

    return `${day}/${month}/${year}`
}

function formatMoney(
    amount: number,
    currency: string,
    symbol: string,
) {
    const formatted = new Intl.NumberFormat(
        'es-CO',
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        },
    ).format(amount)

    return `${symbol} ${formatted} ${currency}`
}

function getWeekRange(date: Date) {
    const current = new Date(date)
    const day = current.getDay()

    const diff =
        day === 0
            ? -6
            : 1 - day

    const start = new Date(current)
    start.setDate(
        current.getDate() + diff,
    )

    const end = new Date(start)
    end.setDate(
        start.getDate() + 6,
    )

    const toKey = (value: Date) =>
        `${value.getFullYear()}-${String(
            value.getMonth() + 1,
        ).padStart(2, '0')}-${String(
            value.getDate(),
        ).padStart(2, '0')}`

    return {
        start: toKey(start),
        end: toKey(end),
    }
}

function getMonthRange(date: Date) {
    const year = date.getFullYear()
    const month = date.getMonth()

    const start = new Date(
        year,
        month,
        1,
    )

    const end = new Date(
        year,
        month + 1,
        0,
    )

    const toKey = (value: Date) =>
        `${value.getFullYear()}-${String(
            value.getMonth() + 1,
        ).padStart(2, '0')}-${String(
            value.getDate(),
        ).padStart(2, '0')}`

    return {
        start: toKey(start),
        end: toKey(end),
    }
}

function isDateInRange(
    date: string,
    start: string,
    end: string,
) {
    return date >= start && date <= end
}

function getInitialFilterValue() {
    const today = new Date()

    return {
        day: getTodayKey(),

        weekStart:
            getWeekRange(today).start,

        weekEnd:
            getWeekRange(today).end,

        month:
            `${today.getFullYear()}-${String(
                today.getMonth() + 1,
            ).padStart(2, '0')}`,

        rangeStart:
            getTodayKey(),

        rangeEnd:
            getTodayKey(),
    }
}

/*
 * =========================================================
 * UTILIDADES DE IMPORTACIÓN
 * =========================================================
 */

function normalizeHeader(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
}

function parseAmount(value: string) {
    let text = String(value ?? '')
        .trim()
        .replace(/[^\d,.-]/g, '')

    if (!text) return 0

    const hasComma =
        text.includes(',')

    const hasDot =
        text.includes('.')

    if (hasComma && hasDot) {
        const lastComma =
            text.lastIndexOf(',')

        const lastDot =
            text.lastIndexOf('.')

        if (lastComma > lastDot) {
            text = text
                .replace(/\./g, '')
                .replace(',', '.')
        } else {
            text = text.replace(/,/g, '')
        }
    } else if (hasComma) {
        const parts =
            text.split(',')

        if (
            parts.length === 2 &&
            parts[1].length <= 2
        ) {
            text = text.replace(
                ',',
                '.',
            )
        } else {
            text = text.replace(
                /,/g,
                '',
            )
        }
    } else if (hasDot) {
        const parts =
            text.split('.')

        if (
            parts.length === 2 &&
            parts[1].length <= 2
        ) {
            // Decimal
        } else {
            text = text.replace(
                /\./g,
                '',
            )
        }
    }

    const result = Number(text)

    return Number.isFinite(result)
        ? result
        : 0
}

function parseDateTime(
    value: string,
    selectedDate: string,
) {
    const text = String(value ?? '')
        .trim()

    if (!text) {
        return `${selectedDate}T12:00:00`
    }

    /*
     * yyyy-mm-dd
     */
    const isoMatch =
        text.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
        )

    if (isoMatch) {
        const [, year, month, day, hour, minute, second] =
            isoMatch

        return `${year}-${String(
            Number(month),
        ).padStart(2, '0')}-${String(
            Number(day),
        ).padStart(2, '0')}T${String(
            Number(hour ?? 12),
        ).padStart(2, '0')}:${String(
            Number(minute ?? 0),
        ).padStart(2, '0')}:${String(
            Number(second ?? 0),
        ).padStart(2, '0')}`
    }

    /*
     * dd/mm/yyyy
     */
    const latinMatch =
        text.match(
            /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
        )

    if (latinMatch) {
        const [, day, month, year, hour, minute, second] =
            latinMatch

        return `${year}-${String(
            Number(month),
        ).padStart(2, '0')}-${String(
            Number(day),
        ).padStart(2, '0')}T${String(
            Number(hour ?? 12),
        ).padStart(2, '0')}:${String(
            Number(minute ?? 0),
        ).padStart(2, '0')}:${String(
            Number(second ?? 0),
        ).padStart(2, '0')}`
    }

    return `${selectedDate}T12:00:00`
}

function normalizeMovementType(
    value: string,
) {
    const text = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    if (
        text.includes('retiro') ||
        text.includes('retirada') ||
        text.includes('salida') ||
        text.includes('withdraw')
    ) {
        return 'exit' as const
    }

    if (
        text.includes('deposito') ||
        text.includes('entrada') ||
        text.includes('recarga') ||
        text.includes('deposit')
    ) {
        return 'entry' as const
    }

    return null
}

function findHeaderIndex(
    headers: string[],
    possibleNames: string[],
) {
    return headers.findIndex(header =>
        possibleNames.some(
            name =>
                header === name ||
                header.includes(name),
        ),
    )
}

/*
 * =========================================================
 * COMPONENTE DE CONCILIACIÓN
 * =========================================================
 */

function Reconciliation({
    countries,
    selectedCountryId,
    onCountryChange,
}: {
    countries: Country[]
    selectedCountryId: string
    onCountryChange: (
        countryId: string,
    ) => void
}) {
    const [reconciliationDate, setReconciliationDate] =
        useState(getTodayKey())

    const [day, setDay] =
        useState<ReconciliationDay | null>(
            null,
        )

    const [reconciliationMovements, setReconciliationMovements] =
        useState<ReconciliationMovement[]>([])

    const [loadingReconciliation, setLoadingReconciliation] =
        useState(false)

    const [savingDay, setSavingDay] =
        useState(false)

    const [openingBalanceInput, setOpeningBalanceInput] =
        useState('')

    const [bankClosingInput, setBankClosingInput] =
        useState('')

    const reconciliationLoadId =
        useRef(0)

    const [importModalOpen, setImportModalOpen] =
        useState(false)

    const [manualModalOpen, setManualModalOpen] =
        useState(false)

    const [importText, setImportText] =
        useState('')

    const [importPreview, setImportPreview] =
        useState<ImportPreview[]>([])

    const [importError, setImportError] =
        useState('')

    const [savingImport, setSavingImport] =
        useState(false)

    const [savingManual, setSavingManual] =
        useState(false)

    const [manualType, setManualType] =
        useState<'entry' | 'exit'>(
            'entry',
        )

    const [manualConcept, setManualConcept] =
        useState('')

    const [manualDescription, setManualDescription] =
        useState('')

    const [manualAmount, setManualAmount] =
        useState('')

    const [manualDateTime, setManualDateTime] =
        useState('')

    const [manualReference, setManualReference] =
        useState('')

    const [manualStatus, setManualStatus] =
        useState<
            'pending' | 'confirmed'
        >('confirmed')

    const [manualObservations, setManualObservations] =
        useState('')

    const [sourceFilter, setSourceFilter] =
        useState<'all' | 'platform' | 'manual'>(
            'all',
        )

    const [statusFilter, setStatusFilter] =
        useState<
            'all' | 'pending' | 'confirmed' | 'problem'
        >('all')

    const selectedCountry =
        countries.find(
            country =>
                country.id ===
                selectedCountryId,
        )

    /*
     * =========================================================
     * CARGAR DÍA
     * =========================================================
     */

    const loadReconciliation = async () => {
        if (
            !selectedCountryId ||
            !reconciliationDate
        ) {
            return
        }

        // Identificador de esta carga.
        // Si el usuario cambia de fecha antes de que termine,
        // la carga anterior queda automáticamente obsoleta.
        const loadId =
            ++reconciliationLoadId.current

        const countryId =
            selectedCountryId

        const currentDate =
            reconciliationDate

        setLoadingReconciliation(true)

        try {
            const {
                data: dayData,
                error: dayError,
            } = await supabase
                .from('reconciliation_days')
                .select('*')
                .eq(
                    'country_id',
                    countryId,
                )
                .eq(
                    'date',
                    currentDate,
                )
                .maybeSingle()

            // Si ya comenzó otra carga, ignoramos esta.
            if (
                loadId !==
                reconciliationLoadId.current
            ) {
                return
            }

            if (dayError) {
                console.error(
                    'Error cargando conciliación:',
                    dayError,
                )
                return
            }

            /*
             * =====================================================
             * EL DÍA YA EXISTE
             * =====================================================
             */

            if (dayData) {
                const loadedDay: ReconciliationDay = {
                    id:
                        dayData.id,

                    countryId:
                        dayData.country_id,

                    date:
                        dayData.date,

                    openingBalance:
                        Number(
                            dayData.opening_balance ??
                            0,
                        ),

                    bankClosingBalance:
                        dayData.bank_closing_balance ===
                            null
                            ? null
                            : Number(
                                dayData.bank_closing_balance,
                            ),

                    cumulativeDifference:
                        Number(
                            dayData.cumulative_difference ??
                            0,
                        ),

                    notes:
                        dayData.notes ??
                        '',
                }

                console.log(
                    'Conciliación cargada:',
                    loadedDay,
                )

                // Restauramos los valores guardados
                // de ESTE día.
                setDay(
                    loadedDay,
                )

                setOpeningBalanceInput(
                    String(
                        loadedDay.openingBalance,
                    ),
                )

                setBankClosingInput(
                    loadedDay.bankClosingBalance ===
                        null
                        ? ''
                        : String(
                            loadedDay.bankClosingBalance,
                        ),
                )

                /*
                 * =================================================
                 * CARGAR MOVIMIENTOS DEL DÍA
                 * =================================================
                 */

                const {
                    data: movementsData,
                    error: movementsError,
                } = await supabase
                    .from(
                        'reconciliation_movements',
                    )
                    .select('*')
                    .eq(
                        'reconciliation_day_id',
                        loadedDay.id,
                    )
                    .order(
                        'movement_datetime',
                        {
                            ascending: true,
                        },
                    )
                    .order(
                        'created_at',
                        {
                            ascending: true,
                        },
                    )

                // Mientras cargábamos los movimientos
                // pudo haber cambiado la fecha.
                if (
                    loadId !==
                    reconciliationLoadId.current
                ) {
                    return
                }

                if (movementsError) {
                    console.error(
                        'Error cargando movimientos:',
                        movementsError,
                    )
                    return
                }

                setReconciliationMovements(
                    (movementsData || []).map(
                        movement => ({
                            id:
                                movement.id,

                            reconciliationDayId:
                                movement.reconciliation_day_id,

                            countryId:
                                movement.country_id,

                            source:
                                movement.source,

                            status:
                                movement.status,

                            movementType:
                                movement.movement_type,

                            movementDatetime:
                                movement.movement_datetime,

                            platformUser:
                                movement.platform_user ??
                                '',

                            platformMethod:
                                movement.platform_method ??
                                '',

                            platformReference:
                                movement.platform_reference ??
                                '',

                            concept:
                                movement.concept ??
                                '',

                            amount:
                                Number(
                                    movement.amount ??
                                    0,
                                ),

                            description:
                                movement.description ??
                                '',

                            observations:
                                movement.observations ??
                                '',
                        }),
                    ),
                )

                return
            }

            /*
             * =====================================================
             * EL DÍA TODAVÍA NO EXISTE
             * =====================================================
             */

            const {
                data: previousDay,
                error: previousError,
            } = await supabase
                .from(
                    'reconciliation_days',
                )
                .select(
                    'date, bank_closing_balance',
                )
                .eq(
                    'country_id',
                    countryId,
                )
                .lt(
                    'date',
                    currentDate,
                )
                .order(
                    'date',
                    {
                        ascending: false,
                    },
                )
                .limit(1)
                .maybeSingle()

            if (
                loadId !==
                reconciliationLoadId.current
            ) {
                return
            }

            if (previousError) {
                console.error(
                    'Error buscando día anterior:',
                    previousError,
                )
            }

            if (
                previousDay?.bank_closing_balance !==
                null &&
                previousDay?.bank_closing_balance !==
                undefined
            ) {
                setOpeningBalanceInput(
                    String(
                        Number(
                            previousDay.bank_closing_balance,
                        ),
                    ),
                )
            } else {
                setOpeningBalanceInput('')
            }

            setBankClosingInput('')
            setReconciliationMovements([])
            setDay(null)

        } finally {
            // Solo la carga más reciente puede
            // quitar el estado de "cargando".
            if (
                loadId ===
                reconciliationLoadId.current
            ) {
                setLoadingReconciliation(false)
            }
        }
    }

    useEffect(() => {
        setDay(null)
        setReconciliationMovements([])
        setOpeningBalanceInput('')
        setBankClosingInput('')

        loadReconciliation()
    }, [
        selectedCountryId,
        reconciliationDate,
    ])

    /*
     * =========================================================
     * CREAR DÍA
     * =========================================================
     */

    const ensureReconciliationDay =
        async () => {
            if (
                !selectedCountryId ||
                !reconciliationDate
            ) {
                return null
            }

            /*
             * Primero buscamos directamente en Supabase
             * el día que estamos trabajando.
             *
             * No confiamos únicamente en el estado `day`,
             * porque al cambiar de fecha React puede conservar
             * momentáneamente el día anterior.
             */
            const { data: existingDay, error: existingError } =
                await supabase
                    .from('reconciliation_days')
                    .select('*')
                    .eq(
                        'country_id',
                        selectedCountryId,
                    )
                    .eq(
                        'date',
                        reconciliationDate,
                    )
                    .maybeSingle()

            if (existingError) {
                console.error(
                    'Error buscando día de conciliación:',
                    existingError,
                )
                return null
            }

            /*
             * Si el día ya existe, lo devolvemos
             * con todos sus datos guardados.
             */
            if (existingDay) {
                const loadedDay: ReconciliationDay = {
                    id: existingDay.id,
                    countryId:
                        existingDay.country_id,
                    date:
                        existingDay.date,
                    openingBalance:
                        Number(
                            existingDay.opening_balance,
                        ),
                    bankClosingBalance:
                        existingDay.bank_closing_balance ===
                            null
                            ? null
                            : Number(
                                existingDay.bank_closing_balance,
                            ),
                    cumulativeDifference:
                        Number(
                            existingDay.cumulative_difference ??
                            0,
                        ),
                    notes:
                        existingDay.notes ?? '',
                }

                setDay(loadedDay)

                return loadedDay
            }

            /*
             * El día todavía no existe.
             *
             * Buscamos el último día anterior para:
             * 1. Obtener su saldo real como saldo inicial.
             * 2. Mantener la diferencia acumulada.
             */
            const { data: previousDay } =
                await supabase
                    .from(
                        'reconciliation_days',
                    )
                    .select(
                        'date, bank_closing_balance, cumulative_difference',
                    )
                    .eq(
                        'country_id',
                        selectedCountryId,
                    )
                    .lt(
                        'date',
                        reconciliationDate,
                    )
                    .order('date', {
                        ascending: false,
                    })
                    .limit(1)
                    .maybeSingle()

            let openingValue =
                Number(
                    openingBalanceInput,
                )

            /*
             * Si existe un cierre real anterior,
             * ese será el saldo inicial del nuevo día.
             */
            if (
                previousDay &&
                previousDay.bank_closing_balance !==
                null
            ) {
                openingValue =
                    Number(
                        previousDay.bank_closing_balance,
                    )
            }

            if (
                !Number.isFinite(
                    openingValue,
                ) ||
                openingValue < 0
            ) {
                openingValue = 0
            }

            const cumulativeDifference =
                Number(
                    previousDay?.cumulative_difference ??
                    0,
                )

            /*
             * Creamos el día.
             */
            const { data, error } =
                await supabase
                    .from(
                        'reconciliation_days',
                    )
                    .insert({
                        country_id:
                            selectedCountryId,

                        date:
                            reconciliationDate,

                        opening_balance:
                            openingValue,

                        bank_closing_balance:
                            null,

                        cumulative_difference:
                            cumulativeDifference,
                    })
                    .select()
                    .single()

            if (error) {
                /*
                 * Si otro proceso creó el día
                 * mientras nosotros lo creábamos,
                 * volvemos a buscarlo.
                 */
                if (
                    error.code ===
                    '23505'
                ) {
                    const { data: retryDay } =
                        await supabase
                            .from(
                                'reconciliation_days',
                            )
                            .select('*')
                            .eq(
                                'country_id',
                                selectedCountryId,
                            )
                            .eq(
                                'date',
                                reconciliationDate,
                            )
                            .maybeSingle()

                    if (retryDay) {
                        const loadedDay: ReconciliationDay =
                        {
                            id:
                                retryDay.id,
                            countryId:
                                retryDay.country_id,
                            date:
                                retryDay.date,
                            openingBalance:
                                Number(
                                    retryDay.opening_balance,
                                ),
                            bankClosingBalance:
                                retryDay.bank_closing_balance ===
                                    null
                                    ? null
                                    : Number(
                                        retryDay.bank_closing_balance,
                                    ),
                            cumulativeDifference:
                                Number(
                                    retryDay.cumulative_difference ??
                                    0,
                                ),
                            notes:
                                retryDay.notes ??
                                '',
                        }

                        setDay(
                            loadedDay,
                        )

                        return loadedDay
                    }
                }

                console.error(
                    'Error creando día de conciliación:',
                    error,
                )

                return null
            }

            const newDay: ReconciliationDay =
            {
                id:
                    data.id,
                countryId:
                    data.country_id,
                date:
                    data.date,
                openingBalance:
                    Number(
                        data.opening_balance,
                    ),
                bankClosingBalance:
                    data.bank_closing_balance ===
                        null
                        ? null
                        : Number(
                            data.bank_closing_balance,
                        ),
                cumulativeDifference:
                    Number(
                        data.cumulative_difference ??
                        0,
                    ),
                notes:
                    data.notes ?? '',
            }

            setDay(
                newDay,
            )

            /*
             * También sincronizamos el input del
             * saldo inicial con lo que realmente
             * quedó guardado.
             */
            setOpeningBalanceInput(
                String(
                    newDay.openingBalance,
                ),
            )

            return newDay
        }

    /*
     * =========================================================
     * GUARDAR SALDOS DEL DÍA
     * =========================================================
     */

    const handleSaveDay =
        async () => {
            if (!selectedCountryId) {
                return
            }

            setSavingDay(true)

            const currentDay =
                await ensureReconciliationDay()

            if (!currentDay) {
                setSavingDay(false)
                return
            }

            const openingValue =
                Number(
                    openingBalanceInput,
                )

            const hasClosing =
                bankClosingInput.trim() !== ''

            const closingValue =
                Number(
                    bankClosingInput,
                )

            if (
                !Number.isFinite(
                    openingValue,
                ) ||
                openingValue < 0
            ) {
                setSavingDay(false)
                return
            }

            if (
                hasClosing &&
                (
                    !Number.isFinite(
                        closingValue,
                    ) ||
                    closingValue < 0
                )
            ) {
                setSavingDay(false)
                return
            }

            const confirmedEntries =
                reconciliationMovements
                    .filter(
                        movement =>
                            movement.status ===
                            'confirmed' &&
                            movement.movementType ===
                            'entry',
                    )
                    .reduce(
                        (total, movement) =>
                            total +
                            movement.amount,
                        0,
                    )

            const confirmedExits =
                reconciliationMovements
                    .filter(
                        movement =>
                            movement.status ===
                            'confirmed' &&
                            movement.movementType ===
                            'exit',
                    )
                    .reduce(
                        (total, movement) =>
                            total +
                            movement.amount,
                        0,
                    )

            /*
             * Saldo esperado:
             *
             * Saldo inicial
             * + entradas confirmadas
             * - salidas confirmadas
             */
            const expectedClosing =
                openingValue +
                confirmedEntries -
                confirmedExits

            let cumulativeDifference =
                currentDay.cumulativeDifference

            /*
             * Si el usuario ingresó el saldo real
             * del banco, calculamos la diferencia
             * del día y la acumulamos con la diferencia
             * anterior.
             */
            if (hasClosing) {
                const previousCumulative =
                    await supabase
                        .from(
                            'reconciliation_days',
                        )
                        .select(
                            'cumulative_difference',
                        )
                        .eq(
                            'country_id',
                            selectedCountryId,
                        )
                        .lt(
                            'date',
                            reconciliationDate,
                        )
                        .order('date', {
                            ascending: false,
                        })
                        .limit(1)
                        .maybeSingle()

                const previousDifference =
                    Number(
                        previousCumulative
                            .data
                            ?.cumulative_difference ??
                        0,
                    )

                const dailyDifference =
                    closingValue -
                    expectedClosing

                cumulativeDifference =
                    previousDifference +
                    dailyDifference
            }

            const { data, error } =
                await supabase
                    .from(
                        'reconciliation_days',
                    )
                    .update({
                        opening_balance:
                            openingValue,

                        bank_closing_balance:
                            hasClosing
                                ? closingValue
                                : null,

                        cumulative_difference:
                            cumulativeDifference,
                    })
                    .eq(
                        'id',
                        currentDay.id,
                    )
                    .select()
                    .single()

            if (error) {
                console.error(
                    'Error guardando cierre:',
                    error,
                )
                setSavingDay(false)
                return
            }

            setDay({
                id: data.id,
                countryId:
                    data.country_id,
                date: data.date,
                openingBalance:
                    Number(
                        data.opening_balance,
                    ),
                bankClosingBalance:
                    data.bank_closing_balance ===
                        null
                        ? null
                        : Number(
                            data.bank_closing_balance,
                        ),
                cumulativeDifference:
                    Number(
                        data.cumulative_difference,
                    ),
                notes:
                    data.notes ?? '',
            })

            setSavingDay(false)
        }

    /*
     * =========================================================
     * RESUMEN DE CONCILIACIÓN
     * =========================================================
     */

    const reconciliationSummary =
        useMemo(() => {
            const entries =
                reconciliationMovements
                    .filter(
                        movement =>
                            movement.status ===
                            'confirmed' &&
                            movement.movementType ===
                            'entry',
                    )
                    .reduce(
                        (total, movement) =>
                            total +
                            movement.amount,
                        0,
                    )

            const exits =
                reconciliationMovements
                    .filter(
                        movement =>
                            movement.status ===
                            'confirmed' &&
                            movement.movementType ===
                            'exit',
                    )
                    .reduce(
                        (total, movement) =>
                            total +
                            movement.amount,
                        0,
                    )

            const pendingEntries =
                reconciliationMovements
                    .filter(
                        movement =>
                            movement.status ===
                            'pending' &&
                            movement.movementType ===
                            'entry',
                    )
                    .reduce(
                        (total, movement) =>
                            total +
                            movement.amount,
                        0,
                    )

            const pendingExits =
                reconciliationMovements
                    .filter(
                        movement =>
                            movement.status ===
                            'pending' &&
                            movement.movementType ===
                            'exit',
                    )
                    .reduce(
                        (total, movement) =>
                            total +
                            movement.amount,
                        0,
                    )

            /*
             * El saldo inicial pertenece exclusivamente
             * a la conciliación diaria.
             */
            const opening =
                Number(
                    openingBalanceInput,
                ) || 0

            /*
             * Saldo que DEBERÍA tener el banco según
             * los movimientos confirmados.
             */
            const expected =
                opening +
                entries -
                exits

            /*
             * IMPORTANTE:
             *
             * Usamos bankClosingInput y NO day.bankClosingBalance.
             *
             * Así la diferencia cambia inmediatamente
             * mientras el usuario escribe el saldo real.
             */
            const hasClosing =
                bankClosingInput.trim() !== ''

            const closing =
                hasClosing
                    ? Number(
                        bankClosingInput,
                    )
                    : null

            const difference =
                hasClosing &&
                    Number.isFinite(
                        closing ?? NaN,
                    )
                    ? (closing as number) -
                    expected
                    : null

            const tolerance =
                Math.abs(expected) * 0.10

            const differenceWithinTolerance =
                difference !== null &&
                Math.abs(difference) <= tolerance

            const pendingTotal =
                pendingEntries +
                pendingExits

            return {
                entries,
                exits,
                pendingEntries,
                pendingExits,
                pendingTotal,
                opening,
                expected,
                difference,
                tolerance,
                differenceWithinTolerance,
                closing,
            }
        }, [
            reconciliationMovements,
            openingBalanceInput,
            bankClosingInput,
        ])

    /*
     * =========================================================
     * FILTROS
     * =========================================================
     */

    const filteredReconciliationMovements =
        useMemo(() => {
            return reconciliationMovements.filter(
                movement => {
                    const sourceMatches =
                        sourceFilter ===
                        'all' ||
                        movement.source ===
                        sourceFilter

                    const statusMatches =
                        statusFilter ===
                        'all' ||
                        movement.status ===
                        statusFilter

                    return (
                        sourceMatches &&
                        statusMatches
                    )
                },
            )
        }, [
            reconciliationMovements,
            sourceFilter,
            statusFilter,
        ])

    /*
     * =========================================================
     * IMPORTAR
     * =========================================================
     */

    const parseImportText = () => {
        setImportError('')
        setImportPreview([])

        const text = importText.trim()

        if (!text) {
            setImportError(
                'Pega primero la tabla de movimientos.',
            )
            return
        }

        /*
         * La plataforma siempre entrega 6 columnas:
         *
         * 0 = Fecha/hora
         * 1 = Usuario completo
         * 2 = Tipo
         * 3 = Método/concepto
         * 4 = Referencia
         * 5 = Valor
         *
         * No existen encabezados.
         */

        const lines = text
            .replace(/\r/g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '')

        const previews: ImportPreview[] = []

        for (const originalLine of lines) {
            /*
             * Puede venir como:
             *
             * Fecha | Usuario | Tipo | Método | Referencia | Valor
             *
             * o como una tabla copiada directamente desde la web
             * usando tabulaciones.
             */

            let row: string[]

            if (originalLine.includes('\t')) {
                row = originalLine.split('\t')
            } else if (originalLine.includes('|')) {
                row = originalLine.split('|')
            } else {
                /*
                 * Si no hay separadores reconocibles,
                 * no podemos interpretar correctamente la fila.
                 */
                continue
            }

            row = row.map(cell =>
                cell
                    .trim()
                    .replace(/^`+|`+$/g, '')
                    .replace(/^\*\*|\*\*$/g, '')
                    .trim(),
            )

            /*
             * Si usamos | como separador y la fila empieza/termina
             * con |, split() genera celdas vacías.
             */
            if (row[0] === '') {
                row.shift()
            }

            if (row[row.length - 1] === '') {
                row.pop()
            }

            /*
             * Ignorar filas que no sean movimientos.
             * Esto también permite pegar una fila de separación
             * de Markdown como:
             *
             * | :--- | :--- | :--- |
             */
            if (row.length < 6) {
                continue
            }

            if (
                row.every(cell =>
                    /^:?-{2,}:?$/.test(
                        cell.replace(/\s/g, ''),
                    ),
                )
            ) {
                continue
            }

            /*
             * Nos quedamos exactamente con las primeras 6 columnas.
             */
            const datetimeText = row[0] ?? ''
            const user = row[1] ?? ''
            const typeText = row[2] ?? ''
            const method = row[3] ?? ''
            const reference = row[4] ?? ''
            const amountText = row[5] ?? ''

            const movementType =
                normalizeMovementType(typeText)

            if (!movementType) {
                continue
            }

            const amount =
                parseAmount(amountText)

            if (!(amount > 0)) {
                continue
            }

            const concept =
                method ||
                (movementType === 'entry'
                    ? 'Depósito'
                    : 'Retiro')

            previews.push({
                movementType,
                movementDatetime:
                    parseDateTime(
                        datetimeText,
                        reconciliationDate,
                    ),
                platformUser: user
                    .replace(/\s+/g, ' ')
                    .trim(),
                platformMethod: method
                    .replace(/\s+/g, ' ')
                    .trim(),
                platformReference: reference
                    .replace(/`/g, '')
                    .trim(),
                concept: concept
                    .replace(/\s+/g, ' ')
                    .trim(),
                amount,
            })
        }

        if (previews.length === 0) {
            setImportError(
                'No se encontraron movimientos válidos. Verifica que la tabla tenga las 6 columnas: fecha, usuario, tipo, método, referencia y valor.',
            )
            return
        }

        setImportPreview(previews)
    }

    const handleImport = async () => {
        if (importPreview.length === 0) {
            alert('No hay movimientos para importar.')
            return
        }

        const currentDay =
            await ensureReconciliationDay()

        if (!currentDay) {
            return
        }

        setSavingDay(true)

        try {
            // 1. Buscar movimientos de plataforma
            //    que ya existen en este día.
            const {
                data: existingMovements,
                error: existingError,
            } = await supabase
                .from('reconciliation_movements')
                .select(
                    `
                    id,
                    movement_datetime,
                    movement_type,
                    platform_user,
                    platform_method,
                    platform_reference,
                    amount
                `,
                )
                .eq(
                    'reconciliation_day_id',
                    currentDay.id,
                )
                .eq(
                    'source',
                    'platform',
                )

            if (existingError) {
                console.error(
                    'Error buscando movimientos existentes:',
                    existingError,
                )

                alert(
                    'No se pudieron verificar los duplicados.',
                )

                return
            }

            const existing =
                existingMovements || []

            // 2. Crear una identificación única
            //    para cada movimiento.
            const createFingerprint = (
                movement: {
                    movementDatetime:
                    string | null

                    movementType:
                    'entry' | 'exit'

                    platformUser:
                    string

                    platformMethod:
                    string

                    platformReference:
                    string

                    amount:
                    number
                },
            ) => {
                const normalizeDatetime = (
                    value: string | null,
                ) => {
                    if (!value) {
                        return ''
                    }

                    return value
                        .trim()
                        .replace('Z', '')
                        .replace(
                            /[+-]\d{2}:\d{2}$/,
                            '',
                        )
                        .slice(0, 19)
                }

                return [
                    normalizeDatetime(
                        movement.movementDatetime,
                    ),

                    movement.movementType,

                    (
                        movement.platformUser ??
                        ''
                    ).trim(),

                    (
                        movement.platformMethod ??
                        ''
                    ).trim(),

                    (
                        movement.platformReference ??
                        ''
                    ).trim(),

                    Number(
                        movement.amount ?? 0,
                    ).toFixed(2),
                ].join('|')
            }

            // 3. Crear conjunto de movimientos
            //    que ya estaban guardados.
            const existingFingerprints =
                new Set(
                    existing.map(
                        movement =>
                            createFingerprint({
                                movementDatetime:
                                    movement.movement_datetime,

                                movementType:
                                    movement.movement_type,

                                platformUser:
                                    movement.platform_user ??
                                    '',

                                platformMethod:
                                    movement.platform_method ??
                                    '',

                                platformReference:
                                    movement.platform_reference ??
                                    '',

                                amount:
                                    Number(
                                        movement.amount ??
                                        0,
                                    ),
                            }),
                    ),
                )

            console.log(
                '=== DUPLICADOS DEBUG ===',
            )

            console.log(
                'EXISTENTES:',
                existing.map(
                    movement => ({
                        reference:
                            movement.platform_reference,

                        user:
                            movement.platform_user,

                        datetime:
                            movement.movement_datetime,

                        type:
                            movement.movement_type,

                        method:
                            movement.platform_method,

                        amount:
                            movement.amount,

                        fingerprint:
                            createFingerprint({
                                movementDatetime:
                                    movement.movement_datetime,

                                movementType:
                                    movement.movement_type,

                                platformUser:
                                    movement.platform_user ?? '',

                                platformMethod:
                                    movement.platform_method ?? '',

                                platformReference:
                                    movement.platform_reference ?? '',

                                amount:
                                    Number(
                                        movement.amount ?? 0,
                                    ),
                            }),
                    }),
                ),
            )

            console.log(
                'IMPORT PREVIEW:',
                importPreview.map(
                    movement => ({
                        reference:
                            movement.platformReference,

                        user:
                            movement.platformUser,

                        datetime:
                            movement.movementDatetime,

                        type:
                            movement.movementType,

                        method:
                            movement.platformMethod,

                        amount:
                            movement.amount,

                        fingerprint:
                            createFingerprint(
                                movement,
                            ),
                    }),
                ),
            )

            // 4. También detectar duplicados
            //    dentro del mismo pegado.
            const importedFingerprints =
                new Set<string>()

            const newMovements =
                importPreview.filter(
                    movement => {
                        const fingerprint =
                            createFingerprint(
                                movement,
                            )

                        // Ya estaba en Supabase.
                        if (
                            existingFingerprints.has(
                                fingerprint,
                            )
                        ) {
                            return false
                        }

                        // Está repetido dentro del
                        // mismo import.
                        if (
                            importedFingerprints.has(
                                fingerprint,
                            )
                        ) {
                            return false
                        }

                        importedFingerprints.add(
                            fingerprint,
                        )

                        return true
                    },
                )

            const duplicateCount =
                importPreview.length -
                newMovements.length

            // 5. Si todo eran duplicados,
            //    no hacemos INSERT.
            if (
                newMovements.length ===
                0
            ) {
                alert(
                    `No hay movimientos nuevos para importar.\n\n` +
                    `Duplicados omitidos: ${duplicateCount}`,
                )

                return
            }

            // 6. Preparar INSERT.
            const rows =
                newMovements.map(
                    movement => ({
                        reconciliation_day_id:
                            currentDay.id,

                        country_id:
                            selectedCountryId,

                        source:
                            'platform',

                        status:
                            'pending',

                        movement_type:
                            movement.movementType,

                        movement_datetime:
                            movement.movementDatetime,

                        platform_user:
                            movement.platformUser,

                        platform_method:
                            movement.platformMethod,

                        platform_reference:
                            movement.platformReference,

                        concept:
                            movement.concept,

                        amount:
                            movement.amount,

                        description:
                            '',

                        observations:
                            '',
                    }),
                )

            // 7. Insertar solamente los nuevos.
            const {
                data: insertedMovements,
                error: insertError,
            } = await supabase
                .from(
                    'reconciliation_movements',
                )
                .insert(rows)
                .select()

            if (insertError) {
                console.error(
                    'Error importando movimientos:',
                    insertError,
                )

                alert(
                    `Error al importar movimientos:\n${insertError.message}`,
                )

                return
            }

            // 8. Convertir los registros
            //    insertados al formato de React.
            const mappedMovements:
                ReconciliationMovement[] =
                (
                    insertedMovements || []
                ).map(
                    movement => ({
                        id:
                            movement.id,

                        reconciliationDayId:
                            movement.reconciliation_day_id,

                        countryId:
                            movement.country_id,

                        source:
                            movement.source,

                        status:
                            movement.status,

                        movementType:
                            movement.movement_type,

                        movementDatetime:
                            movement.movement_datetime,

                        platformUser:
                            movement.platform_user ??
                            '',

                        platformMethod:
                            movement.platform_method ??
                            '',

                        platformReference:
                            movement.platform_reference ??
                            '',

                        concept:
                            movement.concept ??
                            '',

                        amount:
                            Number(
                                movement.amount ??
                                0,
                            ),

                        description:
                            movement.description ??
                            '',

                        observations:
                            movement.observations ??
                            '',
                    }),
                )

            // 9. Actualizar la tabla.
            setReconciliationMovements(
                previous =>
                    [
                        ...previous,
                        ...mappedMovements,
                    ].sort(
                        (
                            a,
                            b,
                        ) =>
                            (
                                a.movementDatetime ??
                                ''
                            ).localeCompare(
                                b.movementDatetime ??
                                '',
                            ),
                    ),
            )

            // 10. Limpiar la previsualización.
            setImportPreview([])

            setImportText('')

            alert(
                `Importación completada.\n\n` +
                `Nuevos: ${newMovements.length}\n` +
                `Duplicados omitidos: ${duplicateCount}`,
            )

        } catch (error) {
            console.error(
                'Error inesperado importando movimientos:',
                error,
            )

            alert(
                error instanceof Error
                    ? `Ocurrió un error inesperado:\n${error.message}`
                    : 'Ocurrió un error inesperado durante la importación.',
            )
        } finally {
            setSavingDay(false)
        }
    }

    /*
     * =========================================================
     * CONFIRMAR MOVIMIENTO
     * =========================================================
     */

    const toggleMovementStatus =
        async (
            movement: ReconciliationMovement,
        ) => {
            const newStatus =
                movement.status ===
                    'confirmed'
                    ? 'pending'
                    : 'confirmed'

            const { error } =
                await supabase
                    .from(
                        'reconciliation_movements',
                    )
                    .update({
                        status:
                            newStatus,
                    })
                    .eq(
                        'id',
                        movement.id,
                    )

            if (error) {
                console.error(
                    'Error actualizando estado:',
                    error,
                )
                return
            }

            setReconciliationMovements(
                previous =>
                    previous.map(
                        item =>
                            item.id ===
                                movement.id
                                ? {
                                    ...item,
                                    status:
                                        newStatus,
                                }
                                : item,
                    ),
            )
        }

    /*
     * =========================================================
     * MARCAR COMO PROBLEMA
     * =========================================================
     */

    const toggleProblem =
        async (
            movement: ReconciliationMovement,
        ) => {
            const newStatus =
                movement.status ===
                    'problem'
                    ? 'pending'
                    : 'problem'

            const { error } =
                await supabase
                    .from(
                        'reconciliation_movements',
                    )
                    .update({
                        status:
                            newStatus,
                    })
                    .eq(
                        'id',
                        movement.id,
                    )

            if (error) {
                console.error(
                    'Error actualizando problema:',
                    error,
                )
                return
            }

            setReconciliationMovements(
                previous =>
                    previous.map(
                        item =>
                            item.id ===
                                movement.id
                                ? {
                                    ...item,
                                    status:
                                        newStatus,
                                }
                                : item,
                    ),
            )
        }

    /*
     * =========================================================
     * ELIMINAR MOVIMIENTO DE CONCILIACIÓN
     * =========================================================
     */

    const deleteReconciliationMovement =
        async (
            movement: ReconciliationMovement,
        ) => {
            const confirmed =
                window.confirm(
                    `¿Eliminar "${movement.concept}" por ${formatMoney(
                        movement.amount,
                        selectedCountry?.currency ??
                        '',
                        selectedCountry?.symbol ??
                        '',
                    )}?`,
                )

            if (!confirmed) {
                return
            }

            const { error } =
                await supabase
                    .from(
                        'reconciliation_movements',
                    )
                    .delete()
                    .eq(
                        'id',
                        movement.id,
                    )

            if (error) {
                console.error(
                    'Error eliminando movimiento:',
                    error,
                )
                return
            }

            setReconciliationMovements(
                previous =>
                    previous.filter(
                        item =>
                            item.id !==
                            movement.id,
                    ),
            )
        }

    /*
     * =========================================================
     * MODAL MANUAL
     * =========================================================
     */

    const openManualModal =
        () => {
            const now =
                new Date()

            const local =
                new Date(
                    now.getTime() -
                    now.getTimezoneOffset() *
                    60000,
                )
                    .toISOString()
                    .slice(
                        0,
                        16,
                    )

            setManualType(
                'entry',
            )
            setManualConcept('')
            setManualDescription('')
            setManualAmount('')
            setManualDateTime(
                local,
            )
            setManualReference('')
            setManualStatus(
                'confirmed',
            )
            setManualObservations('')
            setManualModalOpen(true)
        }

    const handleSaveManual =
        async () => {
            if (
                !selectedCountryId ||
                !manualConcept.trim()
            ) {
                return
            }

            const amount =
                Number(
                    manualAmount,
                )

            if (
                !Number.isFinite(
                    amount,
                ) ||
                amount <= 0
            ) {
                return
            }

            setSavingManual(true)

            const currentDay =
                await ensureReconciliationDay()

            if (!currentDay) {
                setSavingManual(false)
                return
            }

            const { data, error } =
                await supabase
                    .from(
                        'reconciliation_movements',
                    )
                    .insert({
                        reconciliation_day_id:
                            currentDay.id,
                        country_id:
                            selectedCountryId,
                        source:
                            'manual',
                        status:
                            manualStatus,
                        movement_type:
                            manualType,
                        movement_datetime:
                            manualDateTime
                                ? new Date(
                                    manualDateTime,
                                ).toISOString()
                                : null,
                        platform_user:
                            null,
                        platform_method:
                            null,
                        platform_reference:
                            manualReference.trim() ||
                            null,
                        concept:
                            manualConcept
                                .trim()
                                .replace(
                                    /\s+/g,
                                    ' ',
                                ),
                        amount,
                        description:
                            manualDescription
                                .trim() ||
                            null,
                        observations:
                            manualObservations
                                .trim() ||
                            null,
                    })
                    .select()
                    .single()

            if (error) {
                console.error(
                    'Error guardando movimiento manual:',
                    error,
                )
                setSavingManual(false)
                return
            }

            const savedMovement: ReconciliationMovement =
            {
                id: data.id,
                reconciliationDayId:
                    data.reconciliation_day_id,
                countryId:
                    data.country_id,
                source:
                    data.source,
                status:
                    data.status,
                movementType:
                    data.movement_type,
                movementDatetime:
                    data.movement_datetime,
                platformUser:
                    data.platform_user ??
                    '',
                platformMethod:
                    data.platform_method ??
                    '',
                platformReference:
                    data.platform_reference ??
                    '',
                concept:
                    data.concept,
                amount:
                    Number(
                        data.amount,
                    ),
                description:
                    data.description ??
                    '',
                observations:
                    data.observations ??
                    '',
            }

            setReconciliationMovements(
                previous => [
                    ...previous,
                    savedMovement,
                ],
            )

            setManualModalOpen(
                false,
            )
            setSavingManual(false)
        }

    /*
     * =========================================================
     * SI NO HAY PAÍSES
     * =========================================================
     */

    if (
        countries.length ===
        0
    ) {
        return (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
                <p className="text-sm text-zinc-500">
                    No hay países configurados para realizar la conciliación.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">

            {/* ================================================= */}
            {/* ENCABEZADO */}
            {/* ================================================= */}

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">

                <div>
                    <h2 className="text-xl font-semibold text-white">
                        Conciliación diaria
                    </h2>

                    <p className="text-sm text-zinc-600 mt-1">
                        Verifica que los movimientos de la plataforma coincidan con el dinero real del banco.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">

                    <button
                        onClick={() =>
                            setImportModalOpen(
                                true,
                            )
                        }
                        className="h-10 px-4 rounded-lg text-sm font-medium border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    >
                        + Importar movimientos
                    </button>

                    <button
                        onClick={
                            openManualModal
                        }
                        className="h-10 px-4 rounded-lg text-sm font-medium"
                        style={{
                            backgroundColor:
                                GOLD,
                            color:
                                '#09090b',
                        }}
                    >
                        + Añadir movimiento
                    </button>

                </div>
            </div>

            {/* ================================================= */}
            {/* PAÍS Y FECHA */}
            {/* ================================================= */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">

                    <label className="block text-xs text-zinc-500 mb-2">
                        País / moneda
                    </label>

                    <select
                        value={
                            selectedCountryId
                        }
                        onChange={e =>
                            onCountryChange(
                                e.target.value,
                            )
                        }
                        className="w-full h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-4 text-sm text-white outline-none"
                    >
                        {countries.map(
                            country => (
                                <option
                                    key={
                                        country.id
                                    }
                                    value={
                                        country.id
                                    }
                                >
                                    {country.name} — {country.currency}
                                </option>
                            ),
                        )}
                    </select>

                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">

                    <label className="block text-xs text-zinc-500 mb-2">
                        Día a conciliar
                    </label>

                    <input
                        type="date"
                        value={
                            reconciliationDate
                        }
                        onChange={e =>
                            setReconciliationDate(
                                e.target.value,
                            )
                        }
                        className="w-full h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-4 text-sm text-white outline-none"
                    />

                </div>

            </div>

            {loadingReconciliation ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
                    <p className="text-sm text-zinc-600">
                        Cargando conciliación...
                    </p>
                </div>
            ) : selectedCountry ? (
                <>
                    {/* ================================================= */}
                    {/* SALDOS */}
                    {/* ================================================= */}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                            <div className="text-xs text-zinc-500">
                                Saldo inicial
                            </div>

                            <div
                                className="text-xl font-bold mt-2 text-zinc-100"
                                style={{
                                    fontFamily:
                                        'JetBrains Mono, monospace',
                                }}
                            >
                                {formatMoney(
                                    reconciliationSummary.opening,
                                    selectedCountry.currency,
                                    selectedCountry.symbol,
                                )}
                            </div>

                            <div className="mt-3">
                                <input
                                    type="number"
                                    min="0"
                                    value={
                                        openingBalanceInput
                                    }
                                    onChange={e =>
                                        setOpeningBalanceInput(
                                            e.target.value,
                                        )
                                    }
                                    className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-xs text-white outline-none"
                                    placeholder="Saldo inicial"
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                            <div className="text-xs text-zinc-500">
                                Entradas confirmadas
                            </div>

                            <div
                                className="text-xl font-bold mt-2 text-emerald-400"
                                style={{
                                    fontFamily:
                                        'JetBrains Mono, monospace',
                                }}
                            >
                                {formatMoney(
                                    reconciliationSummary.entries,
                                    selectedCountry.currency,
                                    selectedCountry.symbol,
                                )}
                            </div>

                            <div className="text-xs text-zinc-600 mt-2">
                                Pendientes:{' '}
                                {formatMoney(
                                    reconciliationSummary.pendingEntries,
                                    selectedCountry.currency,
                                    selectedCountry.symbol,
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                            <div className="text-xs text-zinc-500">
                                Salidas confirmadas
                            </div>

                            <div
                                className="text-xl font-bold mt-2 text-red-400"
                                style={{
                                    fontFamily:
                                        'JetBrains Mono, monospace',
                                }}
                            >
                                {formatMoney(
                                    reconciliationSummary.exits,
                                    selectedCountry.currency,
                                    selectedCountry.symbol,
                                )}
                            </div>

                            <div className="text-xs text-zinc-600 mt-2">
                                Pendientes:{' '}
                                {formatMoney(
                                    reconciliationSummary.pendingExits,
                                    selectedCountry.currency,
                                    selectedCountry.symbol,
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                            <div className="text-xs text-zinc-500">
                                Saldo esperado
                            </div>

                            <div
                                className="text-xl font-bold mt-2"
                                style={{
                                    color: GOLD,
                                    fontFamily:
                                        'JetBrains Mono, monospace',
                                }}
                            >
                                {formatMoney(
                                    reconciliationSummary.expected,
                                    selectedCountry.currency,
                                    selectedCountry.symbol,
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                            <div className="text-xs text-zinc-500">
                                Saldo real del banco
                            </div>

                            <div
                                className="text-xl font-bold mt-2 text-zinc-100"
                                style={{
                                    fontFamily:
                                        'JetBrains Mono, monospace',
                                }}
                            >
                                {reconciliationSummary.closing !==
                                    null
                                    ? formatMoney(
                                        reconciliationSummary.closing,
                                        selectedCountry.currency,
                                        selectedCountry.symbol,
                                    )
                                    : 'Pendiente'}
                            </div>

                            <div className="mt-3">
                                <input
                                    type="number"
                                    min="0"
                                    value={
                                        bankClosingInput
                                    }
                                    onChange={e =>
                                        setBankClosingInput(
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Escribe el saldo del banco"
                                    className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-xs text-white outline-none"
                                />
                            </div>
                        </div>

                        <div
                            className="rounded-xl border p-5"
                            style={{
                                borderColor:
                                    reconciliationSummary.difference ===
                                        null
                                        ? '#27272a'
                                        : reconciliationSummary.differenceWithinTolerance
                                            ? 'rgba(52,211,153,0.3)'
                                            : '#7f1d1d',

                                backgroundColor:
                                    reconciliationSummary.difference ===
                                        null
                                        ? '#18181b'
                                        : reconciliationSummary.differenceWithinTolerance
                                            ? 'rgba(16,185,129,0.05)'
                                            : 'rgba(127,29,29,0.08)',
                            }}
                        >
                            <div className="text-xs text-zinc-500">
                                Diferencia
                            </div>

                            <div
                                className="text-xl font-bold mt-2"
                                style={{
                                    fontFamily:
                                        'JetBrains Mono, monospace',
                                    color:
                                        reconciliationSummary.difference ===
                                            null
                                            ? '#71717a'
                                            : reconciliationSummary.differenceWithinTolerance
                                                ? '#34d399'
                                                : '#f87171',
                                }}
                            >
                                {reconciliationSummary.difference ===
                                    null
                                    ? 'Sin cierre'
                                    : formatMoney(
                                        reconciliationSummary.difference,
                                        selectedCountry.currency,
                                        selectedCountry.symbol,
                                    )}
                            </div>

                            <div className="text-xs mt-2">
                                {reconciliationSummary.difference ===
                                    null
                                    ? 'Ingresa el saldo real del banco.'
                                    : reconciliationSummary.differenceWithinTolerance
                                        ? 'Diferencia menor del 10%.'
                                        : 'Existe una diferencia por revisar.'}
                            </div>
                        </div>

                    </div>

                    {/* ================================================= */}
                    {/* DIFERENCIA ACUMULADA */}
                    {/* ================================================= */}

                    {day && (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">

                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                                <div>
                                    <p className="text-xs text-zinc-500">
                                        Diferencia acumulada
                                    </p>

                                    <p
                                        className="text-lg font-bold mt-1"
                                        style={{
                                            color:
                                                day.cumulativeDifference ===
                                                    null
                                                    ? '#34d399'
                                                    : '#f87171',
                                            fontFamily:
                                                'JetBrains Mono, monospace',
                                        }}
                                    >
                                        {formatMoney(
                                            day.cumulativeDifference,
                                            selectedCountry.currency,
                                            selectedCountry.symbol,
                                        )}
                                    </p>
                                </div>

                                <div className="text-xs text-zinc-600 max-w-xl">
                                    Esta cifra conserva las diferencias de días anteriores para que un descuadre no desaparezca al comenzar un nuevo día.
                                </div>

                            </div>

                        </div>
                    )}

                    {/* ================================================= */}
                    {/* GUARDAR CIERRE */}
                    {/* ================================================= */}

                    <div className="flex justify-end">

                        <button
                            onClick={
                                handleSaveDay
                            }
                            disabled={
                                savingDay
                            }
                            className="h-11 px-5 rounded-lg text-sm font-medium disabled:opacity-40"
                            style={{
                                backgroundColor:
                                    GOLD,
                                color:
                                    '#09090b',
                            }}
                        >
                            {savingDay
                                ? 'Guardando...'
                                : 'Guardar conciliación'}
                        </button>

                    </div>

                    {/* ================================================= */}
                    {/* FILTROS MOVIMIENTOS */}
                    {/* ================================================= */}

                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">

                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                            <div>
                                <h3 className="text-sm font-semibold text-zinc-100">
                                    Movimientos del día
                                </h3>

                                <p className="text-xs text-zinc-600 mt-1">
                                    Confirma cada movimiento después de verificarlo en el banco.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">

                                {[
                                    {
                                        id: 'all',
                                        label: 'Todos',
                                    },
                                    {
                                        id: 'platform',
                                        label: 'Plataforma',
                                    },
                                    {
                                        id: 'manual',
                                        label: 'Manuales',
                                    },
                                ].map(
                                    filter => {
                                        const active =
                                            sourceFilter ===
                                            filter.id

                                        return (
                                            <button
                                                key={
                                                    filter.id
                                                }
                                                onClick={() =>
                                                    setSourceFilter(
                                                        filter.id as typeof sourceFilter,
                                                    )
                                                }
                                                className="px-3 py-2 rounded-lg text-xs border"
                                                style={{
                                                    borderColor:
                                                        active
                                                            ? GOLD
                                                            : '#27272a',
                                                    color:
                                                        active
                                                            ? GOLD
                                                            : '#a1a1aa',
                                                    backgroundColor:
                                                        active
                                                            ? 'rgba(201,168,76,0.08)'
                                                            : '#18181b',
                                                }}
                                            >
                                                {
                                                    filter.label
                                                }
                                            </button>
                                        )
                                    },
                                )}

                                <select
                                    value={
                                        statusFilter
                                    }
                                    onChange={e =>
                                        setStatusFilter(
                                            e.target.value as typeof statusFilter,
                                        )
                                    }
                                    className="h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-300 outline-none"
                                >
                                    <option value="all">
                                        Todos los estados
                                    </option>

                                    <option value="pending">
                                        Pendientes
                                    </option>

                                    <option value="confirmed">
                                        Confirmados
                                    </option>

                                    <option value="problem">
                                        Con problema
                                    </option>
                                </select>

                            </div>

                        </div>

                    </div>

                    {/* ================================================= */}
                    {/* TABLA */}
                    {/* ================================================= */}

                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">

                        {filteredReconciliationMovements.length ===
                            0 ? (
                            <div className="px-5 py-14 text-center">

                                <div className="text-3xl mb-3">
                                    📋
                                </div>

                                <p className="text-sm text-zinc-500">
                                    No hay movimientos para mostrar.
                                </p>

                                <p className="text-xs text-zinc-700 mt-1">
                                    Puedes importar los movimientos de la plataforma o añadir uno manualmente.
                                </p>

                            </div>
                        ) : (
                            <div className="overflow-x-auto">

                                <table className="w-full text-sm">

                                    <thead>
                                        <tr className="border-b border-zinc-800 text-left">

                                            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
                                                Estado
                                            </th>

                                            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
                                                Hora
                                            </th>

                                            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
                                                Tipo
                                            </th>

                                            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
                                                Fuente
                                            </th>

                                            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
                                                Concepto
                                            </th>

                                            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
                                                Usuario
                                            </th>

                                            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
                                                Referencia
                                            </th>

                                            <th className="px-4 py-3 text-xs font-medium text-zinc-500 text-right">
                                                Valor
                                            </th>

                                            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
                                                Acción
                                            </th>

                                        </tr>
                                    </thead>

                                    <tbody>

                                        {filteredReconciliationMovements.map(
                                            movement => {

                                                const confirmed =
                                                    movement.status ===
                                                    'confirmed'

                                                const problem =
                                                    movement.status ===
                                                    'problem'

                                                return (
                                                    <tr
                                                        key={
                                                            movement.id
                                                        }
                                                        className="border-b border-zinc-900 last:border-0"
                                                    >

                                                        <td className="px-4 py-4">

                                                            <button
                                                                onClick={() =>
                                                                    toggleMovementStatus(
                                                                        movement,
                                                                    )
                                                                }
                                                                className="flex items-center gap-2"
                                                                title={
                                                                    confirmed
                                                                        ? 'Marcar como pendiente'
                                                                        : 'Confirmar movimiento'
                                                                }
                                                            >

                                                                <span
                                                                    className="w-5 h-5 rounded-md border flex items-center justify-center text-xs transition-all"
                                                                    style={{
                                                                        borderColor:
                                                                            confirmed
                                                                                ? '#34d399'
                                                                                : problem
                                                                                    ? '#f87171'
                                                                                    : '#52525b',
                                                                        backgroundColor:
                                                                            confirmed
                                                                                ? 'rgba(52,211,153,0.12)'
                                                                                : problem
                                                                                    ? 'rgba(248,113,113,0.10)'
                                                                                    : 'transparent',
                                                                        color:
                                                                            confirmed
                                                                                ? '#34d399'
                                                                                : problem
                                                                                    ? '#f87171'
                                                                                    : '#71717a',
                                                                    }}
                                                                >
                                                                    {confirmed
                                                                        ? '✓'
                                                                        : problem
                                                                            ? '!'
                                                                            : ''}
                                                                </span>

                                                                <span className="text-xs">
                                                                    {confirmed
                                                                        ? 'Confirmado'
                                                                        : problem
                                                                            ? 'Problema'
                                                                            : 'Pendiente'}
                                                                </span>

                                                            </button>

                                                        </td>

                                                        <td className="px-4 py-4 text-zinc-500 whitespace-nowrap">
                                                            {movement.movementDatetime
                                                                ? new Date(
                                                                    movement.movementDatetime,
                                                                ).toLocaleTimeString(
                                                                    'es-CO',
                                                                    {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                    },
                                                                )
                                                                : '—'}
                                                        </td>

                                                        <td className="px-4 py-4">

                                                            <span
                                                                className="px-2 py-1 rounded-md text-xs font-medium"
                                                                style={{
                                                                    backgroundColor:
                                                                        movement.movementType ===
                                                                            'entry'
                                                                            ? 'rgba(52,211,153,0.08)'
                                                                            : 'rgba(248,113,113,0.08)',
                                                                    color:
                                                                        movement.movementType ===
                                                                            'entry'
                                                                            ? '#34d399'
                                                                            : '#f87171',
                                                                }}
                                                            >
                                                                {movement.movementType ===
                                                                    'entry'
                                                                    ? 'Entrada'
                                                                    : 'Salida'}
                                                            </span>

                                                        </td>

                                                        <td className="px-4 py-4">

                                                            <span
                                                                className="px-2 py-1 rounded-md text-xs"
                                                                style={{
                                                                    backgroundColor:
                                                                        movement.source ===
                                                                            'platform'
                                                                            ? 'rgba(201,168,76,0.08)'
                                                                            : 'rgba(96,165,250,0.08)',
                                                                    color:
                                                                        movement.source ===
                                                                            'platform'
                                                                            ? GOLD
                                                                            : '#60a5fa',
                                                                }}
                                                            >
                                                                {movement.source ===
                                                                    'platform'
                                                                    ? 'Plataforma'
                                                                    : 'Manual'}
                                                            </span>

                                                        </td>

                                                        <td className="px-4 py-4 text-white font-medium min-w-[180px]">
                                                            <div>
                                                                {
                                                                    movement.concept
                                                                }
                                                            </div>

                                                            {movement.description && (
                                                                <div className="text-xs text-zinc-600 mt-1">
                                                                    {
                                                                        movement.description
                                                                    }
                                                                </div>
                                                            )}

                                                            {movement.platformMethod &&
                                                                movement.platformMethod !==
                                                                movement.concept && (
                                                                    <div className="text-xs text-zinc-600 mt-1">
                                                                        {
                                                                            movement.platformMethod
                                                                        }
                                                                    </div>
                                                                )}
                                                        </td>

                                                        <td className="px-4 py-4 text-zinc-500">
                                                            {
                                                                movement.platformUser ||
                                                                '—'
                                                            }
                                                        </td>

                                                        <td className="px-4 py-4 text-zinc-500 max-w-[180px]">
                                                            <span className="block truncate">
                                                                {
                                                                    movement.platformReference ||
                                                                    '—'
                                                                }
                                                            </span>
                                                        </td>

                                                        <td
                                                            className="px-4 py-4 text-right font-semibold whitespace-nowrap"
                                                            style={{
                                                                color:
                                                                    movement.movementType ===
                                                                        'entry'
                                                                        ? '#34d399'
                                                                        : '#f87171',
                                                                fontFamily:
                                                                    'JetBrains Mono, monospace',
                                                            }}
                                                        >
                                                            {movement.movementType ===
                                                                'entry'
                                                                ? '+'
                                                                : '-'}
                                                            {formatMoney(
                                                                movement.amount,
                                                                selectedCountry.currency,
                                                                selectedCountry.symbol,
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-4">

                                                            <div className="flex items-center gap-3">

                                                                <button
                                                                    onClick={() =>
                                                                        toggleProblem(
                                                                            movement,
                                                                        )
                                                                    }
                                                                    className="text-xs text-zinc-500 hover:text-red-400"
                                                                >
                                                                    {problem
                                                                        ? 'Quitar problema'
                                                                        : 'Problema'}
                                                                </button>

                                                                <button
                                                                    onClick={() =>
                                                                        deleteReconciliationMovement(
                                                                            movement,
                                                                        )
                                                                    }
                                                                    className="text-xs text-zinc-600 hover:text-red-400"
                                                                >
                                                                    Eliminar
                                                                </button>

                                                            </div>

                                                        </td>

                                                    </tr>
                                                )
                                            },
                                        )}

                                    </tbody>

                                </table>

                            </div>
                        )}

                    </div>
                </>
            ) : null}

            {/* ===================================================== */}
            {/* MODAL IMPORTAR */}
            {/* ===================================================== */}

            {importModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">

                    <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">

                        <div className="px-6 py-5 border-b border-zinc-800">

                            <p className="text-xs text-zinc-500 mb-1">
                                Conciliación diaria
                            </p>

                            <h2 className="text-lg font-semibold text-white">
                                Importar movimientos de la plataforma
                            </h2>

                            <p className="text-xs text-zinc-600 mt-2">
                                Copia la tabla de movimientos desde la plataforma y pégala aquí. Los movimientos importados comenzarán como pendientes.
                            </p>

                        </div>

                        <div className="p-6 space-y-5">

                            <textarea
                                value={
                                    importText
                                }
                                onChange={e => {
                                    setImportText(
                                        e.target.value,
                                    )
                                    setImportPreview(
                                        [],
                                    )
                                    setImportError(
                                        '',
                                    )
                                }}
                                placeholder="Pega aquí la tabla copiada desde la plataforma..."
                                rows={9}
                                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none resize-y font-mono"
                            />

                            <div className="flex justify-end">

                                <button
                                    onClick={
                                        parseImportText
                                    }
                                    disabled={
                                        !importText.trim()
                                    }
                                    className="h-10 px-5 rounded-lg text-sm font-medium disabled:opacity-40"
                                    style={{
                                        backgroundColor:
                                            GOLD,
                                        color:
                                            '#09090b',
                                    }}
                                >
                                    Analizar movimientos
                                </button>

                            </div>

                            {importError && (
                                <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-400">
                                    {
                                        importError
                                    }
                                </div>
                            )}

                            {importPreview.length >
                                0 && (
                                    <div className="rounded-xl border border-zinc-800 overflow-hidden">

                                        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900">

                                            <div className="flex items-center justify-between">

                                                <div>
                                                    <p className="text-sm font-medium text-white">
                                                        Vista previa
                                                    </p>

                                                    <p className="text-xs text-zinc-600 mt-1">
                                                        {
                                                            importPreview.length
                                                        }{' '}
                                                        movimientos detectados
                                                    </p>
                                                </div>

                                            </div>

                                        </div>

                                        <div className="max-h-80 overflow-auto">

                                            <table className="w-full text-xs">

                                                <thead>
                                                    <tr className="border-b border-zinc-800">

                                                        <th className="px-4 py-3 text-left text-zinc-500">
                                                            Tipo
                                                        </th>

                                                        <th className="px-4 py-3 text-left text-zinc-500">
                                                            Usuario
                                                        </th>

                                                        <th className="px-4 py-3 text-left text-zinc-500">
                                                            Concepto
                                                        </th>

                                                        <th className="px-4 py-3 text-left text-zinc-500">
                                                            Referencia
                                                        </th>

                                                        <th className="px-4 py-3 text-right text-zinc-500">
                                                            Valor
                                                        </th>

                                                    </tr>
                                                </thead>

                                                <tbody>

                                                    {importPreview.map(
                                                        (
                                                            movement,
                                                            index,
                                                        ) => (
                                                            <tr
                                                                key={
                                                                    index
                                                                }
                                                                className="border-b border-zinc-900"
                                                            >

                                                                <td className="px-4 py-3">
                                                                    <span
                                                                        className={
                                                                            movement.movementType ===
                                                                                'entry'
                                                                                ? 'text-emerald-400'
                                                                                : 'text-red-400'
                                                                        }
                                                                    >
                                                                        {movement.movementType ===
                                                                            'entry'
                                                                            ? 'Entrada'
                                                                            : 'Salida'}
                                                                    </span>
                                                                </td>

                                                                <td className="px-4 py-3 text-zinc-400">
                                                                    {
                                                                        movement.platformUser ||
                                                                        '—'
                                                                    }
                                                                </td>

                                                                <td className="px-4 py-3 text-zinc-200">
                                                                    {
                                                                        movement.concept
                                                                    }
                                                                </td>

                                                                <td className="px-4 py-3 text-zinc-500">
                                                                    {
                                                                        movement.platformReference ||
                                                                        '—'
                                                                    }
                                                                </td>

                                                                <td className="px-4 py-3 text-right font-mono text-zinc-200">
                                                                    {formatMoney(
                                                                        movement.amount,
                                                                        selectedCountry?.currency ??
                                                                        '',
                                                                        selectedCountry?.symbol ??
                                                                        '',
                                                                    )}
                                                                </td>

                                                            </tr>
                                                        ),
                                                    )}

                                                </tbody>

                                            </table>

                                        </div>

                                    </div>
                                )}

                        </div>

                        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">

                            <button
                                onClick={() => {
                                    if (
                                        savingImport
                                    ) {
                                        return
                                    }

                                    setImportModalOpen(
                                        false,
                                    )
                                    setImportText(
                                        '',
                                    )
                                    setImportPreview(
                                        [],
                                    )
                                    setImportError(
                                        '',
                                    )
                                }}
                                disabled={
                                    savingImport
                                }
                                className="h-10 px-4 rounded-lg text-sm text-zinc-400 hover:text-white"
                            >
                                Cancelar
                            </button>

                            <button
                                onClick={
                                    handleImport
                                }
                                disabled={
                                    savingImport ||
                                    importPreview.length ===
                                    0
                                }
                                className="h-10 px-5 rounded-lg text-sm font-medium disabled:opacity-40"
                                style={{
                                    backgroundColor:
                                        GOLD,
                                    color:
                                        '#09090b',
                                }}
                            >
                                {savingImport
                                    ? 'Importando...'
                                    : `Importar ${importPreview.length > 0
                                        ? `(${importPreview.length})`
                                        : ''
                                    }`}
                            </button>

                        </div>

                    </div>

                </div>
            )}

            {/* ===================================================== */}
            {/* MODAL MOVIMIENTO MANUAL */}
            {/* ===================================================== */}

            {manualModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">

                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">

                        <div className="px-6 py-5 border-b border-zinc-800">

                            <p className="text-xs text-zinc-500 mb-1">
                                Movimiento manual
                            </p>

                            <h2 className="text-lg font-semibold text-white">
                                {selectedCountry?.name}
                            </h2>

                        </div>

                        <div className="p-6 space-y-5">

                            <div>

                                <label className="block text-sm text-zinc-400 mb-2">
                                    Tipo
                                </label>

                                <div className="grid grid-cols-2 gap-2">

                                    <button
                                        onClick={() =>
                                            setManualType(
                                                'entry',
                                            )
                                        }
                                        className="h-10 rounded-lg border text-sm"
                                        style={{
                                            borderColor:
                                                manualType ===
                                                    'entry'
                                                    ? '#34d399'
                                                    : '#27272a',
                                            backgroundColor:
                                                manualType ===
                                                    'entry'
                                                    ? 'rgba(52,211,153,0.08)'
                                                    : '#18181b',
                                            color:
                                                manualType ===
                                                    'entry'
                                                    ? '#34d399'
                                                    : '#a1a1aa',
                                        }}
                                    >
                                        Entrada
                                    </button>

                                    <button
                                        onClick={() =>
                                            setManualType(
                                                'exit',
                                            )
                                        }
                                        className="h-10 rounded-lg border text-sm"
                                        style={{
                                            borderColor:
                                                manualType ===
                                                    'exit'
                                                    ? '#f87171'
                                                    : '#27272a',
                                            backgroundColor:
                                                manualType ===
                                                    'exit'
                                                    ? 'rgba(248,113,113,0.08)'
                                                    : '#18181b',
                                            color:
                                                manualType ===
                                                    'exit'
                                                    ? '#f87171'
                                                    : '#a1a1aa',
                                        }}
                                    >
                                        Salida
                                    </button>

                                </div>

                            </div>

                            <div>

                                <label className="block text-sm text-zinc-400 mb-2">
                                    Concepto
                                </label>

                                <input
                                    value={
                                        manualConcept
                                    }
                                    onChange={e =>
                                        setManualConcept(
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Ej. Transferencia de la dueña"
                                    className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none"
                                />

                            </div>

                            <div>

                                <label className="block text-sm text-zinc-400 mb-2">
                                    Descripción
                                </label>

                                <input
                                    value={
                                        manualDescription
                                    }
                                    onChange={e =>
                                        setManualDescription(
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Ej. Dinero enviado a la cuenta"
                                    className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none"
                                />

                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                <div>

                                    <label className="block text-sm text-zinc-400 mb-2">
                                        Valor
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        value={
                                            manualAmount
                                        }
                                        onChange={e =>
                                            setManualAmount(
                                                e.target.value,
                                            )
                                        }
                                        placeholder="0"
                                        className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none"
                                    />

                                </div>

                                <div>

                                    <label className="block text-sm text-zinc-400 mb-2">
                                        Fecha y hora
                                    </label>

                                    <input
                                        type="datetime-local"
                                        value={
                                            manualDateTime
                                        }
                                        onChange={e =>
                                            setManualDateTime(
                                                e.target.value,
                                            )
                                        }
                                        className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none"
                                    />

                                </div>

                            </div>

                            <div>

                                <label className="block text-sm text-zinc-400 mb-2">
                                    Referencia / comprobante
                                </label>

                                <input
                                    value={
                                        manualReference
                                    }
                                    onChange={e =>
                                        setManualReference(
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Opcional"
                                    className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none"
                                />

                            </div>

                            <div>

                                <label className="block text-sm text-zinc-400 mb-2">
                                    Estado
                                </label>

                                <select
                                    value={
                                        manualStatus
                                    }
                                    onChange={e =>
                                        setManualStatus(
                                            e.target.value as
                                            | 'pending'
                                            | 'confirmed',
                                        )
                                    }
                                    className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none"
                                >
                                    <option value="confirmed">
                                        Confirmado
                                    </option>

                                    <option value="pending">
                                        Pendiente
                                    </option>
                                </select>

                            </div>

                            <div>

                                <label className="block text-sm text-zinc-400 mb-2">
                                    Observaciones
                                </label>

                                <textarea
                                    value={
                                        manualObservations
                                    }
                                    onChange={e =>
                                        setManualObservations(
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Opcional"
                                    rows={3}
                                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none resize-none"
                                />

                            </div>

                        </div>

                        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">

                            <button
                                onClick={() =>
                                    setManualModalOpen(
                                        false,
                                    )
                                }
                                disabled={
                                    savingManual
                                }
                                className="h-10 px-4 rounded-lg text-sm text-zinc-400 hover:text-white"
                            >
                                Cancelar
                            </button>

                            <button
                                onClick={
                                    handleSaveManual
                                }
                                disabled={
                                    savingManual ||
                                    !manualConcept.trim() ||
                                    !(Number(
                                        manualAmount,
                                    ) > 0)
                                }
                                className="h-10 px-5 rounded-lg text-sm font-medium disabled:opacity-40"
                                style={{
                                    backgroundColor:
                                        GOLD,
                                    color:
                                        '#09090b',
                                }}
                            >
                                {savingManual
                                    ? 'Guardando...'
                                    : 'Añadir movimiento'}
                            </button>

                        </div>

                    </div>

                </div>
            )}

        </div>
    )
}

/*
 * =========================================================
 * COMPONENTE PRINCIPAL
 * =========================================================
 */

export default function Accounting() {
    const [accountingUnlocked, setAccountingUnlocked] =
        useState(
            () =>
                sessionStorage.getItem(
                    'accounting_unlocked',
                ) === 'true',
        )

    const [accountingPassword, setAccountingPassword] =
        useState('')

    const [accountingPasswordError, setAccountingPasswordError] =
        useState(false)

    const [countries, setCountries] =
        useState<Country[]>([])

    const [movements, setMovements] =
        useState<Movement[]>([])

    const [selectedCountryId, setSelectedCountryId] =
        useState('')

    const [loadingCountries, setLoadingCountries] =
        useState(true)

    const [loadingMovements, setLoadingMovements] =
        useState(false)

    /*
     * NUEVO:
     * Sección actual de Contabilidad.
     */
    const [accountingSection, setAccountingSection] =
        useState<
            'accounting' | 'reconciliation'
        >('accounting')

    const [filterType, setFilterType] =
        useState<FilterType>('month')

    const initialFilters =
        getInitialFilterValue()

    const [day, setDay] =
        useState(initialFilters.day)

    const [weekStart, setWeekStart] =
        useState(initialFilters.weekStart)

    const [weekEnd, setWeekEnd] =
        useState(initialFilters.weekEnd)

    const [month, setMonth] =
        useState(initialFilters.month)

    const [rangeStart, setRangeStart] =
        useState(initialFilters.rangeStart)

    const [rangeEnd, setRangeEnd] =
        useState(initialFilters.rangeEnd)

    const [movementModalOpen, setMovementModalOpen] =
        useState(false)

    const [baseModalOpen, setBaseModalOpen] =
        useState(false)

    const [editingMovement, setEditingMovement] =
        useState<Movement | null>(null)

    const [savingMovement, setSavingMovement] =
        useState(false)

    const [savingBase, setSavingBase] =
        useState(false)

    const [concept, setConcept] =
        useState('')

    const [entry, setEntry] =
        useState('')

    const [exit, setExit] =
        useState('')

    const [observations, setObservations] =
        useState('')

    const [movementDate, setMovementDate] =
        useState(getTodayKey())

    const [baseAmount, setBaseAmount] =
        useState('')

    const [commissionAmount, setCommissionAmount] =
        useState('')

    const [commissionPercentage, setCommissionPercentage] =
        useState('')

    const [commissionResult, setCommissionResult] =
        useState<number | null>(null)

    /*
     * =========================================================
     * PAÍSES
     * =========================================================
     */

    useEffect(() => {
        const loadCountries = async () => {
            setLoadingCountries(true)

            const { data, error } =
                await supabase
                    .from('accounting_countries')
                    .select('*')
                    .order('name', {
                        ascending: true,
                    })

            if (error) {
                console.error(
                    'Error cargando países:',
                    error,
                )
                setLoadingCountries(false)
                return
            }

            const mappedCountries: Country[] =
                (data || []).map(
                    country => ({
                        id: country.id,
                        name: country.name,
                        currency: country.currency,
                        symbol: country.symbol,
                        baseAmount:
                            Number(
                                country.base_amount,
                            ),
                    }),
                )

            setCountries(mappedCountries)

            if (
                mappedCountries.length > 0 &&
                !selectedCountryId
            ) {
                setSelectedCountryId(
                    mappedCountries[0].id,
                )
            }

            setLoadingCountries(false)
        }

        loadCountries()
    }, [selectedCountryId])

    /*
     * =========================================================
     * MOVIMIENTOS
     * =========================================================
     */

    const loadMovements = async (
        countryId: string,
    ) => {
        if (!countryId) return

        setLoadingMovements(true)

        const { data, error } =
            await supabase
                .from('accounting_movements')
                .select('*')
                .eq('country_id', countryId)
                .order('date', {
                    ascending: true,
                })
                .order('created_at', {
                    ascending: true,
                })

        if (error) {
            console.error(
                'Error cargando movimientos:',
                error,
            )
            setLoadingMovements(false)
            return
        }

        const mappedMovements: Movement[] =
            (data || []).map(
                movement => ({
                    id: movement.id,
                    countryId:
                        movement.country_id,
                    date: movement.date,
                    concept:
                        movement.concept,
                    entry:
                        Number(movement.entry),
                    exit:
                        Number(movement.exit),
                    observations:
                        movement.observations ??
                        '',
                    createdAt:
                        movement.created_at,
                }),
            )

        setMovements(mappedMovements)
        setLoadingMovements(false)
    }

    useEffect(() => {
        if (!selectedCountryId) return

        loadMovements(
            selectedCountryId,
        )
    }, [selectedCountryId])

    const selectedCountry =
        countries.find(
            country =>
                country.id ===
                selectedCountryId,
        )

    /*
     * =========================================================
     * SALDOS
     * =========================================================
     */

    const movementsWithBalance =
        useMemo(() => {
            if (!selectedCountry) {
                return []
            }

            let runningBalance =
                selectedCountry.baseAmount

            const sorted = [
                ...movements,
            ].sort((a, b) => {
                if (a.date !== b.date) {
                    return a.date.localeCompare(
                        b.date,
                    )
                }

                return a.createdAt.localeCompare(
                    b.createdAt,
                )
            })

            return sorted.map(
                movement => {
                    runningBalance +=
                        movement.entry -
                        movement.exit

                    return {
                        ...movement,
                        balance:
                            runningBalance,
                    }
                },
            )
        }, [
            movements,
            selectedCountry,
        ])

    /*
     * =========================================================
     * RANGO ACTIVO
     * =========================================================
     */

    const activeRange = useMemo(() => {
        if (filterType === 'day') {
            return {
                start: day,
                end: day,
            }
        }

        if (filterType === 'week') {
            return {
                start: weekStart,
                end: weekEnd,
            }
        }

        if (filterType === 'month') {
            const [year, monthNumber] =
                month
                    .split('-')
                    .map(Number)

            const range =
                getMonthRange(
                    new Date(
                        year,
                        monthNumber - 1,
                        1,
                    ),
                )

            return range
        }

        return {
            start: rangeStart,
            end: rangeEnd,
        }
    }, [
        filterType,
        day,
        weekStart,
        weekEnd,
        month,
        rangeStart,
        rangeEnd,
    ])

    /*
     * =========================================================
     * MOVIMIENTOS FILTRADOS
     * =========================================================
     */

    const filteredMovements =
        useMemo(() => {
            return movementsWithBalance.filter(
                movement =>
                    isDateInRange(
                        movement.date,
                        activeRange.start,
                        activeRange.end,
                    ),
            )
        }, [
            movementsWithBalance,
            activeRange,
        ])

    /*
     * =========================================================
     * RESUMEN
     * =========================================================
     */

    const summary = useMemo(() => {
        const entries =
            filteredMovements.reduce(
                (total, movement) =>
                    total + movement.entry,
                0,
            )

        const exits =
            filteredMovements.reduce(
                (total, movement) =>
                    total + movement.exit,
                0,
            )

        const movementsBeforeEnd =
            movementsWithBalance.filter(
                movement =>
                    movement.date <=
                    activeRange.end,
            )

        const balance =
            movementsBeforeEnd.length > 0
                ? movementsBeforeEnd[
                    movementsBeforeEnd.length - 1
                ].balance
                : selectedCountry?.baseAmount ??
                0

        return {
            entries,
            exits,
            balance,
        }
    }, [
        filteredMovements,
        movementsWithBalance,
        activeRange,
        selectedCountry,
    ])

    /*
     * =========================================================
     * MOVIMIENTO: MODAL
     * =========================================================
     */

    const openCreateMovement = () => {
        setEditingMovement(null)

        setMovementDate(getTodayKey())
        setConcept('')
        setEntry('')
        setExit('')
        setObservations('')

        setMovementModalOpen(true)
    }

    const openEditMovement = (
        movement: Movement,
    ) => {
        setEditingMovement(movement)

        setMovementDate(movement.date)

        setConcept(movement.concept)

        setEntry(
            movement.entry > 0
                ? String(movement.entry)
                : '',
        )

        setExit(
            movement.exit > 0
                ? String(movement.exit)
                : '',
        )

        setObservations(
            movement.observations,
        )

        setMovementModalOpen(true)
    }

    const closeMovementModal = () => {
        if (savingMovement) return

        setMovementModalOpen(false)
        setEditingMovement(null)
    }

    /*
     * =========================================================
     * GUARDAR MOVIMIENTO
     * =========================================================
     */

    const handleSaveMovement =
        async () => {
            if (
                !selectedCountryId ||
                !concept.trim()
            ) {
                return
            }

            const entryValue =
                Number(entry) || 0

            const exitValue =
                Number(exit) || 0

            if (
                entryValue <= 0 &&
                exitValue <= 0
            ) {
                return
            }

            if (
                entryValue > 0 &&
                exitValue > 0
            ) {
                return
            }

            setSavingMovement(true)

            if (editingMovement) {
                const { data, error } =
                    await supabase
                        .from(
                            'accounting_movements',
                        )
                        .update({
                            date: movementDate,
                            concept:
                                concept
                                    .trim()
                                    .replace(
                                        /\s+/g,
                                        ' ',
                                    ),
                            entry:
                                entryValue,
                            exit:
                                exitValue,
                            observations:
                                observations
                                    .trim(),
                        })
                        .eq(
                            'id',
                            editingMovement.id,
                        )
                        .select()
                        .single()

                if (error) {
                    console.error(
                        'Error actualizando movimiento:',
                        error,
                    )
                    setSavingMovement(false)
                    return
                }

                const updatedMovement: Movement =
                {
                    id: data.id,
                    countryId:
                        data.country_id,
                    date: data.date,
                    concept:
                        data.concept,
                    entry:
                        Number(data.entry),
                    exit:
                        Number(data.exit),
                    observations:
                        data.observations ??
                        '',
                    createdAt:
                        data.created_at,
                }

                setMovements(
                    previous =>
                        previous.map(
                            movement =>
                                movement.id ===
                                    editingMovement.id
                                    ? updatedMovement
                                    : movement,
                        ),
                )
            } else {
                const newMovement: Movement =
                {
                    id: `M${Date.now()}`,
                    countryId:
                        selectedCountryId,
                    date: movementDate,
                    concept:
                        concept
                            .trim()
                            .replace(
                                /\s+/g,
                                ' ',
                            ),
                    entry:
                        entryValue,
                    exit:
                        exitValue,
                    observations:
                        observations
                            .trim(),
                    createdAt:
                        new Date().toISOString(),
                }

                const { data, error } =
                    await supabase
                        .from(
                            'accounting_movements',
                        )
                        .insert({
                            id: newMovement.id,
                            country_id:
                                newMovement.countryId,
                            date:
                                newMovement.date,
                            concept:
                                newMovement.concept,
                            entry:
                                newMovement.entry,
                            exit:
                                newMovement.exit,
                            observations:
                                newMovement.observations ||
                                null,
                        })
                        .select()
                        .single()

                if (error) {
                    console.error(
                        'Error guardando movimiento:',
                        error,
                    )
                    setSavingMovement(false)
                    return
                }

                const savedMovement: Movement =
                {
                    id: data.id,
                    countryId:
                        data.country_id,
                    date: data.date,
                    concept:
                        data.concept,
                    entry:
                        Number(data.entry),
                    exit:
                        Number(data.exit),
                    observations:
                        data.observations ??
                        '',
                    createdAt:
                        data.created_at,
                }

                setMovements(
                    previous => [
                        ...previous,
                        savedMovement,
                    ],
                )
            }

            setSavingMovement(false)
            closeMovementModal()
        }

    /*
     * =========================================================
     * ELIMINAR MOVIMIENTO
     * =========================================================
     */

    const handleDeleteMovement =
        async (
            movement: Movement,
        ) => {
            const confirmed =
                window.confirm(
                    `¿Eliminar el movimiento "${movement.concept}"?`,
                )

            if (!confirmed) return

            const { error } =
                await supabase
                    .from(
                        'accounting_movements',
                    )
                    .delete()
                    .eq(
                        'id',
                        movement.id,
                    )

            if (error) {
                console.error(
                    'Error eliminando movimiento:',
                    error,
                )
                return
            }

            setMovements(
                previous =>
                    previous.filter(
                        item =>
                            item.id !==
                            movement.id,
                    ),
            )
        }

    /*
     * =========================================================
     * BASE
     * =========================================================
     */

    const openBaseModal = () => {
        if (!selectedCountry) return

        setBaseAmount(
            String(
                selectedCountry.baseAmount,
            ),
        )

        setBaseModalOpen(true)
    }

    const handleSaveBase =
        async () => {
            if (!selectedCountry) return

            const value =
                Number(baseAmount)

            if (
                !Number.isFinite(value) ||
                value < 0
            ) {
                return
            }

            setSavingBase(true)

            const { error } =
                await supabase
                    .from(
                        'accounting_countries',
                    )
                    .update({
                        base_amount: value,
                    })
                    .eq(
                        'id',
                        selectedCountry.id,
                    )

            if (error) {
                console.error(
                    'Error actualizando base:',
                    error,
                )
                setSavingBase(false)
                return
            }

            setCountries(
                previous =>
                    previous.map(
                        country =>
                            country.id ===
                                selectedCountry.id
                                ? {
                                    ...country,
                                    baseAmount:
                                        value,
                                }
                                : country,
                    ),
            )

            setSavingBase(false)
            setBaseModalOpen(false)
        }

    /*
     * =========================================================
     * COMISIÓN
     * =========================================================
     */

    const calculateCommission =
        () => {
            const amount =
                Number(
                    commissionAmount,
                )

            const percentage =
                Number(
                    commissionPercentage,
                )

            if (
                !Number.isFinite(amount) ||
                !Number.isFinite(
                    percentage,
                ) ||
                amount < 0 ||
                percentage < 0
            ) {
                setCommissionResult(
                    null,
                )
                return
            }

            setCommissionResult(
                amount *
                (percentage / 100),
            )
        }

    /*
     * =========================================================
     * CAMBIO DE PAÍS
     * =========================================================
     */

    const handleCountryChange =
        (
            countryId: string,
        ) => {
            setSelectedCountryId(
                countryId,
            )

            setCommissionResult(
                null,
            )
        }

    const handleAccountingUnlock = () => {
        if (
            accountingPassword ===
            ACCOUNTING_PASSWORD
        ) {
            sessionStorage.setItem(
                'accounting_unlocked',
                'true',
            )

            setAccountingUnlocked(true)
            setAccountingPassword('')
            setAccountingPasswordError(false)
            return
        }

        setAccountingPasswordError(true)
    }

    /*
     * =========================================================
     * PROTECCIÓN
     * =========================================================
     */

    if (!accountingUnlocked) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center p-6">
                <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-7 shadow-2xl">

                    <div className="text-center mb-6">

                        <div
                            className="mx-auto mb-4 w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                            style={{
                                backgroundColor:
                                    'rgba(201,168,76,0.10)',
                                color: GOLD,
                            }}
                        >
                            🔒
                        </div>

                        <h1 className="text-xl font-semibold text-white">
                            Contabilidad protegida
                        </h1>

                        <p className="text-sm text-zinc-500 mt-2">
                            Ingresa la clave para acceder a esta sección.
                        </p>

                    </div>

                    <div>

                        <label className="block text-xs text-zinc-500 mb-2">
                            Clave de acceso
                        </label>

                        <input
                            type="password"
                            autoFocus
                            value={
                                accountingPassword
                            }
                            onChange={e => {
                                setAccountingPassword(
                                    e.target.value,
                                )
                                setAccountingPasswordError(
                                    false,
                                )
                            }}
                            onKeyDown={e => {
                                if (
                                    e.key ===
                                    'Enter'
                                ) {
                                    handleAccountingUnlock()
                                }
                            }}
                            placeholder="Ingresa la clave"
                            className="w-full h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-4 text-sm text-white outline-none focus:border-zinc-600"
                        />

                        {accountingPasswordError && (
                            <p className="text-xs text-red-400 mt-2">
                                La clave ingresada no es correcta.
                            </p>
                        )}

                        <button
                            onClick={
                                handleAccountingUnlock
                            }
                            className="w-full h-11 rounded-lg text-sm font-medium mt-4"
                            style={{
                                backgroundColor:
                                    GOLD,
                                color:
                                    '#09090b',
                            }}
                        >
                            Ingresar
                        </button>

                    </div>

                </div>
            </div>
        )
    }

    if (loadingCountries) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                Cargando contabilidad...
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">

            {/* ================================================= */}
            {/* ENCABEZADO */}
            {/* ================================================= */}

            <div>
                <h1
                    className="text-2xl text-zinc-100"
                    style={{
                        fontFamily:
                            'DM Serif Display, Georgia, serif',
                    }}
                >
                    Contabilidad / Cuadres
                </h1>

                <p className="text-sm text-zinc-600 mt-1">
                    Control sencillo de bases y movimientos por país.
                </p>
            </div>

            {/* ================================================= */}
            {/* NUEVAS PESTAÑAS */}
            {/* ================================================= */}

            <div className="flex gap-2 border-b border-zinc-800 pb-3">

                <button
                    onClick={() =>
                        setAccountingSection(
                            'accounting',
                        )
                    }
                    className="px-4 py-2.5 rounded-lg text-sm font-medium border transition-all"
                    style={{
                        borderColor:
                            accountingSection ===
                                'accounting'
                                ? GOLD
                                : '#27272a',
                        backgroundColor:
                            accountingSection ===
                                'accounting'
                                ? 'rgba(201,168,76,0.08)'
                                : '#18181b',
                        color:
                            accountingSection ===
                                'accounting'
                                ? GOLD
                                : '#a1a1aa',
                    }}
                >
                    Bases y movimientos
                </button>

                <button
                    onClick={() =>
                        setAccountingSection(
                            'reconciliation',
                        )
                    }
                    className="px-4 py-2.5 rounded-lg text-sm font-medium border transition-all"
                    style={{
                        borderColor:
                            accountingSection ===
                                'reconciliation'
                                ? GOLD
                                : '#27272a',
                        backgroundColor:
                            accountingSection ===
                                'reconciliation'
                                ? 'rgba(201,168,76,0.08)'
                                : '#18181b',
                        color:
                            accountingSection ===
                                'reconciliation'
                                ? GOLD
                                : '#a1a1aa',
                    }}
                >
                    Conciliación diaria
                </button>

            </div>

            {/* ================================================= */}
            {/* CONCILIACIÓN */}
            {/* ================================================= */}

            {accountingSection ===
                'reconciliation' ? (
                <Reconciliation
                    countries={
                        countries
                    }
                    selectedCountryId={
                        selectedCountryId
                    }
                    onCountryChange={
                        handleCountryChange
                    }
                />
            ) : (
                <>
                    {/* ================================================= */}
                    {/* PAÍSES */}
                    {/* ================================================= */}

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {countries.map(country => {
                            const active =
                                selectedCountryId ===
                                country.id

                            return (
                                <button
                                    key={
                                        country.id
                                    }
                                    onClick={() =>
                                        handleCountryChange(
                                            country.id,
                                        )
                                    }
                                    className="rounded-xl border px-4 py-4 text-left transition-all"
                                    style={{
                                        borderColor:
                                            active
                                                ? 'rgba(201,168,76,0.4)'
                                                : '#27272a',
                                        backgroundColor:
                                            active
                                                ? 'rgba(201,168,76,0.08)'
                                                : '#18181b',
                                    }}
                                >

                                    <div
                                        className="text-sm font-semibold"
                                        style={{
                                            color:
                                                active
                                                    ? GOLD
                                                    : '#f4f4f5',
                                        }}
                                    >
                                        {
                                            country.name
                                        }
                                    </div>

                                    <div className="text-xs text-zinc-600 mt-1">
                                        {
                                            country.currency
                                        }
                                    </div>

                                </button>
                            )
                        })}
                    </div>

                    {selectedCountry && (
                        <>
                            {/* ================================================= */}
                            {/* CABECERA PAÍS */}
                            {/* ================================================= */}

                            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">

                                <div>

                                    <div className="flex items-center gap-3">

                                        <h2 className="text-xl font-semibold text-white">
                                            {
                                                selectedCountry.name
                                            }
                                        </h2>

                                        <span
                                            className="px-2.5 py-1 rounded-md text-xs font-medium"
                                            style={{
                                                backgroundColor:
                                                    'rgba(201,168,76,0.10)',
                                                color: GOLD,
                                            }}
                                        >
                                            {
                                                selectedCountry.currency
                                            }
                                        </span>

                                    </div>

                                    <div className="flex items-center gap-3 mt-2">

                                        <span className="text-sm text-zinc-500">
                                            Base inicial:
                                        </span>

                                        <span className="text-sm font-semibold text-zinc-200">
                                            {formatMoney(
                                                selectedCountry.baseAmount,
                                                selectedCountry.currency,
                                                selectedCountry.symbol,
                                            )}
                                        </span>

                                        <button
                                            onClick={
                                                openBaseModal
                                            }
                                            className="text-xs font-medium"
                                            style={{
                                                color: GOLD,
                                            }}
                                        >
                                            Editar base
                                        </button>

                                    </div>

                                </div>

                                <button
                                    onClick={
                                        openCreateMovement
                                    }
                                    className="h-11 px-5 rounded-lg text-sm font-medium"
                                    style={{
                                        backgroundColor:
                                            GOLD,
                                        color:
                                            '#09090b',
                                    }}
                                >
                                    + Registrar movimiento
                                </button>

                            </div>

                            {/* ================================================= */}
                            {/* RESUMEN */}
                            {/* ================================================= */}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">

                                    <div className="text-xs text-zinc-500">
                                        Saldo actual
                                    </div>

                                    <div
                                        className="text-2xl font-bold mt-2"
                                        style={{
                                            color: GOLD,
                                            fontFamily:
                                                'JetBrains Mono, monospace',
                                        }}
                                    >
                                        {formatMoney(
                                            summary.balance,
                                            selectedCountry.currency,
                                            selectedCountry.symbol,
                                        )}
                                    </div>

                                </div>

                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">

                                    <div className="text-xs text-zinc-500">
                                        Total de entradas
                                    </div>

                                    <div
                                        className="text-2xl font-bold mt-2 text-emerald-400"
                                        style={{
                                            fontFamily:
                                                'JetBrains Mono, monospace',
                                        }}
                                    >
                                        {formatMoney(
                                            summary.entries,
                                            selectedCountry.currency,
                                            selectedCountry.symbol,
                                        )}
                                    </div>

                                </div>

                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">

                                    <div className="text-xs text-zinc-500">
                                        Total de salidas
                                    </div>

                                    <div
                                        className="text-2xl font-bold mt-2 text-red-400"
                                        style={{
                                            fontFamily:
                                                'JetBrains Mono, monospace',
                                        }}
                                    >
                                        {formatMoney(
                                            summary.exits,
                                            selectedCountry.currency,
                                            selectedCountry.symbol,
                                        )}
                                    </div>

                                </div>

                            </div>

                            {/* ================================================= */}
                            {/* FILTROS */}
                            {/* ================================================= */}

                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">

                                <div className="flex flex-wrap gap-2 mb-4">

                                    {[
                                        {
                                            id: 'day',
                                            label: 'Día',
                                        },
                                        {
                                            id: 'week',
                                            label: 'Semana',
                                        },
                                        {
                                            id: 'month',
                                            label: 'Mes',
                                        },
                                        {
                                            id: 'range',
                                            label: 'Rango',
                                        },
                                    ].map(
                                        filter => {
                                            const active =
                                                filterType ===
                                                filter.id

                                            return (
                                                <button
                                                    key={
                                                        filter.id
                                                    }
                                                    onClick={() =>
                                                        setFilterType(
                                                            filter.id as FilterType,
                                                        )
                                                    }
                                                    className="px-4 py-2 rounded-lg text-xs font-medium border transition-all"
                                                    style={{
                                                        borderColor:
                                                            active
                                                                ? GOLD
                                                                : '#27272a',
                                                        backgroundColor:
                                                            active
                                                                ? 'rgba(201,168,76,0.08)'
                                                                : '#18181b',
                                                        color:
                                                            active
                                                                ? GOLD
                                                                : '#a1a1aa',
                                                    }}
                                                >
                                                    {
                                                        filter.label
                                                    }
                                                </button>
                                            )
                                        },
                                    )}

                                </div>

                                {filterType ===
                                    'day' && (
                                        <input
                                            type="date"
                                            value={
                                                day
                                            }
                                            onChange={e =>
                                                setDay(
                                                    e.target.value,
                                                )
                                            }
                                            className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-4 text-sm text-white outline-none"
                                        />
                                    )}

                                {filterType ===
                                    'week' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                                            <div>

                                                <label className="block text-xs text-zinc-500 mb-2">
                                                    Desde
                                                </label>

                                                <input
                                                    type="date"
                                                    value={
                                                        weekStart
                                                    }
                                                    onChange={e =>
                                                        setWeekStart(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="w-full h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-4 text-sm text-white outline-none"
                                                />

                                            </div>

                                            <div>

                                                <label className="block text-xs text-zinc-500 mb-2">
                                                    Hasta
                                                </label>

                                                <input
                                                    type="date"
                                                    value={
                                                        weekEnd
                                                    }
                                                    onChange={e =>
                                                        setWeekEnd(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="w-full h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-4 text-sm text-white outline-none"
                                                />

                                            </div>

                                        </div>
                                    )}

                                {filterType ===
                                    'month' && (
                                        <input
                                            type="month"
                                            value={
                                                month
                                            }
                                            onChange={e =>
                                                setMonth(
                                                    e.target.value,
                                                )
                                            }
                                            className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-4 text-sm text-white outline-none"
                                        />
                                    )}

                                {filterType ===
                                    'range' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                                            <div>

                                                <label className="block text-xs text-zinc-500 mb-2">
                                                    Desde
                                                </label>

                                                <input
                                                    type="date"
                                                    value={
                                                        rangeStart
                                                    }
                                                    onChange={e =>
                                                        setRangeStart(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="w-full h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-4 text-sm text-white outline-none"
                                                />

                                            </div>

                                            <div>

                                                <label className="block text-xs text-zinc-500 mb-2">
                                                    Hasta
                                                </label>

                                                <input
                                                    type="date"
                                                    value={
                                                        rangeEnd
                                                    }
                                                    onChange={e =>
                                                        setRangeEnd(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="w-full h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-4 text-sm text-white outline-none"
                                                />

                                            </div>

                                        </div>
                                    )}

                            </div>

                            {/* ================================================= */}
                            {/* MOVIMIENTOS */}
                            {/* ================================================= */}

                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">

                                <div className="px-5 py-4 border-b border-zinc-800">

                                    <div className="flex items-center justify-between gap-4">

                                        <div>

                                            <h3 className="text-sm font-semibold text-zinc-100">
                                                Movimientos
                                            </h3>

                                            <p className="text-xs text-zinc-600 mt-1">
                                                {
                                                    formatDate(
                                                        activeRange.start,
                                                    )
                                                }
                                                {' — '}
                                                {
                                                    formatDate(
                                                        activeRange.end,
                                                    )
                                                }
                                            </p>

                                        </div>

                                        <span className="text-xs text-zinc-600">
                                            {
                                                filteredMovements.length
                                            }{' '}
                                            movimientos
                                        </span>

                                    </div>

                                </div>

                                {loadingMovements ? (
                                    <div className="px-5 py-12 text-center text-sm text-zinc-600">
                                        Cargando movimientos...
                                    </div>
                                ) : filteredMovements.length ===
                                    0 ? (
                                    <div className="px-5 py-12 text-center">

                                        <p className="text-sm text-zinc-500">
                                            No hay movimientos en este período.
                                        </p>

                                        <button
                                            onClick={
                                                openCreateMovement
                                            }
                                            className="text-xs font-medium mt-2"
                                            style={{
                                                color: GOLD,
                                            }}
                                        >
                                            Registrar el primero
                                        </button>

                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">

                                        <table className="w-full text-sm">

                                            <thead>

                                                <tr className="border-b border-zinc-800 text-left">

                                                    <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                                                        Fecha
                                                    </th>

                                                    <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                                                        Concepto
                                                    </th>

                                                    <th className="px-5 py-3 text-xs font-medium text-zinc-500 text-right">
                                                        Entrada
                                                    </th>

                                                    <th className="px-5 py-3 text-xs font-medium text-zinc-500 text-right">
                                                        Salida
                                                    </th>

                                                    <th className="px-5 py-3 text-xs font-medium text-zinc-500 text-right">
                                                        Saldo
                                                    </th>

                                                    <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                                                        Observaciones
                                                    </th>

                                                    <th className="px-5 py-3 text-xs font-medium text-zinc-500">
                                                        Acción
                                                    </th>

                                                </tr>

                                            </thead>

                                            <tbody>

                                                {filteredMovements.map(
                                                    movement => (
                                                        <tr
                                                            key={
                                                                movement.id
                                                            }
                                                            className="border-b border-zinc-900 last:border-0"
                                                        >

                                                            <td className="px-5 py-4 text-zinc-400 whitespace-nowrap">
                                                                {formatDate(
                                                                    movement.date,
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-white font-medium">
                                                                {
                                                                    movement.concept
                                                                }
                                                            </td>

                                                            <td className="px-5 py-4 text-right text-emerald-400">
                                                                {movement.entry >
                                                                    0
                                                                    ? formatMoney(
                                                                        movement.entry,
                                                                        selectedCountry.currency,
                                                                        selectedCountry.symbol,
                                                                    )
                                                                    : '—'}
                                                            </td>

                                                            <td className="px-5 py-4 text-right text-red-400">
                                                                {movement.exit >
                                                                    0
                                                                    ? formatMoney(
                                                                        movement.exit,
                                                                        selectedCountry.currency,
                                                                        selectedCountry.symbol,
                                                                    )
                                                                    : '—'}
                                                            </td>

                                                            <td className="px-5 py-4 text-right text-zinc-100 font-medium whitespace-nowrap">
                                                                {formatMoney(
                                                                    movement.balance,
                                                                    selectedCountry.currency,
                                                                    selectedCountry.symbol,
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-zinc-500 max-w-xs">
                                                                <span className="block truncate">
                                                                    {movement.observations ||
                                                                        '—'}
                                                                </span>
                                                            </td>

                                                            <td className="px-5 py-4">

                                                                <div className="flex items-center gap-3">

                                                                    <button
                                                                        onClick={() =>
                                                                            openEditMovement(
                                                                                movement,
                                                                            )
                                                                        }
                                                                        className="text-xs font-medium"
                                                                        style={{
                                                                            color: GOLD,
                                                                        }}
                                                                    >
                                                                        Editar
                                                                    </button>

                                                                    <button
                                                                        onClick={() =>
                                                                            handleDeleteMovement(
                                                                                movement,
                                                                            )
                                                                        }
                                                                        className="text-xs font-medium text-red-400"
                                                                    >
                                                                        Eliminar
                                                                    </button>

                                                                </div>

                                                            </td>

                                                        </tr>
                                                    ),
                                                )}

                                            </tbody>

                                        </table>

                                    </div>
                                )}

                            </div>

                            {/* ================================================= */}
                            {/* COMISIÓN */}
                            {/* ================================================= */}

                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">

                                <div className="mb-5">

                                    <h3 className="text-sm font-semibold text-zinc-100">
                                        Cálculo de comisión
                                    </h3>

                                    <p className="text-xs text-zinc-600 mt-1">
                                        Este cálculo es independiente de los movimientos y no modifica el saldo.
                                    </p>

                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-end">

                                    <div>

                                        <label className="block text-xs text-zinc-500 mb-2">
                                            Cantidad
                                        </label>

                                        <input
                                            type="number"
                                            min="0"
                                            value={
                                                commissionAmount
                                            }
                                            onChange={e =>
                                                setCommissionAmount(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="10000"
                                            className="w-full h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-4 text-sm text-white outline-none"
                                        />

                                    </div>

                                    <div>

                                        <label className="block text-xs text-zinc-500 mb-2">
                                            Porcentaje
                                        </label>

                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={
                                                commissionPercentage
                                            }
                                            onChange={e =>
                                                setCommissionPercentage(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="5"
                                            className="w-full h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-4 text-sm text-white outline-none"
                                        />

                                    </div>

                                    <button
                                        onClick={
                                            calculateCommission
                                        }
                                        className="h-11 px-5 rounded-lg text-sm font-medium"
                                        style={{
                                            backgroundColor:
                                                GOLD,
                                            color:
                                                '#09090b',
                                        }}
                                    >
                                        Calcular
                                    </button>

                                </div>

                                {commissionResult !==
                                    null && (
                                        <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-4">

                                            <div className="text-xs text-zinc-500">
                                                Comisión
                                            </div>

                                            <div
                                                className="text-2xl font-bold mt-1"
                                                style={{
                                                    color: GOLD,
                                                    fontFamily:
                                                        'JetBrains Mono, monospace',
                                                }}
                                            >
                                                {formatMoney(
                                                    commissionResult,
                                                    selectedCountry.currency,
                                                    selectedCountry.symbol,
                                                )}
                                            </div>

                                        </div>
                                    )}

                            </div>
                        </>
                    )}
                </>
            )}

            {/* ===================================================== */}
            {/* MODAL MOVIMIENTO ACTUAL */}
            {/* ===================================================== */}

            {movementModalOpen &&
                selectedCountry && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">

                        <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">

                            <div className="px-6 py-5 border-b border-zinc-800">

                                <p className="text-xs text-zinc-500 mb-1">
                                    {editingMovement
                                        ? 'Editar movimiento'
                                        : 'Nuevo movimiento'}
                                </p>

                                <h2 className="text-lg font-semibold text-white">
                                    {
                                        selectedCountry.name
                                    }
                                </h2>

                            </div>

                            <div className="p-6 space-y-5">

                                <div>

                                    <label className="block text-sm text-zinc-400 mb-2">
                                        Fecha
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            movementDate
                                        }
                                        onChange={e =>
                                            setMovementDate(
                                                e.target.value,
                                            )
                                        }
                                        className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none"
                                    />

                                </div>

                                <div>

                                    <label className="block text-sm text-zinc-400 mb-2">
                                        Concepto
                                    </label>

                                    <input
                                        autoFocus
                                        value={
                                            concept
                                        }
                                        onChange={e =>
                                            setConcept(
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Ej. Depósito, pago, transferencia..."
                                        className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none"
                                    />

                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                    <div>

                                        <label className="block text-sm text-zinc-400 mb-2">
                                            Entrada
                                        </label>

                                        <input
                                            type="number"
                                            min="0"
                                            value={
                                                entry
                                            }
                                            onChange={e => {
                                                setEntry(
                                                    e.target.value,
                                                )

                                                if (
                                                    e.target.value
                                                ) {
                                                    setExit(
                                                        '',
                                                    )
                                                }
                                            }}
                                            placeholder="0"
                                            className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none"
                                        />

                                    </div>

                                    <div>

                                        <label className="block text-sm text-zinc-400 mb-2">
                                            Salida
                                        </label>

                                        <input
                                            type="number"
                                            min="0"
                                            value={
                                                exit
                                            }
                                            onChange={e => {
                                                setExit(
                                                    e.target.value,
                                                )

                                                if (
                                                    e.target.value
                                                ) {
                                                    setEntry(
                                                        '',
                                                    )
                                                }
                                            }}
                                            placeholder="0"
                                            className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none"
                                        />

                                    </div>

                                </div>

                                <div>

                                    <label className="block text-sm text-zinc-400 mb-2">
                                        Observaciones
                                    </label>

                                    <textarea
                                        value={
                                            observations
                                        }
                                        onChange={e =>
                                            setObservations(
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Opcional"
                                        rows={3}
                                        className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none resize-none"
                                    />

                                </div>

                                <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">

                                    <p className="text-xs text-zinc-600">
                                        El saldo se calcula automáticamente. Solo puedes registrar una entrada o una salida por movimiento.
                                    </p>

                                </div>

                            </div>

                            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">

                                <button
                                    onClick={
                                        closeMovementModal
                                    }
                                    disabled={
                                        savingMovement
                                    }
                                    className="h-10 px-4 rounded-lg text-sm text-zinc-400 hover:text-white"
                                >
                                    Cancelar
                                </button>

                                <button
                                    onClick={
                                        handleSaveMovement
                                    }
                                    disabled={
                                        savingMovement ||
                                        !concept.trim() ||
                                        (!(Number(entry) > 0) &&
                                            !(Number(exit) > 0))
                                    }
                                    className="h-10 px-5 rounded-lg text-sm font-medium disabled:opacity-40"
                                    style={{
                                        backgroundColor:
                                            GOLD,
                                        color:
                                            '#09090b',
                                    }}
                                >
                                    {savingMovement
                                        ? 'Guardando...'
                                        : editingMovement
                                            ? 'Guardar cambios'
                                            : 'Registrar movimiento'}
                                </button>

                            </div>

                        </div>

                    </div>
                )}

            {/* ===================================================== */}
            {/* MODAL BASE */}
            {/* ===================================================== */}

            {baseModalOpen &&
                selectedCountry && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">

                        <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">

                            <div className="px-6 py-5 border-b border-zinc-800">

                                <p className="text-xs text-zinc-500 mb-1">
                                    Base inicial
                                </p>

                                <h2 className="text-lg font-semibold text-white">
                                    {
                                        selectedCountry.name
                                    }
                                </h2>

                            </div>

                            <div className="p-6">

                                <label className="block text-sm text-zinc-400 mb-2">
                                    Valor de la base
                                </label>

                                <input
                                    type="number"
                                    min="0"
                                    value={
                                        baseAmount
                                    }
                                    onChange={e =>
                                        setBaseAmount(
                                            e.target.value,
                                        )
                                    }
                                    className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-sm text-white outline-none"
                                />

                                <p className="text-xs text-zinc-600 mt-2">
                                    Esta cantidad será el punto de partida para calcular todos los saldos.
                                </p>

                            </div>

                            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">

                                <button
                                    onClick={() =>
                                        setBaseModalOpen(
                                            false,
                                        )
                                    }
                                    disabled={
                                        savingBase
                                    }
                                    className="h-10 px-4 rounded-lg text-sm text-zinc-400 hover:text-white"
                                >
                                    Cancelar
                                </button>

                                <button
                                    onClick={
                                        handleSaveBase
                                    }
                                    disabled={
                                        savingBase
                                    }
                                    className="h-10 px-5 rounded-lg text-sm font-medium disabled:opacity-40"
                                    style={{
                                        backgroundColor:
                                            GOLD,
                                        color:
                                            '#09090b',
                                    }}
                                >
                                    {savingBase
                                        ? 'Guardando...'
                                        : 'Guardar base'}
                                </button>

                            </div>

                        </div>

                    </div>
                )}

        </div>
    )
}