import { describe, expect, it } from 'vitest'

import type { SizingInput } from '../domain/tradeGate'
import { createLocalDojoApi } from './localApi'

const validSizing: SizingInput = {
  instrument: 'Test stock', segment: 'equity', side: 'buy', optionType: null, capital: 200_000,
  conviction: 'medium', entry: 3950, stopLoss: 3850, target: 4300, lotSize: null,
}

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

// Wednesday 2026-11-18, local noon.
const now = () => new Date(2026, 10, 18, 12, 0)

describe('createLocalDojoApi', () => {
  it('persists a toggled ritual across instances', async () => {
    const storage = memoryStorage()
    await createLocalDojoApi(storage, now).toggleRitual('2026-11-18', 'backtesting')

    const day = await createLocalDojoApi(storage, now).getDojoDay('2026-11-18')
    expect(day.rituals.find((r) => r.id === 'backtesting')?.done).toBe(true)
    expect(day.dailyDone).toBe(1)
    expect(day.mood).toBe('Blank')
    expect(day.minutesDone).toBe(30)
  })

  it('toggling twice on the same day leaves the ritual undone', async () => {
    const api = createLocalDojoApi(memoryStorage(), now)
    await api.toggleRitual('2026-11-18', 'webinar')
    const day = await api.toggleRitual('2026-11-18', 'webinar')
    expect(day.rituals.find((r) => r.id === 'webinar')?.done).toBe(false)
  })

  it('corrects the oldest day in the window', async () => {
    const api = createLocalDojoApi(memoryStorage(), now)
    const day = await api.toggleRitual('2026-11-12', 'webinar')
    expect(day.rituals.find((r) => r.id === 'webinar')?.done).toBe(true)
  })

  it('rejects days older than the window, future days, and unknown rituals', async () => {
    const api = createLocalDojoApi(memoryStorage(), now)
    await expect(api.toggleRitual('2026-11-11', 'webinar')).rejects.toMatchObject({ status: 400 })
    await expect(api.toggleRitual('2026-11-19', 'webinar')).rejects.toMatchObject({ status: 400 })
    await expect(api.toggleRitual('2026-11-18', 'nope')).rejects.toMatchObject({ status: 404 })
    await expect(api.toggleRitual('2026-11-18', 'opportunity_hunting')).rejects.toMatchObject({ status: 404 })
  })

  it('saves a valid trade plan and counts it toward the caps', async () => {
    const api = createLocalDojoApi(memoryStorage(), now)
    const plan = await api.logTradePlan({ sizing: validSizing, lossAccepted: true, slWithin30Seconds: true })
    expect(plan.quantity).toBe(20)
    expect(plan.rulesVersion).toBe(1)
    const status = await api.getTradeGateStatus()
    expect(status.readiness).toBe('not_available')
    expect(status.counts).toEqual({ weekly: 1, monthly: 1 })
  })

  it('rejects missing commitments, R:R below 1:3, and the fourth plan in a week', async () => {
    const api = createLocalDojoApi(memoryStorage(), now)
    await expect(api.logTradePlan({ sizing: validSizing, lossAccepted: false, slWithin30Seconds: true }))
      .rejects.toMatchObject({ status: 400 })
    await expect(api.logTradePlan({ sizing: { ...validSizing, target: 4100 }, lossAccepted: true, slWithin30Seconds: true }))
      .rejects.toThrow(/minimum is 1:3/)

    for (let i = 0; i < 3; i += 1) {
      await api.logTradePlan({ sizing: validSizing, lossAccepted: true, slWithin30Seconds: true })
    }
    await expect(api.logTradePlan({ sizing: validSizing, lossAccepted: true, slWithin30Seconds: true }))
      .rejects.toThrow(/Weekly cap reached/)
  })

  it('marks the last seven days, today included, as editable', async () => {
    const api = createLocalDojoApi(memoryStorage(), now)
    expect((await api.getDojoDay('2026-11-18')).editable).toBe(true)
    expect((await api.getDojoDay('2026-11-12')).editable).toBe(true)
    expect((await api.getDojoDay('2026-11-11')).editable).toBe(false)
  })
})
