import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Modal } from 'antd'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AppProviders from '../../AppProviders'
import { DojoApiError, type DojoApi, type RitualDefinition } from '../../api/client'
import RitualSettingsDrawer from './RitualSettingsDrawer'

const TODAY = '2026-11-23'

function definition(overrides: Partial<RitualDefinition> & Pick<RitualDefinition, 'key' | 'label'>): RitualDefinition {
  return {
    minutes: 20,
    schedule: 'daily',
    weekdays: null,
    monthlyLastMarketDays: null,
    countsForStreak: true,
    sortOrder: 1,
    validFrom: '2026-01-01',
    validTo: null,
    ...overrides,
  }
}

const SEEDED: RitualDefinition[] = [
  definition({ key: 'backtesting', label: 'Daily Backtesting', minutes: 30, sortOrder: 1 }),
  definition({ key: 'webinar', label: 'MyASTA webinar recording session', minutes: 20, sortOrder: 2 }),
  definition({
    key: 'gym',
    label: 'Gym',
    minutes: 40,
    schedule: 'weekdays',
    weekdays: [1, 3, 5],
    countsForStreak: false,
    sortOrder: 3,
  }),
]

function fakeApi(overrides: Partial<DojoApi> = {}): DojoApi {
  return {
    today: () => TODAY,
    getDojoDay: vi.fn(),
    toggleRitual: vi.fn(),
    listRituals: vi.fn(async () => SEEDED),
    createRitual: vi.fn(async () => definition({ key: 'chart_review', label: 'Chart review' })),
    updateRitual: vi.fn(async () => SEEDED[0]),
    retireRitual: vi.fn(async () => undefined),
    reorderRituals: vi.fn(async () => SEEDED),
    getTradeGateStatus: vi.fn(),
    logTradePlan: vi.fn(),
    ...overrides,
  } as unknown as DojoApi
}

function renderDrawer(api: DojoApi) {
  return render(
    <AppProviders api={api}>
      <RitualSettingsDrawer open onClose={() => undefined} />
    </AppProviders>,
  )
}

describe('RitualSettingsDrawer', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lists today\'s rituals in order with minutes and schedule', async () => {
    renderDrawer(fakeApi())

    expect(await screen.findByText('Daily Backtesting')).toBeInTheDocument()
    expect(screen.getByText('30 min')).toBeInTheDocument()
    expect(screen.getByText('Mon, Wed, Fri')).toBeInTheDocument()
    expect(screen.getByText('3 of 12 active rituals')).toBeInTheDocument()
  })

  it('asks the API for today\'s rituals', async () => {
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('Daily Backtesting')
    expect(api.listRituals).toHaveBeenCalledWith(TODAY)
  })

  it('creates a daily ritual from the form', async () => {
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('Daily Backtesting')

    fireEvent.click(screen.getByRole('button', { name: /add ritual/i }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: '  Chart review  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add ritual' }))

    await waitFor(() =>
      expect(api.createRitual).toHaveBeenCalledWith({
        label: 'Chart review',
        minutes: 20,
        schedule: 'daily',
        weekdays: null,
        monthlyLastMarketDays: null,
        countsForStreak: true,
      }),
    )
  })

  it('does not submit a ritual without a name', async () => {
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('Daily Backtesting')

    fireEvent.click(screen.getByRole('button', { name: /add ritual/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add ritual' }))

    expect(await screen.findByText('Enter a name for the ritual.')).toBeInTheDocument()
    expect(api.createRitual).not.toHaveBeenCalled()
  })

  it('edits a ritual and keeps its streak flag', async () => {
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('Gym')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Gym' }))
    // Only the open form has a Name field and a Save button, so these queries are unambiguous.
    expect(await screen.findByText('Edit ritual')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Gym')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(api.updateRitual).toHaveBeenCalledWith('gym', {
        label: 'Gym',
        minutes: 40,
        schedule: 'weekdays',
        weekdays: [1, 3, 5],
        monthlyLastMarketDays: null,
        countsForStreak: false,
      }),
    )
  })

  it('moves a ritual down and sends the new order', async () => {
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('Daily Backtesting')

    fireEvent.click(screen.getByRole('button', { name: 'Move Daily Backtesting down' }))

    await waitFor(() => expect(api.reorderRituals).toHaveBeenCalledWith(['webinar', 'backtesting', 'gym']))
  })

  it('disables moving the first ritual up and the last ritual down', async () => {
    renderDrawer(fakeApi())
    await screen.findByText('Daily Backtesting')

    expect(screen.getByRole('button', { name: 'Move Daily Backtesting up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Gym down' })).toBeDisabled()
  })

  it('retires a ritual only after confirmation', async () => {
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('Daily Backtesting')

    fireEvent.click(screen.getByRole('button', { name: 'Retire Daily Backtesting' }))
    expect(api.retireRitual).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: 'Retire' }))
    await waitFor(() => expect(api.retireRitual).toHaveBeenCalledWith('backtesting'))
  })

  it('shows the server message when a ritual cannot be retired', async () => {
    const api = fakeApi({
      retireRitual: vi.fn(async () => {
        throw new DojoApiError(409, 'This ritual started today. Edit it instead, or retire it from tomorrow.')
      }),
    })
    renderDrawer(api)
    await screen.findByText('Daily Backtesting')

    fireEvent.click(screen.getByRole('button', { name: 'Retire Daily Backtesting' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retire' }))

    expect(await screen.findByText(/started today/)).toBeInTheDocument()
  })

  it('stops adding rituals at the limit of twelve', async () => {
    const twelve = Array.from({ length: 12 }, (_, index) =>
      definition({ key: `r${index}`, label: `Ritual ${index}`, sortOrder: index + 1 }),
    )
    renderDrawer(fakeApi({ listRituals: vi.fn(async () => twelve) }))

    expect(await screen.findByText('12 of 12 active rituals')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add ritual/i })).toBeDisabled()
  })

  it('asks before discarding unsaved edits, and keeps them if the user stays', async () => {
    const confirm = vi.spyOn(Modal, 'confirm')
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('Gym')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Gym' }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Gym (evening)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard your changes?', cancelText: 'Keep editing' }))
    // Staying put means the form is still open with the edit in it, and nothing was saved.
    expect(screen.getByLabelText('Name')).toHaveValue('Gym (evening)')
    expect(api.updateRitual).not.toHaveBeenCalled()
  })

  it('leaves the form without a prompt when nothing was changed', async () => {
    const confirm = vi.spyOn(Modal, 'confirm')
    renderDrawer(fakeApi())
    await screen.findByText('Gym')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Gym' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('Ritual settings')).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('offers to add the first ritual when there are none', async () => {
    renderDrawer(fakeApi({ listRituals: vi.fn(async () => []) }))

    expect(await screen.findByText(/No rituals yet/)).toBeInTheDocument()
    expect(screen.getByText('0 of 12 active rituals')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /add ritual/i })[1])
    expect(await screen.findByLabelText('Name')).toBeInTheDocument()
  })

  it('shows a notice that changes apply from today', async () => {
    renderDrawer(fakeApi())
    expect(await screen.findByText(/Changes apply from today/)).toBeInTheDocument()
  })
})
