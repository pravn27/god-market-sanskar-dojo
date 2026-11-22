import type { ConductLine } from './codeOfConduct'
import { isEditableDay, type IsoDate } from './dates'
import { computeStreak, dailyDoneCount, isMarketDay, moodLevel, sanskarLineFor, type MoodLabel, type RitualLogs } from './dojo'
import { ritualsFor, type RitualDef } from './rituals'

export interface DojoRitual extends RitualDef {
  done: boolean
}

export interface DojoDay {
  date: IsoDate
  editable: boolean
  marketDay: boolean
  calendar: 'weekdays_only'
  rituals: DojoRitual[]
  dailyDone: number
  dailyTotal: number
  minutesDone: number
  minutesTotal: number
  mood: MoodLabel
  streak: number
  sanskar: ConductLine
}

export function buildDojoDay(date: IsoDate, today: IsoDate, logs: RitualLogs): DojoDay {
  const doneIds = logs[date] ?? []
  const rituals = ritualsFor(date).map((r) => ({ ...r, done: doneIds.includes(r.id) }))
  const daily = rituals.filter((r) => r.cadence === 'daily')
  const dailyDone = dailyDoneCount(doneIds)
  return {
    date,
    editable: isEditableDay(date, today),
    marketDay: isMarketDay(date),
    calendar: 'weekdays_only',
    rituals,
    dailyDone,
    dailyTotal: daily.length,
    minutesDone: daily.filter((r) => r.done).reduce((sum, r) => sum + r.minutes, 0),
    minutesTotal: daily.reduce((sum, r) => sum + r.minutes, 0),
    mood: moodLevel(dailyDone),
    streak: computeStreak(logs, date),
    sanskar: sanskarLineFor(date),
  }
}
