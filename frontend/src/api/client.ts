import type { IsoDate } from '../domain/dates'
import type { DojoDay } from '../domain/dojoDay'
import type { ConvictionLevel, Direction, PlanCounts, Segment, SizingInput } from '../domain/tradeGate'

export type { DojoDay, DojoRitual } from '../domain/dojoDay'

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

/** One day in the History calendar. Counts are for daily rituals only. */
export interface MonthDay {
  date: IsoDate
  marketDay: boolean
  /** After today. Never counted and never clickable. */
  future: boolean
  dailyTotal: number
  dailyDone: number
  /** Market day with at least the streak minimum of daily rituals. */
  onTrack: boolean
  /** Market day with every daily ritual done. */
  full: boolean
}

export interface MonthView {
  /** `YYYY-MM` */
  month: string
  /** Previous month, or null before the first tracked month. */
  prevMonth: string | null
  /** Next month, or null after the current month. */
  nextMonth: string | null
  days: MonthDay[]
  summary: {
    marketDays: number
    onTrackDays: number
    fullDays: number
  }
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
  getGrowth(): Promise<GrowthMonth[]>
  toggleRitual(date: IsoDate, ritualId: string): Promise<DojoDay>
  listRituals(date: IsoDate): Promise<RitualDefinition[]>
  createRitual(input: RitualInput): Promise<RitualDefinition>
  updateRitual(key: string, input: RitualInput): Promise<RitualDefinition>
  retireRitual(key: string): Promise<void>
  reorderRituals(keys: string[]): Promise<RitualDefinition[]>
  getTradeGateStatus(): Promise<TradeGateStatus>
  logTradePlan(input: LogTradePlanInput): Promise<TradePlan>
}
