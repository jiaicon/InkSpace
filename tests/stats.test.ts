import { describe, it, expect } from 'vitest'
import { countStats } from '../src/renderer/src/utils/stats'

describe('countStats', () => {
  it('counts CJK chars as words and latin tokens as words', () => {
    const s = countStats('你好 world')
    expect(s.words).toBe(3) // 你好 = 2 字 + world = 1 词
    expect(s.chars).toBe(7) // 你好world = 7 个非空白字符
  })

  it('counts lines', () => {
    expect(countStats('a\nb\nc').lines).toBe(3)
  })

  it('handles empty string as zero stats', () => {
    expect(countStats('')).toEqual({ words: 0, chars: 0, lines: 0 })
  })
})
