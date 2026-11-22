import { toIsoDate, type IsoDate } from '../domain/dates'
import type { DojoDay, DojoRitual } from '../domain/dojoDay'
import { moodLevel, sanskarLineFor } from '../domain/dojo'
import type { RitualCadence } from '../domain/rituals'
import { DojoApiError, type DojoApi, type LogTradePlanInput, type TradeGateStatus, type TradePlan } from './client'

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

const CADENCE: Record<ApiCadence, RitualCadence> = {
  daily: 'daily',
  weekend: 'weekend',
  monthly_last_market_days: 'monthly',
  weekdays: 'weekdays',
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

  async function request(path: string, init?: RequestInit): Promise<ApiDay> {
    let response: Response
    try {
      response = await fetchImpl(`${profileUrl}${path}`, {
        ...init,
        headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
      })
    } catch {
      throw new DojoApiError(0, 'The Dojo backend is not reachable. Start it on port 8765 and try again.')
    }
    if (!response.ok) throw new DojoApiError(response.status, await errorMessage(response))
    return (await response.json()) as ApiDay
  }

  return {
    today,

    async getDojoDay(date: IsoDate) {
      return toDojoDay(await request(`/days/${date}`))
    },

    async toggleRitual(date: IsoDate, ritualId: string) {
      const body = await request(`/days/${date}/rituals/${encodeURIComponent(ritualId)}/toggle`, { method: 'POST' })
      return toDojoDay(body)
    },

    getTradeGateStatus(): Promise<TradeGateStatus> {
      return tradeGate.getTradeGateStatus()
    },

    logTradePlan(input: LogTradePlanInput): Promise<TradePlan> {
      return tradeGate.logTradePlan(input)
    },
  }
}
