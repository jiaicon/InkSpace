import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildImageRelPath,
  docStem,
  formatStamp,
  imageMime,
  isAllowedImagePath,
  planImagePlacement
} from '../src/main/modules/file/assets'
import { createFileService } from '../src/main/modules/file/service'

let dir: string
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ms-asset-'))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('formatStamp', () => {
  it('按本地时间格式化为 yyyyMMddHHmmss', () => {
    expect(formatStamp(new Date(2026, 8, 24, 9, 5, 3))).toBe('20260924090503')
  })

  it('个位数月日时分秒补零', () => {
    expect(formatStamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102030405')
  })
})

describe('buildImageRelPath', () => {
  it('生成 assets 下的相对路径，用正斜杠便于写进 markdown', () => {
    expect(buildImageRelPath('png', '20260924120500', 'a1b2')).toBe(
      './assets/image-20260924120500-a1b2.png'
    )
  })

  it('支持自定义子目录名', () => {
    expect(buildImageRelPath('png', '20260924120500', 'a1b2', 'img')).toBe(
      './img/image-20260924120500-a1b2.png'
    )
  })
})

describe('docStem', () => {
  it('取不含扩展名的文件名', () => {
    expect(docStem('D:\\notes\\我的笔记.md')).toBe('我的笔记')
  })

  it('清掉文件名非法字符', () => {
    expect(docStem('D:\\notes\\a?b*c.md')).toBe('a_b_c')
  })

  it('空名回落到 doc', () => {
    expect(docStem('D:\\notes\\   .md')).toBe('doc')
  })
})

describe('isAllowedImagePath / imageMime', () => {
  it('识别白名单内的图片扩展名（大小写不敏感）', () => {
    expect(isAllowedImagePath('C:\\a\\p.PNG')).toBe(true)
    expect(isAllowedImagePath('/a/b/q.JpEg')).toBe(true)
  })

  it('非图片或没有扩展名时拒绝', () => {
    expect(isAllowedImagePath('/a/b.txt')).toBe(false)
    expect(isAllowedImagePath('/a/README')).toBe(false)
    expect(isAllowedImagePath('')).toBe(false)
  })

  it('imageMime 是 ms-file 协议的放行闸门', () => {
    expect(imageMime('/a/p.PNG')).toBe('image/png')
    expect(imageMime('C:\\a\\q.JPEG')).toBe('image/jpeg')
    expect(imageMime('/a/b.md')).toBeNull()
    expect(imageMime('/a/noext')).toBeNull()
  })
})

describe('planImagePlacement', () => {
  const base = { ext: 'png', stamp: '20260924120500', rand: 'a1b2' }

  it('统一目录：写入 imageDir，markdown 引用为绝对路径且用正斜杠', () => {
    const p = planImagePlacement({
      ...base,
      docPath: 'D:\\notes\\我的笔记.md',
      settings: { imageStorage: 'unified', imageDir: 'D:/图库', imageSubdir: 'assets' }
    })
    expect(p.refPath).toBe('D:/图库/我的笔记-20260924120500-a1b2.png')
    expect(p.absPath).toBe(join('D:/图库', '我的笔记-20260924120500-a1b2.png'))
  })

  it('随文档：写入文档旁的子目录，markdown 引用为相对路径', () => {
    const p = planImagePlacement({
      ...base,
      docPath: 'D:\\notes\\a.md',
      settings: { imageStorage: 'relative', imageDir: 'D:/图库', imageSubdir: 'assets' }
    })
    expect(p.refPath).toBe('./assets/image-20260924120500-a1b2.png')
    expect(p.absPath).toBe(join('D:/notes', 'assets', 'image-20260924120500-a1b2.png'))
  })

  it('随文档模式支持自定义子目录名', () => {
    const p = planImagePlacement({
      ...base,
      docPath: 'D:\\notes\\a.md',
      settings: { imageStorage: 'relative', imageDir: 'D:/图库', imageSubdir: 'img' }
    })
    expect(p.refPath).toBe('./img/image-20260924120500-a1b2.png')
    expect(p.absPath).toBe(join('D:/notes', 'img', 'image-20260924120500-a1b2.png'))
  })
})

describe('fileService.saveImage', () => {
  const bytes = new Uint8Array([137, 80, 78, 71])

  it('写入指定绝对路径，并自动建出多级父目录', async () => {
    const svc = createFileService()
    const target = join(dir, 'deep', 'assets', 'a.png')
    await svc.saveImage(target, bytes)
    expect([...(await readFile(target))]).toEqual([...bytes])
  })

  it('覆盖同一路径时不报错', async () => {
    const svc = createFileService()
    const target = join(dir, 'b.png')
    await svc.saveImage(target, bytes)
    await svc.saveImage(target, bytes)
    expect([...(await readFile(target))]).toEqual([...bytes])
  })
})
