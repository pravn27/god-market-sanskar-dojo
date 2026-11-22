import { Alert, Button, Card, Checkbox, Skeleton, Space, Tag, Typography } from 'antd'

import type { WeekDay } from '../../api/client'
import type { IsoDate } from '../../domain/dates'
import { useToggleRitual } from '../daily-dojo/useDailyDojo'
import SummaryCards from './SummaryCards'
import { cellStatus, shortDate, weekTitle } from './monthGrid'
import type { useWeekHistory } from './useMonthHistory'

/** Seven day cards, Monday to Sunday, each with its checklist. */
export default function WeekBody({ query, today }: { query: ReturnType<typeof useWeekHistory>; today: IsoDate }) {
  const { data, isLoading, error, refetch } = query

  return (
    <>
      {error && (
        <Alert
          type="error"
          showIcon
          message="Could not load this week."
          description={error.message}
          action={<Button size="small" onClick={() => void refetch()}>Try again</Button>}
        />
      )}

      {isLoading && <Skeleton active />}

      {data && (
        <>
          <SummaryCards summary={data.summary} />
          <div className="week-list" aria-label={weekTitle(data.weekStart)}>
            {data.days.map((day) => (
              <WeekDayCard key={day.date} day={day} isToday={day.date === today} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

function WeekDayCard({ day, isToday }: { day: WeekDay; isToday: boolean }) {
  const toggle = useToggleRitual(day.date)
  // Untracked days have no colour: they are before the tracker start.
  const status = day.tracked ? cellStatus(day) : 'untracked'
  const className = ['week-day', `week-day--${status}`, isToday ? 'week-day--today' : ''].filter(Boolean).join(' ')

  return (
    <Card
      className={className}
      title={shortDate(day.date)}
      extra={
        <Space size={6}>
          {isToday && <Tag color="blue">Today</Tag>}
          {day.tracked && <Tag>{day.marketDay ? 'Market day' : 'Non-market day'}</Tag>}
          {day.tracked && (
            <Tag>
              {day.dailyDone}/{day.dailyTotal} daily
            </Tag>
          )}
        </Space>
      }
    >
      {!day.tracked && <Typography.Text type="secondary">Before the tracker started. Not counted.</Typography.Text>}
      {day.tracked && day.future && (
        <Typography.Text type="secondary">Upcoming. Check-ins cannot be made in advance.</Typography.Text>
      )}
      {day.tracked && !day.future && !day.editable && (
        <Typography.Text type="secondary">Older than the last 7 days: read-only.</Typography.Text>
      )}
      {toggle.error && <Alert type="warning" showIcon message={toggle.error.message} />}
      {day.tracked &&
        day.rituals.map((ritual) => (
          <div className="dojo-ritual-row" key={ritual.id}>
            <Checkbox
              checked={ritual.done}
              disabled={!day.editable || toggle.isPending}
              onChange={() => toggle.mutate(ritual.id)}
            >
              {ritual.label}
            </Checkbox>
            <Typography.Text type="secondary">{ritual.minutes} min</Typography.Text>
          </div>
        ))}
    </Card>
  )
}
