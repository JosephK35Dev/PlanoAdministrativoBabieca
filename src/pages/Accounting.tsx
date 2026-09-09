import {
    useEffect,
    useMemo,
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
                mappedCountries.length > 0
                &&
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
                        movement.entry
                        - movement.exit

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
                const today =
                    getTodayKey()

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
                            value={accountingPassword}
                            onChange={e => {
                                setAccountingPassword(
                                    e.target.value,
                                )
                                setAccountingPasswordError(false)
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
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
                                backgroundColor: GOLD,
                                color: '#09090b',
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
            {/* PAÍSES */}
            {/* ================================================= */}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {countries.map(country => {
                    const active =
                        selectedCountryId ===
                        country.id

                    return (
                        <button
                            key={country.id}
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
                                    color: active
                                        ? GOLD
                                        : '#f4f4f5',
                                }}
                            >
                                {country.name}
                            </div>

                            <div className="text-xs text-zinc-600 mt-1">
                                {country.currency}
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
                                    {selectedCountry.name}
                                </h2>

                                <span
                                    className="px-2.5 py-1 rounded-md text-xs font-medium"
                                    style={{
                                        backgroundColor:
                                            'rgba(201,168,76,0.10)',
                                        color: GOLD,
                                    }}
                                >
                                    {selectedCountry.currency}
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
                                backgroundColor: GOLD,
                                color: '#09090b',
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
                            ].map(filter => {
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
                                        {filter.label}
                                    </button>
                                )
                            })}
                        </div>

                        {filterType ===
                            'day' && (
                                <input
                                    type="date"
                                    value={day}
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
                                    value={month}
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
                                        {formatDate(
                                            activeRange.start,
                                        )}
                                        {' — '}
                                        {formatDate(
                                            activeRange.end,
                                        )}
                                    </p>
                                </div>

                                <span className="text-xs text-zinc-600">
                                    {filteredMovements.length}{' '}
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
                                                        {movement.concept}
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

            {/* ===================================================== */}
            {/* MODAL MOVIMIENTO */}
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
                                    {selectedCountry.name}
                                </h2>
                            </div>

                            <div className="p-6 space-y-5">

                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">
                                        Fecha
                                    </label>

                                    <input
                                        type="date"
                                        value={movementDate}
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
                                        value={concept}
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
                                            value={entry}
                                            onChange={e => {
                                                setEntry(
                                                    e.target.value,
                                                )

                                                if (
                                                    e.target.value
                                                ) {
                                                    setExit('')
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
                                            value={exit}
                                            onChange={e => {
                                                setExit(
                                                    e.target.value,
                                                )

                                                if (
                                                    e.target.value
                                                ) {
                                                    setEntry('')
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
                                    {selectedCountry.name}
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