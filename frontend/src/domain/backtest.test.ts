import { describe, expect, it } from 'vitest'

import {
  type BacktestDraft,
  calculateDraft,
  checksFor,
  draftFromPlan,
  emptyDraft,
  quantityOf,
  reward1RiskRatio,
  toBacktestInput,
  validateDraft,
} from './backtest'

/** A valid futures buy: 150 qty, 1:3 to target 1. */
function futuresBuy(overrides: Partial<BacktestDraft> = {}): BacktestDraft {
  return {
    ...emptyDraft('futures'),
    instrument: 'NIFTY',
    lotSize: 75,
    lots: 2,
    expiryDate: '2026-11-26',
    entryDate: '2026-11-18',
    entryPrice: 24000,
    stopLoss: 23900,
    target1: 24300,
    exitDate: '2026-11-20',
    exitPrice: 24250,
    exitReason: 'planned_target',
    entryCriteria: 'RD bullish on daily',
    lesson: 'Waited for the weapon candle',
    capital: 300000,
    ...overrides,
  }
}

function equityBuy(overrides: Partial<BacktestDraft> = {}): BacktestDraft {
  return {
    ...emptyDraft('equity'),
    instrument: 'RELIANCE',
    quantity: 20,
    entryDate: '2026-11-18',
    entryPrice: 3950,
    stopLoss: 3850,
    target1: 4250,
    exitDate: '2026-11-18',
    exitPrice: 4100,
    exitReason: 'early_book',
    entryCriteria: 'Support hold',
    lesson: 'Booked early',
    capital: 200000,
    ...overrides,
  }
}

describe('validateDraft', () => {
  it('accepts a complete futures buy', () => {
    expect(validateDraft(futuresBuy())).toEqual([])
  })

  it('needs quantity for equity', () => {
    expect(validateDraft(equityBuy({ quantity: null }))).toContain('equity needs quantity (shares)')
  })

  it('refuses equity that carries contract fields', () => {
    expect(validateDraft(equityBuy({ lots: 2 }))).toContain('equity does not use: lots')
  })

  it('needs option type and strike for options', () => {
    const errors = validateDraft({ ...futuresBuy(), segment: 'options', optionType: null, strike: null })
    expect(errors).toContain('options need option_type (CE or PE) and strike')
  })

  it('refuses option fields on futures', () => {
    expect(validateDraft(futuresBuy({ optionType: 'CE' }))).toContain('futures does not use: option_type, strike')
  })

  it('needs expiry, lot size and lots for futures', () => {
    expect(validateDraft(futuresBuy({ expiryDate: '' }))).toContain('futures needs expiry_date, lot_size and lots')
  })

  it('refuses a stop on the wrong side of entry for a buy', () => {
    const errors = validateDraft(futuresBuy({ stopLoss: 24100 }))
    expect(errors).toContain('for a buy, stop loss must be below entry and target 1 above entry')
  })

  it('refuses a sell with the target above entry', () => {
    const errors = validateDraft(futuresBuy({ side: 'sell', stopLoss: 24100, target1: 24300 }))
    expect(errors).toContain('for a sell, stop loss must be above entry and target 1 below entry')
  })

  it('refuses a reward to risk below 1:3 and names the ratio', () => {
    expect(validateDraft(futuresBuy({ target1: 24250 }))).toContain('R:R is 2.50; the minimum is 1:3')
  })

  it('requires target 2 to lie beyond target 1', () => {
    expect(validateDraft(futuresBuy({ target2: 24200 }))).toContain("target 2 must lie beyond target 1 in the trade's direction")
  })

  it('refuses exit before entry on the same day when times are given', () => {
    const errors = validateDraft(futuresBuy({ exitDate: '2026-11-18', entryTime: '10:00', exitTime: '09:30' }))
    expect(errors).toContain('exit time must not be before entry time on the same day')
  })

  it('refuses an exit date before the entry date', () => {
    expect(validateDraft(futuresBuy({ exitDate: '2026-11-17' }))).toContain('exit date must not be before entry date')
  })

  it('requires an exit reason, entry criteria and a lesson', () => {
    const errors = validateDraft(futuresBuy({ exitReason: null, entryCriteria: '  ', lesson: '' }))
    expect(errors).toEqual(expect.arrayContaining(['choose an exit reason', 'entry_criteria must not be blank', 'lesson must not be blank']))
  })
})

