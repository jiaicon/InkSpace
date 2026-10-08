import { describe, expect, it } from 'vitest'
import {
  decodeHtmlEntities,
  hasMermaid,
  renderMermaidBlocks
} from '../src/main/modules/export/mermaidBlocks'

/** 造一个与 rehype-highlight 输出一致（内容经过 HTML 转义）的 mermaid 代码块 */
const block = (code: string): string =>
  `<pre><code class="hljs language-mermaid">${code}</code></pre>`

describe('decodeHtmlEntities', () => {
  it('还原数值实体与命名实体', () => {
    expect(decodeHtmlEntities('a &#x3C;b&#x3E; &amp; c')).toBe('a <b> & c')
    expect(decodeHtmlEntities('&#65;&#66;')).toBe('AB')
    expect(decodeHtmlEntities('&quot;x&quot; &lt;y&gt;')).toBe('"x" <y>')
  })

  it('普通文本原样返回', () => {
    expect(decodeHtmlEntities('graph TD; A-->B')).toBe('graph TD; A-->B')
  })
})

describe('hasMermaid', () => {
  it('识别 mermaid 代码块', () => {
    expect(hasMermaid(block('graph TD'))).toBe(true)
    expect(hasMermaid('<p>没有图表</p>')).toBe(false)
  })

  it('普通代码块不算', () => {
    expect(hasMermaid('<pre><code class="hljs language-js">x</code></pre>')).toBe(false)
  })
})

describe('renderMermaidBlocks', () => {
  const stub = async (code: string): Promise<string> => `<svg data-code="${code}"></svg>`

  it('把 mermaid 块换成渲染结果', async () => {
    const html = `<p>前</p>${block('graph TD; A--&gt;B;')}<p>后</p>`
    const out = await renderMermaidBlocks(html, stub)
    expect(out).toContain(
      '<div class="ms-mermaid-diagram"><svg data-code="graph TD; A-->B;"></svg></div>'
    )
    expect(out).not.toContain('language-mermaid')
    expect(out).toContain('<p>前</p>')
    expect(out).toContain('<p>后</p>')
  })

  it('多个块逐个渲染，顺序对应', async () => {
    const html = block('one') + block('two')
    const out = await renderMermaidBlocks(html, stub)
    expect(out.indexOf('data-code="one"')).toBeLessThan(out.indexOf('data-code="two"'))
  })

  it('没有 mermaid 块时原样返回（不调用渲染器）', async () => {
    let called = false
    const html = '<pre><code class="hljs language-js">const a = 1</code></pre>'
    const out = await renderMermaidBlocks(html, async (c) => {
      called = true
      return c
    })
    expect(out).toBe(html)
    expect(called).toBe(false)
  })

  it('单个块渲染失败时降级为错误提示，不影响其它块', async () => {
    const html = block('bad') + block('good')
    const out = await renderMermaidBlocks(html, async (code) => {
      if (code === 'bad') throw new Error('语法错误')
      return `<svg data-code="${code}"></svg>`
    })
    expect(out).toContain('语法有误：语法错误')
    expect(out).toContain('data-code="good"')
  })

  it('「看不出图表类型」翻译成人话再展示', async () => {
    const out = await renderMermaidBlocks(block('随便写点啥'), async () => {
      throw new Error('No diagram type detected matching given configuration for text: x')
    })
    expect(out).toContain('看不出图表类型')
    expect(out).not.toContain('No diagram type detected')
  })

  it('错误信息里的 HTML 会被转义，不破坏文档结构', async () => {
    const html = block('bad')
    const out = await renderMermaidBlocks(html, async () => {
      throw new Error('<script>alert(1)</script>')
    })
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
  })

  it('空块降级为提示，不调用渲染器', async () => {
    let called = false
    const out = await renderMermaidBlocks(block('   '), async (c) => {
      called = true
      return c
    })
    expect(called).toBe(false)
    expect(out).toContain('ms-mermaid-error')
  })

  it('只有零宽字符的块也算空块（trim 去不掉它们，不能送去渲染）', async () => {
    let called = false
    const zwsp = String.fromCharCode(0x200b)
    const out = await renderMermaidBlocks(block(zwsp + zwsp), async (c) => {
      called = true
      return c
    })
    expect(called).toBe(false)
    expect(out).toContain('空图表')
  })

  it('class 顺序不同也能识别（hljs 在后）', async () => {
    const html = '<pre><code class="language-mermaid hljs">graph TD</code></pre>'
    expect(hasMermaid(html)).toBe(true)
    const out = await renderMermaidBlocks(html, stub)
    expect(out).toContain('ms-mermaid-diagram')
  })
})
