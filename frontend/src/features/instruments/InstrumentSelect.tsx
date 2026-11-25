import { Select } from 'antd'

import type { Instrument } from '../../api/client'
import { useInstruments } from './useInstruments'

interface InstrumentSelectProps {
  /** The selected symbol, or null when none is chosen. */
  value: string | null
  /** Called with the symbol and the full instrument (so the caller can read its lot size), or nulls when cleared. */
  onChange: (symbol: string | null, instrument: Instrument | null) => void
  label: string
  disabled?: boolean
}

/**
 * Picks an instrument from the profile's list. Only listed symbols can be chosen, so every log uses the same names.
 * An empty list points the user to the profile menu, where instruments are added.
 */
export default function InstrumentSelect({ value, onChange, label, disabled }: InstrumentSelectProps) {
  const { data: instruments = [], isLoading, error } = useInstruments()

  const emptyMessage = error
    ? error.message
    : instruments.length === 0
      ? 'No instruments yet. Add them from the profile menu, then Instruments.'
      : 'No instrument matches'

  return (
    <Select
      aria-label={label}
      showSearch
      // The list is short, so every option is rendered; virtual scrolling only hides rows that are off screen.
      virtual={false}
      allowClear
      disabled={disabled}
      loading={isLoading}
      placeholder="Choose an instrument"
      style={{ width: '100%' }}
      value={value}
      notFoundContent={emptyMessage}
      options={instruments.map((instrument) => ({ value: instrument.symbol, label: instrument.symbol }))}
      onChange={(symbol: string | undefined) => {
        const picked = symbol ? (instruments.find((instrument) => instrument.symbol === symbol) ?? null) : null
        onChange(symbol ?? null, picked)
      }}
    />
  )
}
