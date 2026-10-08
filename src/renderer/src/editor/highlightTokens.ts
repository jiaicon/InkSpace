import { createLowlight, common } from 'lowlight'

/** 与导出侧 rehype-highlight 保持一致：同一套 common 语言集、不开自动检测 */
export const lowlight = createLowlight(common)

/** hast 节点的最小结构（只用到这些字段，便于单测构造普通对象） */
export interface HighlightNode {
  type: string
  value?: string
  properties?: { className?: unknown }
  children?: HighlightNode[]
}

export interface HighlightToken {
  from: number
  to: number
  classes: string[]
}

function classNamesOf(node: HighlightNode): string[] {
  const raw = node.properties?.className
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\s+/) : []
  return list.filter((c): c is string => typeof c === 'string' && c.startsWith('hljs-'))
}

/**
 * 把 lowlight 的 hast 树转成「字符偏移区间 + 类名」列表。
 *
 * 树的文本内容与原始代码逐字符相同，因此偏移可以直接累加得到——这比解析
 * highlight.js 的 HTML 字符串再数 DOM 偏移可靠得多。相邻且类名完全相同的
 * 区间会合并，避免在大段代码里产出成百上千个碎片装饰。
 */
export function collectHighlightTokens(tree: HighlightNode | undefined): HighlightToken[] {
  const tokens: HighlightToken[] = []

  const walk = (node: HighlightNode | undefined, offset: number, inherited: string[]): number => {
    if (!node) return offset

    if (node.type === 'text') {
      const value = node.value ?? ''
      if (value && inherited.length > 0) {
        const last = tokens[tokens.length - 1]
        const sameClasses =
          last && last.to === offset && last.classes.join(' ') === inherited.join(' ')
        if (sameClasses) last.to = offset + value.length
        else tokens.push({ from: offset, to: offset + value.length, classes: [...inherited] })
      }
      return offset + value.length
    }

    const classes = [...inherited, ...classNamesOf(node)]
    let cursor = offset
    for (const child of node.children ?? []) cursor = walk(child, cursor, classes)
    return cursor
  }

  walk(tree, 0, [])
  return tokens
}

/** ProseMirror 文档节点的最小结构（真实 Node 结构上兼容，便于单测） */
export interface DocLikeNode {
  type: { name: string }
  attrs: Record<string, unknown>
  textContent: string
  /** 节点总长度（含前后边框），与 ProseMirror 的 nodeSize 一致 */
  nodeSize: number
  descendants(callback: (node: DocLikeNode, pos: number) => boolean | void): void
}

export interface CodeBlockRange {
  from: number
  to: number
}

/**
 * 文档里需要高亮着色的代码块范围（含边框），**不含 mermaid 块**——
 * 图表块由 node view 渲染成图，不该再套代码块的底色与语法着色。
 */
export function collectCodeBlockRanges(doc: DocLikeNode): CodeBlockRange[] {
  const ranges: CodeBlockRange[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'code_block') return true
    const language = String(node.attrs.language ?? '')
      .trim()
      .toLowerCase()
    if (language === 'mermaid') return false
    ranges.push({ from: pos, to: pos + node.nodeSize })
    return false
  })
  return ranges
}

/**
 * 遍历文档，产出代码块内高亮区间的**文档绝对位置**。
 *
 * 代码块内容是一段纯文本，collectHighlightTokens 给出的是相对内容起点的偏移，
 * 因此统一后移 1（块的起始位置 + 1 即内容起点）。
 */
export function collectDocumentHighlights(doc: DocLikeNode): HighlightToken[] {
  const result: HighlightToken[] = []

  doc.descendants((node, pos) => {
    if (node.type.name !== 'code_block') return true

    // 没写语言就原样显示；不自动检测语言，保证与导出行为一致、结果可预测
    const language = String(node.attrs.language ?? '')
      .trim()
      .toLowerCase()
    const code = node.textContent
    if (!language || !code || !lowlight.registered(language)) return false

    const tree = lowlight.highlight(language, code) as HighlightNode
    for (const token of collectHighlightTokens(tree)) {
      result.push({ from: pos + 1 + token.from, to: pos + 1 + token.to, classes: token.classes })
    }
    return false
  })

  return result
}
