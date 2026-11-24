import type { IsoDate } from '../domain/dates'
import type { BacktestInput, BacktestResults, PnlCategory, SetupType } from '../domain/backtest'
import type { DojoDay, DojoRitual } from '../domain/dojoDay'
import type { ConvictionLevel, Direction, OptionType, PlanCounts, Segment, SizingInput } from '../domain/tradeGate'

export type { DojoDay, DojoRitual } from '../domain/dojoDay'
export type { BacktestInput, BacktestResults } from '../domain/backtest'

/** A saved backtest log, with its calculated results. */
export interface BacktestLog extends BacktestInput, BacktestResults {
  id: number
  createdAt: string
  updatedAt: string
}

export interface BacktestFilters {
  segment?: Segment
  setupType?: SetupType
  outcome?: PnlCategory
  from?: IsoDate
  to?: IsoDate
}

export class DojoApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface TradeGateStatus {
  readiness: 'not_available'
  locks: 'not_available'
  counts: PlanCounts
  weeklyCap: number
  monthlyCap: number
  capReasons: string[]
}

export interface LogTradePlanInput {
  sizing: SizingInput
  lossAccepted: boolean
  slWithin30Seconds: boolean
}

export interface TradePlan {
  id: string
  date: IsoDate
  createdAt: string
  instrument: string
  segment: Segment
  /** Options only: CE or PE. Null for futures and equity. */
  optionType: OptionType | null
  direction: Direction
  conviction: ConvictionLevel
  capital: number
  entry: number
  stopLoss: number
  target: number
  lotSize: number | null
  quantity: number
  lots: number | null
  actualRisk: number
  rewardRisk: number
  rulesVersion: number
}

/** How often a ritual applies. `weekdays` uses `weekdays`; `monthly` uses `monthlyLastMarketDays`. */
export type RitualSchedule = 'daily' | 'weekdays' | 'weekend' | 'monthly'

/** A ritual definition as it applies on one date. Edits always apply from today. */
export interface RitualDefinition {
  key: string
  label: string
  minutes: number
  schedule: RitualSchedule
  /** 0 = Sunday ... 6 = Saturday, for the `weekdays` schedule. */
  weekdays: number[] | null
  /** 1 to 5, for the `monthly` schedule. */
  monthlyLastMarketDays: number | null
  countsForStreak: boolean
  sortOrder: number
  validFrom: IsoDate
  validTo: IsoDate | null
}

export interface RitualInput {
  label: string
  minutes: number
  schedule: RitualSchedule
  weekdays: number[] | null
  monthlyLastMarketDays: number | null
  countsForStreak: boolean
}

/**
 * One day in the History calendar, shared by the month, week and year views.
 * Counts are for daily rituals only.
 */
export interface MonthDay {
  date: IsoDate
  marketDay: boolean
  /** After today. Never counted and never clickable. */
  future: boolean
  /** On or after the tracker start. Days before it are never counted or coloured. */
  tracked: boolean
  /** Inside the edit window and tracked, so its ticks can change. */
  editable: boolean
  dailyTotal: number
  dailyDone: number
  /** At least the streak minimum of daily rituals. Weekends are coloured too. */
  onTrack: boolean
  /** Every daily ritual done. */
  full: boolean
}

/** Totals over market days that are tracked and already over. */
export interface CalendarSummary {
  marketDays: number
  onTrackDays: number
  fullDays: number
}

export interface MonthView {
  /** `YYYY-MM` */
  month: string
  /** Previous month, or null before the first tracked month. */
  prevMonth: string | null
  /** Next month, or null after the current month. */
  nextMonth: string | null
  days: MonthDay[]
  summary: CalendarSummary
}

/** A day in the Week view, with its checklist. */
export interface WeekDay extends MonthDay {
  rituals: DojoRitual[]
}

export interface WeekView {
  /** Monday, `YYYY-MM-DD`. */
  weekStart: IsoDate
  /** Sunday, `YYYY-MM-DD`. */
  weekEnd: IsoDate
  /** Previous week's Monday, or null before the first tracked week. */
  prevWeek: IsoDate | null
  /** Next week's Monday, or null after the current week. */
  nextWeek: IsoDate | null
  days: WeekDay[]
  summary: CalendarSummary
}

export interface YearView {
  year: number
  /** Previous year, or null when it has no tracked days. */
  prevYear: number | null
  /** Next year, or null after the current year. */
  nextYear: number | null
  days: MonthDay[]
  summary: CalendarSummary
}

/** Market-day totals for one month, for the growth chart. */
export interface GrowthMonth {
  /** `YYYY-MM` */
  month: string
  marketDays: number
  onTrackDays: number
  fullDays: number
}

/**
 * Contract shared by the browser-storage implementation and the `/api/v1` backend.
 * Pages depend only on this interface.
 */
export interface DojoApi {
  today(): IsoDate
  getDojoDay(date: IsoDate): Promise<DojoDay>
  getMonth(month: string): Promise<MonthView>
  /** `weekStart` must be a Monday, `YYYY-MM-DD`. */
  getWeek(weekStart: IsoDate): Promise<WeekView>
  getYear(year: number): Promise<YearView>
  getGrowth(): Promise<GrowthMonth[]>
  toggleRitual(date: IsoDate, ritualId: string): Promise<DojoDay>
  listRituals(date: IsoDate): Promise<RitualDefinition[]>
  createRitual(input: RitualInput): Promise<RitualDefinition>
  updateRitual(key: string, input: RitualInput): Promise<RitualDefinition>
  retireRitual(key: string): Promise<void>
  reorderRituals(keys: string[]): Promise<RitualDefinition[]>
  getTradeGateStatus(): Promise<TradeGateStatus>
  logTradePlan(input: LogTradePlanInput): Promise<TradePlan>
  listBacktests(filters?: BacktestFilters): Promise<BacktestLog[]>
  createBacktest(input: BacktestInput): Promise<BacktestLog>
  updateBacktest(id: number, input: BacktestInput): Promise<BacktestLog>
  deleteBacktest(id: number): Promise<void>
}
