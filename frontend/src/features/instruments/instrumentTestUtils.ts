import { fireEvent, screen } from '@testing-library/react'

import type { Instrument } from '../../api/client'

/** A small list the tests can pick from. Lot sizes match the real contracts where a test relies on them. */
export const SAMPLE_INSTRUMENTS: Instrument[] = [
  { id: 1, symbol: 'BANKNIFTY', lotSize: 30 },
  { id: 2, symbol: 'NATURALGAS', lotSize: 1250 },
  { id: 3, symbol: 'NIFTY', lotSize: 75 },
  { id: 4, symbol: 'RELIANCE', lotSize: null },
  { id: 5, symbol: 'TCS', lotSize: null },
]

/** Opens a dropdown by its aria-label and clicks one option. */
export async function pickInstrument(label: string, symbol: string) {
  fireEvent.mouseDown(screen.getByLabelText(label))
  fireEvent.click(await screen.findByRole('option', { name: symbol }))
}
