/**
 * 斜杠菜单的判定规则（纯函数，不依赖 Milkdown，便于单测）。
 */

/** 允许在块首呼出菜单的块类型：段落（列表项内也是段落）与标题 */
const MENU_START_BLOCKS = new Set(['paragraph', 'heading'])

/**
 * 光标是否在可呼出菜单的块的起始处。
 * 标题也算 —— 否则「正文」这项在标题里根本够不着（标题不是 paragraph）。
 */
export function canOpenSlashMenu(parentTypeName: string, parentOffset: number): boolean {
  return MENU_START_BLOCKS.has(parentTypeName) && parentOffset === 0
}

export type EscapeTarget = 'list' | 'quote' | 'paragraph'

/**
 * 「正文」项该做什么 —— 从当前块所处的容器里退出来。
 * 入参是光标处的祖先节点类型（顺序无关）。
 */
export function escapeTarget(ancestorTypeNames: readonly string[]): EscapeTarget {
  const names = new Set(ancestorTypeNames)
  // 列表优先：列表项的段落本来就是 paragraph，setBlockType 是空操作，必须先脱出列表
  if (names.has('bullet_list') || names.has('ordered_list')) return 'list'
  if (names.has('blockquote')) return 'quote'
  return 'paragraph'
}
