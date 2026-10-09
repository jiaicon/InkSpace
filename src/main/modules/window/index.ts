import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { handleWithSender } from '../../ipc/util'
import { documentWindows, findOtherWindowShowing, reportOpenFiles } from './service'

export interface WindowIpcDeps {
  /** 新建一个文档窗口并让它打开该文件（由 main/index.ts 提供，窗口生命周期归它管） */
  openDocumentWindow(path: string): void
}

/**
 * 「文件该交给哪个窗口」：优先当前聚焦的文档窗口，否则第一个。
 * 不要用 `BrowserWindow.getAllWindows()[0]` —— 那里面混着 mermaid/导出的隐藏窗口。
 */
export function focusedOrFirstDocumentWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow()
  const windows = documentWindows()
  if (focused && windows.includes(focused)) return focused
  return windows[0] ?? null
}

/** 注册 window 模块的 IPC handler（多窗口：在新窗口打开、上报已打开文件） */
export function registerWindowIpc(deps: WindowIpcDeps): void {
  handleWithSender(IPC.windowOpenWithPath, (senderId, path) => {
    const target = String(path)
    // 双开守卫：该文件已在**别的**文档窗口里打开，就聚焦那个窗口而不是开第二个 ——
    // 两个窗口各自全量回写同一文件会互相覆盖、静默丢数据（详见 docs/TODO.md）
    const existing = findOtherWindowShowing(target, senderId)
    if (existing) {
      if (existing.isMinimized()) existing.restore()
      existing.focus()
      return { focusedExisting: true }
    }
    deps.openDocumentWindow(target)
    return { focusedExisting: false }
  })

  handleWithSender(IPC.windowReportOpenFiles, (senderId, paths) => {
    reportOpenFiles(senderId, Array.isArray(paths) ? (paths as string[]) : [])
  })
}
