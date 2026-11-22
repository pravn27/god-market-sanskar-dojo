import { Alert, Button, Card, Skeleton } from 'antd'

import type { MonthDay } from '../../api/client'
import type { IsoDate } from '../../domain/dates'
import Legend from './Legend'
import SummaryCards from './SummaryCards'
import { cellStatus, MONTHS_LONG, MONTHS_SHORT, shortDate } from './monthGrid'
import type { useYearHistory } from './useMonthHistory'

/**
 * A heatmap of the year: one row per month, one square per day. A square opens its day.
 * A month name opens that month's calendar.
 */
export default function YearBody({
  query,
  today,
  onOpenDay,
  onOpenMonth,
}: {
  query: ReturnType<typeof useYearHistory>
  today: IsoDate
  onOpenDay: (date: IsoDate) => void
  onOpenMonth: (month: string) => void
}) {
  const { data, isLoading, error, refetch } = query

  return (
    <>
      {error && (
        <Alert
          type="error"
          showIcon
          message="Could not load this year."
          description={error.message}
          action={<Button size="small" onClick={() => void refetch()}>Try again</Button>}
        />
      )}

      {isLoading && <Skeleton active />}

      {data && (
        <>
          <SummaryCards summary={data.summary} />

          <Card>
            <div className="year-scroll">
              <div className="year-grid" aria-label={`Year ${data.year}`}>
                {MONTHS_SHORT.map((_, index) => {
                  const number = index + 1
                  const month = `${data.year}-${String(number).padStart(2, '0')}`
                  const days = data.days.filter((day) => day.date.startsWith(`${month}-`))
                  return (
                    <div className="year-row" key={month}>
                      <button
                        type="button"
                        className="year-month"
                        aria-label={`Open ${MONTHS_LONG[index]} ${data.year}`}
                        onClick={() => onOpenMonth(month)}
                      >
                        {MONTHS_SHORT[index]}
                      </button>
                      {days.map((day) => (
                        <YearCell key={day.date} day={day} isToday={day.date === today} onOpen={onOpenDay} />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>

          <Legend />
        </>
      )}
    </>
  )
}

function YearCell({ day, isToday, onOpen }: { day: MonthDay; isToday: boolean; onOpen: (date: IsoDate) => void }) {
  // Untracked days are shown faded and cannot be opened: they are before the tracker start.
  const status = day.tracked ? cellStatus(day) : 'untracked'
  const className = ['year-cell', `year-cell--${status}`, isToday ? 'is-today' : ''].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={className}
      disabled={day.future || !day.tracked}
      title={shortDate(day.date)}
      aria-label={`${day.date}: ${day.dailyDone} of ${day.dailyTotal} daily rituals`}
      onClick={() => onOpen(day.date)}
    />
  )
}
