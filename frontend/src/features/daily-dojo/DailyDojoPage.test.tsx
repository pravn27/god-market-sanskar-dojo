import { fireEvent, render, screen } from '@testing-library/react'
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

function renderApp(now: Date) {
  const api = createLocalDojoApi(memoryStorage(), () => now)
  window.history.pushState({}, '', '/')
  return render(
    <AppProviders api={api}>
      <App />
    </AppProviders>,
  )
}

describe('DailyDojoPage', () => {
  it('opens by default and updates mood and minutes when a ritual is ticked', async () => {
    renderApp(new Date(2026, 10, 18, 9, 0))

    const ritual = await screen.findByRole('checkbox', { name: 'Daily Backtesting' })
    expect(screen.getByText('None')).toBeInTheDocument()

    fireEvent.click(ritual)

    expect(await screen.findByText('Blank')).toBeInTheDocument()
    expect(ritual).toBeChecked()
    expect(screen.queryByText('Weekend quest')).not.toBeInTheDocument()
  })

  it('shows the weekend quest on Saturday', async () => {
    renderApp(new Date(2026, 10, 21, 9, 0))
    expect(await screen.findByText('Weekend quest')).toBeInTheDocument()
    expect(screen.getByText(/Non-market day/)).toBeInTheDocument()
  })
})
