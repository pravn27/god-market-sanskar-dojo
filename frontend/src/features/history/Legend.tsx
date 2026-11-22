import { Space, Typography } from 'antd'

import { LEGEND } from './monthGrid'

/** Colour key for the History calendar. */
export default function Legend() {
  return (
    <Space wrap size="middle" aria-label="Legend">
      {LEGEND.map((item) => (
        <Space key={item.status} size={6}>
          <span className={`history-cell history-cell--${item.status} history-swatch`} aria-hidden="true" />
          <Typography.Text type="secondary">{item.label}</Typography.Text>
        </Space>
      ))}
    </Space>
  )
}
