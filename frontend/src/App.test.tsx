import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'
import AppProviders from './AppProviders'
import { createLocalDojoApi } from './api/localApi'

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

describe('App navigation', () => {
  it('names the daily screen "Rituals" in the side menu', () => {
    const api = createLocalDojoApi(memoryStorage(), () => new Date(2026, 10, 23, 9, 0))
    window.history.pushState({}, '', '/dojo')
    render(
      <AppProviders api={api}>
        <App />
      </AppProviders>,
    )

    const menu = screen.getByRole('menu', { name: 'Primary' })
    expect(within(menu).getByText('Rituals')).toBeInTheDocument()
    expect(within(menu).queryByText('Daily Dojo')).not.toBeInTheDocument()
  })
})

describe('App header', () => {
  it('opens ritual settings from the profile menu at the right of the header', async () => {
    const api = createLocalDojoApi(memoryStorage(), () => new Date(2026, 10, 23, 9, 0))
    window.history.pushState({}, '', '/dojo')
    render(
      <AppProviders api={api}>
        <App />
      </AppProviders>,
    )

    const profile = screen.getByRole('button', { name: 'Profile menu for Praveen' })
    const themeToggle = screen.getByRole('button', { name: /switch to (dark|light) theme/i })
    // The profile button sits after the theme toggle, so it is the far right control.
    expect(themeToggle.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(profile)
    fireEvent.click(await screen.findByRole('menuitem', { name: /ritual settings/i }))
    // Browser storage cannot manage ritual definitions, and says so. The query retries once first.
    expect(await screen.findByText('Ritual settings need the local backend.', {}, { timeout: 4000 })).toBeInTheDocument()
  }, 10_000)
})
