import { Alert, Button, Drawer, Input, Radio, Space, Typography } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'

interface Props {
  open: boolean
  settings: AppSettings
  onChange: (key: keyof AppSettings, value: string) => void
  onChooseImageDir: () => void
  onRevealImageDir: () => void
  onClose: () => void
}

/** 设置抽屉：外观（主题）+ 图片存放位置 */
export function SettingsDrawer({
  open,
  settings,
  onChange,
  onChooseImageDir,
  onRevealImageDir,
  onClose
}: Props) {
  // 子目录名用本地草稿态，失焦/回车才提交，避免每敲一个字就写一次库
  const [subdirDraft, setSubdirDraft] = useState(settings.imageSubdir)
  useEffect(() => {
    setSubdirDraft(settings.imageSubdir)
  }, [settings.imageSubdir])

  const commitSubdir = (): void => {
    const next = subdirDraft.trim()
    if (next && next !== settings.imageSubdir) onChange('imageSubdir', next)
    else setSubdirDraft(settings.imageSubdir)
  }

  return (
    <Drawer title="设置" placement="right" width={420} open={open} onClose={onClose}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        外观
      </Typography.Title>
      <Radio.Group
        value={settings.theme}
        optionType="button"
        buttonStyle="solid"
        onChange={(e) => onChange('theme', e.target.value as string)}
        options={[
          { label: '浅色', value: 'light' },
          { label: '深色', value: 'dark' }
        ]}
      />

      <Typography.Title level={5} style={{ marginTop: 28 }}>
        图片存放位置
      </Typography.Title>
      <Radio.Group
        value={settings.imageStorage}
        onChange={(e) => onChange('imageStorage', e.target.value as string)}
      >
        <Space direction="vertical" size={10}>
          <Radio value="unified">
            统一目录
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              所有文档的图片集中存放
            </Typography.Text>
          </Radio>
          <Radio value="relative">
            随文档
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              图片放在文档旁的子目录，文档可整体迁移
            </Typography.Text>
          </Radio>
        </Space>
      </Radio.Group>

      {settings.imageStorage === 'unified' ? (
        <div style={{ marginTop: 16 }}>
          <Alert
            type="warning"
            showIcon
            message="图片存在文档之外，文档发送给他人或上传到 GitHub 时图片会无法显示。"
            style={{ marginBottom: 12 }}
          />
          <Typography.Text type="secondary">当前目录</Typography.Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <Input value={settings.imageDir} readOnly title={settings.imageDir} />
            <Button onClick={onChooseImageDir}>更改…</Button>
            <Button
              icon={<FolderOpenOutlined />}
              onClick={onRevealImageDir}
              title="在文件夹中打开"
            />
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <Typography.Text type="secondary">子目录名（相对文档目录）</Typography.Text>
          <Input
            style={{ marginTop: 6 }}
            value={subdirDraft}
            prefix="./"
            onChange={(e) => setSubdirDraft(e.target.value)}
            onBlur={commitSubdir}
            onPressEnter={commitSubdir}
          />
        </div>
      )}
    </Drawer>
  )
}
