import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, readFile, access, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createFileService } from '../src/main/modules/file/service'

let dir: string
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ms-file-'))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('file service', () => {
  it('write 自动建父目录，read 读回内容', async () => {
    const svc = createFileService()
    const p = join(dir, 'nested', 'a.md')
    await svc.write(p, '# hi')
    expect(await svc.read(p)).toBe('# hi')
  })

  it('rename 成功返回新路径，目标已存在则报错', async () => {
    const svc = createFileService()
    const a = join(dir, 'a.md')
    const b = join(dir, 'b.md')
    await svc.write(a, 'A')
    await svc.write(b, 'B')
    expect(await svc.rename(a, 'c.md')).toBe(join(dir, 'c.md'))
    await expect(svc.rename(b, 'c.md')).rejects.toThrow(/已存在/)
  })

  it('remove 删除文件，read 不存在时报错', async () => {
    const svc = createFileService()
    const p = join(dir, 'x.md')
    await svc.write(p, '')
    await svc.remove(p)
    await expect(svc.read(p)).rejects.toThrow()
    await expect(access(p)).rejects.toThrow()
  })
})
