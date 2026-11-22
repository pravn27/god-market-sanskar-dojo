import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Checkbox, Col, Drawer, Row, Segmented, Skeleton, Space, Statistic, Tag, Typography } from 'antd'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useDojoApi } from '../../api/DojoApiContext'
import { dayOfWeek, EDIT_WINDOW_DAYS, mondayOf, type IsoDate } from '../../domain/dates'
import { useDojoDay, useToggleRitual } from '../daily-dojo/useDailyDojo'
import GrowthPanel from './GrowthPanel'
import Legend from './Legend'
import { cellStatus, MONTHS_LONG, monthTitle, weekTitle } from './monthGrid'
import SummaryCards from './SummaryCards'
import { useMonthHistory, useWeekHistory, useYearHistory } from './useMonthHistory'
import WeekBody from './WeekBody'
import YearBody from './YearBody'

type ViewMode = 'week' | 'month' | 'year'

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

/** The view comes from `?view=`, so a refresh keeps it. Anything unknown means Month. */
function parseViewMode(value: string | null): ViewMode {
  return value === 'week' || value === 'year' ? value : 'month'
}

/** Monday-first, to match the Trade Gate week. */
const WEEK_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** e.g. "Tuesday, 17 November 2026". Fixed names so the output does not depend on the browser locale. */
function longDate(iso: IsoDate): string {
  const [year, month, day] = iso.split('-').map(Number)
  const weekday = WEEKDAYS_LONG[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${weekday}, ${day} ${MONTHS_LONG[month - 1]} ${year}`
}

export default function HistoryPage() {
  const api = useDojoApi()
  const today = api.today()
  const [params, setParams] = useSearchParams()
  const mode = parseViewMode(params.get('view'))
  // The anchor is any date in the period on screen. Switching view keeps it, as Google Calendar does.
  const [anchor, setAnchor] = useState<IsoDate>(today)
  const [selected, setSelected] = useState<IsoDate | null>(null)

  const month = anchor.slice(0, 7)
  const monthQuery = useMonthHistory(month, mode === 'month')
  const weekQuery = useWeekHistory(mondayOf(anchor), mode === 'week')
  const yearQuery = useYearHistory(Number(anchor.slice(0, 4)), mode === 'year')

  /** Where Previous or Next leads, from the server's tracker limits. Null means the button is off. */
  function targetFor(direction: 'prev' | 'next'): IsoDate | null {
    if (mode === 'week') {
      return (direction === 'prev' ? weekQuery.data?.prevWeek : weekQuery.data?.nextWeek) ?? null
    }
    if (mode === 'year') {
      const year = direction === 'prev' ? yearQuery.data?.prevYear : yearQuery.data?.nextYear
      return year == null ? null : `${year}-01-01`
    }
    const target = direction === 'prev' ? monthQuery.data?.prevMonth : monthQuery.data?.nextMonth
    return target ? `${target}-01` : null
  }

  function go(direction: 'prev' | 'next') {
    const target = targetFor(direction)
    if (target) setAnchor(target)
  }

  /** From the Year view: open that month's calendar. */
  function openMonth(month: string) {
    setAnchor(`${month}-01`)
    setParams({ view: 'month' })
  }

  const title =
    mode === 'week' ? weekTitle(mondayOf(anchor)) : mode === 'year' ? anchor.slice(0, 4) : monthTitle(month)

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div className="history-view-switch">
        <Segmented value={mode} options={VIEW_OPTIONS} onChange={(value) => setParams({ view: String(value) })} />
      </div>

      <div className="history-nav">
        <Button onClick={() => setAnchor(today)}>Today</Button>
        <Button
          icon={<LeftOutlined />}
          aria-label={`Previous ${mode}`}
          disabled={targetFor('prev') === null}
          onClick={() => go('prev')}
        />
        <Typography.Title level={4} className="history-month-title">
          {title}
        </Typography.Title>
        <Button
          icon={<RightOutlined />}
          aria-label={`Next ${mode}`}
          disabled={targetFor('next') === null}
          onClick={() => go('next')}
        />
      </div>

      {mode === 'month' && <MonthBody query={monthQuery} month={month} today={today} onOpenDay={setSelected} />}
      {mode === 'week' && <WeekBody query={weekQuery} today={today} />}
      {mode === 'year' && (
        <YearBody query={yearQuery} today={today} onOpenDay={setSelected} onOpenMonth={openMonth} />
      )}

      <GrowthPanel />

      <Drawer
        open={selected !== null}
        title={selected ? longDate(selected) : undefined}
        width={420}
        onClose={() => setSelected(null)}
      >
        {selected && <DayDetail date={selected} />}
      </Drawer>
    </Space>
  )
}

function MonthBody({
  query,
  month,
  today,
  onOpenDay,
}: {
  query: ReturnType<typeof useMonthHistory>
  month: string
  today: IsoDate
  onOpenDay: (date: IsoDate) => void
}) {
  const { data, isLoading, error, refetch } = query

  return (
    <>
      {error && (
        <Alert
          type="error"
          showIcon
          message="Could not load this month."
          description={error.message}
          action={<Button size="small" onClick={() => void refetch()}>Try again</Button>}
        />
      )}

      {isLoading && <Skeleton active />}

      {data && (
        <>
          <SummaryCards summary={data.summary} />

          <Card>
            <div className="history-grid" aria-label={`Calendar for ${monthTitle(month)}`}>
              {WEEK_HEADERS.map((name) => (
                <div className="history-weekday" key={name}>
                  {name}
                </div>
              ))}
              {Array.from({ length: (dayOfWeek(`${month}-01`) + 6) % 7 }, (_, index) => (
                <div className="history-cell history-cell--blank" key={`lead-${index}`} aria-hidden="true" />
              ))}
              {data.days.map((day) => {
                const status = cellStatus(day)
                const isToday = day.date === today
                return (
                  <button
                    type="button"
                    key={day.date}
                    className={`history-cell history-cell--${status}${isToday ? ' is-today' : ''}`}
                    disabled={day.future}
                    aria-label={`${day.date}: ${day.dailyDone} of ${day.dailyTotal} daily rituals`}
                    onClick={() => onOpenDay(day.date)}
                  >
                    <span className="history-cell-day">{Number(day.date.slice(8, 10))}</span>
                    {!day.future && (
                      <span className="history-cell-count">
                        {day.dailyDone}/{day.dailyTotal}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </Card>

          <Legend />
        </>
      )}
    </>
  )
}

function DayDetail({ date }: { date: IsoDate }) {
  const { data: day, isLoading, error } = useDojoDay(date)
  const toggle = useToggleRitual(date)

  if (isLoading) return <Skeleton active />
  if (error || !day) return <Alert type="error" showIcon message="Could not load this day." description={error?.message} />

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Row gutter={12}>
        <Col span={8}>
          <Statistic title="Daily done" value={day.dailyDone} suffix={`/ ${day.dailyTotal}`} />
        </Col>
        <Col span={8}>
          <Statistic title="Minutes" value={day.minutesDone} suffix={`/ ${day.minutesTotal}`} />
        </Col>
        <Col span={8}>
          <Statistic title="Streak" value={day.streak} />
        </Col>
      </Row>
      <Tag>{day.marketDay ? 'Market day' : 'Non-market day'}</Tag>
      {toggle.error && <Alert type="warning" showIcon message={toggle.error.message} />}
      <div>
        {day.rituals.map((ritual) => (
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
      </div>
      <Typography.Text type="secondary">
        {day.editable
          ? `You can correct the last ${EDIT_WINDOW_DAYS} days. Each change is logged.`
          : `Older than ${EDIT_WINDOW_DAYS} days: read-only.`}
      </Typography.Text>
    </Space>
  )
}
