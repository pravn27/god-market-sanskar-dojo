import type { RitualDefinition } from '../../api/client'

/** Index matches the backend: 0 = Sunday ... 6 = Saturday. */
export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const SCHEDULE_GROUP_LABEL: Record<RitualDefinition['schedule'], string> = {
  daily: 'Daily',
  weekdays: 'Selected days',
  weekend: 'Weekend',
  monthly: 'Monthly',
}

/** Extra detail worth showing under a group heading. Daily and weekend are already named by the group. */
export function scheduleDetail(ritual: Pick<RitualDefinition, 'schedule' | 'weekdays' | 'monthlyLastMarketDays'>): string | null {
  if (ritual.schedule === 'weekdays' || ritual.schedule === 'monthly') return describeSchedule(ritual)
  return null
}

export function describeSchedule(ritual: Pick<RitualDefinition, 'schedule' | 'weekdays' | 'monthlyLastMarketDays'>): string {
  switch (ritual.schedule) {
    case 'daily':
      return 'Every day'
    case 'weekend':
      return 'Weekend'
    case 'weekdays':
      return (ritual.weekdays ?? []).map((day) => WEEKDAY_NAMES[day]).join(', ')
    case 'monthly': {
      const count = ritual.monthlyLastMarketDays ?? 1
      return `Last ${count} market ${count === 1 ? 'day' : 'days'} of the month`
    }
  }
}
