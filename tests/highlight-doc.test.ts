import { describe, expect, it } from 'vitest'
import { Schema } from '@milkdown/kit/prose/model'
import {
  collectCodeBlockRanges,
  collectDocumentHighlights,
  collectHighlightTokens,
  lowlight,
  type HighlightNode
} from '../src/renderer/src/editor/highlightTokens'

// 用真实 ProseMirror 文档验证偏移换算：这里最容易错的就是「相对内容起点 → 文档绝对位置」
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    code_block: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      attrs: { language: { default: '' } }
    },
    text: { group: 'inline' }
  }
})

const para = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : [])
const code = (language: string, value: string) =>
  schema.node('code_block', { language }, value ? [schema.text(value)] : [])

describe('collectDocumentHighlights', () => {
  it('把代码块内的高亮区间换算成文档绝对位置', () => {
    const source = 'const x = 1'
    const doc = schema.node('doc', null, [para('hi'), code('js', source)])

    // ProseMirror 的 nodeSize = 内容长度 + 2（前后边框），故 'hi' 段落占 0..4，
    // 代码块起点为 4、其内容起点为 5
    const relative = collectHighlightTokens(lowlight.highlight('js', source) as HighlightNode)
    expect(relative.length).toBeGreaterThan(0)
    expect(collectDocumentHighlights(doc)).toEqual(
      relative.map((t) => ({ from: t.from + 5, to: t.to + 5, classes: t.classes }))
    )
  })

  it('多个代码块的偏移互不串位', () => {
    const doc = schema.node('doc', null, [
      code('js', 'const a = 1'),
      para('中间'),
      code('python', 'def f():')
    ])

    // 从文档里取出两个代码块的真实起点，避免测试里写死偏移
    const starts: number[] = []
    doc.descendants((node, pos) => {
      if (node.type.name === 'code_block') {
        starts.push(pos)
        return false
      }
      return true
    })
    const [first, second] = starts

    const tokens = collectDocumentHighlights(doc)
    const inFirst = tokens.filter((t) => t.from > first && t.from < second)
    const inSecond = tokens.filter((t) => t.from > second)

    expect(inFirst.length).toBeGreaterThan(0)
    expect(inSecond.length).toBeGreaterThan(0)
    expect(Math.max(...inFirst.map((t) => t.to))).toBeLessThan(second)
  })

  it('文档里没有代码块时返回空列表', () => {
    expect(collectDocumentHighlights(schema.node('doc', null, [para('just text')]))).toEqual([])
  })

  it('代码块未标注语言时不产出 token', () => {
    expect(collectDocumentHighlights(schema.node('doc', null, [code('', 'plain')]))).toEqual([])
  })

  it('语言不在支持集内时降级为纯文本且不抛错', () => {
    expect(
      collectDocumentHighlights(schema.node('doc', null, [code('notalang', 'x = 1')]))
    ).toEqual([])
  })

  it('语言大小写与别名都能识别（JS / js / javascript 等价）', () => {
    for (const lang of ['JS', 'js', 'javascript']) {
      const tokens = collectDocumentHighlights(
        schema.node('doc', null, [code(lang, 'const x = 1')])
      )
      expect(tokens.length, `语言 ${lang} 应被识别`).toBeGreaterThan(0)
    }
  })

  it('空代码块不产出 token', () => {
    expect(collectDocumentHighlights(schema.node('doc', null, [code('js', '')]))).toEqual([])
  })
})

describe('collectCodeBlockRanges', () => {
  it('覆盖代码块的完整范围（含前后边框），用于挂 hljs 类', () => {
    // 'hi' 段落占 0..4；代码块内容 11 字符 + 边框 2 = 13 长度
    const doc = schema.node('doc', null, [para('hi'), code('js', 'const x = 1')])
    expect(collectCodeBlockRanges(doc)).toEqual([{ from: 4, to: 17 }])
  })

  it('未标注语言的代码块也要返回范围（主题底色仍然要生效）', () => {
    const doc = schema.node('doc', null, [code('', 'plain')])
    expect(collectCodeBlockRanges(doc)).toEqual([{ from: 0, to: 7 }])
  })

  it('多个代码块全部返回', () => {
    const doc = schema.node('doc', null, [code('js', 'a'), para('x'), code('py', 'b')])
    expect(collectCodeBlockRanges(doc)).toHaveLength(2)
  })

  it('没有代码块时返回空列表', () => {
    expect(collectCodeBlockRanges(schema.node('doc', null, [para('t')]))).toEqual([])
  })
})
