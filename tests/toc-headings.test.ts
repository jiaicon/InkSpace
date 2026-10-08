import { describe, expect, it } from 'vitest'
import { TOC_MARKER, buildTocTree, flattenTocTree, isTocParagraph } from '../src/shared/toc'
import {
  collectHeadings,
  type HeadingDocLike,
  type HeadingNodeLike
} from '../src/renderer/src/editor/tocHeadings'

describe('isTocParagraph', () => {
  it('只认整段恰为 [TOC]', () => {
    expect(isTocParagraph('[TOC]')).toBe(true)
    expect(isTocParagraph('  [TOC]  ')).toBe(true)
    expect(isTocParagraph('[toc]')).toBe(true)
  })

  it('夹着别的文字不算', () => {
    expect(isTocParagraph('见 [TOC] 一节')).toBe(false)
    expect(isTocParagraph('[TOC] 目录')).toBe(false)
    expect(isTocParagraph('')).toBe(false)
  })

  it('写入用大写常量', () => {
    expect(TOC_MARKER).toBe('[TOC]')
  })
})

describe('buildTocTree', () => {
  it('按层级成树，缺级不留空层', () => {
    const tree = buildTocTree([
      { level: 1, text: 'a' },
      { level: 3, text: 'b' },
      { level: 2, text: 'c' },
      { level: 1, text: 'd' }
    ])
    expect(tree.map((n) => n.text)).toEqual(['a', 'd'])
    expect(tree[0].children.map((n) => n.text)).toEqual(['b', 'c'])
    expect(tree[0].children[0].children).toEqual([])
  })

  it('同层并列', () => {
    const tree = buildTocTree([
      { level: 2, text: 'a' },
      { level: 2, text: 'b' }
    ])
    expect(tree.map((n) => n.text)).toEqual(['a', 'b'])
    expect(tree[0].children).toEqual([])
  })

  it('空输入返回空数组', () => {
    expect(buildTocTree([])).toEqual([])
  })
})

describe('flattenTocTree', () => {
  it('先序遍历顺序 = 原始输入顺序（目录下标靠这条不变量对上标题下标）', () => {
    const entries = [
      { level: 1, text: 'a' },
      { level: 3, text: 'b' },
      { level: 2, text: 'c' },
      { level: 1, text: 'd' },
      { level: 2, text: 'e' }
    ]
    expect(flattenTocTree(buildTocTree(entries)).map((n) => n.text)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e'
    ])
  })

  it('展平出来的是树里的同一批对象（点击时按下标回查必须能命中）', () => {
    const tree = buildTocTree([
      { level: 1, text: 'a' },
      { level: 2, text: 'b' }
    ])
    const flat = flattenTocTree(tree)
    expect(flat).toHaveLength(2)
    expect(flat[1]).toBe(tree[0].children[0])
  })

  it('空数组返回空数组', () => {
    expect(flattenTocTree([])).toEqual([])
  })
})

/** 伪造块节点：在导出类型上多一个 nodeSize，用于累加位置 */
interface FakeBlock extends HeadingNodeLike {
  nodeSize: number
}

const heading = (level: number, text: string): FakeBlock => ({
  type: { name: 'heading' },
  attrs: { level },
  textContent: text,
  nodeSize: text.length + 2
})

const paragraph = (text: string): FakeBlock => ({
  type: { name: 'paragraph' },
  attrs: {},
  textContent: text,
  nodeSize: text.length + 2
})

function fakeDoc(nodes: FakeBlock[]): HeadingDocLike {
  return {
    descendants(cb) {
      let pos = 0
      for (const n of nodes) {
        cb(n, pos)
        pos += n.nodeSize
      }
    }
  }
}

describe('collectHeadings', () => {
  it('按文档顺序收集标题与层级，忽略非标题', () => {
    const doc = fakeDoc([heading(1, '一'), paragraph('正文'), heading(3, '二')])
    expect(collectHeadings(doc)).toEqual([
      { level: 1, text: '一' },
      { level: 3, text: '二' }
    ])
  })

  it('文本取 textContent —— 行内标记已被剥掉（Review Focus #2）', () => {
    const doc = fakeDoc([heading(2, '用 code 的标题')])
    expect(collectHeadings(doc)[0].text).toBe('用 code 的标题')
  })
})
