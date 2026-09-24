import { describe, expect, it } from 'vitest'
import { buildExportDocument, escapeHtml } from '../src/main/modules/export/document'

describe('escapeHtml', () => {
  it('转义标题里的 HTML 元字符', () => {
    expect(escapeHtml('a<b>&"c"\'d\'')).toBe('a&lt;b&gt;&amp;&quot;c&quot;&#39;d&#39;')
  })

  it('普通文本原样返回', () => {
    expect(escapeHtml('一篇普通的笔记')).toBe('一篇普通的笔记')
  })
})

describe('buildExportDocument', () => {
  const doc = buildExportDocument({ title: '我的笔记', body: '<h1>Hi</h1>' })

  it('产出完整的 HTML 文档骨架', () => {
    expect(doc).toMatch(/^<!DOCTYPE html>/)
    expect(doc).toContain('<html lang="zh-CN">')
    expect(doc).toContain('<meta charset="utf-8">')
    expect(doc).toContain('</html>')
  })

  it('标题写入 <title> 并转义', () => {
    expect(doc).toContain('<title>我的笔记</title>')
    expect(buildExportDocument({ title: '<x>', body: '' })).toContain('<title>&lt;x&gt;</title>')
  })

  it('正文原样嵌入 article 容器', () => {
    expect(doc).toContain('<article class="markdown-body">\n<h1>Hi</h1>\n</article>')
  })

  it('内联样式表，使导出文件自包含', () => {
    expect(doc).toContain('<style>')
    expect(doc).toContain('--ms-export-text')
  })
})
