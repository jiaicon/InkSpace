import { describe, expect, it } from 'vitest'
import { classifyDroppedPaths } from '../src/renderer/src/utils/drop'
import { extFromImageFile, buildImageSrc } from '../src/renderer/src/utils/image'

describe('classifyDroppedPaths', () => {
  it('全是 markdown 时归入 markdown', () => {
    const r = classifyDroppedPaths(['C:\\a\\x.md', 'C:\\a\\y.MARKDOWN'])
    expect(r.markdown).toHaveLength(2)
    expect(r.images).toHaveLength(0)
    expect(r.unsupported).toHaveLength(0)
  })

  it('全是图片时归入 images', () => {
    const r = classifyDroppedPaths(['C:\\a\\p.png', 'C:\\a\\q.JPEG', 'C:\\a\\r.svg'])
    expect(r.images).toHaveLength(3)
    expect(r.markdown).toHaveLength(0)
  })

  it('markdown 与图片混合时各归各的', () => {
    const r = classifyDroppedPaths(['C:\\a\\x.md', 'C:\\a\\p.png'])
    expect(r.markdown).toEqual(['C:\\a\\x.md'])
    expect(r.images).toEqual(['C:\\a\\p.png'])
  })

  it('不支持的类型落入 unsupported', () => {
    const r = classifyDroppedPaths(['C:\\a\\n.txt', 'C:\\a\\b.pdf'])
    expect(r.unsupported).toHaveLength(2)
    expect(r.markdown).toHaveLength(0)
    expect(r.images).toHaveLength(0)
  })

  it('忽略空路径与无扩展名路径', () => {
    const r = classifyDroppedPaths(['', 'C:\\a\\README'])
    expect(r.unsupported).toHaveLength(2)
  })

  it('空数组返回三个空列表', () => {
    expect(classifyDroppedPaths([])).toEqual({ markdown: [], images: [], unsupported: [] })
  })
})

describe('extFromImageFile', () => {
  it('优先用文件名的扩展名', () => {
    expect(extFromImageFile('photo.JPEG', 'image/jpeg')).toBe('jpg')
    expect(extFromImageFile('a.png', 'image/png')).toBe('png')
  })

  it('文件名没有扩展名（截图粘贴常为 image.png 或空名）时回落到 MIME', () => {
    expect(extFromImageFile('', 'image/png')).toBe('png')
    expect(extFromImageFile('blob', 'image/webp')).toBe('webp')
  })

  it('jpg 与 jpeg 归一为 jpg', () => {
    expect(extFromImageFile('a.jpeg', '')).toBe('jpg')
  })

  it('既无扩展名也无可用 MIME 时返回 null', () => {
    expect(extFromImageFile('blob', 'application/octet-stream')).toBeNull()
    expect(extFromImageFile('blob', '')).toBeNull()
  })
})

describe('buildImageSrc', () => {
  it('相对路径按文档目录解析为 ms-file URL', () => {
    const src = buildImageSrc('./assets/a.png', 'D:\\notes')
    expect(src).toBe(
      'ms-file://local/?dir=' +
        encodeURIComponent('D:\\notes') +
        '&p=' +
        encodeURIComponent('./assets/a.png')
    )
  })

  it('http/https/data/blob 等原样保留', () => {
    for (const raw of [
      'https://x.com/a.png',
      'http://x/a.png',
      'data:image/png;base64,AA',
      'blob:x'
    ]) {
      expect(buildImageSrc(raw, 'D:\\notes')).toBe(raw)
    }
  })

  it('已经是 ms-file URL 时不重复包装', () => {
    const u = 'ms-file://local/?dir=x&p=y'
    expect(buildImageSrc(u, 'D:\\notes')).toBe(u)
  })

  it('文档未保存过（无目录）时原样返回相对路径', () => {
    expect(buildImageSrc('./assets/a.png', null)).toBe('./assets/a.png')
  })

  it('空 src 原样返回', () => {
    expect(buildImageSrc('', 'D:\\notes')).toBe('')
  })
})
