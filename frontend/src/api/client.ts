import type { IsoDate } from '../domain/dates'
import type { DojoDay } from '../domain/dojoDay'

export type { DojoDay, DojoRitual } from '../domain/dojoDay'

export class DojoApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Contract shared by the browser-storage implementation and the future `/api/v1` backend.
 * Pages depend only on this interface.
 */
export interface DojoApi {
  today(): IsoDate
  getDojoDay(date: IsoDate): Promise<DojoDay>
  toggleRitual(date: IsoDate, ritualId: string): Promise<DojoDay>
}
