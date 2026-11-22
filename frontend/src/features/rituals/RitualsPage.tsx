import { Tabs } from 'antd'

import DailyDojoPage from '../daily-dojo/DailyDojoPage'
import HistoryPage from '../history/HistoryPage'

/** The Rituals screen: today's checklist, and the monthly History calendar. */
export default function RitualsPage() {
  return (
    <Tabs
      defaultActiveKey="today"
      items={[
        { key: 'today', label: 'Today', children: <DailyDojoPage /> },
        { key: 'history', label: 'History', children: <HistoryPage /> },
      ]}
    />
  )
}
