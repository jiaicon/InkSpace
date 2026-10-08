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
  const themeCss = '.hljs{background:#272822;color:#ddd}'
  const markdownCss = '.milkdown{--ms-accent:#1e80ff}'
  const katexCss = '.katex{font-size:1.2em}'
  const doc = buildExportDocument({
    title: '我的笔记',
    body: '<h1>Hi</h1>',
    markdownThemeCss: markdownCss,
    codeThemeCss: themeCss,
    katexCss
  })

  it('产出完整的 HTML 文档骨架', () => {
    expect(doc).toMatch(/^<!DOCTYPE html>/)
    expect(doc).toContain('<html lang="zh-CN">')
    expect(doc).toContain('<meta charset="utf-8">')
    expect(doc).toContain('</html>')
  })

  it('标题写入 <title> 并转义', () => {
    expect(doc).toContain('<title>我的笔记</title>')
    expect(
      buildExportDocument({
        title: '<x>',
        body: '',
        markdownThemeCss: '',
        codeThemeCss: '',
        katexCss: ''
      })
    ).toContain('<title>&lt;x&gt;</title>')
  })

  it('正文外面套 .milkdown > .editor 容器，使 Markdown 主题一份写两处生效', () => {
    expect(doc).toContain('<div class="milkdown">\n<div class="editor">')
    expect(doc).toContain('<article class="markdown-body">\n<h1>Hi</h1>\n</article>')
    expect(doc).toMatch(/<\/article>\n<\/div>\n<\/div>/)
  })

  it('内联样式表，使导出文件自包含', () => {
    expect(doc).toContain('<style>')
    // 导出侧直接读主题的 --ms-* 变量（不再有中间的 --ms-export-* 映射层）
    expect(doc).toContain('--ms-text, #24292f')
  })

  it('两套主题 CSS 与 KaTeX 样式都内联，顺序为 基础 → KaTeX → 主题 → 代码主题', () => {
    expect(doc).toContain(markdownCss)
    expect(doc).toContain(themeCss)
    expect(doc).toContain(katexCss)
    const base = doc.indexOf('--ms-text, #24292f')
    expect(base).toBeLessThan(doc.indexOf(katexCss))
    expect(doc.indexOf(katexCss)).toBeLessThan(doc.indexOf(markdownCss))
    // 代码主题排在 Markdown 主题之后，代码块观感以代码主题为准
    expect(doc.indexOf(markdownCss)).toBeLessThan(doc.indexOf(themeCss))
  })
})
