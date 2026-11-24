/** Shared display helpers for the backtest screens. Kept apart from components so the component files export only components. */

export const rupees = (value: number) => {
  const text = `₹${Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  return value < 0 ? `-${text}` : text
}

export const plain = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 })

export const ratio = (value: number | null) => (value === null ? '—' : `1:${value.toFixed(2)}`)

/** Looks up a label by id; falls back to the id itself, or a dash when there is none. */
export function labelOf<T extends string>(list: { id: T; label: string }[], id: T | null | undefined): string {
  if (id === null || id === undefined) return '—'
  return list.find((item) => item.id === id)?.label ?? id
}

/** Green for a win, red for a loss, neutral otherwise. */
export function pnlColor(value: number): string | undefined {
  if (value > 0) return '#52c41a'
  if (value < 0) return '#ff4d4f'
  return undefined
}
