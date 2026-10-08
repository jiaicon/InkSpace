import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildExportHtml } from '../src/main/modules/export/compose'

const PNG = Buffer.from('89504e470d0a1a0a', 'hex')

let dir: string
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ms-export-compose-'))
  await mkdir(join(dir, 'assets'), { recursive: true })
  await writeFile(join(dir, 'assets', 'a.png'), PNG)
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('buildExportHtml', () => {
  const codeCss = '.hljs{background:#272822}'
  const themes = { markdown: '.milkdown{--ms-accent:#1e80ff}', code: codeCss }

  it('markdown → 自包含 HTML：渲染正文、内嵌图片、套上文档模板', async () => {
    const html = await buildExportHtml(
      {
        markdown: '# 标题\n\n![图](./assets/a.png)',
        sourcePath: join(dir, 'note.md'),
        title: 'note'
      },
      themes
    )

    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('<title>note</title>')
    expect(html).toContain('<h1>标题</h1>')
    // 相对图片被内嵌，导出物不再依赖原始文件
    expect(html).toContain('data:image/png;base64,')
    expect(html).not.toContain('src="./assets/a.png"')
    // 两套主题 CSS 随导出物一起带走
    expect(html).toContain(themes.markdown)
    expect(html).toContain(codeCss)
  })

  it('文档未保存过（sourcePath 为 null）时仍能导出，图片保持原样', async () => {
    const html = await buildExportHtml(
      {
        markdown: '![图](./assets/a.png)',
        sourcePath: null,
        title: '未命名'
      },
      themes
    )
    expect(html).toContain('<title>未命名</title>')
    expect(html).toContain('src="./assets/a.png"')
  })

  it('标题里的 HTML 元字符被转义，不破坏文档结构', async () => {
    const html = await buildExportHtml(
      { markdown: 'hi', sourcePath: null, title: '<b>&</b>' },
      themes
    )
    expect(html).toContain('<title>&lt;b&gt;&amp;&lt;/b&gt;</title>')
    expect(html).not.toContain('<title><b>')
  })

  it('文档里没有公式时不去取 KaTeX 样式（避免白付几百 KB 字体）', async () => {
    let asked = false
    const html = await buildExportHtml(
      { markdown: '# 标题\n\n普通文本', sourcePath: null, title: 't' },
      themes,
      async () => {
        asked = true
        return '/*KATEX*/'
      }
    )
    expect(asked).toBe(false)
    expect(html).not.toContain('/*KATEX*/')
  })

  it('文档里有公式时把 KaTeX 样式内联进导出物', async () => {
    const html = await buildExportHtml(
      { markdown: '质能方程 $E = mc^2$', sourcePath: null, title: 't' },
      themes,
      async () => '/*KATEX*/'
    )
    expect(html).toContain('class="katex')
    expect(html).toContain('/*KATEX*/')
  })

  it('没提供 KaTeX 样式回调时也不报错（只是公式少样式）', async () => {
    const html = await buildExportHtml({ markdown: '$x$', sourcePath: null, title: 't' }, themes)
    expect(html).toContain('class="katex')
  })
})
