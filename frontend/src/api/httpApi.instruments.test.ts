import { describe, expect, it, vi } from 'vitest'

import { createHttpDojoApi } from './httpApi'

const tradeGate = {
  getTradeGateStatus: vi.fn(),
  logTradePlan: vi.fn(),
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const savedNifty = {
  id: 3,
  symbol: 'NIFTY',
  lot_size: 75,
  created_at: '2026-11-25T09:00:00+05:30',
  updated_at: '2026-11-25T09:00:00+05:30',
}

describe('createHttpDojoApi instruments', () => {
  it('lists the instruments in camelCase', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ profile: 'praveen', instruments: [savedNifty] }))
    const list = await createHttpDojoApi({ tradeGate, fetchImpl }).listInstruments()

    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/profiles/praveen/instruments')
    expect(list).toEqual([{ id: 3, symbol: 'NIFTY', lotSize: 75 }])
  })

  it('posts an instrument with its lot size in snake_case', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(savedNifty, 201))
    const created = await createHttpDojoApi({ tradeGate, fetchImpl }).createInstrument({ symbol: 'NIFTY', lotSize: 75 })

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/profiles/praveen/instruments')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ symbol: 'NIFTY', lot_size: 75 })
    expect(created.lotSize).toBe(75)
  })

  it('puts an edited instrument to its id', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(savedNifty))
    await createHttpDojoApi({ tradeGate, fetchImpl }).updateInstrument(3, { symbol: 'NIFTY', lotSize: null })

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/profiles/praveen/instruments/3')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ symbol: 'NIFTY', lot_size: null })
  })

  it('deletes an instrument by id', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ deleted: 3 }))
    await createHttpDojoApi({ tradeGate, fetchImpl }).deleteInstrument(3)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/profiles/praveen/instruments/3')
    expect(init.method).toBe('DELETE')
  })
})
