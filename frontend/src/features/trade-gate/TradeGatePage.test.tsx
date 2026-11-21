import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from '../../App'
import AppProviders from '../../AppProviders'
import { createLocalDojoApi } from '../../api/localApi'

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

function renderGate() {
  const api = createLocalDojoApi(memoryStorage(), () => new Date(2026, 10, 18, 9, 0))
  window.history.pushState({}, '', '/trade-gate')
  render(
    <AppProviders api={api}>
      <App />
    </AppProviders>,
  )
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('TradeGatePage', () => {
  it('sizes the trade, blocks below 1:3, and logs a committed plan', async () => {
    renderGate()
    expect(await screen.findByText('Not yet available (E-03)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Equity'))
    expect(screen.queryAllByText('Points allowed')).toHaveLength(0)
    type('Instrument', 'Test stock')
    type('Capital', '200000')
    expect(screen.getByLabelText('Capital')).toHaveValue('200,000')
    expect(screen.getByText('₹4,000')).toBeInTheDocument()
    expect(screen.getAllByText('Medium').some((el) => el.closest('th')?.classList.contains('risk-range-selected'))).toBe(true)
    expect(screen.getAllByText('Maximum').length).toBeGreaterThan(0)
    type('Entry', '3950')
    type('Stop loss', '3850')
    expect(screen.getAllByText('Shares allowed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₹79,000').length).toBeGreaterThan(0)
    type('Target', '4100')

    expect(await screen.findByText(/Adjusted entry: 3912.5/)).toBeInTheDocument()
    const log = screen.getByRole('button', { name: 'Log plan' })
    expect(log).toBeDisabled()

    type('Target', '4300')
    expect(screen.queryByText(/Adjusted entry/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /I accept losing ₹2,000/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /within 30 seconds/ }))
    expect(log).toBeEnabled()
    fireEvent.click(log)

    expect(await screen.findByText(/Plan saved: Test stock, risk ₹2,000, R:R 1:3.5/)).toBeInTheDocument()
    const weekly = screen.getByText('Plans this week').closest('.ant-statistic') as HTMLElement
    await waitFor(() => expect(within(weekly).getByText('1')).toBeInTheDocument())
  })

  it('sets conviction by clicking a risk range column', async () => {
    renderGate()
    const high = (await screen.findAllByText('High'))[0]
    fireEvent.click(high)
    expect(screen.getAllByText('High').some((el) => el.closest('th')?.classList.contains('risk-range-selected'))).toBe(true)
    expect(screen.queryByLabelText('Conviction')).not.toBeInTheDocument()
  })

  it('clears the trade when the instrument changes and keeps capital', async () => {
    renderGate()
    type('Instrument', 'NG Mini')
    type('Capital', '300000')
    type('Entry', '7780')
    fireEvent.click(screen.getByText('Sell / Short'))
    fireEvent.click(screen.getByText('Equity'))
    expect(screen.getByLabelText('Instrument')).toHaveValue('')
    expect(screen.getByLabelText('Entry')).toHaveValue('')
    expect(screen.getByLabelText('Capital')).toHaveValue('300,000')
    expect(screen.getByText('Buy / Long').closest('label')).toHaveClass('ant-radio-button-wrapper-checked')
    expect(screen.queryByLabelText('Lot size')).not.toBeInTheDocument()
  })

  it('shows lots allowed without an investment row for F&O buy', async () => {
    renderGate()
    fireEvent.click(await screen.findByText('Futures'))
    type('Capital', '300000')
    type('Lot size', '250')
    type('Entry', '7780')
    type('Stop loss', '7770')
    expect(screen.getAllByText('Lots allowed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Risk Points allowed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Investment')).toHaveLength(0)
  })
})
