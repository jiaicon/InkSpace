import { describe, expect, it } from 'vitest'
import { titleFromPath, dirname } from '../src/renderer/src/utils/path'

describe('path utils', () => {
  it('titleFromPath 取文件名并去 .md', () => {
    expect(titleFromPath('D:/docs/a.md')).toBe('a')
    expect(titleFromPath('C:\\blog\\01.md')).toBe('01')
    expect(titleFromPath('D:/docs/README')).toBe('README')
  })

  it('dirname 取父目录（兼容 / 与 \\）', () => {
    expect(dirname('D:/docs/a.md')).toBe('D:/docs')
    expect(dirname('C:\\blog\\01.md')).toBe('C:\\blog')
    expect(dirname('root.md')).toBe('')
  })
})
