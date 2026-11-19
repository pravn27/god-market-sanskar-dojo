import { describe, expect, it } from 'vitest'

import { adjustedEntryFor, capReasons, countPlans, evaluateSizing, weekStart, type SizingInput } from './tradeGate'

const equityLong: SizingInput = {
  instrument: 'Test stock', segment: 'equity', equityDirection: 'long', capital: 200_000,
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
    instrument: 'NG Mini', segment: 'fno_buy', equityDirection: 'long', capital: 300_000,
    conviction: 'medium', entry: 7780, stopLoss: 7770, target: 7820, lotSize: 250,
  }

  it('sizes F&O buy lots like the risk sheet', () => {
    expect(evaluateSizing(fnoBuy).lots).toBe(1)
    expect(evaluateSizing({ ...fnoBuy, conviction: 'above_high' }).lots).toBe(2)
  })

  it('sizes F&O sell lots like the risk sheet', () => {
    const r = evaluateSizing({
      instrument: 'Nifty 50', segment: 'fno_sell', equityDirection: 'long', capital: 100_000,
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
