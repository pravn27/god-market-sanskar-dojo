import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../../App'
import AppProviders from '../../AppProviders'
import type { BacktestLog } from '../../api/client'
import { createLocalDojoApi } from '../../api/localApi'
import { type BacktestDraft, type BacktestInput, calculateDraft, emptyDraft, toBacktestInput } from '../../domain/backtest'
import { pickInstrument, SAMPLE_INSTRUMENTS } from '../instruments/instrumentTestUtils'

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

/** A complete futures buy that wins 37,500. */
const winningDraft: BacktestDraft = {
  ...emptyDraft('futures'),
  instrument: 'NIFTY',
  lotSize: 75,
  lots: 2,
  expiryDate: '2026-11-26',
  entryDate: '2026-11-18',
  entryPrice: 24000,
  stopLoss: 23900,
  target1: 24300,
  exitDate: '2026-11-20',
  exitPrice: 24250,
  exitReason: 'planned_target',
  entryCriteria: 'RD bullish on daily',
  lesson: 'Waited for the weapon candle',
  capital: 300000,
}

function makeLog(id: number, overrides: Partial<BacktestLog> = {}): BacktestLog {
  const input = toBacktestInput(winningDraft) as NonNullable<ReturnType<typeof toBacktestInput>>
  const results = calculateDraft(winningDraft) as NonNullable<ReturnType<typeof calculateDraft>>
  return { ...input, ...results, id, createdAt: '2026-11-18T10:20:00+05:30', updatedAt: '2026-11-18T10:20:00+05:30', ...overrides }
}

function fakeApi(logs: BacktestLog[] = []) {
  const base = createLocalDojoApi(memoryStorage(), () => new Date(2026, 10, 18, 9, 0))
  return {
    ...base,
    listBacktests: vi.fn(async () => logs),
    listInstruments: vi.fn(async () => SAMPLE_INSTRUMENTS),
    createBacktest: vi.fn<(input: BacktestInput) => Promise<BacktestLog>>(async () => makeLog(8)),
    updateBacktest: vi.fn(async (id: number) => makeLog(id)),
    deleteBacktest: vi.fn(async () => undefined),
  }
}

function renderBacktests(api: ReturnType<typeof fakeApi>) {
  window.history.pushState({}, '', '/backtests')
  render(
    <AppProviders api={api}>
      <App />
    </AppProviders>,
  )
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('BacktestsPage', () => {
  it('lists saved logs with the totals for the filtered set', async () => {
    renderBacktests(fakeApi([makeLog(7)]))

    expect(await screen.findByText('NIFTY')).toBeInTheDocument()
    const logs = screen.getByText('Logs').closest('.ant-statistic') as HTMLElement
    expect(logs).toHaveTextContent('1')
    const wins = screen.getByText('Wins / losses').closest('.ant-statistic') as HTMLElement
    expect(wins).toHaveTextContent('1 / 0')
    expect(screen.getByText('Win rate').closest('.ant-statistic')).toHaveTextContent('100%')
  })

  it('shows the empty message when nothing is logged yet', async () => {
    renderBacktests(fakeApi([]))
    expect(await screen.findByText('No backtests yet. Log one with New backtest.')).toBeInTheDocument()
  })

  it('keeps Save disabled until the draft is complete, then creates the log', async () => {
    const api = fakeApi([])
    renderBacktests(api)

    fireEvent.click(await screen.findByRole('button', { name: /New backtest/ }))
    const save = screen.getByRole('button', { name: 'Save backtest' })
    expect(save).toBeDisabled()
    expect(screen.getByText('instrument must not be blank')).toBeInTheDocument()

    await pickInstrument('Instrument', 'NIFTY')
    type('Expiry date', '2026-11-26')
    type('Entry date', '2026-11-18')
    type('Exit date', '2026-11-20')
    type('Lot size', '75')
    type('Lots', '2')
    type('Entry price', '24000')
    type('Stop loss', '23900')
    type('Target 1', '24300')
    type('Exit price', '24250')
    type('Capital', '300000')
    type('Entry criteria', 'RD bullish on daily')
    type('Lesson', 'Waited for the weapon candle')
    fireEvent.mouseDown(screen.getByLabelText('Exit reason'))
    fireEvent.click(await screen.findByText('Planned target hit'))

    expect(screen.getByText('Quantity: 150 (lots × lot size)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Why saving is blocked')).not.toBeInTheDocument()
    expect(save).toBeEnabled()

    fireEvent.click(save)
    await waitFor(() => expect(api.createBacktest).toHaveBeenCalledTimes(1))
    expect(api.createBacktest.mock.calls[0][0]).toMatchObject({ instrument: 'NIFTY', quantity: 150, exitReason: 'planned_target' })
  })

  it('opens the edit form prefilled from the saved log', async () => {
    renderBacktests(fakeApi([makeLog(7)]))

    fireEvent.click(await screen.findByLabelText('Edit backtest 7'))
    expect(await screen.findByTitle('NIFTY')).toBeInTheDocument()
    expect(screen.getByLabelText('Entry price')).toHaveValue('24000')
    expect(screen.getByLabelText('Target 1')).toHaveValue('24300')
    expect(screen.getByText('Edit backtest 7')).toBeInTheDocument()
  })

  it('shows the Trade Gate plan that opened the page, as a new log', async () => {
    const plan = {
      id: 'plan-1',
      date: '2026-11-18',
      createdAt: '2026-11-18T09:30:00.000Z',
      instrument: 'TCS',
      segment: 'equity' as const,
      optionType: null,
      direction: 'short' as const,
      conviction: 'medium' as const,
      capital: 200000,
      entry: 3950,
      stopLoss: 4050,
      target: 3750,
      lotSize: null,
      quantity: 10,
      lots: null,
      actualRisk: 1000,
      rewardRisk: 2,
      rulesVersion: 1,
    }
    window.history.pushState({ usr: { fromPlan: plan } }, '', '/backtests')
    render(
      <AppProviders api={fakeApi([])}>
        <App />
      </AppProviders>,
    )

    expect(await screen.findByTitle('TCS')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity (shares)')).toHaveValue('10')
    expect(screen.getByText('Sell / Short').closest('label')).toHaveClass('ant-radio-button-wrapper-checked')
  })
})
