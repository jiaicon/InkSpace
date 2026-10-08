import { describe, expect, it } from 'vitest'
import { collectTocTargets, type TocBlockLike } from '../src/renderer/src/editor/toc'

const para = (text: string): TocBlockLike => ({
  type: { name: 'paragraph' },
  textContent: text,
  nodeSize: text.length + 2
})
const code = (text: string): TocBlockLike => ({
  type: { name: 'code_block' },
  textContent: text,
  nodeSize: text.length + 2
})

describe('collectTocTargets', () => {
  it('收集根层 [TOC] 段落的位置与长度', () => {
    const blocks = [para('正文'), para('[TOC]'), para('后面')]
    // '正文' nodeSize = 4 → 第二块 pos = 4；'[TOC]' nodeSize = 7 → to = 11
    expect(collectTocTargets(blocks)).toEqual([{ pos: 4, to: 11 }])
  })

  it('大小写与前后空白容错', () => {
    expect(collectTocTargets([para(' [toc] ')])).toEqual([{ pos: 0, to: 9 }])
  })

  it('夹着别的文字不算', () => {
    expect(collectTocTargets([para('见 [TOC] 一节')])).toEqual([])
  })

  it('非段落不算（如代码块里出现 [TOC]）', () => {
    expect(collectTocTargets([code('[TOC]')])).toEqual([])
  })

  it('多个 [TOC] 都收集', () => {
    const blocks = [para('[TOC]'), para('x'), para('[TOC]')]
    // 第一块 nodeSize 7、第二块 3 → 两个占位段分别落在 pos 0 与 10
    expect(collectTocTargets(blocks).map((t) => t.pos)).toEqual([0, 10])
  })
})
