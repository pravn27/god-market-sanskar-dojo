import {
  AuditOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  FireOutlined,
  SafetyOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'

export interface ScreenDef {
  path: string
  label: string
  icon: ReactNode
  epic: string
  summary: string
}

export const SCREENS: ScreenDef[] = [
  { path: '/dashboard', label: 'Dashboard', icon: <DashboardOutlined />, epic: 'E-12', summary: 'Readiness, KPIs, today, trends, and recent trades at a glance.' },
  { path: '/dojo', label: 'Rituals', icon: <FireOutlined />, epic: 'E-02', summary: 'Daily rituals, sanskar oath, mood level, and streak.' },
  { path: '/readiness', label: 'Readiness', icon: <CheckSquareOutlined />, epic: 'E-03', summary: 'Market Overview checklist and the readiness score that unlocks trading.' },
  { path: '/trade-gate', label: 'Trade Gate', icon: <SafetyOutlined />, epic: 'E-04', summary: 'Plan, size, and accept the loss before any trade.' },
  { path: '/audit', label: 'Audit + Scorecard', icon: <AuditOutlined />, epic: 'E-05', summary: 'Grade each trade and see the 3:30 PM discipline scorecard.' },
  { path: '/weekly', label: 'Weekly Arena', icon: <CalendarOutlined />, epic: 'E-08', summary: 'Weekly focus, five-role ratings, screen time, and mood.' },
  { path: '/monthly', label: 'Monthly Boss', icon: <TrophyOutlined />, epic: 'E-09', summary: 'Monthly theme and SWOT drafted from your trades.' },
  { path: '/character', label: 'Character', icon: <UserOutlined />, epic: 'E-10', summary: 'XP, level, virtues, and the Full GEO skill tree.' },
]
