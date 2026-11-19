import { BulbFilled, BulbOutlined, FireOutlined } from '@ant-design/icons'
import { Button, Layout, Menu, Tooltip, Typography } from 'antd'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import DailyDojoPage from './features/daily-dojo/DailyDojoPage'
import PlannedScreen from './features/planned/PlannedScreen'
import { SCREENS } from './screens'
import { useUiStore } from './state/uiStore'

const { Header, Sider, Content, Footer } = Layout

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const themeMode = useUiStore((state) => state.themeMode)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const isDark = themeMode === 'dark'
  const themeLabel = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <button className="brand" type="button" onClick={() => navigate('/dojo')} aria-label="Sanskar Dojo home">
          <FireOutlined className="brand-icon" aria-hidden="true" />
          <Typography.Text strong className="brand-text">
            God Market <span className="brand-accent">Sanskar Dojo</span>
          </Typography.Text>
        </button>
        <Tooltip title={themeLabel}>
          <Button
            type="text"
            aria-label={themeLabel}
            icon={isDark ? <BulbFilled className="theme-toggle-on" /> : <BulbOutlined />}
            onClick={toggleTheme}
          />
        </Tooltip>
      </Header>
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
              <Route path="/dojo" element={<DailyDojoPage />} />
              {SCREENS.filter((screen) => screen.path !== '/dojo').map((screen) => (
                <Route key={screen.path} path={screen.path} element={<PlannedScreen screen={screen} />} />
              ))}
              <Route path="*" element={<Navigate to="/dojo" replace />} />
            </Routes>
          </Content>
          <Footer className="app-footer">ASTA process over profit · local practice</Footer>
        </Layout>
      </Layout>
    </Layout>
  )
}
