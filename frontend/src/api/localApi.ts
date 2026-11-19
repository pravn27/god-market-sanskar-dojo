import { toIsoDate, type IsoDate } from '../domain/dates'
import type { RitualLogs } from '../domain/dojo'
import { buildDojoDay } from '../domain/dojoDay'
import { findRitual, ritualsFor } from '../domain/rituals'
import { DojoApiError, type DojoApi } from './client'

export const STORAGE_KEY = 'sanskar-dojo-data-v1'

interface StoredData {
  ritualLogs: RitualLogs
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export function createLocalDojoApi(
  storage: KeyValueStorage = window.localStorage,
  now: () => Date = () => new Date(),
): DojoApi {
  const read = (): StoredData => {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return { ritualLogs: {} }
    try {
      const parsed = JSON.parse(raw) as Partial<StoredData>
      return { ritualLogs: parsed.ritualLogs ?? {} }
    } catch {
      return { ritualLogs: {} }
    }
  }
  const write = (data: StoredData) => storage.setItem(STORAGE_KEY, JSON.stringify(data))
  const today = () => toIsoDate(now())

  return {
    today,

    async getDojoDay(date: IsoDate) {
      return buildDojoDay(date, today(), read().ritualLogs)
    },

    async toggleRitual(date: IsoDate, ritualId: string) {
      const current = today()
      if (date > current) throw new DojoApiError(400, 'Check-ins for a future date are not allowed.')
      if (date < current) throw new DojoApiError(400, 'Past days are read-only.')
      if (!findRitual(ritualId) || !ritualsFor(date).some((r) => r.id === ritualId)) {
        throw new DojoApiError(404, `Unknown ritual for this day: ${ritualId}`)
      }

      const data = read()
      const done = new Set(data.ritualLogs[date] ?? [])
      if (done.has(ritualId)) done.delete(ritualId)
      else done.add(ritualId)
      data.ritualLogs[date] = [...done]
      write(data)
      return buildDojoDay(date, current, data.ritualLogs)
    },
  }
}
