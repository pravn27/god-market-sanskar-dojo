import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AppProviders from '../../AppProviders'
import type { DojoApi, MonthDay, MonthView, WeekView, YearView } from '../../api/client'
import { addDays, dayOfWeek, type IsoDate } from '../../domain/dates'
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
      tracked: true,
      editable: !future && date >= '2026-11-15',
      dailyTotal: 6,
      dailyDone,
      onTrack: !future && dailyDone >= 4,
      full: !future && dailyDone === 6,
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

/** Seven days with one daily ritual. Editable from the last 7 days (16 Nov onwards). Only 17 Nov is ticked. */
function weekFixture(weekStart: IsoDate): WeekView {
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(weekStart, offset)
    const ticked = date === '2026-11-17'
    return {
      date,
      marketDay: offset < 5,
      future: date > TODAY,
      tracked: true,
      editable: date >= '2026-11-16' && date <= TODAY,
      dailyTotal: 1,
      dailyDone: ticked ? 1 : 0,
      onTrack: false,
      full: ticked,
      rituals: [{ id: 'backtesting', label: 'Daily Backtesting', minutes: 30, cadence: 'daily' as const, done: ticked }],
    }
  })
  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    prevWeek: weekStart === '2026-11-16' ? '2026-11-09' : null,
    nextWeek: null,
    days,
    summary: { marketDays: 5, onTrackDays: 0, fullDays: 1 },
  }
}

/** Every day of the year. Tracked from 1 Jan 2026, future after today, and only 17 Nov is ticked. */
function yearFixture(year: number): YearView {
  const days: MonthDay[] = []
  for (let date = `${year}-01-01`; date.startsWith(`${year}-`); date = addDays(date, 1)) {
    const weekday = dayOfWeek(date)
    const future = date > TODAY
    const tracked = date >= '2026-01-01'
    const ticked = tracked && !future && date === '2026-11-17'
    days.push({
      date,
      marketDay: weekday !== 0 && weekday !== 6,
      future,
      tracked,
      editable: false,
      dailyTotal: 6,
      dailyDone: ticked ? 6 : 0,
      onTrack: ticked,
      full: ticked,
    })
  }
  return {
    year,
    prevYear: null,
    nextYear: null,
    days,
    summary: { marketDays: 5, onTrackDays: 1, fullDays: 1 },
  }
}

