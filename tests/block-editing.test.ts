import { describe, expect, it } from 'vitest'
import { isBlockBeingEdited } from '../src/renderer/src/editor/blockEditing'

describe('isBlockBeingEdited', () => {
  const inside = { from: 3, to: 3 }

  it('有焦点且选区在块内 → 是', () => {
    expect(isBlockBeingEdited(true, inside, 0, 10)).toBe(true)
  })

  it('没有焦点时不算编辑', () => {
    // 打开文档时选区默认落在第一个块里；若只看选区，首块是 [TOC] / callout 的文档
    // 一打开就会显示源码层，看不到渲染结果
    expect(isBlockBeingEdited(false, inside, 0, 10)).toBe(false)
  })

  it('选区在块外 → 不是', () => {
    expect(isBlockBeingEdited(true, { from: 12, to: 12 }, 0, 10)).toBe(false)
  })

  it('选区横跨块边界（选中了别处）→ 不是', () => {
    expect(isBlockBeingEdited(true, { from: 2, to: 30 }, 0, 10)).toBe(false)
  })
})
