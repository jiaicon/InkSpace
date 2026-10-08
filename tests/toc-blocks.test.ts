import { describe, expect, it } from 'vitest'
import { collectHastHeadings, replaceTocPlaceholder } from '../src/main/modules/export/tocBlocks'
import { addHeadingIds } from '../src/main/modules/export/headingIds'
import type { HastNode } from '../src/main/modules/export/ensureCodeClass'

const text = (value: string): HastNode => ({ type: 'text', value })
const el = (tagName: string, ...children: HastNode[]): HastNode => ({
  type: 'element',
  tagName,
  children
})
const root = (...children: HastNode[]): HastNode => ({ type: 'root', children })

const hastTextOf = (n: HastNode): string =>
  n.type === 'text' ? (n.value ?? '') : (n.children ?? []).map(hastTextOf).join('')

/** 收集出来的第一个 nav 里的链接文本 */
function firstNavLinks(tree: HastNode): string[] {
  const nav = tree.children!.find((c) => c.tagName === 'nav')!
  const links: string[] = []
  const walk = (n: HastNode): void => {
    if (n.tagName === 'a') links.push(hastTextOf(n))
    for (const c of n.children ?? []) walk(c)
  }
  walk(nav)
  return links
}

describe('collectHastHeadings', () => {
  it('按文档顺序收集 h1–h6，带 id 与文本', () => {
    const tree = root(el('h1', text('一')), el('p', text('正文')), el('h3', text('二')))
    addHeadingIds(tree)
    expect(collectHastHeadings(tree)).toEqual([
      { level: 1, text: '一', id: '一' },
      { level: 3, text: '二', id: '二' }
    ])
  })
})

describe('replaceTocPlaceholder', () => {
  it('把根层 [TOC] 段落换成 nav 嵌套列表', () => {
    const tree = root(
      el('p', text('[TOC]')),
      el('h1', text('一')),
      el('h2', text('二')),
      el('h3', text('三'))
    )
    addHeadingIds(tree)
    const entries = collectHastHeadings(tree)
    expect(replaceTocPlaceholder(tree, entries)).toBe(1)

    const nav = tree.children![0]
    expect(nav.tagName).toBe('nav')
    expect(nav.properties?.className).toEqual(['toc'])
    expect(firstNavLinks(tree)).toEqual(['一', '二', '三'])
    // h3 嵌在 h2 的 li 里
    const ul = nav.children![0]
    const firstLi = ul.children![0]
    expect(firstLi.children!.some((c) => c.tagName === 'ul')).toBe(true)
  })

  it('非根层的 [TOC] 不转换（Review Focus #1）', () => {
    const tree = root(el('blockquote', el('p', text('[TOC]'))), el('h1', text('一')))
    addHeadingIds(tree)
    expect(replaceTocPlaceholder(tree, collectHastHeadings(tree))).toBe(0)
    expect(tree.children![0].tagName).toBe('blockquote')
  })

  it('段落里夹着别的文字不转换', () => {
    const tree = root(el('p', text('见 [TOC] 一节')), el('h1', text('一')))
    addHeadingIds(tree)
    expect(replaceTocPlaceholder(tree, collectHastHeadings(tree))).toBe(0)
  })

  it('无标题时 nav 内为空', () => {
    const tree = root(el('p', text('[TOC]')))
    addHeadingIds(tree)
    expect(replaceTocPlaceholder(tree, collectHastHeadings(tree))).toBe(1)
    const nav = tree.children![0]
    expect(nav.tagName).toBe('nav')
    expect(nav.children).toEqual([])
  })

  it('链接指向标题 id', () => {
    const tree = root(el('p', text('[TOC]')), el('h2', text('同名')), el('h2', text('同名')))
    addHeadingIds(tree)
    replaceTocPlaceholder(tree, collectHastHeadings(tree))
    const nav = tree.children![0]
    const hrefs: string[] = []
    const walk = (n: HastNode): void => {
      if (n.tagName === 'a') hrefs.push(String(n.properties?.href))
      for (const c of n.children ?? []) walk(c)
    }
    walk(nav)
    expect(hrefs).toEqual(['#同名', '#同名-1'])
  })

  it('多个 [TOC] 各得一份独立节点（不共享同一对象）', () => {
    const tree = root(el('p', text('[TOC]')), el('p', text('[TOC]')), el('h1', text('一')))
    addHeadingIds(tree)
    expect(replaceTocPlaceholder(tree, collectHastHeadings(tree))).toBe(2)
    expect(tree.children![0].tagName).toBe('nav')
    expect(tree.children![1].tagName).toBe('nav')
    expect(tree.children![0]).not.toBe(tree.children![1])
  })
})
