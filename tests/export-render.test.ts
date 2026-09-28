import { describe, expect, it } from 'vitest'
import { renderMarkdownToHtml } from '../src/main/modules/export/render'

describe('renderMarkdownToHtml', () => {
  it('渲染基础 markdown 结构', async () => {
    const html = await renderMarkdownToHtml('# 标题\n\n正文 **加粗**')
    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<strong>加粗</strong>')
  })

  it('保留 GFM 任务列表的复选框（sanitize 未开）', async () => {
    const html = await renderMarkdownToHtml('- [ ] 待办\n- [x] 已完成')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
    expect(html).toContain('task-list-item')
  })

  it('保留 GFM 表格与对齐属性', async () => {
    const html = await renderMarkdownToHtml('| a | b |\n| :-: | ---: |\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('align="center"')
    expect(html).toContain('align="right"')
  })

  it('保留 GFM 删除线', async () => {
    expect(await renderMarkdownToHtml('~~删掉~~')).toContain('<del>删掉</del>')
  })

  it('透传正文里的原始 HTML', async () => {
    expect(await renderMarkdownToHtml('<div class="note">注</div>')).toContain(
      '<div class="note">注</div>'
    )
  })

  it('空字符串返回空串且不抛错', async () => {
    expect((await renderMarkdownToHtml('')).trim()).toBe('')
  })

  it('标注了语言的代码块被高亮（产出 hljs 类名）', async () => {
    const html = await renderMarkdownToHtml('```js\nconst x = 1\n```')
    expect(html).toContain('language-js')
    expect(html).toContain('hljs-keyword')
    expect(html).toContain('hljs-number')
  })

  it('未标注语言的代码块不高亮，但同样带 hljs 类（否则会完全没有样式）', async () => {
    const html = await renderMarkdownToHtml('```\nplain text\n```')
    expect(html).not.toContain('hljs-')
    expect(html).toContain('class="hljs"')
  })

  it('标注语言的代码块类名同时含 hljs 与 language-xx', async () => {
    const html = await renderMarkdownToHtml('```js\nconst x = 1\n```')
    expect(html).toMatch(/class="hljs language-js"/)
  })

  it('不支持的语言降级为纯文本，不抛错（保证导出不因写错语言名而失败）', async () => {
    const html = await renderMarkdownToHtml('```notalang\nx = 1\n```')
    expect(html).toContain('notalang')
    expect(html).not.toContain('hljs-keyword')
  })

  it('高亮不会破坏代码块内的转义（尖括号原样显示而非被当标签解析）', async () => {
    const html = await renderMarkdownToHtml('```html\n<div class="a">x</div>\n```')
    expect(html).toContain('hljs-tag')
    // 代码里的 <div 必须是被转义后的文本，不能变成真正的标签
    expect(html).not.toContain('<div')
  })
})
