import { describe, expect, it } from 'vitest'

import {
  adjustedEntryFor, capReasons, countPlans, type ConvictionLevel, evaluateSizing, lotRangeRows, riskRangeRows, shareRangeRows, weekStart, type SizingInput,
} from './tradeGate'

describe('share range', () => {
  it('shows shares and amount per conviction, like the shares-by-risk sheet', () => {
    const rows = shareRangeRows(200_000, 3950, 3850).filter((r) => r.id !== 'max')
    expect(rows.map((r) => r.shares)).toEqual([5, 10, 20, 30, 35])
    expect(rows.map((r) => r.amount)).toEqual([19750, 39500, 79000, 118500, 138250])
  })

  it('adds the Maximum column at 2% risk', () => {
    const max = shareRangeRows(200_000, 3950, 3850).find((r) => r.id === 'max')
    expect(max?.label).toBe('Maximum')
    expect(max?.shares).toBe(40)
    expect(max?.amount).toBe(158_000)
  })

  it('matches the shares the sizing rule gives for each conviction', () => {
    const rows = shareRangeRows(200_000, 3950, 3850).filter((r) => r.id !== 'max')
    for (const row of rows) {
      expect(evaluateSizing({ ...equityLong, conviction: row.id as ConvictionLevel }).quantity).toBe(row.shares)
    }
  })

  it('shows nothing until capital, entry and stop loss are valid', () => {
    expect(shareRangeRows(200_000, null, 3850).every((r) => r.shares === null)).toBe(true)
    expect(shareRangeRows(200_000, 3850, 3850).every((r) => r.shares === null)).toBe(true)
  })
})

describe('options', () => {
  const option: SizingInput = {
    instrument: 'NIFTY 24500 PE', segment: 'options', side: 'buy', optionType: 'PE', capital: 300_000,
    conviction: 'medium', entry: 100, stopLoss: 90, target: 130, lotSize: 75,
  }

  it('requires CE or PE', () => {
    const r = evaluateSizing({ ...option, optionType: null })
    expect(r.errors).toContain('Choose CE or PE for options.')
  })

  it('buying a PE is a long on the premium, with the same lot maths as futures', () => {
    const r = evaluateSizing(option)
    expect(r.direction).toBe('long')
    expect(r.errors).toEqual([])
    expect(r.lots).toBe(Math.floor(3000 / (10 * 75)))
  })

  it('selling an option is a short on the premium', () => {
    const r = evaluateSizing({ ...option, side: 'sell', stopLoss: 110, target: 60 })
    expect(r.direction).toBe('short')
    expect(r.errors).toEqual([])
  })
})

describe('lot range (F&O)', () => {
  // Spec example: capital 3,00,000; entry 7,780; SL 7,770 (risk 10); lot 250 => risk per lot 2,500.
  const base = { capital: 300_000, entry: 7780, stopLoss: 7770, lotSize: 250 }

  it('shows lots per conviction, matching the F&O sizing rule', () => {
    const rows = lotRangeRows(base.capital, base.entry, base.stopLoss, base.lotSize).filter((r) => r.id !== 'max')
    expect(rows.map((r) => r.lots)).toEqual([0, 0, 1, 1, 2])
  })

  it('adds the Maximum column at 2% risk', () => {
    const max = lotRangeRows(base.capital, base.entry, base.stopLoss, base.lotSize).find((r) => r.id === 'max')
    expect(max?.lots).toBe(2)
  })

  it('matches the lots the F&O sizing rule gives for each conviction', () => {
    const rows = lotRangeRows(base.capital, base.entry, base.stopLoss, base.lotSize).filter((r) => r.id !== 'max')
    for (const row of rows) {
      const sized = evaluateSizing({
        instrument: 'NG Mini', segment: 'futures', side: 'buy', optionType: null, capital: base.capital,
        conviction: row.id as ConvictionLevel, entry: base.entry, stopLoss: base.stopLoss, target: 7820, lotSize: base.lotSize,
      })
      expect(sized.lots).toBe(row.lots)
    }
  })

  it('shows nothing until lot size is a whole number', () => {
    expect(lotRangeRows(300_000, 7780, 7770, null).every((r) => r.lots === null)).toBe(true)
    expect(lotRangeRows(300_000, 7780, 7770, 25.5).every((r) => r.lots === null)).toBe(true)
  })
})

