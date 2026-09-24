import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { inlineLocalImages } from '../src/main/modules/export/images'

// 8 字节的 PNG 文件头，足够验证「读到了文件并按 png 编码」
const PNG = Buffer.from('89504e470d0a1a0a', 'hex')
const PNG_DATA_URI = `data:image/png;base64,${PNG.toString('base64')}`

let dir: string
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ms-export-img-'))
  await mkdir(join(dir, 'assets'), { recursive: true })
  await writeFile(join(dir, 'assets', 'a.png'), PNG)
  await writeFile(join(dir, 'assets', '我 的.png'), PNG)
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('inlineLocalImages', () => {
  it('相对路径图片内嵌为 data URI，其余属性保留', async () => {
    const out = await inlineLocalImages('<p><img src="./assets/a.png" alt="a"></p>', dir)
    expect(out).toContain(`src="${PNG_DATA_URI}"`)
    expect(out).toContain('alt="a"')
  })

  it('URL 编码的路径（含空格）也能解析', async () => {
    const out = await inlineLocalImages('<img src="assets/%E6%88%91%20%E7%9A%84.png">', dir)
    expect(out).toContain(PNG_DATA_URI)
  })

  it('远程地址与 data URI 原样保留', async () => {
    const html =
      '<img src="https://example.com/a.png"><img src="data:image/png;base64,AAA"><img src="//cdn.x/a.png">'
    expect(await inlineLocalImages(html, dir)).toBe(html)
  })

  it('图片文件不存在时保留原路径且不抛错', async () => {
    const html = '<img src="./assets/missing.png">'
    expect(await inlineLocalImages(html, dir)).toBe(html)
  })

  it('未知图片扩展名不做处理', async () => {
    const html = '<img src="./assets/a.xyz">'
    expect(await inlineLocalImages(html, dir)).toBe(html)
  })

  it('baseDir 为 null（文档未保存过）时原样返回', async () => {
    const html = '<img src="./assets/a.png">'
    expect(await inlineLocalImages(html, null)).toBe(html)
  })

  it('多张图片逐个内嵌', async () => {
    const out = await inlineLocalImages(
      '<img src="assets/a.png"><img src="assets/%E6%88%91%20%E7%9A%84.png">',
      dir
    )
    expect(out.match(/data:image\/png;base64,/g)).toHaveLength(2)
  })

  it('非 img 标签上的 src 不受影响', async () => {
    const html = '<video src="./assets/a.png"></video>'
    expect(await inlineLocalImages(html, dir)).toBe(html)
  })

  it('同一张图片多次引用复用同一 data URI', async () => {
    const out = await inlineLocalImages('<img src="assets/a.png"><img src="assets/a.png">', dir)
    expect(out.match(/data:image\/png;base64,/g)).toHaveLength(2)
  })
})
