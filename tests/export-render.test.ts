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
})
