import { describe, expect, it, vi } from 'vitest'

import { createHttpDojoApi } from './httpApi'
import { DojoApiError, type DojoApi } from './client'

const tradeGate = {
  getTradeGateStatus: vi.fn(async () => ({
    readiness: 'not_available' as const,
    locks: 'not_available' as const,
    counts: { weekly: 0, monthly: 0 },
    weeklyCap: 3,
    monthlyCap: 12,
    capReasons: [],
  })),
  logTradePlan: vi.fn(async () => {
    throw new Error('not used in these tests')
  }),
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const monday = {
  date: '2026-11-23',
  editable: true,
  market_day: true,
  rituals: [
    { ritual_key: 'market_overview', label: 'Daily Rituals on Market Overview', minutes: 45, cadence: 'daily', done: true },
    { ritual_key: 'backtesting', label: 'Daily Backtesting', minutes: 30, cadence: 'daily', done: false },
    { ritual_key: 'webinar', label: 'MyASTA webinar recording session', minutes: 20, cadence: 'daily', done: false },
    { ritual_key: 'log_audit', label: 'Trade log update and SWOT review', minutes: 60, cadence: 'monthly_last_market_days', done: false },
    { ritual_key: 'gym', label: 'Gym', minutes: 40, cadence: 'weekdays', done: false },
  ],
  daily_done: 1,
  streak: 3,
}

function api(fetchImpl: typeof fetch, now = () => new Date(2026, 10, 23, 9, 0)): DojoApi {
  return createHttpDojoApi({ tradeGate, fetchImpl, now })
}

describe('createHttpDojoApi', () => {
  it('maps the day response into the shape the pages already use', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(monday))
    const day = await api(fetchImpl as unknown as typeof fetch).getDojoDay('2026-11-23')

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/v1/profiles/praveen/days/2026-11-23',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    )
    expect(day.editable).toBe(true)
    expect(day.marketDay).toBe(true)
    expect(day.dailyDone).toBe(1)
    expect(day.dailyTotal).toBe(3)
    expect(day.minutesDone).toBe(45)
    expect(day.minutesTotal).toBe(95)
    expect(day.mood).toBe('Blank')
    expect(day.streak).toBe(3)
    expect(day.rituals.find((r) => r.id === 'log_audit')?.cadence).toBe('monthly')
    expect(day.rituals.find((r) => r.id === 'gym')?.cadence).toBe('weekdays')
    expect(day.sanskar.text.length).toBeGreaterThan(0)
  })

  it('posts a toggle and returns the updated day', async () => {
    const toggled = { ...monday, rituals: monday.rituals.map((r) => (r.ritual_key === 'backtesting' ? { ...r, done: true } : r)), daily_done: 2 }
    const fetchImpl = vi.fn(async () => jsonResponse(toggled))
    const day = await api(fetchImpl as unknown as typeof fetch).toggleRitual('2026-11-23', 'backtesting')

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/v1/profiles/praveen/days/2026-11-23/rituals/backtesting/toggle',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(day.rituals.find((r) => r.id === 'backtesting')?.done).toBe(true)
    expect(day.dailyDone).toBe(2)
  })

  it('turns a backend rule error into a DojoApiError with the server message', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ detail: 'Past days are read-only.' }, 400))
    const failure = api(fetchImpl as unknown as typeof fetch).toggleRitual('2026-11-20', 'backtesting')

    await expect(failure).rejects.toBeInstanceOf(DojoApiError)
    await expect(failure).rejects.toMatchObject({ status: 400, message: 'Past days are read-only.' })
  })

  it('reads validation errors from a list of details', async () => {
    const detail = [{ msg: 'value is not a valid date' }]
    const fetchImpl = vi.fn(async () => jsonResponse({ detail }, 422))
    await expect(api(fetchImpl as unknown as typeof fetch).getDojoDay('2026-02-30')).rejects.toMatchObject({
      status: 422,
      message: 'value is not a valid date',
    })
  })

  it('explains when the backend is not running', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(api(fetchImpl as unknown as typeof fetch).getDojoDay('2026-11-23')).rejects.toMatchObject({
      status: 0,
    })
  })

  it('uses the injected clock for today', () => {
    const fetchImpl = vi.fn()
    expect(api(fetchImpl as unknown as typeof fetch).today()).toBe('2026-11-23')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('delegates Trade Gate calls to the other implementation', async () => {
    const fetchImpl = vi.fn()
    const status = await api(fetchImpl as unknown as typeof fetch).getTradeGateStatus()
    expect(tradeGate.getTradeGateStatus).toHaveBeenCalled()
    expect(status.weeklyCap).toBe(3)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

const apiRitual = (overrides: Record<string, unknown> = {}) => ({
  ritual_key: 'gym',
  label: 'Gym',
  minutes: 40,
  cadence: 'weekdays',
  weekdays: [1, 3, 5],
  monthly_last_market_days: null,
  counts_for_streak: false,
  sort_order: 3,
  valid_from: '2026-01-01',
  valid_to: null,
  ...overrides,
})

describe('ritual definitions over HTTP', () => {
  it('lists the rituals that apply on a date, in order, with schedules mapped', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        profile: 'praveen',
        as_of: '2026-11-23',
        rituals: [
          apiRitual({ ritual_key: 'log_audit', label: 'Trade log update and SWOT review', cadence: 'monthly_last_market_days', weekdays: null, monthly_last_market_days: 2, sort_order: 1 }),
          apiRitual({ ritual_key: 'market_overview', label: 'Daily Rituals on Market Overview', cadence: 'daily', weekdays: null, counts_for_streak: true, sort_order: 2 }),
          apiRitual({ ritual_key: 'opportunity_hunting', label: 'Opportunity hunting', cadence: 'weekend', weekdays: null, sort_order: 3 }),
          apiRitual(),
        ],
      }),
    )

    const rituals = await api(fetchImpl as unknown as typeof fetch).listRituals('2026-11-23')

    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/profiles/praveen/rituals?as_of=2026-11-23', expect.anything())
    expect(rituals.map((r) => [r.key, r.schedule])).toEqual([
      ['log_audit', 'monthly'],
      ['market_overview', 'daily'],
      ['opportunity_hunting', 'weekend'],
      ['gym', 'weekdays'],
    ])
    expect(rituals[0]).toMatchObject({ monthlyLastMarketDays: 2, weekdays: null })
    expect(rituals[3]).toMatchObject({ weekdays: [1, 3, 5], countsForStreak: false, validFrom: '2026-01-01', validTo: null })
  })

  it('creates a ritual, sending weekdays only for the weekdays schedule', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(apiRitual({ ritual_key: 'chart_review', label: 'Chart review', cadence: 'daily', weekdays: null, counts_for_streak: true, minutes: 20 }), 201))

    const created = await api(fetchImpl as unknown as typeof fetch).createRitual({
      label: 'Chart review',
      minutes: 20,
      schedule: 'daily',
      weekdays: [1, 3],
      monthlyLastMarketDays: 2,
      countsForStreak: true,
    })

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/profiles/praveen/rituals')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      label: 'Chart review',
      minutes: 20,
      cadence: 'daily',
      weekdays: null,
      monthly_last_market_days: null,
      counts_for_streak: true,
    })
    expect(created).toMatchObject({ key: 'chart_review', schedule: 'daily' })
  })

  it('sends the monthly count for the monthly schedule', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(apiRitual({ cadence: 'monthly_last_market_days', weekdays: null, monthly_last_market_days: 3 }), 201))

    await api(fetchImpl as unknown as typeof fetch).createRitual({
      label: 'Gym',
      minutes: 40,
      schedule: 'monthly',
      weekdays: [1],
      monthlyLastMarketDays: 3,
      countsForStreak: false,
    })

    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body).toMatchObject({ cadence: 'monthly_last_market_days', weekdays: null, monthly_last_market_days: 3 })
  })

  it('updates a ritual with PUT', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(apiRitual({ minutes: 50 })))

    const updated = await api(fetchImpl as unknown as typeof fetch).updateRitual('gym', {
      label: 'Gym',
      minutes: 50,
      schedule: 'weekdays',
      weekdays: [1, 3, 5],
      monthlyLastMarketDays: null,
      countsForStreak: false,
    })

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/profiles/praveen/rituals/gym')
    expect(init.method).toBe('PUT')
    expect(updated.minutes).toBe(50)
  })

  it('retires a ritual with DELETE', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ritual_key: 'gym', retired_from: '2026-11-23' }))

    await api(fetchImpl as unknown as typeof fetch).retireRitual('gym')

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/profiles/praveen/rituals/gym')
    expect(init.method).toBe('DELETE')
  })

  it('posts the new order and returns the reordered rituals', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ profile: 'praveen', rituals: [apiRitual({ ritual_key: 'a', sort_order: 1 }), apiRitual({ ritual_key: 'gym', sort_order: 2 })] }))

    const rituals = await api(fetchImpl as unknown as typeof fetch).reorderRituals(['a', 'gym'])

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/profiles/praveen/rituals/reorder')
    expect(JSON.parse(init.body as string)).toEqual({ keys: ['a', 'gym'] })
    expect(rituals.map((r) => r.key)).toEqual(['a', 'gym'])
  })

  it('shows the validation message from a rejected create', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ detail: [{ msg: 'Value error, the weekdays cadence needs at least one weekday' }] }, 422),
    )

    await expect(
      api(fetchImpl as unknown as typeof fetch).createRitual({
        label: 'Gym',
        minutes: 40,
        schedule: 'weekdays',
        weekdays: [],
        monthlyLastMarketDays: null,
        countsForStreak: false,
      }),
    ).rejects.toMatchObject({ status: 422, message: 'Value error, the weekdays cadence needs at least one weekday' })
  })
})
