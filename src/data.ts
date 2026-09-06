export type Page =
  | 'dashboard'
  | 'employees'
  | 'schedules'
  | 'bonuses'
  | 'withdrawals'
  | 'plano'

export type EmployeeStatus = 'ACTIVO' | 'INACTIVO'

export type JornadaStatus =
  | 'EN_TURNO'
  | 'SIN_LLEGADA'
  | 'JORNADA_FINALIZADA'
  | 'FUERA_DE_TURNO'

export type BonusStatus = 'PENDIENTE' | 'ENTREGADO' | 'CANCELADO'

export type WithdrawalStatus =
  | 'PENDIENTE'
  | 'PAGADO'
  | 'RECHAZADO'

export interface Employee {
  id: string
  name: string
  role: string
  status: EmployeeStatus
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  arrival?: string
  departure?: string
  hours?: string
  notes: string
}

export type BonusKind =
  | 'PORCENTAJE'
  | 'GIROS'
  | 'DEPORTIVA'
  | 'HIPISMO'

export interface BonusRecord {
  id: string
  client: string
  step: number
  type: string
  kind: BonusKind
  rechargeAmount?: number
  percentage?: number
  bonusAmount?: number
  rollover?: string
  date: string
  time: string
  status: BonusStatus
  responsible: string
}

export interface WithdrawalRecord {
  id: string
  client: string
  amount: number
  date: string
  status: WithdrawalStatus
  responsible: string
  method: string
}

/*
|--------------------------------------------------------------------------
| EMPLEADOS
|--------------------------------------------------------------------------
*/

export const EMPLOYEES: Employee[] = [
  {
    id: '001',
    name: 'Yulexy',
    role: 'Supervisor',
    status: 'ACTIVO',
  },
  {
    id: '002',
    name: 'Susana',
    role: 'Asesora',
    status: 'ACTIVO',
  },
  {
    id: '003',
    name: 'Gabriel',
    role: 'Asesor',
    status: 'ACTIVO',
  },
  {
    id: '004',
    name: 'Adrian',
    role: 'Asesor',
    status: 'ACTIVO',
  },
  {
    id: '005',
    name: 'Leonardo',
    role: 'Asesor',
    status: 'ACTIVO',
  },
]

/*
|--------------------------------------------------------------------------
| REGISTROS DE ASISTENCIA / JORNADAS
|--------------------------------------------------------------------------
*/

export const ATTENDANCE_RECORDS: AttendanceRecord[] = [
  {
    id: 'A001',
    employeeId: '001',
    date: '05/09/2026',
    arrival: '08:02',
    notes: '',
  },
  {
    id: 'A002',
    employeeId: '002',
    date: '05/09/2026',
    arrival: '08:15',
    notes: '',
  },
  {
    id: 'A003',
    employeeId: '004',
    date: '05/09/2026',
    arrival: '07:58',
    departure: '16:00',
    hours: '8h 02min',
    notes: '',
  },
  {
    id: 'A004',
    employeeId: '005',
    date: '05/09/2026',
    arrival: '07:30',
    notes: '',
  },

  // Historial de Carlos
  {
    id: 'A005',
    employeeId: '001',
    date: '04/09/2026',
    arrival: '08:00',
    departure: '16:00',
    hours: '8h 00min',
    notes: '',
  },
  {
    id: 'A006',
    employeeId: '001',
    date: '03/09/2026',
    arrival: '07:55',
    departure: '16:05',
    hours: '8h 10min',
    notes: 'Horas extra aprobadas',
  },
  {
    id: 'A007',
    employeeId: '001',
    date: '02/09/2026',
    arrival: '08:10',
    departure: '16:00',
    hours: '7h 50min',
    notes: '',
  },
  {
    id: 'A008',
    employeeId: '001',
    date: '01/09/2026',
    arrival: '08:00',
    departure: '16:00',
    hours: '8h 00min',
    notes: '',
  },

  // Historial de Ana
  {
    id: 'A009',
    employeeId: '002',
    date: '04/09/2026',
    arrival: '08:15',
    departure: '16:15',
    hours: '8h 00min',
    notes: '',
  },
  {
    id: 'A010',
    employeeId: '002',
    date: '03/09/2026',
    arrival: '08:00',
    departure: '16:00',
    hours: '8h 00min',
    notes: '',
  },

  // Historial de Luis
  {
    id: 'A011',
    employeeId: '003',
    date: '04/09/2026',
    arrival: '09:00',
    departure: '17:00',
    hours: '8h 00min',
    notes: '',
  },
  {
    id: 'A012',
    employeeId: '003',
    date: '03/09/2026',
    arrival: '09:05',
    departure: '17:00',
    hours: '7h 55min',
    notes: 'Llegada tardía',
  },

  // Historial de María
  {
    id: 'A013',
    employeeId: '004',
    date: '04/09/2026',
    arrival: '08:00',
    departure: '16:00',
    hours: '8h 00min',
    notes: '',
  },
  {
    id: 'A014',
    employeeId: '004',
    date: '03/09/2026',
    arrival: '08:05',
    departure: '16:00',
    hours: '7h 55min',
    notes: '',
  },

  // Historial de Roberto
  {
    id: 'A015',
    employeeId: '005',
    date: '04/09/2026',
    arrival: '07:30',
    departure: '15:30',
    hours: '8h 00min',
    notes: '',
  },
]

