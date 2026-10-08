import { calloutMeta, parseCalloutMarker } from '@shared/callout'
import { hastText, type HastNode } from './ensureCodeClass'

/**
 * 第一个**元素**子节点。remark-rehype 会在块之间插入 `"\n"` 文本节点，
 * 所以不能假设 children[0] 就是段落。
 */
function firstElement(children: readonly HastNode[]): { node: HastNode; index: number } | null {
  for (let i = 0; i < children.length; i++) {
    if (children[i].type === 'element') return { node: children[i], index: i }
  }
  return null
}

/** 只有空白的文本节点（块之间的换行） */
function isBlank(node: HastNode): boolean {
  return node.type === 'text' && (node.value ?? '').trim() === ''
}

/**
 * 把 `> [!TYPE]` 的引用块换成 `<div class="callout callout-<slug>">`。
 *
 * 判定与编辑器侧共用 @shared/callout，两边规则不会漂移。
 * 不满足条件的引用块一律原样不动（降级为普通引用）。
 */
export function transformCallouts(node: HastNode | undefined): void {
  if (!node?.children) return

  node.children.forEach((child, i) => {
    if (child.type === 'element' && child.tagName === 'blockquote') {
      const converted = asCallout(child)
      if (converted) {
        node.children![i] = converted
        return // 内容已原样搬进 div，不必再往里递归
      }
    }
    transformCallouts(child)
  })
}

function asCallout(quote: HastNode): HastNode | null {
  const kids = quote.children ?? []
  const found = firstElement(kids)
  if (!found || found.node.tagName !== 'p') return null

  const type = parseCalloutMarker(hastText(found.node))
  if (!type) return null

  const meta = calloutMeta(type)
  const title: HastNode = {
    type: 'element',
    tagName: 'p',
    properties: { className: ['callout-title'] },
    children: [{ type: 'text', value: meta.title }]
  }
  // 丢掉标记段本身；同时丢掉 div **直接子节点**里的空白（块之间的换行无意义）。
  // 只过滤直接子节点，pre 内部的空白是内容，不能碰。
  const body = kids.slice(found.index + 1).filter((kid) => !isBlank(kid))
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['callout', `callout-${meta.slug}`] },
    children: [title, ...body]
  }
}
