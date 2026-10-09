import { describe, expect, it } from 'vitest'
import {
  AUTO_MERMAID_THEME,
  MERMAID_THEMES,
  isKnownMermaidTheme,
  resolveMermaidTheme
} from '../src/shared/mermaidThemes'

describe('resolveMermaidTheme', () => {
  it('auto / 空值跟随界面明暗（暗色下必须给 dark，否则线条看不见）', () => {
    expect(resolveMermaidTheme(AUTO_MERMAID_THEME, 'light')).toBe('default')
    expect(resolveMermaidTheme(AUTO_MERMAID_THEME, 'dark')).toBe('dark')
    expect(resolveMermaidTheme(undefined, 'dark')).toBe('dark')
    expect(resolveMermaidTheme('', 'light')).toBe('default')
  })

  it('显式选的主题直接用，不跟随明暗', () => {
    expect(resolveMermaidTheme('forest', 'dark')).toBe('forest')
    expect(resolveMermaidTheme('base', 'light')).toBe('base')
  })

  it('未知值回落 default（保证任何情况下都有确定结果）', () => {
    expect(resolveMermaidTheme('no-such', 'light')).toBe('default')
    expect(resolveMermaidTheme('no-such', 'dark')).toBe('default')
  })
})

describe('isKnownMermaidTheme', () => {
  it('接受 auto 与全部内置主题 id', () => {
    expect(isKnownMermaidTheme(AUTO_MERMAID_THEME)).toBe(true)
    for (const t of MERMAID_THEMES) expect(isKnownMermaidTheme(t.id), t.id).toBe(true)
  })

  it('拒绝其它值（IPC 边界靠它挡下脏数据）', () => {
    expect(isKnownMermaidTheme('no-such')).toBe(false)
    expect(isKnownMermaidTheme('')).toBe(false)
  })
})
