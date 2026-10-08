import { describe, expect, it } from 'vitest'
import { addHeadingIds, hastText, slugifyHeading } from '../src/main/modules/export/headingIds'
import type { HastNode } from '../src/main/modules/export/ensureCodeClass'

const h = (tagName: string, ...children: HastNode[]): HastNode => ({
  type: 'element',
  tagName,
  children
})
const text = (value: string): HastNode => ({ type: 'text', value })
const root = (...children: HastNode[]): HastNode => ({ type: 'root', children })

describe('hastText', () => {
  it('递归拼接元素与文本', () => {
    expect(hastText(h('h2', text('用 '), h('code', text('code')), text(' 的标题')))).toBe(
      '用 code 的标题'
    )
  })

  it('带行内标记的标题取到纯文本，与编辑侧口径一致（Review Focus #2）', () => {
    // 编辑侧 collectHeadings 读 ProseMirror 的 textContent，同样不含标记；
    // 两边都得到 '用 code 的标题'，目录文本与 slug 才不会分叉
    const heading = h('h2', text('用 '), h('code', text('code')), text(' 的标题'))
    expect(hastText(heading)).toBe('用 code 的标题')
    expect(slugifyHeading(hastText(heading))).toBe('用-code-的标题')
  })
})

describe('slugifyHeading', () => {
  it('保留中文与字母数字，去标点，空白转连字符', () => {
    expect(slugifyHeading('第一章 概述')).toBe('第一章-概述')
    expect(slugifyHeading('Hello World!')).toBe('hello-world')
    expect(slugifyHeading('a/b:c')).toBe('a-b-c')
  })

  it('折叠连续连字符并去掉首尾连字符', () => {
    expect(slugifyHeading('a  --  b')).toBe('a-b')
    expect(slugifyHeading(' 空格 ')).toBe('空格')
  })

  it('只有 emoji / 符号时回落 section（Review Focus #3）', () => {
    expect(slugifyHeading('!!!')).toBe('section')
    expect(slugifyHeading('😀')).toBe('section')
    expect(slugifyHeading('')).toBe('section')
  })
})

describe('addHeadingIds', () => {
  it('给 h1–h6 加 id，其余元素不动', () => {
    const p: HastNode = { type: 'element', tagName: 'p', children: [text('x')] }
    const tree = root(h('h1', text('标题')), p)
    addHeadingIds(tree)
    expect(tree.children![0].properties?.id).toBe('标题')
    expect(p.properties).toBeUndefined()
  })

  it('重名追加 -1 / -2，第一个不加后缀', () => {
    const tree = root(h('h2', text('同名')), h('h2', text('同名')), h('h2', text('同名')))
    addHeadingIds(tree)
    expect(tree.children!.map((c) => c.properties?.id)).toEqual(['同名', '同名-1', '同名-2'])
  })

  it('嵌套在引用里的标题也加 id', () => {
    const tree = root(h('blockquote', h('h3', text('引用里的标题'))))
    addHeadingIds(tree)
    expect(tree.children![0].children![0].properties?.id).toBe('引用里的标题')
  })

  it('只为 h1–h6 加 id，h7 不管', () => {
    const tree = root(h('h7', text('x')))
    addHeadingIds(tree)
    expect(tree.children![0].properties?.id).toBeUndefined()
  })
})
