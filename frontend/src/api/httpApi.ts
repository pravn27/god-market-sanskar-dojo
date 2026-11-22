import { toIsoDate, type IsoDate } from '../domain/dates'
import type { DojoDay, DojoRitual } from '../domain/dojoDay'
import { moodLevel, sanskarLineFor } from '../domain/dojo'
import type { RitualCadence } from '../domain/rituals'
import {
  DojoApiError,
  type DojoApi,
  type LogTradePlanInput,
  type MonthView,
  type RitualDefinition,
  type RitualInput,
  type RitualSchedule,
  type TradeGateStatus,
  type TradePlan,
} from './client'

export const API_BASE = '/api/v1'
export const PROFILE_SLUG = 'praveen'

type ApiCadence = 'daily' | 'weekend' | 'monthly_last_market_days' | 'weekdays'

/** Shape returned by `GET /api/v1/profiles/{slug}/days/{date}`. */
interface ApiDay {
  date: IsoDate
  editable: boolean
  market_day: boolean
  rituals: { ritual_key: string; label: string; minutes: number; cadence: ApiCadence; done: boolean }[]
  daily_done: number
  streak: number
}

/** One ritual definition as returned by the rituals endpoints. */
interface ApiRitual {
  ritual_key: string
  label: string
  minutes: number
  cadence: ApiCadence
  weekdays: number[] | null
  monthly_last_market_days: number | null
  counts_for_streak: boolean
  sort_order: number
  valid_from: IsoDate
  valid_to: IsoDate | null
}

/** Body sent to the create and update endpoints. */
interface ApiRitualBody {
  label: string
  minutes: number
  cadence: ApiCadence
  weekdays: number[] | null
  monthly_last_market_days: number | null
  counts_for_streak: boolean
}

const CADENCE: Record<ApiCadence, RitualCadence> = {
  daily: 'daily',
  weekend: 'weekend',
  monthly_last_market_days: 'monthly',
  weekdays: 'weekdays',
}

const SCHEDULE_TO_API: Record<RitualSchedule, ApiCadence> = {
  daily: 'daily',
  weekdays: 'weekdays',
  weekend: 'weekend',
  monthly: 'monthly_last_market_days',
}

const SCHEDULE_FROM_API: Record<ApiCadence, RitualSchedule> = {
  daily: 'daily',
  weekdays: 'weekdays',
  weekend: 'weekend',
  monthly_last_market_days: 'monthly',
}

function toDojoDay(body: ApiDay): DojoDay {
  const rituals: DojoRitual[] = body.rituals.map((r) => ({
    id: r.ritual_key,
    label: r.label,
    minutes: r.minutes,
    cadence: CADENCE[r.cadence],
    done: r.done,
  }))
  const daily = rituals.filter((r) => r.cadence === 'daily')
  return {
    date: body.date,
    editable: body.editable,
    marketDay: body.market_day,
    calendar: 'weekdays_only',
    rituals,
    dailyDone: body.daily_done,
    dailyTotal: daily.length,
    minutesDone: daily.filter((r) => r.done).reduce((sum, r) => sum + r.minutes, 0),
    minutesTotal: daily.reduce((sum, r) => sum + r.minutes, 0),
    mood: moodLevel(body.daily_done),
    streak: body.streak,
    sanskar: sanskarLineFor(body.date),
  }
}

/** Shape returned by `GET /api/v1/profiles/{slug}/months/{month}`. */
interface ApiMonth {
  month: string
  prev_month: string | null
  next_month: string | null
  days: {
    date: IsoDate
    market_day: boolean
    future: boolean
    daily_total: number
    daily_done: number
    on_track: boolean
    full: boolean
  }[]
  summary: { market_days: number; on_track_days: number; full_days: number }
}

function toMonthView(body: ApiMonth): MonthView {
  return {
    month: body.month,
    prevMonth: body.prev_month,
    nextMonth: body.next_month,
    days: body.days.map((d) => ({
      date: d.date,
      marketDay: d.market_day,
      future: d.future,
      dailyTotal: d.daily_total,
      dailyDone: d.daily_done,
      onTrack: d.on_track,
      full: d.full,
    })),
    summary: {
      marketDays: body.summary.market_days,
      onTrackDays: body.summary.on_track_days,
      fullDays: body.summary.full_days,
    },
  }
}

