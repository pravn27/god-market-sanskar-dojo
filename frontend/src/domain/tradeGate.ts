import { addDays, dayOfWeek, type IsoDate } from './dates'

/** `trade_gate` in the ASTA rules catalogue. */
export const TRADE_GATE_RULES = {
  version: 1,
  maxRiskPct: 2,
  minRewardRisk: 3,
  weeklyTradeCap: 3,
  monthlyTradeCap: 12,
} as const

export type ConvictionLevel = 'below_low' | 'low' | 'medium' | 'high' | 'above_high'

export const CONVICTION_LEVELS: { id: ConvictionLevel; label: string; pct: number }[] = [
  { id: 'below_low', label: 'Below Low', pct: 0.25 },
  { id: 'low', label: 'Low', pct: 0.5 },
  { id: 'medium', label: 'Medium', pct: 1 },
  { id: 'high', label: 'High', pct: 1.5 },
  { id: 'above_high', label: 'Above High', pct: 1.75 },
]

/** What is traded. Futures and options both use lots; equity uses shares. */
export type Segment = 'equity' | 'futures' | 'options'
/** Buy or sell of the traded instrument. Buying or selling an option trades its premium. */
export type Side = 'buy' | 'sell'
/** Options only: the market view. It does not change the side (buying a PE is still a buy of the premium). */
export type OptionType = 'CE' | 'PE'
export type Direction = 'long' | 'short'

export interface SizingInput {
  instrument: string
  segment: Segment
  side: Side
  /** Required for options; null otherwise. */
  optionType: OptionType | null
  capital: number | null
  conviction: ConvictionLevel
  entry: number | null
  stopLoss: number | null
  target: number | null
  lotSize: number | null
}

export interface SizingResult {
  direction: Direction
  errors: string[]
  riskAllowed: number
  riskPerUnit: number
  /** Equity: shares. F&O: lots x lot size. */
  quantity: number
  lots: number | null
  maxByEntry: number | null
  actualRisk: number
  investment: number | null
  rewardRisk: number | null
  rewardRiskOk: boolean
  adjustedEntry: number | null
}

/** Buy is long and sell is short for every instrument, because options are traded on their premium. */
export function directionFor(side: Side): Direction {
  return side === 'buy' ? 'long' : 'short'
}

const positive = (value: number | null): value is number => value !== null && Number.isFinite(value) && value > 0

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function adjustedEntryFor(direction: Direction, stopLoss: number, target: number): number {
  const part = Math.abs(target - stopLoss) / (TRADE_GATE_RULES.minRewardRisk + 1)
  return round2(direction === 'long' ? stopLoss + part : stopLoss - part)
}

export function evaluateSizing(input: SizingInput): SizingResult {
  const direction = directionFor(input.side)
  const isFno = input.segment !== 'equity'
  const errors: string[] = []
  const empty: SizingResult = {
    direction, errors, riskAllowed: 0, riskPerUnit: 0, quantity: 0, lots: null, maxByEntry: null,
    actualRisk: 0, investment: null, rewardRisk: null, rewardRiskOk: false, adjustedEntry: null,
  }

  if (!input.instrument.trim()) errors.push('Enter the instrument.')
  if (!positive(input.capital)) errors.push('Enter capital greater than 0.')
  if (!positive(input.entry) || !positive(input.stopLoss) || !positive(input.target)) {
    errors.push('Enter entry, stop loss, and target greater than 0.')
  }
  if (isFno && !(positive(input.lotSize) && Number.isInteger(input.lotSize))) errors.push('Enter a whole lot size.')
  if (input.segment === 'options' && input.optionType === null) errors.push('Choose CE or PE for options.')
  if (errors.length > 0) return empty

  const capital = input.capital as number
  const entry = input.entry as number
  const stopLoss = input.stopLoss as number
  const target = input.target as number

  const ordered = direction === 'long' ? stopLoss < entry && entry < target : target < entry && entry < stopLoss
  if (!ordered) {
    errors.push(direction === 'long'
      ? 'For a long trade: stop loss < entry < target.'
      : 'For a short trade: target < entry < stop loss.')
    return empty
  }

  const pct = CONVICTION_LEVELS.find((c) => c.id === input.conviction)?.pct ?? 0
  const riskAllowed = round2((capital * pct) / 100)
  const riskPerUnit = round2(Math.abs(entry - stopLoss))
  const rewardRisk = round2(Math.abs(target - entry) / Math.abs(entry - stopLoss))
  const rewardRiskOk = rewardRisk >= TRADE_GATE_RULES.minRewardRisk

  let quantity: number
  let lots: number | null = null
  let maxByEntry: number | null = null
  let investment: number | null = null
  if (isFno) {
    const lotSize = input.lotSize as number
    lots = Math.floor(riskAllowed / (riskPerUnit * lotSize))
    quantity = lots * lotSize
  } else {
    maxByEntry = Math.floor(capital / entry)
    quantity = Math.min(Math.floor(riskAllowed / riskPerUnit), maxByEntry)
    investment = round2(quantity * entry)
  }

  const actualRisk = round2(quantity * riskPerUnit)
  if (quantity === 0) errors.push('Stop loss is too wide for this conviction: quantity is 0.')
  if (actualRisk > (capital * TRADE_GATE_RULES.maxRiskPct) / 100) errors.push('Risk exceeds 2% of capital.')
  if (!rewardRiskOk) errors.push(`Reward to risk is 1:${rewardRisk}; the minimum is 1:${TRADE_GATE_RULES.minRewardRisk}.`)

  return {
    direction, errors, riskAllowed, riskPerUnit, quantity, lots, maxByEntry, actualRisk, investment,
    rewardRisk, rewardRiskOk, adjustedEntry: rewardRiskOk ? null : adjustedEntryFor(direction, stopLoss, target),
  }
}

