import { isWeekend, type IsoDate } from './dates'

export type RitualCadence = 'daily' | 'weekend'

export interface RitualDef {
  id: string
  label: string
  minutes: number
  cadence: RitualCadence
}

/** Seeded from the setup sheet of `2026/daily rituals _ habits.xlsx`. */
export const RITUALS: RitualDef[] = [
  { id: 'market_overview', label: 'Daily Rituals on Market Overview', minutes: 45, cadence: 'daily' },
  { id: 'backtesting', label: 'Daily Backtesting', minutes: 30, cadence: 'daily' },
  { id: 'geo_revision', label: 'Repeat, learn and clear concepts: Full GEO revision', minutes: 15, cadence: 'daily' },
  { id: 'webinar', label: 'MyASTA webinar recording session', minutes: 20, cadence: 'daily' },
  { id: 'preparation', label: 'Market preparation, execution planning, money management', minutes: 10, cadence: 'daily' },
  { id: 'buddy_connect', label: 'Accountability buddy connect', minutes: 15, cadence: 'daily' },
  { id: 'opportunity_hunting', label: 'Opportunity hunting: Nifty sectors vs stocks', minutes: 60, cadence: 'weekend' },
]

export const DAILY_RITUAL_IDS = new Set(RITUALS.filter((r) => r.cadence === 'daily').map((r) => r.id))

export function ritualsFor(date: IsoDate): RitualDef[] {
  return RITUALS.filter((r) => r.cadence === 'daily' || (r.cadence === 'weekend' && isWeekend(date)))
}

export function findRitual(id: string): RitualDef | undefined {
  return RITUALS.find((r) => r.id === id)
}
