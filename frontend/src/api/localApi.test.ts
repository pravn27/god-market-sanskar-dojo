import { describe, expect, it } from 'vitest'

import { createLocalDojoApi } from './localApi'

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

  it('rejects past, future, and unknown rituals', async () => {
    const api = createLocalDojoApi(memoryStorage(), now)
    await expect(api.toggleRitual('2026-11-17', 'webinar')).rejects.toMatchObject({ status: 400 })
    await expect(api.toggleRitual('2026-11-19', 'webinar')).rejects.toMatchObject({ status: 400 })
    await expect(api.toggleRitual('2026-11-18', 'nope')).rejects.toMatchObject({ status: 404 })
    await expect(api.toggleRitual('2026-11-18', 'opportunity_hunting')).rejects.toMatchObject({ status: 404 })
  })

  it('marks only today as editable', async () => {
    const api = createLocalDojoApi(memoryStorage(), now)
    expect((await api.getDojoDay('2026-11-18')).editable).toBe(true)
    expect((await api.getDojoDay('2026-11-17')).editable).toBe(false)
  })
})