function toRitualDefinition(r: ApiRitual): RitualDefinition {
  return {
    key: r.ritual_key,
    label: r.label,
    minutes: r.minutes,
    schedule: SCHEDULE_FROM_API[r.cadence],
    weekdays: r.weekdays,
    monthlyLastMarketDays: r.monthly_last_market_days,
    countsForStreak: r.counts_for_streak,
    sortOrder: r.sort_order,
    validFrom: r.valid_from,
    validTo: r.valid_to,
  }
}

function toRitualBody(input: RitualInput): ApiRitualBody {
  return {
    label: input.label,
    minutes: input.minutes,
    cadence: SCHEDULE_TO_API[input.schedule],
    weekdays: input.schedule === 'weekdays' ? input.weekdays : null,
    monthly_last_market_days: input.schedule === 'monthly' ? input.monthlyLastMarketDays : null,
    counts_for_streak: input.countsForStreak,
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      return body.detail.map((item: { msg?: string }) => item.msg ?? 'Invalid request.').join(' ')
    }
  } catch {
    // Not JSON: fall through to the status-based message.
  }
  return `Request failed with status ${response.status}.`
}

export interface HttpDojoApiOptions {
  /** Trade Gate has no backend endpoints yet, so it is delegated to another implementation. */
  tradeGate: Pick<DojoApi, 'getTradeGateStatus' | 'logTradePlan'>
  now?: () => Date
  fetchImpl?: typeof fetch
  baseUrl?: string
  profile?: string
}

export function createHttpDojoApi({
  tradeGate,
  now = () => new Date(),
  fetchImpl = (input, init) => fetch(input, init),
  baseUrl = API_BASE,
  profile = PROFILE_SLUG,
}: HttpDojoApiOptions): DojoApi {
  const profileUrl = `${baseUrl}/profiles/${encodeURIComponent(profile)}`
  const today = () => toIsoDate(now())

  async function send<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (init?.body) headers['Content-Type'] = 'application/json'

    let response: Response
    try {
      response = await fetchImpl(`${profileUrl}${path}`, { ...init, headers })
    } catch {
      throw new DojoApiError(0, 'The Dojo backend is not reachable. Start it on port 8765 and try again.')
    }
    if (!response.ok) throw new DojoApiError(response.status, await errorMessage(response))
    return (await response.json()) as T
  }

  const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

  return {
    today,

    async getDojoDay(date: IsoDate) {
      return toDojoDay(await send<ApiDay>(`/days/${date}`))
    },

    async getMonth(month: string) {
      return toMonthView(await send<ApiMonth>(`/months/${encodeURIComponent(month)}`))
    },

    async toggleRitual(date: IsoDate, ritualId: string) {
      const body = await send<ApiDay>(`/days/${date}/rituals/${encodeURIComponent(ritualId)}/toggle`, { method: 'POST' })
      return toDojoDay(body)
    },

    async listRituals(date: IsoDate) {
      const body = await send<{ rituals: ApiRitual[] }>(`/rituals?as_of=${date}`)
      return body.rituals.map(toRitualDefinition)
    },

    async createRitual(input: RitualInput) {
      const created = await send<ApiRitual>('/rituals', json(toRitualBody(input)))
      return toRitualDefinition(created)
    },

    async updateRitual(key: string, input: RitualInput) {
      const updated = await send<ApiRitual>(`/rituals/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify(toRitualBody(input)),
      })
      return toRitualDefinition(updated)
    },

    async retireRitual(key: string) {
      await send<unknown>(`/rituals/${encodeURIComponent(key)}`, { method: 'DELETE' })
    },

    async reorderRituals(keys: string[]) {
      const body = await send<{ rituals: ApiRitual[] }>('/rituals/reorder', json({ keys }))
      return body.rituals.map(toRitualDefinition)
    },

    getTradeGateStatus(): Promise<TradeGateStatus> {
      return tradeGate.getTradeGateStatus()
    },

    logTradePlan(input: LogTradePlanInput): Promise<TradePlan> {
      return tradeGate.logTradePlan(input)
    },
  }
}