/*
|--------------------------------------------------------------------------
| BONOS
|--------------------------------------------------------------------------
|
| Estos datos son solamente de prueba.
| La lógica real de bonos la definiremos posteriormente.
|
*/

/*
|--------------------------------------------------------------------------
| RETIROS
|--------------------------------------------------------------------------
|
| Datos de prueba mientras definimos el proceso real de Excel.
|
*/

export const WITHDRAWALS: WithdrawalRecord[] = [
  {
    id: 'R001',
    client: 'Andrés Romero',
    amount: 350,
    date: '05/09/2026 10:05',
    status: 'PENDIENTE',
    responsible: 'Carlos Méndez',
    method: 'Transferencia',
  },
  {
    id: 'R002',
    client: 'Valentina Cruz',
    amount: 1200,
    date: '05/09/2026 09:30',
    status: 'PAGADO',
    responsible: 'Ana García',
    method: 'Efectivo',
  },
  {
    id: 'R003',
    client: 'Héctor Jiménez',
    amount: 500,
    date: '05/09/2026 11:45',
    status: 'PENDIENTE',
    responsible: 'Ana García',
    method: 'Transferencia',
  },
  {
    id: 'R004',
    client: 'Isabela Flores',
    amount: 750,
    date: '04/09/2026 16:20',
    status: 'RECHAZADO',
    responsible: 'Carlos Méndez',
    method: 'Transferencia',
  },
  {
    id: 'R005',
    client: 'Pablo Guerrero',
    amount: 200,
    date: '04/09/2026 14:55',
    status: 'PAGADO',
    responsible: 'Luis Torres',
    method: 'Efectivo',
  },
  {
    id: 'R006',
    client: 'Natalia Herrera',
    amount: 900,
    date: '05/09/2026 08:15',
    status: 'PAGADO',
    responsible: 'Carlos Méndez',
    method: 'Transferencia',
  },
]

/*
|--------------------------------------------------------------------------
| HORARIOS
|--------------------------------------------------------------------------
|
| Datos de prueba.
| La estructura la vamos a mejorar después para que cada semana
| tenga sus propios horarios.
|
*/

