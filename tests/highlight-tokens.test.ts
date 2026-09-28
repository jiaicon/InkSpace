import { describe, expect, it } from 'vitest'
import {
  collectHighlightTokens,
  type HighlightNode
} from '../src/renderer/src/editor/highlightTokens'

const text = (value: string): HighlightNode => ({ type: 'text', value })
const el = (
  className: string | string[] | undefined,
  children: HighlightNode[]
): HighlightNode => ({
  type: 'element',
  properties: className === undefined ? {} : { className },
  children
})
const root = (children: HighlightNode[]): HighlightNode => ({ type: 'root', children })

describe('collectHighlightTokens', () => {
  it('纯文本（没有 hljs 类名）不产生任何 token', () => {
    expect(collectHighlightTokens(root([text('plain code')]))).toEqual([])
  })

  it('单个 span 转成一段区间', () => {
    const tree = root([el(['hljs-keyword'], [text('const')]), text(' x = 1')])
    expect(collectHighlightTokens(tree)).toEqual([{ from: 0, to: 5, classes: ['hljs-keyword'] }])
  })

  it('嵌套 span 的类名会累积', () => {
    const tree = root([el(['hljs-title'], [el(['hljs-function'], [text('foo')])])])
    expect(collectHighlightTokens(tree)).toEqual([
      { from: 0, to: 3, classes: ['hljs-title', 'hljs-function'] }
    ])
  })

  it('偏移量跨兄弟节点连续累加', () => {
    const tree = root([
      text('a'),
      el(['hljs-string'], [text('bb')]),
      text('c'),
      el(['hljs-number'], [text('dd')])
    ])
    expect(collectHighlightTokens(tree)).toEqual([
      { from: 1, to: 3, classes: ['hljs-string'] },
      { from: 4, to: 6, classes: ['hljs-number'] }
    ])
  })

  it('相邻且类名相同的 token 合并（避免产出大量碎片装饰）', () => {
    const tree = root([el(['hljs-string'], [text('aa')]), el(['hljs-string'], [text('bb')])])
    expect(collectHighlightTokens(tree)).toEqual([{ from: 0, to: 4, classes: ['hljs-string'] }])
  })

  it('相邻但类名不同的 token 不合并', () => {
    const tree = root([el(['hljs-string'], [text('aa')]), el(['hljs-number'], [text('bb')])])
    expect(collectHighlightTokens(tree)).toEqual([
      { from: 0, to: 2, classes: ['hljs-string'] },
      { from: 2, to: 4, classes: ['hljs-number'] }
    ])
  })

  it('只收录 hljs-* 类名，其它类名忽略', () => {
    expect(collectHighlightTokens(root([el(['something-else'], [text('x')])]))).toEqual([])
  })

  it('类名同时给字符串与数组都能处理', () => {
    expect(collectHighlightTokens(root([el('hljs-comment', [text('// c')])]))).toEqual([
      { from: 0, to: 4, classes: ['hljs-comment'] }
    ])
  })

  it('多行文本按字符数计算偏移', () => {
    const tree = root([el(['hljs-keyword'], [text('a\nb')]), text('\nc')])
    expect(collectHighlightTokens(tree)).toEqual([{ from: 0, to: 3, classes: ['hljs-keyword'] }])
  })

  it('空文本节点被跳过', () => {
    const tree = root([el(['hljs-keyword'], [text('')]), el(['hljs-string'], [text('x')])])
    expect(collectHighlightTokens(tree)).toEqual([{ from: 0, to: 1, classes: ['hljs-string'] }])
  })

  it('缺少 children / properties 的节点不会抛错', () => {
    expect(collectHighlightTokens({ type: 'element' })).toEqual([])
    expect(collectHighlightTokens({ type: 'text', value: 'hi' })).toEqual([])
  })
})
