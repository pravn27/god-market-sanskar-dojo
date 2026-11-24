import { BulbFilled, BulbOutlined, DownOutlined, FireOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Dropdown, Layout, Menu, Tooltip, Typography } from 'antd'
import { useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import BacktestsPage from './features/backtests/BacktestsPage'
import PlannedScreen from './features/planned/PlannedScreen'
import RitualSettingsDrawer from './features/rituals/RitualSettingsDrawer'
import RitualsPage from './features/rituals/RitualsPage'
import TradeGatePage from './features/trade-gate/TradeGatePage'
import { SCREENS } from './screens'
import { useUiStore } from './state/uiStore'

const { Header, Sider, Content, Footer } = Layout

const BUILT_PATHS = new Set(['/rituals', '/trade-gate', '/backtests'])

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const themeMode = useUiStore((state) => state.themeMode)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isDark = themeMode === 'dark'
  const themeLabel = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <button className="brand" type="button" onClick={() => navigate('/rituals')} aria-label="Sanskar Dojo home">
          <FireOutlined className="brand-icon" aria-hidden="true" />
          <Typography.Text strong className="brand-text">
            God Market <span className="brand-accent">Sanskar Dojo</span>
          </Typography.Text>
        </button>
        <div className="header-actions">
          <Tooltip title={themeLabel}>
            <Button
              type="text"
              aria-label={themeLabel}
              icon={isDark ? <BulbFilled className="theme-toggle-on" /> : <BulbOutlined />}
              onClick={toggleTheme}
            />
          </Tooltip>
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [{ key: 'ritual-settings', icon: <SettingOutlined />, label: 'Ritual settings' }],
              onClick: ({ key }) => {
                if (key === 'ritual-settings') setSettingsOpen(true)
              },
            }}
          >
            <Button type="text" aria-label="Profile menu for Praveen" icon={<UserOutlined />}>
              Praveen <DownOutlined />
            </Button>
          </Dropdown>
        </div>
      </Header>
      <RitualSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Layout>
        <Sider className="app-sider" theme={isDark ? 'dark' : 'light'} breakpoint="md" collapsedWidth={0} width={210}>
          <Menu
            mode="inline"
            theme={isDark ? 'dark' : 'light'}
            aria-label="Primary"
            selectedKeys={[location.pathname]}
            items={SCREENS.map((screen) => ({ key: screen.path, icon: screen.icon, label: screen.label }))}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
        <Layout>
          <Content className="app-content">
            <Routes>
              <Route path="/rituals" element={<RitualsPage />} />
              {/* Old address from before the rename, kept so bookmarks still open the page. */}
              <Route path="/dojo" element={<Navigate to="/rituals" replace />} />
              <Route path="/trade-gate" element={<TradeGatePage />} />
              <Route path="/backtests" element={<BacktestsPage />} />
              {SCREENS.filter((screen) => !BUILT_PATHS.has(screen.path)).map((screen) => (
                <Route key={screen.path} path={screen.path} element={<PlannedScreen screen={screen} />} />
              ))}
              <Route path="*" element={<Navigate to="/rituals" replace />} />
            </Routes>
          </Content>
          <Footer className="app-footer">ASTA process over profit · local practice</Footer>
        </Layout>
      </Layout>
    </Layout>
  )
}
