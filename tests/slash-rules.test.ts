import { describe, expect, it } from 'vitest'
import { canOpenSlashMenu, escapeTarget } from '../src/renderer/src/editor/slashRules'

describe('canOpenSlashMenu', () => {
  it('段落起始可呼出（列表项内也是段落，所以列表里也能呼出）', () => {
    expect(canOpenSlashMenu('paragraph', 0)).toBe(true)
  })

  it('标题起始也可呼出 —— 否则「正文」在标题里够不着', () => {
    expect(canOpenSlashMenu('heading', 0)).toBe(true)
  })

  it('不在块起始处不呼出', () => {
    expect(canOpenSlashMenu('paragraph', 3)).toBe(false)
    expect(canOpenSlashMenu('heading', 1)).toBe(false)
  })

  it('其它块类型不呼出', () => {
    expect(canOpenSlashMenu('code_block', 0)).toBe(false)
    expect(canOpenSlashMenu('doc', 0)).toBe(false)
  })
})

describe('escapeTarget', () => {
  it('在列表里 → 先脱出列表（哪怕外层还套着引用）', () => {
    expect(escapeTarget(['doc', 'bullet_list', 'list_item', 'paragraph'])).toBe('list')
    expect(escapeTarget(['doc', 'ordered_list', 'list_item', 'paragraph'])).toBe('list')
    expect(escapeTarget(['doc', 'blockquote', 'bullet_list', 'list_item', 'paragraph'])).toBe(
      'list'
    )
  })

  it('在引用里 → 拆掉引用', () => {
    expect(escapeTarget(['doc', 'blockquote', 'paragraph'])).toBe('quote')
  })

  it('标题或普通段落 → 设为段落', () => {
    expect(escapeTarget(['doc', 'heading'])).toBe('paragraph')
    expect(escapeTarget(['doc', 'paragraph'])).toBe('paragraph')
  })
})
