import github from 'highlight.js/styles/github.css?raw'
import atomOneLight from 'highlight.js/styles/atom-one-light.css?raw'
import xcode from 'highlight.js/styles/xcode.css?raw'
import vs from 'highlight.js/styles/vs.css?raw'
import intellijLight from 'highlight.js/styles/intellij-light.css?raw'
import stackoverflowLight from 'highlight.js/styles/stackoverflow-light.css?raw'
import a11yLight from 'highlight.js/styles/a11y-light.css?raw'
import googlecode from 'highlight.js/styles/googlecode.css?raw'
import githubDark from 'highlight.js/styles/github-dark.css?raw'
import githubDarkDimmed from 'highlight.js/styles/github-dark-dimmed.css?raw'
import atomOneDark from 'highlight.js/styles/atom-one-dark.css?raw'
import monokai from 'highlight.js/styles/monokai.css?raw'
import vs2015 from 'highlight.js/styles/vs2015.css?raw'
import nord from 'highlight.js/styles/nord.css?raw'
import tokyoNightDark from 'highlight.js/styles/tokyo-night-dark.css?raw'
import agate from 'highlight.js/styles/agate.css?raw'
import irBlack from 'highlight.js/styles/ir-black.css?raw'
import a11yDark from 'highlight.js/styles/a11y-dark.css?raw'
import gradientDark from 'highlight.js/styles/gradient-dark.css?raw'

/** 主题的明暗属性：用于分组展示，也用于「跟随明暗」时的自动挑选 */
export type HighlightThemeKind = 'light' | 'dark'

export interface HighlightTheme {
  id: string
  label: string
  kind: HighlightThemeKind
  /** 主题原始 CSS（highlight.js 官方文件） */
  css: string
}

/** 跟随应用明暗自动挑选（设置项的默认值） */
export const AUTO_THEME_ID = 'auto'

/** 经筛选的 highlight.js 官方主题：覆盖主流风格，浅深各半，体积可控 */
export const HIGHLIGHT_THEMES: readonly HighlightTheme[] = [
  { id: 'github', label: 'GitHub', kind: 'light', css: github },
  { id: 'atom-one-light', label: 'Atom One Light', kind: 'light', css: atomOneLight },
  { id: 'xcode', label: 'Xcode', kind: 'light', css: xcode },
  { id: 'vs', label: 'Visual Studio', kind: 'light', css: vs },
  { id: 'intellij-light', label: 'IntelliJ Light', kind: 'light', css: intellijLight },
  {
    id: 'stackoverflow-light',
    label: 'Stack Overflow Light',
    kind: 'light',
    css: stackoverflowLight
  },
  { id: 'a11y-light', label: 'A11y Light', kind: 'light', css: a11yLight },
  { id: 'googlecode', label: 'Google Code', kind: 'light', css: googlecode },
  { id: 'github-dark', label: 'GitHub Dark', kind: 'dark', css: githubDark },
  { id: 'github-dark-dimmed', label: 'GitHub Dark Dimmed', kind: 'dark', css: githubDarkDimmed },
  { id: 'atom-one-dark', label: 'Atom One Dark', kind: 'dark', css: atomOneDark },
  { id: 'monokai', label: 'Monokai', kind: 'dark', css: monokai },
  { id: 'vs2015', label: 'Visual Studio 2015', kind: 'dark', css: vs2015 },
  { id: 'nord', label: 'Nord', kind: 'dark', css: nord },
  { id: 'tokyo-night-dark', label: 'Tokyo Night', kind: 'dark', css: tokyoNightDark },
  { id: 'agate', label: 'Agate', kind: 'dark', css: agate },
  { id: 'ir-black', label: 'IR Black', kind: 'dark', css: irBlack },
  { id: 'a11y-dark', label: 'A11y Dark', kind: 'dark', css: a11yDark },
  { id: 'gradient-dark', label: 'Gradient Dark', kind: 'dark', css: gradientDark }
]

export const DEFAULT_HIGHLIGHT_THEME = AUTO_THEME_ID

const AUTO_LIGHT_THEME = 'github'
const AUTO_DARK_THEME = 'github-dark'

const BY_ID = new Map(HIGHLIGHT_THEMES.map((t) => [t.id, t]))
const FALLBACK = HIGHLIGHT_THEMES[0]

/**
 * 把设置里的主题 id 解析成实际生效的主题。
 * `auto`（以及空值）按应用明暗挑同色调的主题，避免暗色界面里出现浅色代码块；
 * 未知 id 回落到第一个主题，保证任何情况下都有确定结果。
 */
export function resolveHighlightTheme(
  id: string | undefined | null,
  appTheme: 'light' | 'dark'
): HighlightTheme {
  const auto = appTheme === 'dark' ? AUTO_DARK_THEME : AUTO_LIGHT_THEME
  const wanted = !id || id === AUTO_THEME_ID ? auto : id
  return BY_ID.get(wanted) ?? FALLBACK
}

/** 是否是合法的主题设置值（'auto' 或目录里的 id），用于 IPC 边界校验 */
export function isKnownHighlightTheme(id: string): boolean {
  return id === AUTO_THEME_ID || BY_ID.has(id)
}
