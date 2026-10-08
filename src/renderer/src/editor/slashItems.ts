/**
 * 斜杠菜单的条目定义（纯数据，不依赖 Milkdown，便于单测）。
 * 每项的「动作」在 slashMenu.ts 里按 id 绑定 —— 这样过滤/分组逻辑可以脱离编辑器独立测试。
 *
 * 面向非技术用户：功能自明的项（H1–H6）只显示代号，功能名放 tooltip；
 * 其余项保留短标签，并用 keywords 兜住中英文别名。
 */

export type SlashGroup = 'heading' | 'list' | 'block' | 'insert'

/** 组的展示顺序（同时也是分组结果的顺序） */
export const SLASH_GROUP_ORDER: SlashGroup[] = ['heading', 'list', 'block', 'insert']

export const SLASH_GROUP_LABELS: Record<SlashGroup, string> = {
  heading: '标题',
  list: '列表',
  block: '基础块',
  insert: '插入'
}

export interface SlashItemMeta {
  id: string
  group: SlashGroup
  icon: string
  /** 有 label 就显示文字；缺省表示只显示图标（功能名放进 tooltip），如 H1–H6 */
  label?: string
  tooltip: string
  /** 参与过滤的别名（英文/简写等） */
  keywords: string[]
}

const CN_NUMERALS = '一二三四五六'

const headingItem = (level: number): SlashItemMeta => ({
  id: `h${level}`,
  group: 'heading',
  icon: `H${level}`,
  tooltip: `${CN_NUMERALS[level - 1]}级标题`,
  keywords: [`h${level}`, `heading ${level}`, `标题${level}`, '标题', 'bt']
})

export const slashItems: SlashItemMeta[] = [
  ...[1, 2, 3, 4, 5, 6].map(headingItem),
  {
    id: 'bullet',
    group: 'list',
    icon: '•',
    label: '无序列表',
    tooltip: '无序列表',
    keywords: ['list', 'bullet', '无序', 'lb', 'wxlb']
  },
  {
    id: 'ordered',
    group: 'list',
    icon: '1.',
    label: '有序列表',
    tooltip: '有序列表',
    keywords: ['ordered list', 'number', '有序', 'lb', 'yxlb']
  },
  {
    id: 'task',
    group: 'list',
    icon: '☑',
    label: '任务列表',
    tooltip: '任务列表',
    keywords: ['task', 'todo', 'checkbox', '任务', 'lb', 'rwlb']
  },
  {
    id: 'text',
    group: 'block',
    icon: '▤',
    label: '正文',
    tooltip: '转回普通段落',
    keywords: ['text', 'paragraph', 'body', '正文', '段落', '普通', 'zw']
  },
  {
    id: 'quote',
    group: 'block',
    icon: '❝',
    label: '引用',
    tooltip: '引用',
    keywords: ['quote', 'blockquote', '引用', 'yy']
  },
  {
    id: 'hr',
    group: 'block',
    icon: '―',
    label: '分割线',
    tooltip: '分割线',
    keywords: ['hr', 'divider', 'rule', '分割', 'fgx']
  },
  {
    id: 'code',
    group: 'block',
    icon: '</>',
    label: '代码块',
    tooltip: '代码块',
    keywords: ['code', 'codeblock', '代码', 'dmk']
  },
  {
    id: 'table',
    group: 'block',
    icon: '⊞',
    label: '表格',
    tooltip: '表格',
    keywords: ['table', 'grid', '表格', 'bg']
  },
  {
    id: 'math',
    group: 'insert',
    icon: '∑',
    label: '数学公式',
    tooltip: '数学公式',
    keywords: ['math', 'formula', 'latex', 'katex', '公式', 'gs']
  },
  {
    id: 'mermaid',
    group: 'insert',
    icon: '◈',
    label: 'Mermaid 图',
    tooltip: 'Mermaid 图',
    keywords: ['mermaid', 'diagram', 'chart', '图表', '图', 'mt']
  },
  {
    id: 'image',
    group: 'insert',
    icon: '▣',
    label: '图片',
    tooltip: '图片',
    keywords: ['image', 'picture', 'img', '图片', 'tp']
  }
]

/** 按 query 过滤：匹配 label / tooltip / keywords，大小写不敏感；空 query 返回全部 */
export function filterSlashItems<T extends SlashItemMeta>(items: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...items]
  return items.filter((item) =>
    [item.label, item.tooltip, ...item.keywords].some((field) =>
      (field ?? '').toLowerCase().includes(q)
    )
  )
}

/** 按固定组顺序归类，丢弃空组（过滤后某组无匹配，就不显示该组标题） */
export function groupSlashItems<T extends SlashItemMeta>(
  items: readonly T[]
): { group: SlashGroup; label: string; items: T[] }[] {
  return SLASH_GROUP_ORDER.map((group) => ({
    group,
    label: SLASH_GROUP_LABELS[group],
    items: items.filter((item) => item.group === group)
  })).filter((g) => g.items.length > 0)
}
