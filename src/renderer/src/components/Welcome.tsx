import { Button, Empty, Space, Typography } from 'antd'
import { FolderOpenOutlined, FileAddOutlined } from '@ant-design/icons'
import { titleFromPath } from '../utils/path'

interface WelcomeProps {
  recent: string[]
  onOpenWorkspace(): void
  onNewFile(): void
  onOpenRecent(path: string): void
}

export function Welcome({ recent, onOpenWorkspace, onNewFile, onOpenRecent }: WelcomeProps) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Empty description="打开一个文件夹或文件开始写作">
        <Space direction="vertical" style={{ width: 320 }}>
          <Button type="primary" block icon={<FolderOpenOutlined />} onClick={onOpenWorkspace}>
            打开文件夹
          </Button>
          <Button block icon={<FileAddOutlined />} onClick={onNewFile}>
            新建文件
          </Button>
          {recent.length > 0 && (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                最近打开
              </Typography.Text>
              {recent.map((p) => (
                <Button
                  key={p}
                  type="link"
                  size="small"
                  block
                  style={{ textAlign: 'left', padding: 0 }}
                  onClick={() => onOpenRecent(p)}
                >
                  {titleFromPath(p)}
                </Button>
              ))}
            </div>
          )}
        </Space>
      </Empty>
    </div>
  )
}
