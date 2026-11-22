import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Checkbox, Col, Drawer, Row, Skeleton, Space, Statistic, Tag, Typography } from 'antd'
import { useState } from 'react'

import { useDojoApi } from '../../api/DojoApiContext'
import { dayOfWeek, EDIT_WINDOW_DAYS, type IsoDate } from '../../domain/dates'
import { useDojoDay, useToggleRitual } from '../daily-dojo/useDailyDojo'
import { cellStatus, type CellStatus } from './monthGrid'
import { useMonthHistory } from './useMonthHistory'

/** Monday-first, to match the Trade Gate week. */
const WEEK_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const LEGEND: { status: CellStatus; label: string }[] = [
  { status: 'full', label: 'Every daily ritual done' },
  { status: 'on-track', label: 'Streak minimum met' },
  { status: 'short', label: 'Below streak minimum' },
  { status: 'weekend', label: 'Weekend or no market' },
]

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** e.g. "November 2026". */
function monthTitle(month: string): string {
  const [year, number] = month.split('-').map(Number)
  return `${MONTHS_LONG[number - 1]} ${year}`
}

/** e.g. "Tuesday, 17 November 2026". Fixed names so the output does not depend on the browser locale. */
function longDate(iso: IsoDate): string {
  const [year, month, day] = iso.split('-').map(Number)
  const weekday = WEEKDAYS_LONG[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${weekday}, ${day} ${MONTHS_LONG[month - 1]} ${year}`
}

function shiftLabel(month: string | null): string {
  return month ? monthTitle(month) : ''
}

export default function HistoryPage() {
  const api = useDojoApi()
  const today = api.today()
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [selected, setSelected] = useState<IsoDate | null>(null)
  const { data, isLoading, error, refetch } = useMonthHistory(month)

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div className="history-nav">
        <Button
          icon={<LeftOutlined />}
          aria-label="Previous month"
          title={shiftLabel(data?.prevMonth ?? null)}
          disabled={!data?.prevMonth}
          onClick={() => {
            if (data?.prevMonth) setMonth(data.prevMonth)
          }}
        />
        <Typography.Title level={4} className="history-month-title">
          {monthTitle(month)}
        </Typography.Title>
        <Button
          icon={<RightOutlined />}
          aria-label="Next month"
          title={shiftLabel(data?.nextMonth ?? null)}
          disabled={!data?.nextMonth}
          onClick={() => {
            if (data?.nextMonth) setMonth(data.nextMonth)
          }}
        />
      </div>

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
          <Row gutter={[16, 16]}>
            <Col xs={8}>
              <Card>
                <Statistic title="Market days so far" value={data.summary.marketDays} />
              </Card>
            </Col>
            <Col xs={8}>
              <Card>
                <Statistic
                  title="On track"
                  value={data.summary.onTrackDays}
                  suffix={`/ ${data.summary.marketDays}`}
                />
              </Card>
            </Col>
            <Col xs={8}>
              <Card>
                <Statistic title="Full days" value={data.summary.fullDays} suffix={`/ ${data.summary.marketDays}`} />
              </Card>
            </Col>
          </Row>

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
                    onClick={() => setSelected(day.date)}
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

          <Space wrap size="middle" aria-label="Legend">
            {LEGEND.map((item) => (
              <Space key={item.status} size={6}>
                <span className={`history-cell history-cell--${item.status} history-swatch`} aria-hidden="true" />
                <Typography.Text type="secondary">{item.label}</Typography.Text>
              </Space>
            ))}
          </Space>
        </>
      )}

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
