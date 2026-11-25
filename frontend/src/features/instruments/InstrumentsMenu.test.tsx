import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from '../../App'
import AppProviders from '../../AppProviders'
import { createLocalDojoApi } from '../../api/localApi'
import { SAMPLE_INSTRUMENTS } from './instrumentTestUtils'

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

describe('Instruments in the profile menu', () => {
  it('sits below Ritual settings and opens the instrument list', async () => {
    const api = {
      ...createLocalDojoApi(memoryStorage(), () => new Date(2026, 10, 25, 9, 0)),
      listInstruments: async () => SAMPLE_INSTRUMENTS,
    }
    window.history.pushState({}, '', '/rituals')
    render(
      <AppProviders api={api}>
        <App />
      </AppProviders>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Profile menu for Praveen' }))
    // The sidebar has menu items too, so read only the profile dropdown.
    await screen.findByText('Instruments')
    const items = Array.from(document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item')).map((item) => item.textContent)
    expect(items).toEqual(['Ritual settings', 'Instruments'])

    fireEvent.click(screen.getByText('Instruments'))
    expect(await screen.findByRole('button', { name: /add instrument/i })).toBeInTheDocument()
    expect(await screen.findByText('NIFTY')).toBeInTheDocument()
  })
})
