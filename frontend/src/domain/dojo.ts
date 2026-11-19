import { CODE_OF_CONDUCT, type ConductLine } from './codeOfConduct'
import { addDays, daysSinceEpoch, isWeekend, type IsoDate } from './dates'
import { DAILY_RITUAL_IDS } from './rituals'

/** `streak.min_daily_rituals` in the ASTA rules catalogue. */
export const STREAK_MIN_DAILY_RITUALS = 4

/** Index = number of daily rituals done (0 to 6). */
export const MOOD_LABELS = ['None', 'Blank', 'Started', 'Steady', 'Strong', 'Rocket', 'On fire'] as const
export type MoodLabel = (typeof MOOD_LABELS)[number]

/** Completed ritual ids per date. */
export type RitualLogs = Record<IsoDate, string[]>

export function dailyDoneCount(doneIds: string[]): number {
  return doneIds.filter((id) => DAILY_RITUAL_IDS.has(id)).length
}

export function moodLevel(dailyDone: number): MoodLabel {
  return MOOD_LABELS[Math.max(0, Math.min(dailyDone, MOOD_LABELS.length - 1))]
}

/** Weekdays only until a holiday list is configured. */
export function isMarketDay(date: IsoDate, holidays: ReadonlySet<IsoDate> = new Set()): boolean {
  return !isWeekend(date) && !holidays.has(date)
}

/**
 * Consecutive market days with at least `minRituals` daily rituals done.
 * Non-market days are skipped; today never breaks the streak because the day has not ended.
 */
export function computeStreak(
  logs: RitualLogs,
  today: IsoDate,
  holidays: ReadonlySet<IsoDate> = new Set(),
  minRituals = STREAK_MIN_DAILY_RITUALS,
): number {
  const qualifies = (date: IsoDate) => dailyDoneCount(logs[date] ?? []) >= minRituals
  const earliest = Object.keys(logs).sort()[0]
  if (!earliest) return 0

  let streak = 0
  if (isMarketDay(today, holidays) && qualifies(today)) streak += 1

  for (let date = addDays(today, -1); date >= earliest; date = addDays(date, -1)) {
    if (!isMarketDay(date, holidays)) continue
    if (!qualifies(date)) break
    streak += 1
  }
  return streak
}

export function sanskarLineFor(date: IsoDate): ConductLine {
  return CODE_OF_CONDUCT[daysSinceEpoch(date) % CODE_OF_CONDUCT.length]
}