/** Monday of the week containing `date`. */
export function weekStart(date: IsoDate): IsoDate {
  return addDays(date, -((dayOfWeek(date) + 6) % 7))
}

export interface PlanCounts {
  weekly: number
  monthly: number
}

export function countPlans(planDates: IsoDate[], today: IsoDate): PlanCounts {
  const monday = weekStart(today)
  const sunday = addDays(monday, 6)
  const month = today.slice(0, 7)
  return {
    weekly: planDates.filter((d) => d >= monday && d <= sunday).length,
    monthly: planDates.filter((d) => d.slice(0, 7) === month).length,
  }
}

export interface RiskRangeRow {
  id: ConvictionLevel | 'max'
  label: string
  pct: number
  /** Risk allowed in rupees for the capital; null when capital is missing. */
  amount: number | null
}

/** Risk range table: each conviction level plus the maximum, for the given capital. */
export function riskRangeRows(capital: number | null): RiskRangeRow[] {
  const amountFor = (pct: number): number | null => (positive(capital) ? round2((capital * pct) / 100) : null)
  return [
    ...CONVICTION_LEVELS.map((c) => ({ id: c.id, label: c.label, pct: c.pct, amount: amountFor(c.pct) })),
    { id: 'max' as const, label: 'Maximum', pct: TRADE_GATE_RULES.maxRiskPct, amount: amountFor(TRADE_GATE_RULES.maxRiskPct) },
  ]
}

/** Conviction levels plus the maximum risk, in table order. */
const RANGE_LEVELS: { id: ConvictionLevel | 'max'; label: string; pct: number }[] = [
  ...CONVICTION_LEVELS,
  { id: 'max', label: 'Maximum', pct: TRADE_GATE_RULES.maxRiskPct },
]

export interface ShareRangeRow {
  id: ConvictionLevel | 'max'
  label: string
  /** Whole shares: risk allowed / risk per share, capped by what the capital buys at entry. */
  shares: number | null
  /** Shares x entry. */
  amount: number | null
}

/** Shares allowed at each conviction level and at the maximum risk (equity). Empty until capital, entry and stop loss are valid. */
export function shareRangeRows(capital: number | null, entry: number | null, stopLoss: number | null): ShareRangeRow[] {
  const empty = () => RANGE_LEVELS.map((l) => ({ id: l.id, label: l.label, shares: null, amount: null }))
  if (!positive(capital) || !positive(entry) || !positive(stopLoss)) return empty()
  const riskPerShare = round2(Math.abs(entry - stopLoss))
  if (riskPerShare === 0) return empty()
  const cap: number = capital
  const price: number = entry
  return RANGE_LEVELS.map((l) => {
    const riskAllowed = round2((cap * l.pct) / 100)
    const shares = Math.min(Math.floor(riskAllowed / riskPerShare), Math.floor(cap / price))
    return { id: l.id, label: l.label, shares, amount: round2(shares * price) }
  })
}

export interface LotRangeRow {
  id: ConvictionLevel | 'max'
  label: string
  /** Whole lots: risk allowed / (risk per unit x lot size). Same rule as the F&O sizing. */
  lots: number | null
}

/** Lots allowed at each conviction level and at the maximum risk (F&O). Empty until capital, entry, stop loss and lot size are valid. */
export function lotRangeRows(
  capital: number | null,
  entry: number | null,
  stopLoss: number | null,
  lotSize: number | null,
): LotRangeRow[] {
  const empty = () => RANGE_LEVELS.map((l) => ({ id: l.id, label: l.label, lots: null }))
  if (!positive(capital) || !positive(entry) || !positive(stopLoss) || !positive(lotSize) || !Number.isInteger(lotSize)) {
    return empty()
  }
  const riskPerUnit = round2(Math.abs(entry - stopLoss))
  if (riskPerUnit === 0) return empty()
  const cap: number = capital
  const lot: number = lotSize
  return RANGE_LEVELS.map((l) => {
    const riskAllowed = round2((cap * l.pct) / 100)
    const lots = Math.floor(riskAllowed / (riskPerUnit * lot))
    return { id: l.id, label: l.label, lots }
  })
}

export function capReasons(counts: PlanCounts): string[] {
  const reasons: string[] = []
  if (counts.weekly >= TRADE_GATE_RULES.weeklyTradeCap) reasons.push(`Weekly cap reached (${TRADE_GATE_RULES.weeklyTradeCap} plans).`)
  if (counts.monthly >= TRADE_GATE_RULES.monthlyTradeCap) reasons.push(`Monthly cap reached (${TRADE_GATE_RULES.monthlyTradeCap} plans).`)
  return reasons
}
