import { describe, expect, it } from 'vitest'
import { transformCallouts } from '../src/main/modules/export/calloutBlocks'
import type { HastNode } from '../src/main/modules/export/ensureCodeClass'

const text = (value: string): HastNode => ({ type: 'text', value })
const p = (...children: HastNode[]): HastNode => ({ type: 'element', tagName: 'p', children })
const quote = (...children: HastNode[]): HastNode => ({
  type: 'element',
  tagName: 'blockquote',
  children
})
const root = (...children: HastNode[]): HastNode => ({ type: 'root', children })

describe('transformCallouts', () => {
  it('把首段是标记的引用转成 div.callout', () => {
    const tree = root(quote(p(text('[!NOTE]')), p(text('内容一')), p(text('内容二'))))
    transformCallouts(tree)

    const div = tree.children![0]
    expect(div.tagName).toBe('div')
    expect(div.properties?.className).toEqual(['callout', 'callout-note'])

    const kids = div.children!
    expect(kids[0].tagName).toBe('p')
    expect(kids[0].properties?.className).toEqual(['callout-title'])
    expect(kids[0].children![0].value).toBe('提示')
    expect(kids[1].children![0].value).toBe('内容一')
    expect(kids[2].children![0].value).toBe('内容二')
  })

  it('大小写与空白容错', () => {
    const tree = root(quote(p(text(' [!warning] ')), p(text('x'))))
    transformCallouts(tree)
    expect(tree.children![0].properties?.className).toEqual(['callout', 'callout-warning'])
  })

  it('未知类型原样保留为引用', () => {
    const tree = root(quote(p(text('[!FOO]')), p(text('x'))))
    transformCallouts(tree)
    expect(tree.children![0].tagName).toBe('blockquote')
  })

  it('标记不在首段不转换（Review Focus #4）', () => {
    const tree = root(quote(p(text('正文')), p(text('[!NOTE]'))))
    transformCallouts(tree)
    expect(tree.children![0].tagName).toBe('blockquote')
  })

  it('只有标记没有内容', () => {
    const tree = root(quote(p(text('[!TIP]'))))
    transformCallouts(tree)
    const div = tree.children![0]
    expect(div.tagName).toBe('div')
    expect(div.children!.map((c) => c.tagName)).toEqual(['p'])
  })

  it('内容里的列表/代码块完整保留在 div 内', () => {
    const list: HastNode = {
      type: 'element',
      tagName: 'ul',
      children: [{ type: 'element', tagName: 'li', children: [p(text('项'))] }]
    }
    const code: HastNode = {
      type: 'element',
      tagName: 'pre',
      children: [{ type: 'element', tagName: 'code', children: [text('x()')] }]
    }
    const tree = root(quote(p(text('[!NOTE]')), list, code))
    transformCallouts(tree)
    expect(tree.children![0].children!.map((c) => c.tagName)).toEqual(['p', 'ul', 'pre'])
  })

  it('嵌套引用只转换最内层命中', () => {
    const tree = root(quote(quote(p(text('[!NOTE]')), p(text('x')))))
    transformCallouts(tree)
    const outer = tree.children![0]
    expect(outer.tagName).toBe('blockquote')
    expect(outer.children![0].tagName).toBe('div')
  })

  it('真实管线形状：块之间有空白文本节点时仍能识别', () => {
    // remark-rehype 会在块之间插入 "\n" 文本节点，children[0] 并不是段落。
    // 手写 fixture 很容易漏掉这点，所以这条测试按真实形状构造。
    const blank: HastNode = { type: 'text', value: '\n' }
    const tree = root(quote(blank, p(text('[!NOTE]')), blank, p(text('内容')), blank))
    transformCallouts(tree)

    const div = tree.children![0]
    expect(div.tagName).toBe('div')
    expect(div.properties?.className).toEqual(['callout', 'callout-note'])
    // div 直接子节点里的空白无意义：应丢掉标记段，也丢掉空白
    expect(div.children!.map((c) => c.tagName)).toEqual(['p', 'p'])
    expect(div.children![0].children![0].value).toBe('提示')
    expect(div.children![1].children![0].value).toBe('内容')
  })
})
