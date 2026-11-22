import { Card, Col, Row, Statistic } from 'antd'

import type { CalendarSummary } from '../../api/client'

/** Totals for the period on screen. Only market days that are tracked and already over are counted. */
export default function SummaryCards({ summary }: { summary: CalendarSummary }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={8}>
        <Card>
          <Statistic title="Market days so far" value={summary.marketDays} />
        </Card>
      </Col>
      <Col xs={8}>
        <Card>
          <Statistic title="On track" value={summary.onTrackDays} suffix={`/ ${summary.marketDays}`} />
        </Card>
      </Col>
      <Col xs={8}>
        <Card>
          <Statistic title="Full days" value={summary.fullDays} suffix={`/ ${summary.marketDays}`} />
        </Card>
      </Col>
    </Row>
  )
}
