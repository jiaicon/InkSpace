import { describe, expect, it } from 'vitest'
import type { BrowserWindow } from 'electron'
import {
  documentWindowCount,
  documentWindows,
  findOtherWindowShowing,
  isEditorOnly,
  markEditorOnly,
  registerDocumentWindow,
  reportOpenFiles
} from '../src/main/modules/window/service'

/**
 * 伪造 BrowserWindow：service 只用到 `webContents.id` 与 `on('closed')`，
 * 所以不需要真的 Electron（这也是把注册表放在 service、把 Electron 相关调用放在 index 的原因）。
 */
function fakeWindow(id: number): { win: BrowserWindow; close: () => void } {
  const handlers: Record<string, (() => void)[]> = {}
  const win = {
    webContents: { id },
    on: (evt: string, cb: () => void) => {
      ;(handlers[evt] ??= []).push(cb)
    }
  } as unknown as BrowserWindow
  return { win, close: () => (handlers['closed'] ?? []).forEach((cb) => cb()) }
}

describe('document window registry', () => {
  it('登记 / 计数 / 列表', () => {
    const base = documentWindowCount()
    const a = fakeWindow(101)
    const b = fakeWindow(102)
    registerDocumentWindow(a.win)
    registerDocumentWindow(b.win)

    expect(documentWindowCount()).toBe(base + 2)
    expect(documentWindows()).toContain(a.win)
    a.close()
    b.close()
    expect(documentWindowCount()).toBe(base)
  })

  it('窗口关闭后从表里移除（不留残留记录）', () => {
    const base = documentWindowCount()
    const a = fakeWindow(201)
    registerDocumentWindow(a.win)
    reportOpenFiles(201, ['D:/notes/a.md'])
    expect(findOtherWindowShowing('D:/notes/a.md', 999)).not.toBeNull()

    a.close()
    expect(documentWindowCount()).toBe(base)
    expect(findOtherWindowShowing('D:/notes/a.md', 999)).toBeNull()
  })
})

describe('findOtherWindowShowing（双开守卫的依据）', () => {
  it('找到打开该文件的**别的**窗口', () => {
    const a = fakeWindow(301)
    const b = fakeWindow(302)
    registerDocumentWindow(a.win)
    registerDocumentWindow(b.win)
    reportOpenFiles(302, ['D:/notes/x.md'])

    expect(findOtherWindowShowing('D:/notes/x.md', 301)).toBe(b.win)
    a.close()
    b.close()
  })

  it('排除请求方自己 —— 否则会「聚焦自己」而永远开不出新窗口', () => {
    const a = fakeWindow(401)
    registerDocumentWindow(a.win)
    reportOpenFiles(401, ['D:/notes/y.md'])

    expect(findOtherWindowShowing('D:/notes/y.md', 401)).toBeNull()
    a.close()
  })

  it('没人打开该文件时返回 null', () => {
    const a = fakeWindow(501)
    registerDocumentWindow(a.win)
    reportOpenFiles(501, ['D:/notes/z.md'])

    expect(findOtherWindowShowing('D:/notes/other.md', 999)).toBeNull()
    a.close()
  })

  it('未登记的窗口上报被忽略（不让表里长出幽灵条目）', () => {
    reportOpenFiles(999_999, ['D:/notes/ghost.md'])
    expect(findOtherWindowShowing('D:/notes/ghost.md', 1)).toBeNull()
  })

  it.skipIf(process.platform !== 'win32')(
    'Windows 下路径大小写不敏感（D:/ vs d:/ 视为同一文件）',
    () => {
      const a = fakeWindow(601)
      registerDocumentWindow(a.win)
      reportOpenFiles(601, ['D:/Notes/Case.md'])

      expect(findOtherWindowShowing('d:/notes/case.md', 999)).toBe(a.win)
      a.close()
    }
  )
})

describe('editor-only 标记（分离窗口）', () => {
  it('默认不是；标记后是；窗口关闭后清掉', () => {
    const a = fakeWindow(701)
    registerDocumentWindow(a.win)
    expect(isEditorOnly(701)).toBe(false)

    markEditorOnly(701)
    expect(isEditorOnly(701)).toBe(true)

    a.close()
    expect(isEditorOnly(701)).toBe(false)
  })
})
