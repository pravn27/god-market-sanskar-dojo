import { Card, Tag, Typography } from 'antd'

import type { ScreenDef } from '../../screens'

export default function PlannedScreen({ screen }: { screen: ScreenDef }) {
  return (
    <Card>
      <Typography.Title level={3}>{screen.label}</Typography.Title>
      <Typography.Paragraph type="secondary">{screen.summary}</Typography.Paragraph>
      <Tag>Delivered in {screen.epic}</Tag>
    </Card>
  )
}