describe('risk range', () => {
  it('shows the risk allowed per conviction and the maximum, like the risk sheet', () => {
    const rows = riskRangeRows(200_000)
    expect(rows.map((r) => r.amount)).toEqual([500, 1000, 2000, 3000, 3500, 4000])
    expect(rows.map((r) => r.id)).toEqual(['below_low', 'low', 'medium', 'high', 'above_high', 'max'])
  })

  it('leaves amounts empty without a valid capital', () => {
    expect(riskRangeRows(null).every((r) => r.amount === null)).toBe(true)
    expect(riskRangeRows(0).every((r) => r.amount === null)).toBe(true)
  })
})

const equityLong: SizingInput = {
  instrument: 'Test stock', segment: 'equity', side: 'buy', optionType: null, capital: 200_000,
  conviction: 'medium', entry: 3950, stopLoss: 3850, target: 4300, lotSize: null,
}

describe('evaluateSizing — equity', () => {
  it('sizes Medium conviction like the risk sheet', () => {
    const r = evaluateSizing(equityLong)
    expect(r.riskAllowed).toBe(2000)
    expect(r.quantity).toBe(20)
    expect(r.actualRisk).toBe(2000)
    expect(r.investment).toBe(79_000)
    expect(r.errors).toEqual([])
  })

  it('applies the entry limit at Above High', () => {
    const r = evaluateSizing({ ...equityLong, conviction: 'above_high' })
    expect(r.maxByEntry).toBe(50)
    expect(r.quantity).toBe(35)
  })

  it('rejects a long trade with the stop loss above entry', () => {
    const r = evaluateSizing({ ...equityLong, stopLoss: 4000 })
    expect(r.errors[0]).toMatch(/stop loss < entry < target/)
  })
})

describe('evaluateSizing — F&O', () => {
  const fnoBuy: SizingInput = {
    instrument: 'NG Mini', segment: 'futures', side: 'buy', optionType: null, capital: 300_000,
    conviction: 'medium', entry: 7780, stopLoss: 7770, target: 7820, lotSize: 250,
  }

  it('sizes F&O buy lots like the risk sheet', () => {
    expect(evaluateSizing(fnoBuy).lots).toBe(1)
    expect(evaluateSizing({ ...fnoBuy, conviction: 'above_high' }).lots).toBe(2)
  })

  it('sizes F&O sell lots like the risk sheet', () => {
    const r = evaluateSizing({
      instrument: 'Nifty 50', segment: 'futures', side: 'sell', optionType: null, capital: 100_000,
      conviction: 'low', entry: 5, stopLoss: 7, target: 0.5, lotSize: 65,
    })
    expect(r.direction).toBe('short')
    expect(r.lots).toBe(3)
    expect(r.quantity).toBe(195)
    expect(r.actualRisk).toBe(390)
  })

  it('blocks when the stop loss is too wide for the conviction', () => {
    const r = evaluateSizing({ ...fnoBuy, conviction: 'below_low' })
    expect(r.lots).toBe(0)
    expect(r.errors).toContain('Stop loss is too wide for this conviction: quantity is 0.')
  })
})

describe('reward to risk', () => {
  it('blocks below 1:3 and suggests the adjusted entry', () => {
    const r = evaluateSizing({ ...equityLong, target: 4100 })
    expect(r.rewardRisk).toBe(1.5)
    expect(r.rewardRiskOk).toBe(false)
    expect(r.adjustedEntry).toBe(3912.5)
  })

  it('matches the RR Failure handle sheet', () => {
    expect(adjustedEntryFor('long', 232, 265)).toBe(240.25)
    expect(adjustedEntryFor('short', 280, 200)).toBe(260)
  })
})

describe('trade caps', () => {
  it('counts the Monday-to-Sunday week and the calendar month', () => {
    expect(weekStart('2026-11-19')).toBe('2026-11-16')
    expect(weekStart('2026-11-16')).toBe('2026-11-16')
    expect(weekStart('2026-11-22')).toBe('2026-11-16')
    const counts = countPlans(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-10'], '2026-11-19')
    expect(counts).toEqual({ weekly: 3, monthly: 4 })
    expect(capReasons(counts)).toEqual(['Weekly cap reached (3 plans).'])
  })
})
