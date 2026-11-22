import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AppProviders from '../../AppProviders'
import type { DojoApi, MonthDay, MonthView } from '../../api/client'
import type { IsoDate } from '../../domain/dates'
import { buildDojoDay } from '../../domain/dojoDay'
import HistoryPage from './HistoryPage'
import { cellStatus } from './monthGrid'

const TODAY: IsoDate = '2026-11-22'

/** Builds a month the way the backend would: 6 daily rituals, weekends not counted. */
function buildMonth(month: string, doneFor: (date: IsoDate) => number): MonthView {
  const [year, number] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate()
  const days: MonthDay[] = []
  for (let d = 1; d <= last; d += 1) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    const weekday = new Date(Date.UTC(year, number - 1, d)).getUTCDay()
    const marketDay = weekday !== 0 && weekday !== 6
    const future = date > TODAY
    const dailyDone = future ? 0 : doneFor(date)
    days.push({
      date,
      marketDay,
      future,
      dailyTotal: 6,
      dailyDone,
      onTrack: !future && marketDay && dailyDone >= 4,
      full: !future && marketDay && dailyDone === 6,
    })
  }
  const elapsed = days.filter((d) => d.marketDay && !d.future)
  return {
    month,
    prevMonth: month === '2026-11' ? '2026-10' : null,
    nextMonth: month === '2026-10' ? '2026-11' : null,
    days,
    summary: {
      marketDays: elapsed.length,
      onTrackDays: elapsed.filter((d) => d.onTrack).length,
      fullDays: elapsed.filter((d) => d.full).length,
    },
  }
}

const doneFor = (date: IsoDate) => (date === '2026-11-17' ? 6 : date === '2026-11-16' ? 4 : 2)

function fakeApi(overrides: Partial<DojoApi> = {}) {
  const logs = { '2026-11-17': ['backtesting'] }
  const api = {
    today: () => TODAY,
    getMonth: vi.fn(async (month: string) => buildMonth(month, doneFor)),
    getDojoDay: vi.fn(async (date: IsoDate) => buildDojoDay(date, TODAY, logs)),
    toggleRitual: vi.fn(async (date: IsoDate) => buildDojoDay(date, TODAY, {})),
    ...overrides,
  } as unknown as DojoApi
  return api
}

function renderHistory(api: DojoApi) {
  return render(
    <AppProviders api={api}>
      <HistoryPage />
    </AppProviders>,
  )
}

describe('HistoryPage', () => {
  it('opens on the current month with the summary and a Monday-first grid', async () => {
    renderHistory(fakeApi())

    expect(await screen.findByText('Market days so far')).toBeInTheDocument()
    expect(screen.getByText('November 2026')).toBeInTheDocument()
    expect(screen.getByText('On track').closest('.ant-card')).toHaveTextContent(/2\s*\/\s*15/)
    expect(screen.getByText('Full days').closest('.ant-card')).toHaveTextContent(/1\s*\/\s*15/)
    // 1 November 2026 is a Sunday, so six blank cells lead the Monday-first grid.
    expect(document.querySelectorAll('.history-cell--blank')).toHaveLength(6)
  })

  it('disables the next month button on the current month', async () => {
    renderHistory(fakeApi())
    await screen.findByText('Market days so far')

    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeEnabled()
  })

  it('moves to the previous month and back again', async () => {
    const api = fakeApi()
    renderHistory(api)
    await screen.findByText('Market days so far')

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(await screen.findByText('October 2026')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled())
    expect(api.getMonth).toHaveBeenCalledWith('2026-10')

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(await screen.findByText('November 2026')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled())
    expect(api.getMonth).toHaveBeenLastCalledWith('2026-11')
  })

  it('never lets a future day be opened', async () => {
    renderHistory(fakeApi())
    await screen.findByText('Market days so far')

    expect(screen.getByRole('button', { name: '2026-11-25: 0 of 6 daily rituals' })).toBeDisabled()
  })

  it('lets a day inside the last 7 days be corrected from its drawer', async () => {
    const api = fakeApi()
    renderHistory(api)
    await screen.findByText('Market days so far')

    fireEvent.click(screen.getByRole('button', { name: '2026-11-17: 6 of 6 daily rituals' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Tuesday, 17 November 2026')).toBeInTheDocument()
    const ritual = await within(dialog).findByRole('checkbox', { name: 'Daily Backtesting' })
    expect(ritual).toBeChecked()
    expect(ritual).toBeEnabled()

    fireEvent.click(ritual)
    await waitFor(() => expect(api.toggleRitual).toHaveBeenCalledWith('2026-11-17', 'backtesting'))
  })

  it('keeps a day older than the last 7 days read-only', async () => {
    renderHistory(fakeApi())
    await screen.findByText('Market days so far')

    fireEvent.click(screen.getByRole('button', { name: '2026-11-10: 2 of 6 daily rituals' }))

    const dialog = await screen.findByRole('dialog')
    const ritual = await within(dialog).findByRole('checkbox', { name: 'Daily Backtesting' })
    expect(ritual).toBeDisabled()
    expect(within(dialog).getByText('Older than 7 days: read-only.')).toBeInTheDocument()
  })

  it('shows an error with a retry when the month cannot be loaded', async () => {
    const getMonth = vi.fn(async () => {
      throw new Error('The Dojo backend is not reachable.')
    })
    renderHistory(fakeApi({ getMonth }))

    expect(await screen.findByText('Could not load this month.', {}, { timeout: 4000 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(getMonth.mock.calls.length).toBeGreaterThanOrEqual(2))
  })
})

describe('cellStatus', () => {
  const base: MonthDay = { date: '2026-11-17', marketDay: true, future: false, dailyTotal: 6, dailyDone: 0, onTrack: false, full: false }

  it('classifies a day by its streak progress', () => {
    expect(cellStatus({ ...base, full: true, onTrack: true, dailyDone: 6 })).toBe('full')
    expect(cellStatus({ ...base, onTrack: true, dailyDone: 4 })).toBe('on-track')
    expect(cellStatus({ ...base, dailyDone: 3 })).toBe('short')
  })

  it('does not colour weekends or future days', () => {
    expect(cellStatus({ ...base, marketDay: false, dailyDone: 6 })).toBe('weekend')
    expect(cellStatus({ ...base, future: true })).toBe('future')
  })
})
