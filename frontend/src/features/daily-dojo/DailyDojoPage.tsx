import { Alert, Card, Checkbox, Col, Progress, Row, Skeleton, Space, Statistic, Tag, Typography } from 'antd'

import { useDojoApi } from '../../api/DojoApiContext'
import { useDojoDay, useToggleRitual } from './useDailyDojo'

export default function DailyDojoPage() {
  const today = useDojoApi().today()
  const { data: day, isLoading, error } = useDojoDay(today)
  const toggle = useToggleRitual(today)

  if (isLoading) return <Skeleton active />
  if (error || !day) return <Alert type="error" showIcon message="Could not load today's Dojo." description={error?.message} />

  const dailyRituals = day.rituals.filter((r) => r.cadence === 'daily')
  const weekendRituals = day.rituals.filter((r) => r.cadence === 'weekend')
  const monthlyRituals = day.rituals.filter((r) => r.cadence === 'monthly')

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card className="dojo-hero">
        <Typography.Text type="secondary">Today's sanskar · trains {day.sanskar.virtue}</Typography.Text>
        <Typography.Title level={4} style={{ margin: '4px 0 0' }}>
          {day.sanskar.text}
        </Typography.Title>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card><Statistic title="Mood level" value={day.mood} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="Rituals done" value={day.dailyDone} suffix={`/ ${day.dailyTotal}`} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="Minutes" value={day.minutesDone} suffix={`/ ${day.minutesTotal}`} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="Market-day streak" value={day.streak} /></Card>
        </Col>
      </Row>

      {toggle.error && <Alert type="warning" showIcon message={toggle.error.message} />}

      <Card
        title="Daily rituals"
        extra={<Tag>{day.marketDay ? 'Market day' : 'Non-market day'} · calendar: weekdays only</Tag>}
      >
        <Progress percent={Math.round((day.minutesDone / day.minutesTotal) * 100)} aria-label="Ritual minutes progress" />
        {dailyRituals.map((ritual) => (
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

      {weekendRituals.length > 0 && (
        <Card title="Weekend quest">
          {weekendRituals.map((ritual) => (
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
      )}

      {monthlyRituals.length > 0 && (
        <Card title="Monthly review" extra={<Tag>Last 2 market days of the month</Tag>}>
          {monthlyRituals.map((ritual) => (
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
      )}
    </Space>
  )
}
