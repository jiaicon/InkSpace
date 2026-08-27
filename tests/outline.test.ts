import { describe, expect, it } from 'vitest'
import { parseOutline } from '../src/renderer/src/editor/outline'

describe('parseOutline', () => {
  it('extracts headings with levels and positional ids', () => {
    const md = '# 标题一\n\n正文\n\n## 二级\n\n### 三级\n\n# 标题二\n'
    expect(parseOutline(md)).toEqual([
      { id: 'h-0', level: 1, text: '标题一' },
      { id: 'h-1', level: 2, text: '二级' },
      { id: 'h-2', level: 3, text: '三级' },
      { id: 'h-3', level: 1, text: '标题二' }
    ])
  })

  it('ignores headings inside fenced code blocks', () => {
    const md = '# real\n\n```md\n# not a heading\n```\n'
    expect(parseOutline(md)).toEqual([{ id: 'h-0', level: 1, text: 'real' }])
  })

  it('returns empty for no headings', () => {
    expect(parseOutline('just text')).toEqual([])
  })
})
