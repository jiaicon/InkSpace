import { describe, expect, it } from 'vitest'
import { renderMarkdownToHtml } from '../src/main/modules/export/render'

describe('导出管线的 TOC', () => {
  it('[TOC] 变成 nav，标题带 id，链接指过去', async () => {
    const html = await renderMarkdownToHtml('[TOC]\n\n# 第一章\n\n## 小节\n')
    expect(html).toContain('<nav class="toc">')
    expect(html).toContain('id="第一章"')
    expect(html).toContain('id="小节"')
    expect(html).toContain('href="#第一章"')
    expect(html).toContain('href="#小节"')
    expect(html).not.toContain('[TOC]')
  })

  it('重名标题的链接与 id 一致', async () => {
    const html = await renderMarkdownToHtml('[TOC]\n\n## 同名\n\n## 同名\n')
    expect(html).toContain('id="同名"')
    expect(html).toContain('id="同名-1"')
    expect(html).toContain('href="#同名-1"')
  })

  it('无 [TOC] 的文档：标题仍会带 id，但没有 nav', async () => {
    const html = await renderMarkdownToHtml('# 只有标题\n')
    expect(html).toContain('id="只有标题"')
    expect(html).not.toContain('<nav')
  })

  it('引用里的 [TOC] 不变目录（Review Focus #1）', async () => {
    const html = await renderMarkdownToHtml('> [TOC]\n')
    expect(html).not.toContain('<nav class="toc">')
    expect(html).toContain('[TOC]')
  })

  it('无标题时目录为空但不报错', async () => {
    const html = await renderMarkdownToHtml('[TOC]\n\n正文\n')
    expect(html).toContain('<nav class="toc"></nav>')
  })

  it('编辑器实际写出的转义形式（\\[TOC]）同样识别', async () => {
    // Milkdown 序列化会把行首的 [ 转义成 \[ —— 这是编辑器真正存进 .md 的形式，
    // 导出侧必须照样认出来（与 callout 的 \[!TYPE] 是同一回事）。
    // 已确认 GitHub 也认这种转义形式，因此不需要在保存时反转义。
    const html = await renderMarkdownToHtml('\\[TOC]\n\n# 标题\n')
    expect(html).toContain('<nav class="toc">')
    expect(html).toContain('href="#标题"')
    expect(html).not.toContain('[TOC]')
  })
})
