import type { HastNode } from './ensureCodeClass'

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/** 元素的纯文本（递归拼接 h1–h6 里的行内标记，如 <code>） */
export function hastText(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(hastText).join('')
}

/**
 * 标题文本 → 锚点 id：保留中文与字母数字，其余转 `-`，折叠连续 `-`，去首尾 `-`，
 * 小写化；结果为空（只有 emoji / 符号）时回落 `section`。
 */
export function slugifyHeading(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'section'
}

/**
 * 给所有 h1–h6 加 id（同名的追加 `-1`/`-2`）。
 * 只写 id 属性，不改动层级、文本或其它属性。
 */
export function addHeadingIds(node: HastNode | undefined): void {
  if (!node?.children) return

  const used = new Set<string>()
  const assign = (el: HastNode): void => {
    const base = slugifyHeading(hastText(el))
    let id = base
    let n = 0
    while (used.has(id)) id = `${base}-${++n}`
    used.add(id)
    el.properties = { ...el.properties, id }
  }

  // 先按文档顺序扫一遍所有标题（含嵌套在引用里的），再统一分配，保证去重顺序稳定
  const headings: HastNode[] = []
  const scan = (n: HastNode): void => {
    if (n.type === 'element' && n.tagName && HEADING_TAGS.has(n.tagName)) headings.push(n)
    for (const child of n.children ?? []) scan(child)
  }
  scan(node)

  for (const el of headings) assign(el)
}
