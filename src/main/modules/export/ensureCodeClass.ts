/** hast 节点的最小结构（只用到这些字段，便于单测构造普通对象） */
export interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

/**
 * 元素的纯文本（递归拼接行内子节点，例如标题里的 `<code>`）。
 *
 * 与 `HastNode` 同放在这里：本目录的几个 hast 变换都从这一个模块取共用件，
 * 免得各写一份实现之后行为悄悄分叉。
 */
export function hastText(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(hastText).join('')
}

function classNameOf(node: HastNode): string[] {
  const raw = node.properties?.className
  if (Array.isArray(raw)) return raw.filter((c): c is string => typeof c === 'string')
  if (typeof raw === 'string') return raw.split(/\s+/).filter(Boolean)
  return []
}

/**
 * 给所有代码块补上 hljs 类。
 *
 * `rehype-highlight` 只处理**标注了语言**的代码块：没标注语言的不会被高亮，也就不会被
 * 打上 hljs 类。而代码主题的底色、文字色、内边距全都挂在 `.hljs` / `pre code.hljs` 上，
 * 于是无语言的代码块会完全没有样式。
 *
 * 编辑器侧是给每个代码块都挂 hljs（见 editor/highlightTokens.ts 的 collectCodeBlockRanges），
 * 这里保持一致，导出与编辑器行为才统一。
 */
export function addHljsClassToCodeBlocks(node: HastNode | undefined): void {
  if (!node) return

  if (node.type === 'element' && node.tagName === 'pre') {
    for (const child of node.children ?? []) {
      if (child.type !== 'element' || child.tagName !== 'code') continue
      const classes = classNameOf(child)
      if (classes.includes('hljs')) continue
      child.properties = { ...child.properties, className: ['hljs', ...classes] }
    }
  }

  for (const child of node.children ?? []) addHljsClassToCodeBlocks(child)
}
