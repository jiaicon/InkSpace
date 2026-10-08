export interface HeadingEntry {
  level: number
  text: string
}

/** collectHeadings 只需要文档这几个能力，便于用伪造对象单测 */
export interface HeadingDocLike {
  descendants(cb: (node: HeadingNodeLike, pos: number) => boolean | void): void
}
export interface HeadingNodeLike {
  type: { name: string }
  attrs: Record<string, unknown>
  textContent: string
}

/**
 * 文档里所有标题，按文档顺序。
 * 口径与侧栏大纲一致：**包含嵌在引用里的标题**（如 `> # 标题`）。
 */
export function collectHeadings(doc: HeadingDocLike): HeadingEntry[] {
  const headings: HeadingEntry[] = []
  doc.descendants((node) => {
    if (node.type.name !== 'heading') return true
    const level = Number(node.attrs.level ?? 1)
    headings.push({ level, text: node.textContent })
    return false
  })
  return headings
}
