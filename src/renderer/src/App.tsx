import { useRef, useState } from 'react'
import { ConfigProvider, Layout, Typography } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { Editor } from './editor'
import type { EditorHandle } from './editor'

const SAMPLE = '# 我的第一篇文章\n\n这是一段 **Markdown** 内容。\n\n## 第二章\n\n- 列表\n- 列表\n\n```js\nconsole.log(1)\n```\n'

export default function App() {
  const ref = useRef<EditorHandle>(null)
  const [dirty, setDirty] = useState(false)
  const [outline, setOutline] = useState<string[]>([])

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Typography.Text strong style={{ color: '#fff' }}>
            Markdown Studio
          </Typography.Text>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.65)' }}>
            {dirty ? '未保存' : '已保存'}
          </Typography.Text>
          <button
            onClick={() => {
              const h = ref.current
              if (!h) return
              h.setMode(h.getMode() === 'wysiwyg' ? 'source' : 'wysiwyg')
            }}
          >
            切换源码/WYSIWYG
          </button>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.65)' }}>
            {outline.join(' / ')}
          </Typography.Text>
        </Layout.Header>
        <Layout.Content style={{ height: 'calc(100vh - 64px)', padding: 16 }}>
          <Editor
            ref={ref}
            initialMarkdown={SAMPLE}
            onChange={() => {}}
            onChangeDirty={setDirty}
            onOutlineChange={(o) => setOutline(o.map((n) => n.text))}
          />
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  )
}
