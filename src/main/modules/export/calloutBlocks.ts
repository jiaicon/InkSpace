import { calloutMeta, parseCalloutMarker } from '@shared/callout'
import type { HastNode } from './ensureCodeClass'

/** 元素节点的纯文本（递归拼接） */
function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
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
  const first = kids[0]
  if (!first || first.type !== 'element' || first.tagName !== 'p') return null

  const type = parseCalloutMarker(textOf(first))
  if (!type) return null

  const meta = calloutMeta(type)
  const title: HastNode = {
    type: 'element',
    tagName: 'p',
    properties: { className: ['callout-title'] },
    children: [{ type: 'text', value: meta.title }]
  }
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['callout', `callout-${meta.slug}`] },
    children: [title, ...kids.slice(1)]
  }
}
