import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  clipLine,
  findMatches,
  flattenTree,
  searchInWorkspace
} from '../src/main/modules/workspace/search'
import type { FileTreeNode } from '../src/shared/types'

describe('clipLine', () => {
  it('短行原样返回，列号不变', () => {
    expect(clipLine('hello world', 6, 5)).toEqual({ text: 'hello world', column: 6 })
  })

  it('长行以命中为中心裁剪，两侧加省略号并校正列号', () => {
    const line = 'a'.repeat(100) + 'TARGET' + 'b'.repeat(100)
    const { text, column } = clipLine(line, 100, 6, 10)
    expect(text).toBe('…' + 'a'.repeat(10) + 'TARGET' + 'b'.repeat(10) + '…')
    expect(text.slice(column, column + 6)).toBe('TARGET')
  })

  it('只有右侧被裁时列号不变（仅前缀占一位）', () => {
    const line = 'TARGET' + 'b'.repeat(100)
    const { text, column } = clipLine(line, 0, 6, 10)
    expect(text.startsWith('TARGET')).toBe(true)
    expect(text.slice(column, column + 6)).toBe('TARGET')
  })
})

describe('findMatches', () => {
  it('逐行找出全部命中，行号从 1 起', () => {
    const found = findMatches('foo\nbar foo\nbaz', 'foo')
    expect(found.map((m) => m.line)).toEqual([1, 2])
    expect(found[1].column).toBe(4)
  })

  it('同一行多次出现都算命中', () => {
    expect(findMatches('a a a', 'a')).toHaveLength(3)
  })

  it('默认忽略大小写，可切换为区分', () => {
    expect(findMatches('Foo foo', 'foo')).toHaveLength(2)
    expect(findMatches('Foo foo', 'foo', true)).toHaveLength(1)
  })

  it('没有命中返回空数组', () => {
    expect(findMatches('abc', 'zzz')).toEqual([])
  })

  it('空查询不匹配任何内容（避免无限循环）', () => {
    expect(findMatches('abc', '')).toEqual([])
  })

  it('跨行文本按 CRLF 也能正确分行', () => {
    const found = findMatches('a\r\nb\r\nc', 'c')
    expect(found[0].line).toBe(3)
  })
})

describe('flattenTree', () => {
  it('把目录树摊平成文件路径列表，顺序稳定', () => {
    const tree: FileTreeNode[] = [
      {
        name: 'dir',
        path: '/r/dir',
        type: 'directory',
        children: [{ name: 'a.md', path: '/r/dir/a.md', type: 'file' }]
      },
      { name: 'b.md', path: '/r/b.md', type: 'file' }
    ]
    expect(flattenTree(tree)).toEqual(['/r/dir/a.md', '/r/b.md'])
  })
})

describe('searchInWorkspace', () => {
  let root: string
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'ms-search-'))
    await mkdir(join(root, 'sub'), { recursive: true })
    await mkdir(join(root, '.hidden'), { recursive: true })
    await mkdir(join(root, 'node_modules'), { recursive: true })
    await writeFile(join(root, 'a.md'), '# 标题\n\n这里有 KEY 一次\n还有 key 一次\n', 'utf8')
    await writeFile(join(root, 'sub', 'b.md'), 'sub 里的 KEY\n', 'utf8')
    await writeFile(join(root, 'note.txt'), 'KEY 不该被搜到\n', 'utf8')
    await writeFile(join(root, '.hidden', 'h.md'), 'KEY 不该被搜到\n', 'utf8')
    await writeFile(join(root, 'node_modules', 'n.md'), 'KEY 不该被搜到\n', 'utf8')
  })
  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('跨文件搜索并按文件分组', async () => {
    const res = await searchInWorkspace(root, 'KEY')
    expect(res.files.map((f) => f.name).sort()).toEqual(['a.md', 'b.md'])
    expect(res.totalMatches).toBe(3)
    expect(res.truncated).toBe(false)
  })

  it('结果里带行号与上下文', async () => {
    const res = await searchInWorkspace(root, 'KEY')
    const a = res.files.find((f) => f.name === 'a.md')!
    expect(a.matches.map((m) => m.line)).toEqual([3, 4])
    expect(a.matches[0].text.slice(a.matches[0].column, a.matches[0].column + 3)).toBe('KEY')
  })

  it('忽略大小写可选', async () => {
    const sensitive = await searchInWorkspace(root, 'KEY', { caseSensitive: true })
    expect(sensitive.totalMatches).toBe(2) // a.md 的第 3 行 + b.md
  })

  it('不搜非 markdown、隐藏目录与 node_modules', async () => {
    const res = await searchInWorkspace(root, 'KEY')
    expect(res.files.some((f) => f.name.endsWith('.txt'))).toBe(false)
    expect(res.files.some((f) => f.path.includes('node_modules'))).toBe(false)
    expect(res.files.some((f) => f.path.includes('.hidden'))).toBe(false)
  })

  it('超过上限时截断并标记', async () => {
    const res = await searchInWorkspace(root, 'KEY', { maxMatches: 2 })
    expect(res.totalMatches).toBe(2)
    expect(res.truncated).toBe(true)
  })

  it('空查询直接返回空结果', async () => {
    expect(await searchInWorkspace(root, '   ')).toEqual({
      files: [],
      totalMatches: 0,
      truncated: false
    })
  })

  it('根目录不存在时不抛错，返回空结果', async () => {
    const res = await searchInWorkspace(join(root, 'no-such-dir'), 'KEY')
    expect(res).toEqual({ files: [], totalMatches: 0, truncated: false })
  })
})