function fakeApi(overrides: Partial<DojoApi> = {}) {
  const logs = { '2026-11-17': ['backtesting'] }
  const api = {
    today: () => TODAY,
    getMonth: vi.fn(async (month: string) => buildMonth(month, doneFor)),
    getDojoDay: vi.fn(async (date: IsoDate) => buildDojoDay(date, TODAY, logs)),
    toggleRitual: vi.fn(async (date: IsoDate) => buildDojoDay(date, TODAY, {})),
    getGrowth: vi.fn(async () => [{ month: '2026-11', marketDays: 15, onTrackDays: 2, fullDays: 1 }]),
    getWeek: vi.fn(async (weekStart: IsoDate) => weekFixture(weekStart)),
    getYear: vi.fn(async (year: number) => yearFixture(year)),
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

  it('switches to the week view and steps back one week', async () => {
    const api = fakeApi()
    renderHistory(api)
    await screen.findByText('Market days so far')

    fireEvent.click(screen.getByText('Week'))
    expect(await screen.findByRole('heading', { name: '16 Nov – 22 Nov 2026' })).toBeInTheDocument()
    expect(api.getWeek).toHaveBeenCalledWith('2026-11-16')

    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous week' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(await screen.findByRole('heading', { name: '9 Nov – 15 Nov 2026' })).toBeInTheDocument()
    expect(api.getWeek).toHaveBeenLastCalledWith('2026-11-09')
  })

  it('shows each day of the week with its checklist', async () => {
    renderHistory(fakeApi())
    await screen.findByText('Market days so far')

    fireEvent.click(screen.getByText('Week'))
    expect(await screen.findByText('Mon 16 Nov')).toBeInTheDocument()
    expect(screen.getByText('Sun 22 Nov')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox', { name: 'Daily Backtesting' })).toHaveLength(7)
  })

  it('ticks a day inside the last 7 days from the week view', async () => {
    const api = fakeApi()
    renderHistory(api)
    await screen.findByText('Market days so far')

    fireEvent.click(screen.getByText('Week'))
    const card = (await screen.findByText('Wed 18 Nov')).closest('.ant-card') as HTMLElement
    const ritual = within(card).getByRole('checkbox', { name: 'Daily Backtesting' })
    expect(ritual).toBeEnabled()

    fireEvent.click(ritual)
    await waitFor(() => expect(api.toggleRitual).toHaveBeenCalledWith('2026-11-18', 'backtesting'))
  })

  it('keeps an older week read-only', async () => {
    renderHistory(fakeApi())
    await screen.findByText('Market days so far')

    fireEvent.click(screen.getByText('Week'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous week' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))

    const card = (await screen.findByText('Mon 9 Nov')).closest('.ant-card') as HTMLElement
    expect(within(card).getByRole('checkbox', { name: 'Daily Backtesting' })).toBeDisabled()
    expect(within(card).getByText('Older than the last 7 days: read-only.')).toBeInTheDocument()
  })

  it('disables Next week on the current week', async () => {
    renderHistory(fakeApi())
    fireEvent.click(screen.getByText('Week'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next week' })).toBeDisabled())
  })

  it('opens the view named in the URL', async () => {
    window.history.pushState({}, '', '/rituals?view=year')
    const api = fakeApi()
    renderHistory(api)

    expect(await screen.findByRole('heading', { name: '2026' })).toBeInTheDocument()
    expect(api.getYear).toHaveBeenCalledWith(2026)
    expect(await screen.findByRole('button', { name: 'Open November 2026' })).toBeInTheDocument()
    window.history.pushState({}, '', '/')
  })

  it('shows the year as a heatmap with one square per day', async () => {
    renderHistory(fakeApi())
    await screen.findByText('Market days so far')

    fireEvent.click(screen.getByText('Year'))
    expect(await screen.findByRole('button', { name: 'Open March 2026' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^2026-\d{2}-\d{2}: / })).toHaveLength(365)
    expect(screen.getByRole('button', { name: '2026-12-01: 0 of 6 daily rituals' })).toBeDisabled()
  })

  it('opens a day from the year heatmap', async () => {
    renderHistory(fakeApi())
    await screen.findByText('Market days so far')

    fireEvent.click(screen.getByText('Year'))
    fireEvent.click(await screen.findByRole('button', { name: '2026-11-17: 6 of 6 daily rituals' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Tuesday, 17 November 2026')).toBeInTheDocument()
  })

  it('opens a month from its name in the year view', async () => {
    renderHistory(fakeApi())
    await screen.findByText('Market days so far')

    fireEvent.click(screen.getByText('Year'))
    fireEvent.click(await screen.findByRole('button', { name: 'Open October 2026' }))

    expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked()
  })

  it('returns to the current month from another month with Today', async () => {
    renderHistory(fakeApi())
    await screen.findByText('Market days so far')

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
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
  const base: MonthDay = {
    date: '2026-11-17',
    marketDay: true,
    future: false,
    tracked: true,
    editable: true,
    dailyTotal: 6,
    dailyDone: 0,
    onTrack: false,
    full: false,
  }

  it('classifies a day by its streak progress', () => {
    expect(cellStatus({ ...base, full: true, onTrack: true, dailyDone: 6 })).toBe('full')
    expect(cellStatus({ ...base, onTrack: true, dailyDone: 4 })).toBe('on-track')
    expect(cellStatus({ ...base, dailyDone: 3 })).toBe('short')
  })

  it('colours a non-market day by the same rules as a market day', () => {
    expect(cellStatus({ ...base, marketDay: false, full: true, onTrack: true, dailyDone: 6 })).toBe('full')
    expect(cellStatus({ ...base, marketDay: false, onTrack: true, dailyDone: 4 })).toBe('on-track')
    expect(cellStatus({ ...base, marketDay: false, dailyDone: 1 })).toBe('short')
  })

  it('keeps future days neutral', () => {
    expect(cellStatus({ ...base, future: true })).toBe('future')
  })
})