export const SCHEDULE: Record<string, string[]> = {
  '001': [
    '08:00–16:00',
    '08:00–16:00',
    '08:00–16:00',
    '08:00–16:00',
    '08:00–16:00',
    'DESCANSO',
    'DESCANSO',
  ],

  '002': [
    '08:00–16:00',
    '08:00–16:00',
    '08:00–16:00',
    '08:00–16:00',
    '08:00–16:00',
    '08:00–14:00',
    'DESCANSO',
  ],

  '003': [
    '09:00–17:00',
    '09:00–17:00',
    '09:00–17:00',
    '09:00–17:00',
    'DESCANSO',
    '09:00–17:00',
    'DESCANSO',
  ],

  '004': [
    '07:00–15:00',
    '07:00–15:00',
    '07:00–15:00',
    'DESCANSO',
    '07:00–15:00',
    '07:00–15:00',
    'DESCANSO',
  ],

  '005': [
    '07:00–15:00',
    '07:00–15:00',
    '07:00–15:00',
    '07:00–15:00',
    '07:00–15:00',
    'DESCANSO',
    'DESCANSO',
  ],
}

export const TEMPORARY_WEEKLY_SCHEDULES: Record<string, string[][]> = {
  '001': [
    ['08:00–16:00', '08:00–16:00', '08:00–16:00', '08:00–16:00', '08:00–16:00', 'DESCANSO', 'DESCANSO'],
    ['09:00–17:00', '09:00–17:00', '09:00–17:00', '09:00–17:00', '09:00–17:00', 'DESCANSO', 'DESCANSO'],
    ['11:00–19:00', '11:00–19:00', '11:00–19:00', '11:00–19:00', '11:00–19:00', 'DESCANSO', 'DESCANSO'],
  ],

  '002': [
    ['09:00–17:00', '09:00–17:00', '09:00–17:00', '09:00–17:00', '09:00–17:00', '09:00–15:00', 'DESCANSO'],
    ['11:00–19:00', '11:00–19:00', '11:00–19:00', '11:00–19:00', '11:00–19:00', '11:00–17:00', 'DESCANSO'],
    ['08:00–16:00', '08:00–16:00', '08:00–16:00', '08:00–16:00', '08:00–16:00', '08:00–14:00', 'DESCANSO'],
  ],

  '003': [
    ['11:00–19:00', '11:00–19:00', '11:00–19:00', '11:00–19:00', 'DESCANSO', '11:00–19:00', 'DESCANSO'],
    ['08:00–16:00', '08:00–16:00', '08:00–16:00', '08:00–16:00', 'DESCANSO', '08:00–16:00', 'DESCANSO'],
    ['09:00–17:00', '09:00–17:00', '09:00–17:00', '09:00–17:00', 'DESCANSO', '09:00–17:00', 'DESCANSO'],
  ],

  '004': [
    ['DESCANSO', '18:00–22:00', '18:00–22:00', '18:00–22:00', '18:00–22:00', '08:00–22:00', '08:00–22:00',],
    ['DESCANSO', '18:00–22:00', '18:00–22:00', '18:00–22:00', '18:00–22:00', '08:00–22:00', '08:00–22:00',],
    ['DESCANSO', '18:00–22:00', '18:00–22:00', '18:00–22:00', '18:00–22:00', '08:00–22:00', '08:00–22:00',],
  ],

  '005': [
    ['18:00–22:00', 'DESCANSO', 'DESCANSO', 'DESCANSO', 'DESCANSO', '08:00–18:00', '08:00–18:00',],
    ['18:00–22:00', 'DESCANSO', 'DESCANSO', 'DESCANSO', 'DESCANSO', '08:00–18:00', '08:00–18:00',],
    ['18:00–22:00', 'DESCANSO', 'DESCANSO', 'DESCANSO', 'DESCANSO', '08:00–18:00', '08:00–18:00',],
  ],
}

/*
|--------------------------------------------------------------------------
| OPCIONES
|--------------------------------------------------------------------------
*/

export const BONUS_TYPES = [
  'Bono de Bienvenida',
  'Bono de Recarga',
  'Bono de Fidelidad',
  'Bono VIP',
  'Bono Especial',
]

export const WITHDRAWAL_METHODS = [
  'Transferencia',
  'Efectivo',
  'Bizum',
]