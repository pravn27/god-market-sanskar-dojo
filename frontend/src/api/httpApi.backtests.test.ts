import { describe, expect, it, vi } from 'vitest'

import { createHttpDojoApi } from './httpApi'
import type { BacktestInput } from '../domain/backtest'

const tradeGate = {
  getTradeGateStatus: vi.fn(async () => {
    throw new Error('not used here')
  }),
  logTradePlan: vi.fn(async () => {
    throw new Error('not used here')
  }),
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** One log as the backend returns it (snake_case, calculated fields included). */
const savedLog = {
  id: 7,
  segment: 'futures',
  side: 'buy',
  setup_family: 'swing',
  setup_type: 'rd_bullish',
  pattern: null,
  instrument: 'NIFTY',
  option_type: null,
  strike: null,
  expiry_date: '2026-11-26',
  lot_size: 75,
  lots: 2,
  quantity: 150,
  tide_tf: 'daily',
  wave_tf: '4hr',
  ripple_tf: '1hr',
  entry_date: '2026-11-18',
  entry_time: '10:15',
  entry_price: 24000,
  entry_criteria: 'RD bullish on daily',
  stop_loss: 23900,
  target_1: 24300,
  target_2: null,
  exit_date: '2026-11-20',
  exit_time: null,
  exit_price: 24250,
  exit_reason: 'planned_target',
  exit_criteria: null,
  capital: 300000,
  spot_price: null,
  margin_used: null,
  observations: null,
  chart_link: null,
  lesson: 'Waited for the weapon candle',
  checks: [{ item_id: 'find_macd_peak', ticked: true }],
  rules_version: 1,
  created_at: '2026-11-18T10:20:00+05:30',
  updated_at: '2026-11-18T10:20:00+05:30',
  risk_per_unit: 100,
  risk_taken: 15000,
  reward_t1: 300,
  rr_t1: 3,
  reward_t2: null,
  rr_t2: null,
  points: 250,
  pnl: 37500,
  pct: 1.04,
  roi: 12.5,
  holding_days: 2,
  pnl_category: 'win',
}

const input: BacktestInput = {
  segment: 'futures',
  side: 'buy',
  setupFamily: 'swing',
  setupType: 'rd_bullish',
  pattern: null,
  instrument: 'NIFTY',
  optionType: null,
  strike: null,
  expiryDate: '2026-11-26',
  lotSize: 75,
  lots: 2,
  quantity: 150,
  tideTf: 'daily',
  waveTf: '4hr',
  rippleTf: '1hr',
  entryDate: '2026-11-18',
  entryTime: '10:15',
  entryPrice: 24000,
  entryCriteria: 'RD bullish on daily',
  stopLoss: 23900,
  target1: 24300,
  target2: null,
  exitDate: '2026-11-20',
  exitTime: null,
  exitPrice: 24250,
  exitReason: 'planned_target',
  exitCriteria: null,
  capital: 300000,
  spotPrice: null,
  marginUsed: null,
  observations: null,
  chartLink: null,
  lesson: 'Waited for the weapon candle',
  checks: [{ itemId: 'find_macd_peak', ticked: true }],
}

describe('createHttpDojoApi backtests', () => {
  it('lists logs with filters in the query string and maps them to camelCase', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ backtests: [savedLog] }))
    const api = createHttpDojoApi({ tradeGate, fetchImpl: fetchImpl as unknown as typeof fetch })

    const logs = await api.listBacktests({ segment: 'futures', setupType: 'rd_bullish', outcome: 'win', from: '2026-11-01', to: '2026-11-30' })

    expect(fetchImpl.mock.calls[0][0]).toBe(
      '/api/v1/profiles/praveen/backtests?segment=futures&setup_type=rd_bullish&outcome=win&from=2026-11-01&to=2026-11-30',
    )
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      id: 7,
      setupType: 'rd_bullish',
      entryPrice: 24000,
      stopLoss: 23900,
      target1: 24300,
      rr1: 3,
      pnl: 37500,
      pnlCategory: 'win',
      holdingDays: 2,
      checks: [{ itemId: 'find_macd_peak', ticked: true }],
    })
  })

  it('sends no query string when no filter is set', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ backtests: [] }))
    await createHttpDojoApi({ tradeGate, fetchImpl: fetchImpl as unknown as typeof fetch }).listBacktests()
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/profiles/praveen/backtests')
  })

  it('posts a new log in the backend shape and returns the saved log', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(savedLog, 201))
    const log = await createHttpDojoApi({ tradeGate, fetchImpl: fetchImpl as unknown as typeof fetch }).createBacktest(input)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/profiles/praveen/backtests')
    expect(init.method).toBe('POST')
    const sent = JSON.parse(init.body as string)
    expect(sent).toMatchObject({
      setup_type: 'rd_bullish',
      entry_price: 24000,
      target_1: 24300,
      expiry_date: '2026-11-26',
      lot_size: 75,
      checks: [{ item_id: 'find_macd_peak', ticked: true }],
    })
    expect(log.id).toBe(7)
  })

  it('puts an edited log to its id', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(savedLog))
    await createHttpDojoApi({ tradeGate, fetchImpl: fetchImpl as unknown as typeof fetch }).updateBacktest(7, input)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/profiles/praveen/backtests/7')
    expect(init.method).toBe('PUT')
  })

  it('deletes a log by id', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ deleted: 7 }))
    await createHttpDojoApi({ tradeGate, fetchImpl: fetchImpl as unknown as typeof fetch }).deleteBacktest(7)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/profiles/praveen/backtests/7')
    expect(init.method).toBe('DELETE')
  })
})
