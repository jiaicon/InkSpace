/**
 * mermaid 图表的主题：mermaid 官方就这几个内置主题。
 * 形态与 highlightThemes.ts 刻意保持一致（auto 跟随明暗 + 按明暗分组的下拉），
 * 设置面板里两块能复用同一套交互。
 */

export type MermaidThemeId = 'default' | 'neutral' | 'forest' | 'dark' | 'base'

export interface MermaidTheme {
  id: MermaidThemeId
  label: string
  /** 用于按当前界面明暗分组展示 */
  kind: 'light' | 'dark'
}

export const MERMAID_THEMES: readonly MermaidTheme[] = [
  { id: 'default', label: 'Default', kind: 'light' },
  { id: 'neutral', label: 'Neutral', kind: 'light' },
  { id: 'forest', label: 'Forest', kind: 'light' },
  { id: 'base', label: 'Base（最素，适合再被主题 CSS 覆盖）', kind: 'light' },
  { id: 'dark', label: 'Dark', kind: 'dark' }
]

/** 跟随应用明暗自动挑选（设置项的默认值） */
export const AUTO_MERMAID_THEME = 'auto'
export const DEFAULT_MERMAID_THEME = AUTO_MERMAID_THEME

const AUTO_LIGHT: MermaidThemeId = 'default'
const AUTO_DARK: MermaidThemeId = 'dark'
const KNOWN = new Set<string>(MERMAID_THEMES.map((t) => t.id))

/**
 * 把设置里的值解析成实际生效的 mermaid 主题。
 * `auto`（以及空值）按界面明暗挑，避免暗色界面里出现浅色图表；
 * 未知 id 回落 default，保证任何情况下都有确定结果。
 */
export function resolveMermaidTheme(
  id: string | undefined | null,
  appTheme: 'light' | 'dark'
): MermaidThemeId {
  if (!id || id === AUTO_MERMAID_THEME) return appTheme === 'dark' ? AUTO_DARK : AUTO_LIGHT
  return KNOWN.has(id) ? (id as MermaidThemeId) : AUTO_LIGHT
}

/** 是否是合法的设置值（'auto' 或内置 id），用于 IPC 边界校验 */
export function isKnownMermaidTheme(id: string): boolean {
  return id === AUTO_MERMAID_THEME || KNOWN.has(id)
}
