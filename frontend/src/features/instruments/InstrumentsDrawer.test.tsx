import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Modal } from 'antd'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AppProviders from '../../AppProviders'
import { DojoApiError, type DojoApi, type Instrument } from '../../api/client'
import InstrumentsDrawer from './InstrumentsDrawer'
import { SAMPLE_INSTRUMENTS } from './instrumentTestUtils'

function fakeApi(overrides: Partial<DojoApi> = {}): DojoApi {
  return {
    today: () => '2026-11-25',
    listInstruments: vi.fn(async () => SAMPLE_INSTRUMENTS),
    createInstrument: vi.fn(async (input) => ({ id: 9, symbol: input.symbol, lotSize: input.lotSize })),
    updateInstrument: vi.fn(async (id: number, input) => ({ id, symbol: input.symbol, lotSize: input.lotSize })),
    deleteInstrument: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as DojoApi
}

function renderDrawer(api: DojoApi, open = true) {
  return render(
    <AppProviders api={api}>
      <InstrumentsDrawer open={open} onClose={() => undefined} />
    </AppProviders>,
  )
}

describe('InstrumentsDrawer', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lists the instruments with their lot sizes', async () => {
    renderDrawer(fakeApi())

    expect(await screen.findByText('NIFTY')).toBeInTheDocument()
    expect(screen.getByText('Lot size 75')).toBeInTheDocument()
    expect(screen.getAllByText('Equity, no lot size')).toHaveLength(2)
    expect(screen.getByText(/5 instruments/)).toBeInTheDocument()
  })

  it('does not load the list while the drawer is closed', () => {
    const api = fakeApi()
    renderDrawer(api, false)
    expect(api.listInstruments).not.toHaveBeenCalled()
  })

  it('adds an instrument with its lot size', async () => {
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('NIFTY')

    fireEvent.click(screen.getByRole('button', { name: /add instrument/i }))
    fireEvent.change(await screen.findByLabelText('Symbol'), { target: { value: '  sensex ' } })
    fireEvent.change(screen.getByLabelText(/^Lot size/), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /add instrument/i }))

    await waitFor(() => expect(api.createInstrument).toHaveBeenCalledWith({ symbol: 'SENSEX', lotSize: 10 }))
  })

  it('accepts an equity instrument with no lot size', async () => {
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('NIFTY')

    fireEvent.click(screen.getByRole('button', { name: /add instrument/i }))
    fireEvent.change(await screen.findByLabelText('Symbol'), { target: { value: 'INFY' } })
    fireEvent.click(screen.getByRole('button', { name: /add instrument/i }))

    await waitFor(() => expect(api.createInstrument).toHaveBeenCalledWith({ symbol: 'INFY', lotSize: null }))
  })

  it('does not save a symbol with characters the market does not use', async () => {
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('NIFTY')

    fireEvent.click(screen.getByRole('button', { name: /add instrument/i }))
    fireEvent.change(await screen.findByLabelText('Symbol'), { target: { value: 'NIFTY/50' } })
    fireEvent.click(screen.getByRole('button', { name: /add instrument/i }))

    expect(await screen.findByText('Use letters, digits, spaces and & . - _ only.')).toBeInTheDocument()
    expect(api.createInstrument).not.toHaveBeenCalled()
  })

  it('shows the server message when the symbol is already listed', async () => {
    const api = fakeApi({
      createInstrument: vi.fn(async () => {
        throw new DojoApiError(409, 'NIFTY is already in the list.')
      }),
    })
    renderDrawer(api)
    await screen.findByText('NIFTY')

    fireEvent.click(screen.getByRole('button', { name: /add instrument/i }))
    fireEvent.change(await screen.findByLabelText('Symbol'), { target: { value: 'nifty' } })
    fireEvent.click(screen.getByRole('button', { name: /add instrument/i }))

    expect(await screen.findByText('NIFTY is already in the list.')).toBeInTheDocument()
  })

  it('edits an instrument and keeps its symbol', async () => {
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('NIFTY')

    fireEvent.click(screen.getByRole('button', { name: 'Edit NIFTY' }))
    expect(await screen.findByLabelText('Symbol')).toHaveValue('NIFTY')
    fireEvent.change(screen.getByLabelText(/^Lot size/), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(api.updateInstrument).toHaveBeenCalledWith(3, { symbol: 'NIFTY', lotSize: 50 }))
  })

  it('removes an instrument only after confirmation', async () => {
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('NIFTY')

    fireEvent.click(screen.getByRole('button', { name: 'Remove NIFTY' }))
    expect(api.deleteInstrument).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(api.deleteInstrument).toHaveBeenCalledWith(3))
  })

  it('offers to add the first instrument when the list is empty', async () => {
    renderDrawer(fakeApi({ listInstruments: vi.fn(async (): Promise<Instrument[]> => []) }))

    expect(await screen.findByText(/No instruments yet/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /add instrument/i })).toHaveLength(2)
  })

  it('asks before discarding unsaved edits', async () => {
    const confirm = vi.spyOn(Modal, 'confirm')
    const api = fakeApi()
    renderDrawer(api)
    await screen.findByText('NIFTY')

    fireEvent.click(screen.getByRole('button', { name: 'Edit NIFTY' }))
    fireEvent.change(await screen.findByLabelText('Symbol'), { target: { value: 'NIFTY 50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard your changes?' }))
    expect(screen.getByLabelText('Symbol')).toHaveValue('NIFTY 50')
    expect(api.updateInstrument).not.toHaveBeenCalled()
  })
})