describe('calculations', () => {
  it('derives quantity from lots and lot size for F&O, and from shares for equity', () => {
    expect(quantityOf(futuresBuy())).toBe(150)
    expect(quantityOf(equityBuy())).toBe(20)
  })

  it('calculates risk, reward, P/L, ROI and holding days for a futures win', () => {
    expect(calculateDraft(futuresBuy())).toEqual({
      riskPerUnit: 100,
      riskTaken: 15000,
      reward1: 300,
      rr1: 3,
      reward2: null,
      rr2: null,
      points: 250,
      pnl: 37500,
      pct: 1.04,
      roi: 12.5,
      holdingDays: 2,
      pnlCategory: 'win',
    })
  })

  it('reports a loss on a sell that moves against the trade', () => {
    const draft = futuresBuy({ side: 'sell', stopLoss: 24100, target1: 23700, exitPrice: 24050 })
    const results = calculateDraft(draft)
    expect(results?.points).toBe(-50)
    expect(results?.pnlCategory).toBe('loss')
  })

  it('returns null until the numbers needed are typed', () => {
    expect(calculateDraft(futuresBuy({ exitPrice: null }))).toBeNull()
  })

  it('measures the reward to risk to target 1', () => {
    expect(reward1RiskRatio(futuresBuy())).toBe(3)
    expect(reward1RiskRatio(futuresBuy({ entryPrice: null }))).toBeNull()
  })
})

describe('toBacktestInput', () => {
  it('builds the request with the derived quantity and no contract fields for equity', () => {
    const input = toBacktestInput(equityBuy())
    expect(input).not.toBeNull()
    expect(input?.quantity).toBe(20)
    expect(input?.expiryDate).toBeNull()
    expect(input?.lotSize).toBeNull()
    expect(input?.optionType).toBeNull()
  })

  it('keeps the expiry and lot fields for futures', () => {
    const input = toBacktestInput(futuresBuy())
    expect(input).toMatchObject({ expiryDate: '2026-11-26', lotSize: 75, lots: 2, quantity: 150, optionType: null, strike: null })
  })

  it('returns null while the draft is invalid', () => {
    expect(toBacktestInput(futuresBuy({ lesson: '' }))).toBeNull()
  })
})

describe('checksFor', () => {
  it('sends one tick per item of the setup, defaulting to unticked', () => {
    const checks = checksFor(futuresBuy({ ticks: { find_macd_peak: true } }))
    expect(checks).toHaveLength(14)
    expect(checks[0]).toEqual({ itemId: 'find_macd_peak', ticked: true })
    expect(checks[1]).toEqual({ itemId: 'mark_previous_hl', ticked: false })
  })

  it('sends nothing for a setup without items yet', () => {
    expect(checksFor({ ...futuresBuy(), setupType: 'double_top' })).toEqual([])
  })
})

describe('draftFromPlan', () => {
  it('maps a long options plan to a buy with the option type and lots', () => {
    const draft = draftFromPlan({
      date: '2026-11-18',
      instrument: 'NIFTY',
      segment: 'options',
      direction: 'long',
      optionType: 'PE',
      capital: 300000,
      entry: 150,
      stopLoss: 120,
      target: 240,
      lotSize: 75,
      lots: 1,
      quantity: 75,
    })
    expect(draft).toMatchObject({ side: 'buy', segment: 'options', optionType: 'PE', lotSize: 75, lots: 1, quantity: null })
    expect(draft.entryPrice).toBe(150)
    expect(draft.entryDate).toBe('2026-11-18')
    expect(draft.exitDate).toBe('')
  })

  it('maps a short equity plan to a sell with the share quantity', () => {
    const draft = draftFromPlan({
      date: '2026-11-18',
      instrument: 'TCS',
      segment: 'equity',
      direction: 'short',
      optionType: null,
      capital: 200000,
      entry: 3950,
      stopLoss: 4050,
      target: 3750,
      lotSize: null,
      lots: null,
      quantity: 10,
    })
    expect(draft).toMatchObject({ side: 'sell', segment: 'equity', quantity: 10, lotSize: null })
  })
})
