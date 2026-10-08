import { describe, expect, it } from 'vitest'
import { extractImagePaths } from '../src/renderer/src/utils/clipboard'
import { isImagePath } from '../src/renderer/src/utils/drop'

describe('isImagePath', () => {
  it('按扩展名判定图片（大小写不敏感）', () => {
    expect(isImagePath('C:\\a\\b.PNG')).toBe(true)
    expect(isImagePath('/a/b.jpeg')).toBe(true)
    expect(isImagePath('a.svg')).toBe(true)
  })

  it('非图片返回 false', () => {
    expect(isImagePath('/a/b.txt')).toBe(false)
    expect(isImagePath('/a/README')).toBe(false)
  })
})

describe('extractImagePaths', () => {
  it('识别 Windows 与 POSIX 绝对路径', () => {
    expect(extractImagePaths('C:\\Users\\me\\Desktop\\a.png')).toEqual([
      'C:\\Users\\me\\Desktop\\a.png'
    ])
    expect(extractImagePaths('/home/me/a.jpg')).toEqual(['/home/me/a.jpg'])
  })

  it('识别 file:// URI 并去掉盘符前的斜杠', () => {
    expect(extractImagePaths('file:///C:/Users/me/a.png')).toEqual(['C:/Users/me/a.png'])
  })

  it('file:// URI 里的百分号转义会还原', () => {
    expect(extractImagePaths('file:///C:/Users/me/%E6%88%91%20的.png')).toEqual([
      'C:/Users/me/我 的.png'
    ])
  })

  it('忽略网络地址（粘贴网页图片地址不该被当成文件）', () => {
    expect(extractImagePaths('https://example.com/a.png')).toEqual([])
    expect(extractImagePaths('http://example.com/a.png')).toEqual([])
  })

  it('忽略非图片路径', () => {
    expect(extractImagePaths('C:\\Users\\me\\note.txt')).toEqual([])
    expect(extractImagePaths('C:\\Users\\me\\folder')).toEqual([])
  })

  it('忽略 uri-list 的注释行与空行', () => {
    const text = '# comment\n\nC:\\a\\b.png\n   \n'
    expect(extractImagePaths(text)).toEqual(['C:\\a\\b.png'])
  })

  it('多行（一次复制多个文件）全部提取，并按行去重', () => {
    const text = 'C:\\a\\1.png\nC:\\a\\2.jpg\nC:\\a\\1.png'
    expect(extractImagePaths(text)).toEqual(['C:\\a\\1.png', 'C:\\a\\2.jpg'])
  })

  it('纯文本（不是路径）不产生任何结果', () => {
    expect(extractImagePaths('这是一段普通文字，里面提到 a.png')).toEqual([])
    expect(extractImagePaths('a.png')).toEqual([])
    expect(extractImagePaths('./assets/a.png')).toEqual([])
  })

  it('UNC 网络路径也识别', () => {
    expect(extractImagePaths('\\\\server\\share\\a.png')).toEqual(['\\\\server\\share\\a.png'])
  })

  it('空串不报错', () => {
    expect(extractImagePaths('')).toEqual([])
  })

  it('末尾空白会被去掉', () => {
    expect(extractImagePaths('  C:\\a\\b.png  ')).toEqual(['C:\\a\\b.png'])
  })
})
