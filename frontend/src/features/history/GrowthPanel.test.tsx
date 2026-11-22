import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AppProviders from '../../AppProviders'
import { DojoApiError, type DojoApi, type GrowthMonth } from '../../api/client'
import GrowthPanel from './GrowthPanel'
import { growthSummary, monthShortLabel } from './monthGrid'

const MONTHS: GrowthMonth[] = [
  { month: '2026-10', marketDays: 22, onTrackDays: 18, fullDays: 6 },
  { month: '2026-11', marketDays: 15, onTrackDays: 2, fullDays: 1 },
]

function renderPanel(getGrowth: () => Promise<GrowthMonth[]>) {
  const api = { today: () => '2026-11-22', getGrowth: vi.fn(getGrowth) } as unknown as DojoApi
  return render(
    <AppProviders api={api}>
      <GrowthPanel />
    </AppProviders>,
  )
}

describe('monthShortLabel', () => {
  it('shows the month and the two-digit year', () => {
    expect(monthShortLabel('2026-11')).toBe('Nov 26')
    expect(monthShortLabel('2027-01')).toBe('Jan 27')
  })
})

describe('growthSummary', () => {
  it('spells out the on-track count of each month for screen readers', () => {
    expect(growthSummary(MONTHS)).toBe(
      'On-track market days per month. Oct 26: 18 of 22 market days on track. Nov 26: 2 of 15 market days on track.',
    )
  })
})

describe('GrowthPanel', () => {
  it('shows one bar per month, described in text', async () => {
    renderPanel(async () => MONTHS)

    const chart = await screen.findByRole('img', { name: /Oct 26: 18 of 22/ })
    expect(chart).toHaveAccessibleName(/Nov 26: 2 of 15/)
    expect(screen.getByText('Growth')).toBeInTheDocument()
  })

  it('shows an error with a retry when growth cannot be loaded', async () => {
    renderPanel(async () => {
      throw new DojoApiError(501, 'Growth needs the local backend.')
    })

    expect(await screen.findByText('Could not load growth.', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText('Growth needs the local backend.')).toBeInTheDocument()
  })
})
