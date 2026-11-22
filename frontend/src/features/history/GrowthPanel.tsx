import { Alert, Button, Card, Skeleton, Typography } from 'antd'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { growthSummary, monthShortLabel } from './monthGrid'
import { useGrowth } from './useMonthHistory'

export default function GrowthPanel() {
  const { data, isLoading, error, refetch } = useGrowth()

  return (
    <Card title="Growth" extra={<Typography.Text type="secondary">On-track market days per month</Typography.Text>}>
      {isLoading && <Skeleton active />}
      {error && (
        <Alert
          type="error"
          showIcon
          message="Could not load growth."
          description={error.message}
          action={<Button size="small" onClick={() => void refetch()}>Try again</Button>}
        />
      )}
      {data && (
        <div role="img" aria-label={growthSummary(data)}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={data.map((m) => ({ label: monthShortLabel(m.month), onTrack: m.onTrackDays }))}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} width={32} />
              <Tooltip />
              <Bar dataKey="onTrack" name="On track" fill="#1677ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
