import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { handleWithSender } from '../../ipc/util'
import { takePendingOpenPath } from '../file/external'
import { documentWindows, findOtherWindowShowing, isEditorOnly, reportOpenFiles } from './service'

export interface DocumentWindowOptions {
  /** 启动后要打开的文件 */
  initialPath?: string
  /** 只渲染编辑器（无左侧文件区）—— 分离出去的窗口用 */
  editorOnly?: boolean
}

export interface WindowIpcDeps {
  /** 新建一个文档窗口（窗口生命周期归 main/index.ts，所以由它注入） */
  openDocumentWindow(opts: DocumentWindowOptions): void
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

function bringToFront(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.focus()
}

/** 注册 window 模块的 IPC handler（多窗口） */
export function registerWindowIpc(deps: WindowIpcDeps): void {
  // 窗口启动时**拉取**自己的配置。用拉取而不是推送：推送会跟渲染进程挂载抢时间
  //（监听器还没注册就发出去了，文件打不开）。
  handleWithSender(IPC.windowBootstrap, (senderId) => ({
    initialPath: takePendingOpenPath(senderId),
    editorOnly: isEditorOnly(senderId)
  }))

  // 把文档**移**到新窗口。本窗口的 tab 由渲染进程负责关掉 ——
  // 它会先把未落盘的编辑 flush 下去，再发这条请求，否则新窗口会从磁盘读到旧内容。
  handleWithSender(IPC.windowMoveToNewWindow, (senderId, path) => {
    const target = String(path)
    const existing = findOtherWindowShowing(target, senderId)
    if (existing) {
      bringToFront(existing)
      return { moved: false, focusedExisting: true }
    }
    deps.openDocumentWindow({ initialPath: target, editorOnly: true })
    return { moved: true, focusedExisting: false }
  })

  // 「一个文件只在一个窗口打开」：打开前先问一句，已在别处就把那个窗口拿到前面、本窗口不再开 tab
  handleWithSender(IPC.windowClaimFile, (senderId, path) => {
    const existing = findOtherWindowShowing(String(path), senderId)
    if (existing) {
      bringToFront(existing)
      return { claimedElsewhere: true }
    }
    return { claimedElsewhere: false }
  })

  handleWithSender(IPC.windowReportOpenFiles, (senderId, paths) => {
    reportOpenFiles(senderId, Array.isArray(paths) ? (paths as string[]) : [])
  })
}
