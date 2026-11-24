import { daysSinceEpoch, type IsoDate } from './dates'
import type { OptionType, Segment, Side } from './tradeGate'

/**
 * Backtest log rules, mirrored from the backend (`backtests.py` and `models.py`).
 * The backend is the authority on save; these checks let the form explain a problem before it is sent.
 * See docs/specifications/backtest-log.md.
 */
export const BACKTEST_RULES = {
  minRewardRisk: 3,
  // The target the R:R minimum is measured to.
  rrBasis: 'target_1',
} as const

export type SetupFamily = 'swing' | 'momentum'

export type SetupType =
  | 'rd_bullish'
  | 'rd_bearish'
  | 'fbd'
  | 'double_top'
  | 'double_bottom'
  | 'third_wave'
  | 'other'

export type Timeframe = '5min' | '15min' | '30min' | '1hr' | '4hr' | 'daily' | 'weekly' | 'monthly'

export type ExitReason = 'planned_target' | 'planned_stop' | 'trail_stop' | 'view_invalidated' | 'early_book' | 'other'

export type PnlCategory = 'win' | 'loss' | 'breakeven'

export const SETUP_TYPES: { id: SetupType; label: string; family: SetupFamily }[] = [
  { id: 'rd_bullish', label: 'RD bullish', family: 'swing' },
  { id: 'rd_bearish', label: 'RD bearish', family: 'swing' },
  { id: 'fbd', label: 'FBD', family: 'swing' },
  { id: 'double_top', label: 'Double top', family: 'swing' },
  { id: 'double_bottom', label: 'Double bottom', family: 'swing' },
  { id: 'third_wave', label: '3rd wave', family: 'momentum' },
  { id: 'other', label: 'Other', family: 'swing' },
]

export const SETUP_FAMILIES: { id: SetupFamily; label: string }[] = [
  { id: 'swing', label: 'Swing' },
  { id: 'momentum', label: 'Momentum' },
]

