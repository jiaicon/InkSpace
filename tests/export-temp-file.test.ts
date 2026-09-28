import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, open, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { removeTempFile } from '../src/main/modules/export/tempFile'

let dir: string
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ms-temp-'))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('removeTempFile（重试逻辑，注入删除实现以保证确定性）', () => {
  it('首次就成功时不重试', async () => {
    let calls = 0
    const ok = await removeTempFile('x', 5, 1, async () => {
      calls++
    })
    expect(ok).toBe(true)
    expect(calls).toBe(1)
  })

  it('删除失败会重试，成功后返回 true', async () => {
    let calls = 0
    const ok = await removeTempFile('x', 5, 1, async () => {
      calls++
      if (calls < 3) throw new Error('EBUSY')
    })
    expect(ok).toBe(true)
    expect(calls).toBe(3)
  })

  it('一直失败也不抛错，重试满次数后返回 false', async () => {
    let calls = 0
    const ok = await removeTempFile('x', 4, 1, async () => {
      calls++
      throw Object.assign(new Error('ENOTEMPTY: directory not empty'), { code: 'ENOTEMPTY' })
    })
    // 关键：收尾失败只是返回 false，绝不向上抛——否则会覆盖掉已成功的导出结果
    expect(ok).toBe(false)
    expect(calls).toBe(4)
  })
})

describe('removeTempFile（真实文件系统）', () => {
  it('删除已存在的文件并返回 true', async () => {
    const file = join(dir, 'a.html')
    await writeFile(file, 'x')
    expect(await removeTempFile(file)).toBe(true)
    await expect(access(file)).rejects.toThrow()
  })

  it('文件不存在时也不抛错（force 语义）', async () => {
    expect(await removeTempFile(join(dir, 'nope.html'))).toBe(true)
  })

  it('删除后内容确实不可再读（防止只删了个空壳）', async () => {
    const file = join(dir, 'b.html')
    await writeFile(file, 'content')
    expect(await readFile(file, 'utf8')).toBe('content')
    await removeTempFile(file)
    await expect(readFile(file, 'utf8')).rejects.toThrow()
  })

  it('文件被占用时不抛错（句柄释放后仍可正常删除）', async () => {
    const file = join(dir, 'locked.html')
    await writeFile(file, 'x')
    const handle = await open(file, 'r')
    try {
      // 只断言「没有抛异常」，不依赖平台对「删除被占用文件」的具体行为
      expect(typeof (await removeTempFile(file, 2, 1))).toBe('boolean')
    } finally {
      await handle.close()
    }
    expect(await removeTempFile(file)).toBe(true)
  })
})
