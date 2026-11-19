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

/**
 * Contract shared by the browser-storage implementation and the future `/api/v1` backend.
 * Pages depend only on this interface.
 */
export interface DojoApi {
  today(): IsoDate
  getDojoDay(date: IsoDate): Promise<DojoDay>
  toggleRitual(date: IsoDate, ritualId: string): Promise<DojoDay>
  getTradeGateStatus(): Promise<TradeGateStatus>
  logTradePlan(input: LogTradePlanInput): Promise<TradePlan>
}
