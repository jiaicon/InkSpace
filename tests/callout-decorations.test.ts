import { describe, expect, it } from 'vitest'
import {
  collectCallouts,
  type CalloutDocLike,
  type CalloutNodeLike
} from '../src/renderer/src/editor/callout'

/** 伪造块节点：在导出类型上多一个 children，便于搭出嵌套结构 */
interface FakeBlock extends CalloutNodeLike {
  children?: FakeBlock[]
}

/** 用最小结构伪造 ProseMirror doc；子节点从父节点 pos+1 开始，与真实文档一致 */
function fakeDoc(topLevel: FakeBlock[]): CalloutDocLike {
  return {
    descendants(cb) {
      const walk = (list: FakeBlock[], base: number) => {
        let pos = base
        for (const n of list) {
          const keepGoing = cb(n, pos)
          if (keepGoing !== false && n.children) walk(n.children, pos + 1)
          pos += n.nodeSize
        }
      }
      walk(topLevel, 0)
    }
  }
}

const para = (text: string): FakeBlock => ({
  type: { name: 'paragraph' },
  textContent: text,
  nodeSize: text.length + 2,
  firstChild: null
})
const quote = (children: FakeBlock[], nodeSize: number): FakeBlock => ({
  type: { name: 'blockquote' },
  textContent: children.map((c) => c.textContent).join(''),
  nodeSize,
  firstChild: children[0],
  children
})

describe('collectCallouts', () => {
  it('找出首段是标记的引用块，并给出标记段结束位置', () => {
    const doc = fakeDoc([quote([para('[!NOTE]'), para('内容')], 100)])
    // '[!NOTE]' 共 7 个字符 → 标记段 nodeSize = 7 + 2 = 9，从 pos+1 起 → markerTo = 10
    expect(collectCallouts(doc)).toEqual([{ pos: 0, to: 100, markerTo: 10, type: 'NOTE' }])
  })

  it('标记不在首段则不算（Review Focus #4）', () => {
    const doc = fakeDoc([quote([para('正文'), para('[!NOTE]')], 100)])
    expect(collectCallouts(doc)).toEqual([])
  })

  it('普通引用不算', () => {
    const doc = fakeDoc([quote([para('普通引用')], 100)])
    expect(collectCallouts(doc)).toEqual([])
  })

  it('外层不是 callout 时，仍能找到内层嵌套的 callout', () => {
    const inner = quote([para('[!TIP]'), para('x')], 50)
    const doc = fakeDoc([quote([inner], 200)])
    const hits = collectCallouts(doc)
    expect(hits).toHaveLength(1)
    expect(hits[0].type).toBe('TIP')
  })

  it('大小写容错', () => {
    const doc = fakeDoc([quote([para('[!caution]'), para('x')], 100)])
    expect(collectCallouts(doc)[0].type).toBe('CAUTION')
  })
})
