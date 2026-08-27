import { useEffect, useState } from 'react'
import { ConfigProvider, Layout, Typography } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import UserManage from './pages/UserManage'
import { systemApi } from './api/system'
import type { SystemInfo } from '@shared/types'

export default function App() {
  const [info, setInfo] = useState<SystemInfo>()

  useEffect(() => {
    systemApi.getInfo().then(setInfo).catch(() => {})
  }, [])

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Typography.Text strong style={{ color: '#fff' }}>
            ElectronApp
          </Typography.Text>
          {info && (
            <Typography.Text style={{ color: 'rgba(255,255,255,0.65)' }}>
              v{info.appVersion} · {info.platform}/{info.arch} · Electron {info.electron}
            </Typography.Text>
          )}
        </Layout.Header>
        <Layout.Content>
          <UserManage />
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  )
}
