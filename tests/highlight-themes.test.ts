import { describe, expect, it } from 'vitest'
import {
  AUTO_THEME_ID,
  HIGHLIGHT_THEMES,
  resolveHighlightTheme
} from '../src/shared/highlightThemes'

describe('highlightThemes 目录', () => {
  it('主题 id 唯一', () => {
    const ids = HIGHLIGHT_THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每款主题都带非空 CSS，且含 .hljs 规则（说明 ?raw 导入真的取到了内容）', () => {
    for (const theme of HIGHLIGHT_THEMES) {
      expect(theme.css.length, theme.id).toBeGreaterThan(100)
      expect(theme.css, theme.id).toContain('.hljs')
    }
  })

  it('浅色与深色都有可选主题，且数量可观', () => {
    expect(HIGHLIGHT_THEMES.filter((t) => t.kind === 'light').length).toBeGreaterThanOrEqual(5)
    expect(HIGHLIGHT_THEMES.filter((t) => t.kind === 'dark').length).toBeGreaterThanOrEqual(5)
  })
})

describe('resolveHighlightTheme', () => {
  it('auto 跟随应用明暗：浅色配浅色主题、暗色配深色主题', () => {
    expect(resolveHighlightTheme(AUTO_THEME_ID, 'light').kind).toBe('light')
    expect(resolveHighlightTheme(AUTO_THEME_ID, 'dark').kind).toBe('dark')
  })

  it('显式选择的主题优先于 auto（浅色界面也能用深色代码主题）', () => {
    expect(resolveHighlightTheme('monokai', 'light').id).toBe('monokai')
    expect(resolveHighlightTheme('github', 'dark').id).toBe('github')
  })

  it('未知 / 空 / undefined 都有确定回落，不会返回 undefined', () => {
    expect(resolveHighlightTheme('no-such-theme', 'light')).toBeDefined()
    expect(resolveHighlightTheme(undefined, 'dark').kind).toBe('dark')
    expect(resolveHighlightTheme('', 'light')).toBeDefined()
    expect(resolveHighlightTheme(null, 'light')).toBeDefined()
  })

  it('auto 选出的主题确实在目录里（避免常量与目录脱节）', () => {
    for (const appTheme of ['light', 'dark'] as const) {
      const picked = resolveHighlightTheme(AUTO_THEME_ID, appTheme)
      expect(HIGHLIGHT_THEMES.some((t) => t.id === picked.id)).toBe(true)
    }
  })
})
