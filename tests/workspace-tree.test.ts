import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildFileTree } from '../src/main/modules/workspace/tree'

let dir: string
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ms-tree-'))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('buildFileTree', () => {
  it('只返回目录与 *.md，目录在前，跳过隐藏项与非 md', async () => {
    await mkdir(join(dir, 'docs'))
    await mkdir(join(dir, 'docs', 'sub'))
    await mkdir(join(dir, '.git'))
    await writeFile(join(dir, 'a.md'), '')
    await writeFile(join(dir, 'b.txt'), '')
    await writeFile(join(dir, '.hidden.md'), '')
    await writeFile(join(dir, 'docs', 'c.md'), '')
    await writeFile(join(dir, 'docs', 'd.png'), '')
    await writeFile(join(dir, '.git', 'HEAD'), '')

    const tree = await buildFileTree(dir)

    expect(tree.map((n) => n.name)).toEqual(['docs', 'a.md'])
    expect(tree[0].type).toBe('directory')
    expect(tree[0].children!.map((n) => n.name)).toEqual(['sub', 'c.md'])
    expect(tree[0].children![0].children).toEqual([])
  })
})
