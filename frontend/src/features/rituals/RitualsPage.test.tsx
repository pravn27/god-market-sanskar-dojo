import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AppProviders from '../../AppProviders'
import type { DojoApi, MonthView } from '../../api/client'
import { buildDojoDay } from '../../domain/dojoDay'
import RitualsPage from './RitualsPage'

const TODAY = '2026-11-22'

const emptyMonth: MonthView = {
  month: '2026-11',
  prevMonth: null,
  nextMonth: null,
  days: [],
  summary: { marketDays: 0, onTrackDays: 0, fullDays: 0 },
}

function fakeApi(): DojoApi {
  return {
    today: () => TODAY,
    getDojoDay: vi.fn(async (date: string) => buildDojoDay(date, TODAY, {})),
    getMonth: vi.fn(async () => emptyMonth),
    getGrowth: vi.fn(async () => []),
  } as unknown as DojoApi
}

describe('RitualsPage', () => {
  it('shows today by default and switches to the History calendar', async () => {
    render(
      <AppProviders api={fakeApi()}>
        <RitualsPage />
      </AppProviders>,
    )

    expect(await screen.findByText('Daily rituals')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'History' }))

    expect(await screen.findByRole('button', { name: 'Previous month' })).toBeInTheDocument()
  })
})
