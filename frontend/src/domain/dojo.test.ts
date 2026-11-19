import { describe, expect, it } from 'vitest'

import { addDays, dayOfWeek } from './dates'
import { computeStreak, moodLevel, sanskarLineFor, type RitualLogs } from './dojo'
import { ritualsFor } from './rituals'

const FOUR = ['market_overview', 'backtesting', 'geo_revision', 'webinar']
const FIVE = [...FOUR, 'preparation']
const TWO = ['market_overview', 'backtesting']

// 2026-11-16 is a Monday.
const MON = '2026-11-16'
const TUE = '2026-11-17'
const WED = '2026-11-18'
const THU = '2026-11-19'

describe('moodLevel', () => {
  it('maps the count of daily rituals to the sheet scale', () => {
    expect(moodLevel(0)).toBe('None')
    expect(moodLevel(3)).toBe('Steady')
    expect(moodLevel(6)).toBe('On fire')
    expect(moodLevel(9)).toBe('On fire')
  })
})

describe('computeStreak', () => {
  const logs: RitualLogs = { [MON]: FOUR, [TUE]: FIVE, [WED]: TWO }

  it('counts qualifying days and does not let an unfinished today break it', () => {
    expect(dayOfWeek(MON)).toBe(1)
    expect(computeStreak(logs, WED)).toBe(2)
  })

  it('resets after a non-qualifying day ends', () => {
    expect(computeStreak(logs, THU)).toBe(0)
  })

  it('skips weekends', () => {
    const fri = '2026-11-20'
    const nextMon = addDays(fri, 3)
    expect(computeStreak({ [fri]: FOUR, [nextMon]: FOUR }, nextMon)).toBe(2)
  })

  it('skips listed holidays', () => {
    expect(computeStreak({ [MON]: FOUR, [WED]: FOUR }, WED, new Set([TUE]))).toBe(2)
  })

  it('ignores the weekend ritual when counting daily rituals', () => {
    const sat = '2026-11-21'
    expect(computeStreak({ [MON]: [...TWO, 'opportunity_hunting', 'webinar'] }, MON)).toBe(0)
    expect(computeStreak({}, sat)).toBe(0)
  })
})

describe('sanskarLineFor', () => {
  it('is stable within a day and changes the next day', () => {
    expect(sanskarLineFor(MON)).toEqual(sanskarLineFor(MON))
    expect(sanskarLineFor(MON)).not.toEqual(sanskarLineFor(TUE))
  })
})

describe('ritualsFor', () => {
  it('shows the weekend ritual only on Saturday and Sunday', () => {
    expect(ritualsFor(MON).map((r) => r.id)).not.toContain('opportunity_hunting')
    expect(ritualsFor('2026-11-21').map((r) => r.id)).toContain('opportunity_hunting')
    expect(ritualsFor(MON)).toHaveLength(6)
  })
})
