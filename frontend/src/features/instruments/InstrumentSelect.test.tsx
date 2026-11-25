import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AppProviders from '../../AppProviders'
import type { DojoApi } from '../../api/client'
import InstrumentSelect from './InstrumentSelect'
import { SAMPLE_INSTRUMENTS } from './instrumentTestUtils'

function fakeApi(listInstruments: DojoApi['listInstruments']): DojoApi {
  return { today: () => '2026-11-25', listInstruments } as unknown as DojoApi
}

function Harness({ onPick }: { onPick: (symbol: string | null, lotSize: number | null | undefined) => void }) {
  return (
    <InstrumentSelect
      label="Instrument"
      value={null}
      onChange={(symbol, instrument) => onPick(symbol, instrument?.lotSize)}
    />
  )
}

describe('InstrumentSelect', () => {
  it('offers only the listed instruments and passes the picked one, with its lot size', async () => {
    const onPick = vi.fn()
    render(
      <AppProviders api={fakeApi(async () => SAMPLE_INSTRUMENTS)}>
        <Harness onPick={onPick} />
      </AppProviders>,
    )

    fireEvent.mouseDown(screen.getByLabelText('Instrument'))
    fireEvent.click(await screen.findByRole('option', { name: 'NIFTY' }))

    expect(onPick).toHaveBeenCalledWith('NIFTY', 75)
  })

  it('explains where to add instruments when the list is empty', async () => {
    render(
      <AppProviders api={fakeApi(async () => [])}>
        <Harness onPick={vi.fn()} />
      </AppProviders>,
    )

    fireEvent.mouseDown(screen.getByLabelText('Instrument'))
    expect(await screen.findByText(/No instruments yet. Add them from the profile menu/)).toBeInTheDocument()
  })
})