export const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: '5min', label: '5 min' },
  { id: '15min', label: '15 min' },
  { id: '30min', label: '30 min' },
  { id: '1hr', label: '1 hour' },
  { id: '4hr', label: '4 hour' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

export const EXIT_REASONS: { id: ExitReason; label: string }[] = [
  { id: 'planned_target', label: 'Planned target hit' },
  { id: 'planned_stop', label: 'Planned stop hit' },
  { id: 'trail_stop', label: 'Trailing stop hit' },
  { id: 'view_invalidated', label: 'View invalidated' },
  { id: 'early_book', label: 'Booked early' },
  { id: 'other', label: 'Other' },
]

export interface ChecklistItem {
  id: string
  label: string
}

/**
 * Checklist items for setups whose conditions are defined (from the Backtesting template).
 * Double top, double bottom and 3rd wave have no items yet; see the spec's open items.
 */
export const CHECKLISTS: Partial<Record<SetupType, ChecklistItem[]>> = {
  rd_bullish: [
    { id: 'find_macd_peak', label: 'MACD peak found (significant top, 3rd wave end)' },
    { id: 'mark_previous_hl', label: 'Previous higher low marked after the MACD peak' },
    { id: 'macd_near_zero', label: 'MACD price near the zero line (4th wave end)' },
    { id: 'context_tide_wave', label: 'Context in tide or wave timeframe' },
    { id: 'concept_setup', label: 'Concept or setup in wave timeframe' },
    { id: 'confirmation_weapon', label: 'Confirmation or weapon in wave timeframe' },
    { id: 'rr_minimum', label: 'Reward to risk meets the minimum' },
    { id: 'retracement_23_38_50', label: 'Retracement 23%, 38% or 50%, no more than 50%' },
    { id: 'support_level', label: 'Price at a significant support level' },
    { id: 'weapon_above_5ema', label: 'Weapon candle closed above the 5 EMA' },
    { id: 'price_upper_bb', label: 'Price in the upper half of the Bollinger Bands' },
    { id: 'rsi_40_60', label: 'RSI between 40 and 60, above 50 is good' },
    { id: 'bullish_divergence', label: 'Normal bullish divergence in the lower timeframe' },
    { id: 'chart_pattern', label: 'Chart pattern (SMM or PAPA setup)' },
  ],
  rd_bearish: [
    { id: 'find_macd_peak', label: 'MACD peak found (significant bottom, 3rd wave end)' },
    { id: 'mark_previous_lh', label: 'Previous lower high marked after the MACD peak' },
    { id: 'macd_near_zero', label: 'MACD price near the zero line (4th wave end)' },
    { id: 'context_tide_wave', label: 'Context in tide or wave timeframe' },
    { id: 'concept_setup', label: 'Concept or setup in wave timeframe' },
    { id: 'confirmation_weapon', label: 'Confirmation or weapon in wave timeframe' },
    { id: 'rr_minimum', label: 'Reward to risk meets the minimum' },
    { id: 'retracement_23_38_50', label: 'Retracement 23%, 38% or 50%, no more than 50%' },
    { id: 'resistance_level', label: 'Price at a significant resistance level' },
    { id: 'weapon_below_5ema', label: 'Weapon candle closed below the 5 EMA' },
    { id: 'price_lower_bb', label: 'Price in the lower half of the Bollinger Bands' },
    { id: 'rsi_40_60', label: 'RSI between 40 and 60, below 50 is good' },
    { id: 'bearish_divergence', label: 'Normal bearish divergence in the lower timeframe' },
    { id: 'chart_pattern', label: 'Chart pattern (SMM or PAPA setup)' },
  ],
  fbd: [
    { id: 'bb_not_challenged', label: 'Bollinger Band not challenged on the downside' },
    { id: 'prev_low_reclaimed', label: 'Price broke the previous low and closed above it' },
    { id: 'follow_up_candle', label: 'Follow-up candle broke above the BD candle high' },
    { id: 'lbbcf_bkp', label: 'LBBCF with BKP' },
    { id: 'reversal_candle', label: 'Bullish reversal candlestick pattern' },
    { id: 'ha_red_to_green', label: 'Heikin-Ashi candle changed from red to green' },
    { id: 'macd_uptick', label: 'MACD uptick' },
    { id: 'rsi_above_40', label: 'RSI above 40' },
    { id: 'stoch_pco', label: 'Stochastic PCO' },
    { id: 'di_converging', label: 'DI and -DI converging' },
    { id: 'significant_fall', label: 'Significant fall before the first fall' },
    { id: 'wave_divergence', label: 'Divergence on the wave (stochastic and/or RSI)' },
    { id: 'end_fifth_or_flat', label: 'End of 5th wave or flat correction' },
    { id: 'no_sobbo', label: 'No SOBBO' },
  ],
}

/** The form's working state. Numbers are null until typed; dates and times are `YYYY-MM-DD` / `HH:MM` strings. */
export interface BacktestDraft {
  segment: Segment
  side: Side
  setupFamily: SetupFamily
  setupType: SetupType
  pattern: string
  instrument: string
  optionType: OptionType | null
  strike: number | null
  expiryDate: string
  lotSize: number | null
  lots: number | null
  /** Equity only: shares. For F&O the quantity is lots x lot size. */
  quantity: number | null
  tideTf: Timeframe | null
  waveTf: Timeframe | null
  rippleTf: Timeframe | null
  entryDate: string
  entryTime: string
  entryPrice: number | null
  entryCriteria: string
  stopLoss: number | null
  target1: number | null
  target2: number | null
  exitDate: string
  exitTime: string
  exitPrice: number | null
  exitReason: ExitReason | null
  exitCriteria: string
  capital: number | null
  spotPrice: number | null
  marginUsed: number | null
  observations: string
  chartLink: string
  lesson: string
  /** Checklist ticks by item id. Only the current setup's items are sent. */
  ticks: Record<string, boolean>
}

export function familyFor(setupType: SetupType): SetupFamily {
  return SETUP_TYPES.find((setup) => setup.id === setupType)?.family ?? 'swing'
}

export function emptyDraft(segment: Segment = 'futures'): BacktestDraft {
  return {
    segment,
    side: 'buy',
    setupFamily: 'swing',
    setupType: 'rd_bullish',
    pattern: '',
    instrument: '',
    optionType: null,
    strike: null,
    expiryDate: '',
    lotSize: null,
    lots: null,
    quantity: null,
    tideTf: null,
    waveTf: null,
    rippleTf: null,
    entryDate: '',
    entryTime: '',
    entryPrice: null,
    entryCriteria: '',
    stopLoss: null,
    target1: null,
    target2: null,
    exitDate: '',
    exitTime: '',
    exitPrice: null,
    exitReason: null,
    exitCriteria: '',
    capital: null,
    spotPrice: null,
    marginUsed: null,
    observations: '',
    chartLink: '',
    lesson: '',
    ticks: {},
  }
}

/** The quantity that will be saved: lots x lot size for F&O, shares for equity. Null until it is known. */
export function quantityOf(draft: BacktestDraft): number | null {
  if (draft.segment === 'equity') return draft.quantity
  if (draft.lots === null || draft.lotSize === null) return null
  return draft.lots * draft.lotSize
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

const positiveNumber = (value: number | null): value is number => value !== null && Number.isFinite(value) && value > 0
const wholeNumber = (value: number | null): value is number => positiveNumber(value) && Number.isInteger(value)

/** Every reason the draft cannot be saved yet. Empty when it can. Same order and wording as the backend. */
export function validateDraft(draft: BacktestDraft): string[] {
  const errors: string[] = []
  const add = (message: string) => errors.push(message)
  const { segment, side } = draft

  if (!draft.instrument.trim()) add('instrument must not be blank')

  if (segment === 'equity') {
    if (!wholeNumber(draft.quantity)) add('equity needs quantity (shares)')
    const extra = (['optionType', 'strike', 'expiryDate', 'lotSize', 'lots'] as const).filter(
      (key) => draft[key] !== null && draft[key] !== '',
    )
    if (extra.length > 0) add(`equity does not use: ${extra.join(', ')}`)
  } else {
    if (segment === 'options' && (draft.optionType === null || !positiveNumber(draft.strike))) {
      add('options need option_type (CE or PE) and strike')
    }
    if (segment === 'futures' && (draft.optionType !== null || draft.strike !== null)) {
      add('futures does not use: option_type, strike')
    }
    if (!DATE.test(draft.expiryDate) || !wholeNumber(draft.lotSize) || !wholeNumber(draft.lots)) {
      add(`${segment} needs expiry_date, lot_size and lots`)
    }
  }

  if (!positiveNumber(draft.entryPrice)) add('entry price must be above 0')
  if (!positiveNumber(draft.stopLoss)) add('stop loss must be above 0')
  if (!positiveNumber(draft.target1)) add('target 1 must be above 0')
  if (draft.target2 !== null && !positiveNumber(draft.target2)) add('target 2 must be above 0')

  if (positiveNumber(draft.entryPrice) && positiveNumber(draft.stopLoss) && positiveNumber(draft.target1)) {
    const entry = draft.entryPrice
    const stop = draft.stopLoss
    const target1 = draft.target1
    if (side === 'buy' && !(stop < entry && entry < target1)) {
      add('for a buy, stop loss must be below entry and target 1 above entry')
    }
    if (side === 'sell' && !(stop > entry && entry > target1)) {
      add('for a sell, stop loss must be above entry and target 1 below entry')
    }
    if (draft.target2 !== null) {
      const beyond = side === 'buy' ? draft.target2 > target1 : draft.target2 < target1
      if (!beyond) add("target 2 must lie beyond target 1 in the trade's direction")
    }
    const rr = reward1RiskRatio(draft)
    if (rr === null || rr < BACKTEST_RULES.minRewardRisk - 1e-9) {
      add(`R:R is ${rr === null ? 'none' : rr.toFixed(2)}; the minimum is 1:${BACKTEST_RULES.minRewardRisk}`)
    }
  }

  if (!positiveNumber(draft.capital)) add('capital must be above 0')
  if (!DATE.test(draft.entryDate)) add('entry date is required')
  if (!DATE.test(draft.exitDate)) add('exit date is required')
  if (DATE.test(draft.entryDate) && DATE.test(draft.exitDate)) {
    if (draft.exitDate < draft.entryDate) add('exit date must not be before entry date')
    if (draft.exitDate === draft.entryDate && TIME.test(draft.entryTime) && TIME.test(draft.exitTime)) {
      if (draft.exitTime < draft.entryTime) add('exit time must not be before entry time on the same day')
    }
  }
  if (draft.entryTime && !TIME.test(draft.entryTime)) add('entry time must be HH:MM on a 24-hour clock')
  if (draft.exitTime && !TIME.test(draft.exitTime)) add('exit time must be HH:MM on a 24-hour clock')

  if (!positiveNumber(draft.exitPrice)) add('exit price must be above 0')
  if (draft.exitReason === null) add('choose an exit reason')
  if (!draft.entryCriteria.trim()) add('entry_criteria must not be blank')
  if (!draft.lesson.trim()) add('lesson must not be blank')

  return errors
}

/** Reward to risk to the target named by `BACKTEST_RULES.rrBasis`. Null when there is no risk or no target. */
export function reward1RiskRatio(draft: BacktestDraft): number | null {
  const target = BACKTEST_RULES.rrBasis === 'target_1' ? draft.target1 : draft.target2
  if (!positiveNumber(draft.entryPrice) || !positiveNumber(draft.stopLoss) || !positiveNumber(target)) return null
  const risk = Math.abs(draft.entryPrice - draft.stopLoss)
  if (risk <= 0) return null
  const sign = draft.side === 'buy' ? 1 : -1
  return (sign * (target - draft.entryPrice)) / risk
}

export interface BacktestResults {
  riskPerUnit: number
  riskTaken: number
  reward1: number
  rr1: number | null
  reward2: number | null
  rr2: number | null
  points: number
  pnl: number
  pct: number
  roi: number
  holdingDays: number
  pnlCategory: PnlCategory
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** The calculated results for a complete draft, or null while a required number is missing. */
export function calculateDraft(draft: BacktestDraft): BacktestResults | null {
  const quantity = quantityOf(draft)
  if (!positiveNumber(draft.entryPrice) || !positiveNumber(draft.stopLoss) || !positiveNumber(draft.target1)) return null
  if (!positiveNumber(draft.exitPrice) || !positiveNumber(draft.capital) || quantity === null) return null
  if (!DATE.test(draft.entryDate) || !DATE.test(draft.exitDate)) return null

  const sign = draft.side === 'buy' ? 1 : -1
  const entry = draft.entryPrice
  const riskPerUnit = Math.abs(entry - draft.stopLoss)
  const reward1 = sign * (draft.target1 - entry)
  const reward2 = positiveNumber(draft.target2) ? sign * (draft.target2 - entry) : null
  const points = sign * (draft.exitPrice - entry)
  const pnl = points * quantity
  const pnlCategory: PnlCategory = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven'

  return {
    riskPerUnit: round2(riskPerUnit),
    riskTaken: round2(riskPerUnit * quantity),
    reward1: round2(reward1),
    rr1: riskPerUnit > 0 ? round2(reward1 / riskPerUnit) : null,
    reward2: reward2 === null ? null : round2(reward2),
    rr2: reward2 !== null && riskPerUnit > 0 ? round2(reward2 / riskPerUnit) : null,
    points: round2(points),
    pnl: round2(pnl),
    pct: round2((points / entry) * 100),
    roi: round2((pnl / draft.capital) * 100),
    holdingDays: daysSinceEpoch(draft.exitDate) - daysSinceEpoch(draft.entryDate),
    pnlCategory,
  }
}

/** The checklist ticks to send, one per item of the setup. Empty for setups without items. */
export function checksFor(draft: BacktestDraft): { itemId: string; ticked: boolean }[] {
  return (CHECKLISTS[draft.setupType] ?? []).map((item) => ({ itemId: item.id, ticked: draft.ticks[item.id] === true }))
}

/** The body sent to the backend. Only call once `validateDraft` returns no errors. */
export interface BacktestInput {
  segment: Segment
  side: Side
  setupFamily: SetupFamily
  setupType: SetupType
  pattern: string | null
  instrument: string
  optionType: OptionType | null
  strike: number | null
  expiryDate: IsoDate | null
  lotSize: number | null
  lots: number | null
  quantity: number
  tideTf: Timeframe | null
  waveTf: Timeframe | null
  rippleTf: Timeframe | null
  entryDate: IsoDate
  entryTime: string | null
  entryPrice: number
  entryCriteria: string
  stopLoss: number
  target1: number
  target2: number | null
  exitDate: IsoDate
  exitTime: string | null
  exitPrice: number
  exitReason: ExitReason
  exitCriteria: string | null
  capital: number
  spotPrice: number | null
  marginUsed: number | null
  observations: string | null
  chartLink: string | null
  lesson: string
  checks: { itemId: string; ticked: boolean }[]
}

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim())

/** Converts a draft to the request body. Returns null while the draft is not valid. */
export function toBacktestInput(draft: BacktestDraft): BacktestInput | null {
  if (validateDraft(draft).length > 0) return null
  const quantity = quantityOf(draft)
  if (quantity === null || draft.entryPrice === null || draft.stopLoss === null || draft.target1 === null) return null
  if (draft.exitPrice === null || draft.exitReason === null || draft.capital === null) return null
  const fno = draft.segment !== 'equity'
  return {
    segment: draft.segment,
    side: draft.side,
    setupFamily: draft.setupFamily,
    setupType: draft.setupType,
    pattern: blankToNull(draft.pattern),
    instrument: draft.instrument.trim(),
    optionType: draft.segment === 'options' ? draft.optionType : null,
    strike: draft.segment === 'options' ? draft.strike : null,
    expiryDate: fno ? draft.expiryDate : null,
    lotSize: fno ? draft.lotSize : null,
    lots: fno ? draft.lots : null,
    quantity,
    tideTf: draft.tideTf,
    waveTf: draft.waveTf,
    rippleTf: draft.rippleTf,
    entryDate: draft.entryDate,
    entryTime: blankToNull(draft.entryTime),
    entryPrice: draft.entryPrice,
    entryCriteria: draft.entryCriteria.trim(),
    stopLoss: draft.stopLoss,
    target1: draft.target1,
    target2: draft.target2,
    exitDate: draft.exitDate,
    exitTime: blankToNull(draft.exitTime),
    exitPrice: draft.exitPrice,
    exitReason: draft.exitReason,
    exitCriteria: blankToNull(draft.exitCriteria),
    capital: draft.capital,
    spotPrice: draft.spotPrice,
    marginUsed: draft.marginUsed,
    observations: blankToNull(draft.observations),
    chartLink: blankToNull(draft.chartLink),
    lesson: draft.lesson.trim(),
    checks: checksFor(draft),
  }
}

/** A draft from a saved log, for editing it. */
export function draftFromInput(input: BacktestInput): BacktestDraft {
  const ticks: Record<string, boolean> = {}
  for (const check of input.checks) ticks[check.itemId] = check.ticked
  return {
    segment: input.segment,
    side: input.side,
    setupFamily: input.setupFamily,
    setupType: input.setupType,
    pattern: input.pattern ?? '',
    instrument: input.instrument,
    optionType: input.optionType,
    strike: input.strike,
    expiryDate: input.expiryDate ?? '',
    lotSize: input.lotSize,
    lots: input.lots,
    quantity: input.segment === 'equity' ? input.quantity : null,
    tideTf: input.tideTf,
    waveTf: input.waveTf,
    rippleTf: input.rippleTf,
    entryDate: input.entryDate,
    entryTime: input.entryTime ?? '',
    entryPrice: input.entryPrice,
    entryCriteria: input.entryCriteria,
    stopLoss: input.stopLoss,
    target1: input.target1,
    target2: input.target2,
    exitDate: input.exitDate,
    exitTime: input.exitTime ?? '',
    exitPrice: input.exitPrice,
    exitReason: input.exitReason,
    exitCriteria: input.exitCriteria ?? '',
    capital: input.capital,
    spotPrice: input.spotPrice,
    marginUsed: input.marginUsed,
    observations: input.observations ?? '',
    chartLink: input.chartLink ?? '',
    lesson: input.lesson,
    ticks,
  }
}

/** The fields a Trade Gate plan can supply. Everything else is typed on the backtest page. */
export interface PlanPrefill {
  date: IsoDate
  instrument: string
  segment: Segment
  direction: 'long' | 'short'
  optionType: OptionType | null
  capital: number
  entry: number
  stopLoss: number
  target: number
  lotSize: number | null
  lots: number | null
  quantity: number
}

/** A new draft from a Trade Gate plan. The contract details that the plan lacks are left blank. */
export function draftFromPlan(plan: PlanPrefill): BacktestDraft {
  return {
    ...emptyDraft(plan.segment),
    side: plan.direction === 'long' ? 'buy' : 'sell',
    instrument: plan.instrument,
    optionType: plan.segment === 'options' ? plan.optionType : null,
    lotSize: plan.segment === 'equity' ? null : plan.lotSize,
    lots: plan.segment === 'equity' ? null : plan.lots,
    quantity: plan.segment === 'equity' ? plan.quantity : null,
    entryDate: plan.date,
    entryPrice: plan.entry,
    stopLoss: plan.stopLoss,
    target1: plan.target,
    capital: plan.capital,
  }
}
