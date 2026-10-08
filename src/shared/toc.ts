/** TOC 占位符的共用规则：编辑器与导出都要用，放 shared 保证两边一致。 */

/** 写入文档时统一用这个写法 */
export const TOC_MARKER = '[TOC]'

/**
 * 整段文本是否为 TOC 占位符（trim 后、大小写不敏感）。
 * 注意：**是否在根层**由调用方判断 —— 引用内 / 列表项内的 `> [TOC]`、`- [TOC]`
 * 不算目录，本函数只看文本。
 */
export function isTocParagraph(text: string): boolean {
  return text.trim().toLowerCase() === TOC_MARKER.toLowerCase()
}

export interface TocEntry {
  level: number
  text: string
}

export type TocTreeNode<T> = T & { children: TocTreeNode<T>[] }

/**
 * 按层级把标题序列组织成树。
 * 只比较层级大小，因此 h1 直接跳到 h3 会直接嵌套，**不会产生空层**。
 */
export function buildTocTree<T extends { level: number }>(entries: readonly T[]): TocTreeNode<T>[] {
  const roots: TocTreeNode<T>[] = []
  const stack: TocTreeNode<T>[] = []
  for (const entry of entries) {
    const node = { ...entry, children: [] } as TocTreeNode<T>
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) stack.pop()
    if (stack.length === 0) roots.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }
  return roots
}

/**
 * 按先序遍历展平目录树 —— 先序顺序就是原始标题的文档顺序。
 *
 * 编辑器靠这条不变量把目录条目的下标对上 `querySelectorAll('h1..h6')` 的下标。
 * 注意：`buildTocTree` 会为每个条目**新建对象**，所以不能拿原始标题对象做身份查表，
 * 必须从这棵树的展平结果里取下标。
 */
export function flattenTocTree<T>(nodes: TocTreeNode<T>[]): TocTreeNode<T>[] {
  const flat: TocTreeNode<T>[] = []
  const walk = (list: TocTreeNode<T>[]): void => {
    for (const node of list) {
      flat.push(node)
      walk(node.children)
    }
  }
  walk(nodes)
  return flat
}
