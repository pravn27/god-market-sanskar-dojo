import { EDIT_WINDOW_DAYS, isEditableDay, toIsoDate, type IsoDate } from '../domain/dates'
import type { RitualLogs } from '../domain/dojo'
import { buildDojoDay } from '../domain/dojoDay'
import { findRitual, ritualsFor } from '../domain/rituals'
import { capReasons, countPlans, evaluateSizing, TRADE_GATE_RULES } from '../domain/tradeGate'
import { DojoApiError, type DojoApi, type TradeGateStatus, type TradePlan } from './client'

export const STORAGE_KEY = 'sanskar-dojo-data-v1'

interface StoredData {
  ritualLogs: RitualLogs
  tradePlans: TradePlan[]
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export function createLocalDojoApi(
  storage: KeyValueStorage = window.localStorage,
  now: () => Date = () => new Date(),
): DojoApi {
  const read = (): StoredData => {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return { ritualLogs: {}, tradePlans: [] }
    try {
      const parsed = JSON.parse(raw) as Partial<StoredData>
      return { ritualLogs: parsed.ritualLogs ?? {}, tradePlans: parsed.tradePlans ?? [] }
    } catch {
      return { ritualLogs: {}, tradePlans: [] }
    }
  }
  const write = (data: StoredData) => storage.setItem(STORAGE_KEY, JSON.stringify(data))
  const today = () => toIsoDate(now())

  const gateStatus = (data: StoredData): TradeGateStatus => {
    const counts = countPlans(data.tradePlans.map((p) => p.date), today())
    return {
      readiness: 'not_available',
      locks: 'not_available',
      counts,
      weeklyCap: TRADE_GATE_RULES.weeklyTradeCap,
      monthlyCap: TRADE_GATE_RULES.monthlyTradeCap,
      capReasons: capReasons(counts),
    }
  }

  return {
    today,

    async getDojoDay(date: IsoDate) {
      return buildDojoDay(date, today(), read().ritualLogs)
    },

    // Monthly history is computed from the database, so browser storage cannot show it.
    async getMonth() {
      throw new DojoApiError(501, 'History needs the local backend.')
    },

    async toggleRitual(date: IsoDate, ritualId: string) {
      const current = today()
      if (date > current) throw new DojoApiError(400, 'Check-ins for a future date are not allowed.')
      if (!isEditableDay(date, current)) throw new DojoApiError(400, `Only the last ${EDIT_WINDOW_DAYS} days can be changed.`)
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

    // Ritual definitions live only in the database, so browser storage cannot manage them.
    async listRituals() {
      throw new DojoApiError(501, 'Ritual settings need the local backend.')
    },
    async createRitual() {
      throw new DojoApiError(501, 'Ritual settings need the local backend.')
    },
    async updateRitual() {
      throw new DojoApiError(501, 'Ritual settings need the local backend.')
    },
    async retireRitual() {
      throw new DojoApiError(501, 'Ritual settings need the local backend.')
    },
    async reorderRituals() {
      throw new DojoApiError(501, 'Ritual settings need the local backend.')
    },

    async getTradeGateStatus() {
      return gateStatus(read())
    },

    async logTradePlan({ sizing, lossAccepted, slWithin30Seconds }) {
      const data = read()
      const result = evaluateSizing(sizing)
      const reasons = [...result.errors, ...gateStatus(data).capReasons]
      if (!lossAccepted || !slWithin30Seconds) reasons.push('Both commitments must be accepted.')
      if (reasons.length > 0) throw new DojoApiError(400, reasons.join(' '))

      const plan: TradePlan = {
        id: `plan-${now().getTime()}-${data.tradePlans.length + 1}`,
        date: today(),
        createdAt: now().toISOString(),
        instrument: sizing.instrument.trim(),
        segment: sizing.segment,
        direction: result.direction,
        conviction: sizing.conviction,
        capital: sizing.capital as number,
        entry: sizing.entry as number,
        stopLoss: sizing.stopLoss as number,
        target: sizing.target as number,
        lotSize: sizing.segment === 'equity' ? null : sizing.lotSize,
        quantity: result.quantity,
        lots: result.lots,
        actualRisk: result.actualRisk,
        rewardRisk: result.rewardRisk as number,
        rulesVersion: TRADE_GATE_RULES.version,
      }
      data.tradePlans.push(plan)
      write(data)
      return plan
    },
  }
}
