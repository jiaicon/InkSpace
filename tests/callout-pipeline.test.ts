import { describe, expect, it } from 'vitest'
import { renderMarkdownToHtml } from '../src/main/modules/export/render'
import { hasMermaid } from '../src/main/modules/export/mermaidBlocks'

describe('导出管线的 callout', () => {
  it('markdown → 带样式的 div', async () => {
    const html = await renderMarkdownToHtml('> [!WARNING]\n>\n> 注意风险\n')
    expect(html).toContain('<div class="callout callout-warning">')
    expect(html).toContain('<p class="callout-title">警告</p>')
    expect(html).toContain('注意风险')
    expect(html).not.toContain('[!WARNING]')
  })

  it('普通引用块不受影响（Review Focus #4）', async () => {
    const html = await renderMarkdownToHtml('> 普通引用\n')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<p>普通引用</p>')
    expect(html).not.toContain('callout')
  })

  it('callout 里的 Mermaid 仍能被后续管线识别（Review Focus #5）', async () => {
    const html = await renderMarkdownToHtml('> [!NOTE]\n>\n> ```mermaid\n> graph TD\n> ```\n')
    expect(html).toContain('<div class="callout callout-note">')
    expect(hasMermaid(html)).toBe(true)
  })

  it('callout 里的代码块仍带 hljs 类（Review Focus #5）', async () => {
    const html = await renderMarkdownToHtml('> [!NOTE]\n>\n> ```js\n> const a = 1\n> ```\n')
    expect(html).toContain('class="hljs language-js"')
  })

  it('编辑器实际写出的转义形式（\\[!WARNING]）同样识别', async () => {
    // Milkdown 序列化时会把行首的 [ 转义成 \[（避免被当成链接语法）。
    // 这是编辑器真正存到 .md 里的形式，导出侧必须照样认出来。
    const html = await renderMarkdownToHtml('> \\[!WARNING]\n>\n> 注意风险\n')
    expect(html).toContain('<div class="callout callout-warning">')
    expect(html).toContain('<p class="callout-title">警告</p>')
    expect(html).not.toContain('[!WARNING]')
  })
})
