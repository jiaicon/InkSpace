import { Alert, Button, Drawer, Input, Radio, Select, Space, Typography } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import type { AppSettings, MarkdownThemeInfo } from '@shared/types'
import { AUTO_THEME_ID, HIGHLIGHT_THEMES } from '@shared/highlightThemes'
import { AUTO_MERMAID_THEME, MERMAID_THEMES } from '@shared/mermaidThemes'

// 下拉分组：auto 单独一组，其余按明暗分组，便于按当前界面色调挑
const THEME_OPTIONS = [
  { label: '跟随明暗', value: AUTO_THEME_ID },
  {
    label: '浅色',
    options: HIGHLIGHT_THEMES.filter((t) => t.kind === 'light').map((t) => ({
      label: t.label,
      value: t.id
    }))
  },
  {
    label: '深色',
    options: HIGHLIGHT_THEMES.filter((t) => t.kind === 'dark').map((t) => ({
      label: t.label,
      value: t.id
    }))
  }
]

// mermaid 主题下拉：形态与上面的代码块主题刻意保持一致
const MERMAID_THEME_OPTIONS = [
  { label: '跟随明暗', value: AUTO_MERMAID_THEME },
  {
    label: '浅色',
    options: MERMAID_THEMES.filter((t) => t.kind === 'light').map((t) => ({
      label: t.label,
      value: t.id
    }))
  },
  {
    label: '深色',
    options: MERMAID_THEMES.filter((t) => t.kind === 'dark').map((t) => ({
      label: t.label,
      value: t.id
    }))
  }
]

/**
 * 主题预览：元素带 hljs 类，注入到 <head> 的主题 CSS 会自动生效，
 * 因此这块预览与编辑器里的代码块用的是同一份样式，不需要额外维护。
 */
function CodeThemePreview() {
  return (
    <pre style={{ margin: '10px 0 0', borderRadius: 6, overflow: 'auto' }}>
      <code
        className="hljs"
        style={{
          display: 'block',
          padding: 12,
          fontFamily: 'var(--ms-font-mono)',
          fontSize: 12,
          lineHeight: 1.7
        }}
      >
        <span className="hljs-comment">// 预览</span>
        {'\n'}
        <span className="hljs-keyword">const</span> <span className="hljs-title">answer</span>{' '}
        <span className="hljs-operator">=</span> <span className="hljs-number">42</span>
        {'\n'}
        <span className="hljs-keyword">function</span> <span className="hljs-title">greet</span>(
        <span className="hljs-params">name</span>) {'{'}
        {'\n'} <span className="hljs-keyword">return</span>{' '}
        <span className="hljs-string">'hi '</span> <span className="hljs-operator">+</span>{' '}
        <span className="hljs-params">name</span>
        {'\n'}
        {'}'}
      </code>
    </pre>
  )
}

interface Props {
  open: boolean
  settings: AppSettings
  /** Markdown 主题列表（内置 + userData/themes 下的自定义） */
  themes: MarkdownThemeInfo[]
  onChange: (key: keyof AppSettings, value: string) => void
  onChooseImageDir: () => void
  onRevealImageDir: () => void
  onImportTheme: () => void
  onExportTheme: () => void
  onRevealThemes: () => void
  onReloadThemes: () => void
  onClose: () => void
}

/** 设置抽屉：外观（主题）+ 图片存放位置 */
export function SettingsDrawer({
  open,
  settings,
  themes,
  onChange,
  onChooseImageDir,
  onRevealImageDir,
  onImportTheme,
  onExportTheme,
  onRevealThemes,
  onReloadThemes,
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

  const builtinThemes = themes.filter((t) => t.builtin)
  const customThemes = themes.filter((t) => !t.builtin)
  const markdownThemeOptions = [
    { label: '跟随明暗（不套主题）', value: 'auto' },
    ...(builtinThemes.length
      ? [{ label: '内置', options: builtinThemes.map((t) => ({ label: t.name, value: t.id })) }]
      : []),
    ...(customThemes.length
      ? [{ label: '自定义', options: customThemes.map((t) => ({ label: t.name, value: t.id })) }]
      : [])
  ]

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
        Markdown 主题
      </Typography.Title>
      <Select
        style={{ width: '100%' }}
        value={settings.markdownTheme}
        onChange={(value) => onChange('markdownTheme', value)}
        options={markdownThemeOptions}
      />
      <Space wrap size={8} style={{ marginTop: 10 }}>
        <Button size="small" onClick={onImportTheme}>
          导入主题…
        </Button>
        <Button size="small" onClick={onExportTheme}>
          导出当前主题…
        </Button>
        <Button size="small" icon={<FolderOpenOutlined />} onClick={onRevealThemes}>
          主题目录
        </Button>
        <Button size="small" onClick={onReloadThemes}>
          重新加载
        </Button>
      </Space>
      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}
      >
        自定义主题放在用户数据目录的 themes/ 下（每个主题一个文件夹，内含
        theme.css）。改完文件点「重新加载」即可看到效果。
      </Typography.Paragraph>

      <Typography.Title level={5} style={{ marginTop: 28 }}>
        代码块主题
      </Typography.Title>
      <Select
        style={{ width: '100%' }}
        value={settings.highlightTheme}
        onChange={(value) => onChange('highlightTheme', value)}
        options={THEME_OPTIONS}
      />
      <CodeThemePreview />

      <Typography.Title level={5} style={{ marginTop: 28 }}>
        图表主题
      </Typography.Title>
      <Select
        style={{ width: '100%' }}
        value={settings.mermaidTheme}
        onChange={(value) => onChange('mermaidTheme', value)}
        options={MERMAID_THEME_OPTIONS}
      />
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
        Mermaid 图表的配色。改完当前文档里的图表会立即重画。
      </Typography.Paragraph>

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
