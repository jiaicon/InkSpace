import { buildTocTree, isTocParagraph, type TocTreeNode } from '@shared/toc'
import { hastText } from './headingIds'
import type { HastNode } from './ensureCodeClass'

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

export interface TocHtmlEntry {
  level: number
  text: string
  id: string
}

/** 按文档顺序收集 h1–h6（含嵌在引用里的），要求已经跑过 addHeadingIds */
export function collectHastHeadings(node: HastNode | undefined): TocHtmlEntry[] {
  const entries: TocHtmlEntry[] = []
  const walk = (n: HastNode): void => {
    if (n.type === 'element' && n.tagName && HEADING_TAGS.has(n.tagName)) {
      entries.push({
        level: Number(n.tagName.slice(1)),
        text: hastText(n),
        id: String(n.properties?.id ?? '')
      })
    }
    for (const child of n.children ?? []) walk(child)
  }
  walk(node ?? { type: 'root' })
  return entries
}

function anchor(entry: TocHtmlEntry): HastNode {
  return {
    type: 'element',
    tagName: 'a',
    properties: { href: `#${entry.id}` },
    children: [{ type: 'text', value: entry.text }]
  }
}

function listFrom(nodes: TocTreeNode<TocHtmlEntry>[]): HastNode {
  return {
    type: 'element',
    tagName: 'ul',
    // properties 必须存在：rehype-katex 等插件会无保护地读 node.properties.className，
    // 缺了会让整条导出管线抛错（纯函数单测看不出来，只有集成测试才会踩到）
    properties: {},
    children: nodes.map((n) => ({
      type: 'element' as const,
      tagName: 'li',
      properties: {},
      children: n.children.length > 0 ? [anchor(n), listFrom(n.children)] : [anchor(n)]
    }))
  }
}

/** 每次替换都造一份新的 nav —— 多个 [TOC] 共享同一对象会让树里出现节点别名 */
function tocNav(entries: readonly TocHtmlEntry[]): HastNode {
  return {
    type: 'element',
    tagName: 'nav',
    properties: { className: ['toc'] },
    children: entries.length > 0 ? [listFrom(buildTocTree(entries))] : []
  }
}

/**
 * 把**根层**文本恰为 `[TOC]` 的 `<p>` 换成 `<nav class="toc">` 嵌套列表。
 * 返回替换的个数。非根层（引用内 / 列表项内）的 `[TOC]` 保持普通文本。
 */
export function replaceTocPlaceholder(tree: HastNode, entries: readonly TocHtmlEntry[]): number {
  if (!tree.children) return 0

  let replaced = 0
  tree.children = tree.children.map((child) => {
    if (child.type !== 'element' || child.tagName !== 'p') return child
    if (!isTocParagraph(hastText(child))) return child
    replaced++
    return tocNav(entries)
  })
  return replaced
}
